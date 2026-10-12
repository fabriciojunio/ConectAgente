-- ===========================================================================
-- ConectAgente, fecha as tabelas que ficaram sem Row Level Security
-- ===========================================================================
--
-- POR QUE ESTA MIGRACAO EXISTE
--
-- Auditoria do schema encontrou 7 das 14 tabelas sem RLS nenhum:
--
--   agentes                  CPF e senha_hash de todo agente
--   prontuario_saude         peso, pressao, glicemia, alergias
--   prontuario_gestante      dados de gestacao
--   prontuario_puericultura  dados de crianca
--   prontuario_mulher        saude da mulher
--   prontuario_social        dados socioeconomicos
--   audit_log                a propria trilha de auditoria
--
-- A chave anon do Supabase e publica por desenho: quem protege o dado e o RLS.
-- Sem RLS, essas sete tabelas ficam legiveis e gravaveis por qualquer pessoa
-- que tenha a chave. Os cinco prontuario_* guardam dado de saude, que a LGPD
-- classifica como dado pessoal SENSIVEL (art. 5, II), com protecao reforcada.
--
-- A ARMADILHA QUE ESTA MIGRACAO PRECISA DESVIAR
--
-- As policies ja existentes (prontuarios, moradores, visitas...) consultam a
-- tabela `agentes` de dentro da propria policy, para descobrir o papel de quem
-- esta chamando. Isso hoje funciona justamente PORQUE `agentes` nao tem RLS.
--
-- Ligar RLS em `agentes` sem mais nada quebraria todas elas: a policy tentaria
-- ler `agentes`, o RLS de `agentes` se aplicaria, e a consulta voltaria vazia.
-- Em alguns casos o Postgres detecta recursao e aborta.
--
-- A saida e o padrao recomendado pelo Supabase: funcoes SECURITY DEFINER com
-- search_path travado. Elas rodam com o dono da funcao e enxergam `agentes`
-- sem passar pelo RLS, o que quebra o ciclo. O search_path fixo impede que
-- alguem crie um schema no caminho e sequestre a resolucao dos nomes, que e o
-- ataque classico contra SECURITY DEFINER.
--
-- A migracao e idempotente: pode rodar de novo sem quebrar.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Funcoes auxiliares
-- ---------------------------------------------------------------------------
-- Centralizam a regra de acesso em um lugar so. Sem elas, a mesma condicao de
-- quatro linhas precisaria ser repetida em 20 policies (5 tabelas x 4
-- operacoes), e bastaria uma copia divergir para abrir um buraco silencioso.

CREATE OR REPLACE FUNCTION public.agente_papel()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.agentes WHERE id = auth.uid()
$$;

COMMENT ON FUNCTION public.agente_papel() IS
  'Papel do usuario autenticado. SECURITY DEFINER para nao recursar no RLS de agentes.';

CREATE OR REPLACE FUNCTION public.agente_unidade()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT unidade_saude FROM public.agentes WHERE id = auth.uid()
$$;

COMMENT ON FUNCTION public.agente_unidade() IS
  'Unidade de saude do usuario autenticado.';

-- Leitura de prontuario: espelha exatamente a policy prontuarios_select.
CREATE OR REPLACE FUNCTION public.pode_ler_prontuario(p_prontuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prontuarios p
    JOIN public.moradores m ON m.id = p.morador_id
    WHERE p.id = p_prontuario_id AND (
      public.agente_papel() IN ('gerente', 'admin')
      OR (public.agente_papel() = 'coordenador' AND public.agente_unidade() = (
            SELECT a2.unidade_saude FROM public.agentes a2 WHERE a2.id = m.agente_id
          ))
      OR (public.agente_papel() = 'agente' AND m.agente_id = auth.uid())
    )
  )
$$;

-- Criacao: espelha prontuarios_insert, que so permite ao agente dono do morador.
CREATE OR REPLACE FUNCTION public.pode_criar_prontuario(p_prontuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prontuarios p
    JOIN public.moradores m ON m.id = p.morador_id
    WHERE p.id = p_prontuario_id AND m.agente_id = auth.uid()
  )
$$;

