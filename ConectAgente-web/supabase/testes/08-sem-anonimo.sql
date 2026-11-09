-- ===========================================================================
-- Quem não fez login não toca em nada
-- ===========================================================================
--
-- O que estes casos provam, depois do setup-completo:
--
-- 1. `anon` não tem nenhum privilégio de tabela, nem por coluna: nem o
--    SELECT nas colunas de `agentes` (CPF, e-mail, telefone) que sobrava.
-- 2. `anon` não executa as funções auxiliares das policies.
-- 3. `authenticated` perdeu TRUNCATE, que passaria por cima do RLS.
-- 4. Pedido de cadastro não entra mais pela API: a policy WITH CHECK (true)
--    saiu, e quem grava é o servidor com a chave de serviço.
-- 5. As funções de gatilho têm search_path fixo.
-- 6. O agente logado continua lendo o próprio cadastro.
-- ===========================================================================

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES ('a8a8a8a8-0000-0000-0000-000000000001', 'Agente Oito', '30000000001', 'oito@x.test',
        'h', 'A', 'UBS Oeste', 'agente', true)
ON CONFLICT (id) DO NOTHING;

-- Roda um comando sob um papel: true se o banco recusou por permissão.
CREATE OR REPLACE FUNCTION pg_temp.recusado(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_recusado BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusado := true;
  END;
  RESET ROLE;
  RETURN v_recusado;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Nenhum privilégio de tabela para anon
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'anon_sem_privilegio_de_tabela',
  CASE WHEN (SELECT count(*) FROM information_schema.role_table_grants
             WHERE table_schema = 'public' AND grantee = 'anon') = 0
   AND (SELECT count(*) FROM information_schema.column_privileges
             WHERE table_schema = 'public' AND grantee = 'anon') = 0
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'anon_nao_le_cpf_de_agente',
  CASE WHEN pg_temp.recusado('anon', NULL, 'SELECT cpf FROM agentes') THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'anon_nao_grava_visita',
  CASE WHEN pg_temp.recusado('anon', NULL,
    'INSERT INTO visitas (agente_id, residencia_id, data_visita) VALUES (gen_random_uuid(), gen_random_uuid(), CURRENT_DATE)')
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 2. Funções auxiliares fora do alcance de anon
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'anon_nao_executa_agente_papel',
  CASE WHEN pg_temp.recusado('anon', NULL, 'SELECT public.agente_papel()') THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'anon_nao_executa_pode_ler_prontuario',
  CASE WHEN pg_temp.recusado('anon', NULL,
    'SELECT public.pode_ler_prontuario(gen_random_uuid())') THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'nenhuma_auxiliar_executavel_por_anon',
  CASE WHEN (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('_get_user_role', 'agente_papel', 'agente_unidade', 'conta_ativa',
                                 'pode_ler_prontuario', 'pode_criar_prontuario',
                                 'pode_alterar_prontuario', 'pode_excluir_prontuario')
               AND has_function_privilege('anon', p.oid, 'EXECUTE')) = 0
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 3. Sem TRUNCATE para quem está logado
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'authenticated_sem_truncate',
  CASE WHEN (SELECT count(*) FROM information_schema.role_table_grants
             WHERE table_schema = 'public' AND grantee = 'authenticated'
               AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')) = 0
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 4. Pedido de cadastro só pelo servidor
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'sem_policy_de_cadastro_aberta',
  CASE WHEN NOT EXISTS (SELECT 1 FROM pg_policies
                        WHERE tablename = 'solicitacoes_registro'
                          AND policyname = 'solicitacoes_insert_anon')
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 5. Gatilhos com search_path fixo
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'gatilhos_com_search_path',
  CASE WHEN (SELECT count(*) FROM pg_proc
             WHERE proname IN ('set_updated_at', 'update_solicitacoes_updated_at')
               AND proconfig IS NULL) = 0
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 6. Quem está logado continua trabalhando
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'agente_logado_le_o_proprio_cadastro',
  CASE WHEN NOT pg_temp.recusado('authenticated', 'a8a8a8a8-0000-0000-0000-000000000001',
    'SELECT nome FROM agentes WHERE id = ''a8a8a8a8-0000-0000-0000-000000000001''')
  THEN 'OK' ELSE 'FALHOU' END;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