-- Alteracao: espelha prontuarios_update (gerente/admin, ou o agente dono).
CREATE OR REPLACE FUNCTION public.pode_alterar_prontuario(p_prontuario_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.prontuarios p
    JOIN public.moradores m ON m.id = p.morador_id
    WHERE p.id = p_prontuario_id AND (
      public.agente_papel() IN ('gerente', 'admin')
      OR (public.agente_papel() = 'agente' AND m.agente_id = auth.uid())
    )
  )
$$;

-- Exclusao: espelha prontuarios_delete (so gerente e admin).
CREATE OR REPLACE FUNCTION public.pode_excluir_prontuario()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.agente_papel() IN ('gerente', 'admin')
$$;

-- PERMISSAO DE EXECUCAO: anon TAMBEM precisa poder chamar.
--
-- A tentacao e revogar de anon "por seguranca". Testamos, e isso QUEBRA o
-- aplicativo: a tela publica de solicitacao de cadastro faz
-- `INSERT ... RETURNING id`, e o RETURNING dispara a policy de SELECT da
-- tabela, que chama agente_papel(). Sem permissao de execucao, o insert
-- legitimo morre com "permission denied for function" em vez de funcionar.
--
-- Revogar tambem nao acrescenta seguranca nenhuma. Sem login, auth.uid() e
-- NULL, as funcoes devolvem NULL, e toda comparacao do tipo
-- `NULL IN ('gerente','admin')` resulta em NULL, que o RLS trata como falso.
-- Ou seja: para o visitante anonimo a resposta ja e "nao pode", por construcao.
--
-- A diferenca pratica entre as duas opcoes e so a forma da recusa: erro de
-- permissao (quebra o fluxo publico) contra zero linhas (nega o dado e deixa
-- o aplicativo funcionar). A segunda e a correta.
REVOKE ALL ON FUNCTION public.agente_papel()                FROM PUBLIC;
REVOKE ALL ON FUNCTION public.agente_unidade()              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_ler_prontuario(UUID)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_criar_prontuario(UUID)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_alterar_prontuario(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pode_excluir_prontuario()     FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.agente_papel()                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agente_unidade()              TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ler_prontuario(UUID)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pode_criar_prontuario(UUID)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pode_alterar_prontuario(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pode_excluir_prontuario()     TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. agentes
-- ---------------------------------------------------------------------------
-- Guarda CPF e senha_hash. Era a tabela mais exposta das sete.

ALTER TABLE agentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agentes_select" ON agentes;
CREATE POLICY "agentes_select" ON agentes FOR SELECT USING (
  id = auth.uid()                                   -- o proprio cadastro
  OR public.agente_papel() IN ('gerente', 'admin')  -- gestao ve todos
  OR (public.agente_papel() = 'coordenador'         -- coordenador ve a unidade
      AND unidade_saude = public.agente_unidade())
);

-- Criacao de agente nao passa pelo cliente: e fluxo administrativo, feito pela
-- service role (que ignora RLS) ou pelo fluxo de solicitacao de registro, que
-- tem tabela propria com policies proprias. Por isso nao existe policy de
-- INSERT aqui: sem policy, a operacao e negada, que e o comportamento correto.

DROP POLICY IF EXISTS "agentes_update" ON agentes;
CREATE POLICY "agentes_update" ON agentes FOR UPDATE USING (
  id = auth.uid()
  OR public.agente_papel() IN ('gerente', 'admin')
);

DROP POLICY IF EXISTS "agentes_delete" ON agentes;
CREATE POLICY "agentes_delete" ON agentes FOR DELETE USING (
  public.agente_papel() = 'admin'
);

-- RLS filtra LINHA, nao COLUNA: um agente enxerga a propria linha inteira,
-- inclusive o proprio senha_hash. Hash nenhum precisa trafegar para o cliente,
-- e vazar o hash permite ataque de dicionario offline contra a senha real.
--
-- ATENCAO A ORDEM. Revogar so a coluna NAO funciona quando ja existe GRANT na
-- tabela inteira: o privilegio de tabela continua valendo e o hash segue
-- legivel. Testamos, e e exatamente o que acontece. O jeito correto e revogar
-- a tabela e devolver coluna a coluna, deixando senha_hash de fora.
REVOKE SELECT, UPDATE ON agentes FROM anon, authenticated;

GRANT SELECT (id, nome, cpf, email, telefone, area_atuacao, unidade_saude,
              ativo, created_at, updated_at, role, microarea)
  ON agentes TO anon, authenticated;

GRANT UPDATE (nome, email, telefone, area_atuacao, unidade_saude,
              ativo, updated_at, role, microarea)
  ON agentes TO authenticated;

-- A troca de senha passa a ser possivel apenas por funcao propria ou pela
-- service role, nunca por UPDATE direto vindo do cliente.

-- ---------------------------------------------------------------------------
-- 3. prontuario_saude
-- ---------------------------------------------------------------------------

ALTER TABLE prontuario_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuario_saude FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prontuario_saude_select" ON prontuario_saude;
CREATE POLICY "prontuario_saude_select" ON prontuario_saude FOR SELECT
  USING (public.pode_ler_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_saude_insert" ON prontuario_saude;
CREATE POLICY "prontuario_saude_insert" ON prontuario_saude FOR INSERT
  WITH CHECK (public.pode_criar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_saude_update" ON prontuario_saude;
CREATE POLICY "prontuario_saude_update" ON prontuario_saude FOR UPDATE
  USING (public.pode_alterar_prontuario(prontuario_id))
  WITH CHECK (public.pode_alterar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_saude_delete" ON prontuario_saude;
CREATE POLICY "prontuario_saude_delete" ON prontuario_saude FOR DELETE
  USING (public.pode_excluir_prontuario());

-- ---------------------------------------------------------------------------
-- 4. prontuario_gestante
-- ---------------------------------------------------------------------------

ALTER TABLE prontuario_gestante ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuario_gestante FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prontuario_gestante_select" ON prontuario_gestante;
CREATE POLICY "prontuario_gestante_select" ON prontuario_gestante FOR SELECT
  USING (public.pode_ler_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_gestante_insert" ON prontuario_gestante;
CREATE POLICY "prontuario_gestante_insert" ON prontuario_gestante FOR INSERT
  WITH CHECK (public.pode_criar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_gestante_update" ON prontuario_gestante;
CREATE POLICY "prontuario_gestante_update" ON prontuario_gestante FOR UPDATE
  USING (public.pode_alterar_prontuario(prontuario_id))
  WITH CHECK (public.pode_alterar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_gestante_delete" ON prontuario_gestante;
CREATE POLICY "prontuario_gestante_delete" ON prontuario_gestante FOR DELETE
  USING (public.pode_excluir_prontuario());

-- ---------------------------------------------------------------------------
-- 5. prontuario_puericultura
-- ---------------------------------------------------------------------------

ALTER TABLE prontuario_puericultura ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuario_puericultura FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prontuario_puericultura_select" ON prontuario_puericultura;
CREATE POLICY "prontuario_puericultura_select" ON prontuario_puericultura FOR SELECT
  USING (public.pode_ler_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_puericultura_insert" ON prontuario_puericultura;
CREATE POLICY "prontuario_puericultura_insert" ON prontuario_puericultura FOR INSERT
  WITH CHECK (public.pode_criar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_puericultura_update" ON prontuario_puericultura;
CREATE POLICY "prontuario_puericultura_update" ON prontuario_puericultura FOR UPDATE
  USING (public.pode_alterar_prontuario(prontuario_id))
  WITH CHECK (public.pode_alterar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_puericultura_delete" ON prontuario_puericultura;
CREATE POLICY "prontuario_puericultura_delete" ON prontuario_puericultura FOR DELETE
  USING (public.pode_excluir_prontuario());

-- ---------------------------------------------------------------------------
-- 6. prontuario_mulher
-- ---------------------------------------------------------------------------

ALTER TABLE prontuario_mulher ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuario_mulher FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prontuario_mulher_select" ON prontuario_mulher;
CREATE POLICY "prontuario_mulher_select" ON prontuario_mulher FOR SELECT
  USING (public.pode_ler_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_mulher_insert" ON prontuario_mulher;
CREATE POLICY "prontuario_mulher_insert" ON prontuario_mulher FOR INSERT
  WITH CHECK (public.pode_criar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_mulher_update" ON prontuario_mulher;
CREATE POLICY "prontuario_mulher_update" ON prontuario_mulher FOR UPDATE
  USING (public.pode_alterar_prontuario(prontuario_id))
  WITH CHECK (public.pode_alterar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_mulher_delete" ON prontuario_mulher;
CREATE POLICY "prontuario_mulher_delete" ON prontuario_mulher FOR DELETE
  USING (public.pode_excluir_prontuario());

-- ---------------------------------------------------------------------------
-- 7. prontuario_social
-- ---------------------------------------------------------------------------

ALTER TABLE prontuario_social ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuario_social FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prontuario_social_select" ON prontuario_social;
CREATE POLICY "prontuario_social_select" ON prontuario_social FOR SELECT
  USING (public.pode_ler_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_social_insert" ON prontuario_social;
CREATE POLICY "prontuario_social_insert" ON prontuario_social FOR INSERT
  WITH CHECK (public.pode_criar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_social_update" ON prontuario_social;
CREATE POLICY "prontuario_social_update" ON prontuario_social FOR UPDATE
  USING (public.pode_alterar_prontuario(prontuario_id))
  WITH CHECK (public.pode_alterar_prontuario(prontuario_id));

DROP POLICY IF EXISTS "prontuario_social_delete" ON prontuario_social;
CREATE POLICY "prontuario_social_delete" ON prontuario_social FOR DELETE
  USING (public.pode_excluir_prontuario());

-- ---------------------------------------------------------------------------
-- 8. audit_log
-- ---------------------------------------------------------------------------
-- Trilha de auditoria so vale se nao puder ser apagada nem reescrita por quem
-- esta sendo auditado. Por isso ela e append-only: existe policy de INSERT e de
-- SELECT, e NAO existe de UPDATE nem de DELETE. Sem policy, o Postgres nega.

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (
  public.agente_papel() IN ('gerente', 'admin')
);

DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (
  -- O registro precisa ser atribuido a quem esta de fato autenticado, senao a
  -- trilha aceitaria acao forjada em nome de outro agente.
  agente_id = auth.uid()
);

-- Reforco em nivel de permissao, alem do RLS: nem o papel authenticated pode
-- tentar alterar ou remover linha de auditoria.
REVOKE UPDATE, DELETE ON audit_log FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Indices que as novas policies passam a exigir
-- ---------------------------------------------------------------------------
-- Toda policy vira filtro em cada consulta. As funcoes auxiliares resolvem
-- prontuario -> morador -> agente a cada linha avaliada; sem indice nessas
-- chaves, o custo do RLS cresce junto com a tabela e aparece como lentidao
-- generalizada, que e dificil de atribuir a causa certa depois.

CREATE INDEX IF NOT EXISTS idx_prontuario_saude_prontuario
  ON prontuario_saude (prontuario_id);
CREATE INDEX IF NOT EXISTS idx_prontuario_gestante_prontuario
  ON prontuario_gestante (prontuario_id);
CREATE INDEX IF NOT EXISTS idx_prontuario_puericultura_prontuario
  ON prontuario_puericultura (prontuario_id);
CREATE INDEX IF NOT EXISTS idx_prontuario_mulher_prontuario
  ON prontuario_mulher (prontuario_id);
CREATE INDEX IF NOT EXISTS idx_prontuario_social_prontuario
  ON prontuario_social (prontuario_id);

CREATE INDEX IF NOT EXISTS idx_agentes_unidade  ON agentes (unidade_saude);
CREATE INDEX IF NOT EXISTS idx_audit_log_agente ON audit_log (agente_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_criado ON audit_log (created_at DESC);

COMMIT;

-- ===========================================================================
-- CONFERENCIA
-- ===========================================================================
-- Rode depois de aplicar. O resultado esperado e NENHUMA linha: toda tabela do
-- schema public com RLS desligado ou sem policy aparece aqui.
--
--   SELECT c.relname AS tabela,
--          c.relrowsecurity AS rls_ligado,
--          count(p.polname) AS policies
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   LEFT JOIN pg_policy p ON p.polrelid = c.oid
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--   GROUP BY c.relname, c.relrowsecurity
--   HAVING c.relrowsecurity = false OR count(p.polname) = 0
--   ORDER BY c.relname;
-- ===========================================================================
