-- ===========================================================================
-- ConectAgente: tudo que o servidor precisa, num arquivo só
-- ===========================================================================
--
-- Cole isto inteiro no SQL Editor do Supabase e execute uma vez. É a união
-- do schema base com as seis migrações, na ordem em que precisam rodar.
--
-- A ordem não é arbitrária e trocá-la quebra:
--
--   1. schema.sql                         Estrutura base: as 13 tabelas
--   2. migration_web.sql                  Papel e microárea do agente, e as policies do painel
--   3. migration_registro.sql             Solicitação de cadastro público
--   4. migration_risco.sql                Classificação de risco da família
--   5. migration_sync_mobile.sql          As oito colunas clínicas da visita
--   6. migration_prontuario_sync.sql      As 53 colunas das cinco fichas de prontuário
--   7. migration_rls_completo.sql         Row Level Security em todas as tabelas
--
-- Tudo aqui é idempotente: rodar duas vezes não causa dano. Em banco que já
-- tem dado, os ALTER só acrescentam coluna que falta, e as policies são
-- recriadas.
--
-- DEPOIS DE RODAR, faltam dois passos que não são SQL:
--
--   1. Pôr a URL e a chave `anon` do projeto no `.env` do aplicativo
--      (EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY) e no do
--      painel (NEXT_PUBLIC_*, mais SUPABASE_SERVICE_ROLE_KEY, que é usada
--      apenas no servidor e nunca pode ir para o cliente).
--
--   2. Aprovar ao menos um agente pelo painel web. É a aprovação que cria o
--      usuário no Supabase Auth, e sem usuário o `auth.uid()` é nulo e o RLS
--      nega toda gravação do aplicativo. Agente criado só pelo primeiro
--      acesso do aplicativo não sincroniza.
--
-- Gerado por `gerar-setup-supabase.sh`. Não edite este arquivo: edite as
-- migrações e gere de novo, senão ele sai do passo com elas.
-- ===========================================================================




-- =========================================================================
-- schema.sql
-- Estrutura base: as 13 tabelas
-- =========================================================================


-- ============================================================
-- ConectAgente, Schema Supabase (PostgreSQL)
-- ============================================================
-- Execute este script no SQL Editor do seu projeto Supabase:
--   Dashboard → SQL Editor → New query → Cole e execute
--
-- LGPD: Row-Level Security garante que cada agente vê
--       apenas seus próprios dados.
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- AGENTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agentes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT NOT NULL,
  cpf             TEXT UNIQUE NOT NULL,
  email           TEXT,
  senha_hash      TEXT NOT NULL,
  telefone        TEXT,
  area_atuacao    TEXT NOT NULL,
  unidade_saude   TEXT NOT NULL,
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- RESIDÊNCIAS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residencias (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id                UUID NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  cep                      TEXT NOT NULL,
  logradouro               TEXT NOT NULL,
  numero                   TEXT NOT NULL,
  complemento              TEXT,
  bairro                   TEXT NOT NULL,
  cidade                   TEXT NOT NULL,
  estado                   CHAR(2) NOT NULL,
  tipo_imovel              TEXT CHECK (tipo_imovel IN ('proprio','alugado','cedido','outros')),
  num_comodos              INTEGER DEFAULT 1,
  tem_animais              BOOLEAN DEFAULT false,
  animais_info             TEXT,
  morador_responsavel_id   UUID,
  sync_status              TEXT DEFAULT 'sincronizado',
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_residencias_agente ON residencias(agente_id);
CREATE INDEX IF NOT EXISTS idx_residencias_cep ON residencias(cep);

-- ─────────────────────────────────────────────
-- MORADORES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moradores (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  residencia_id            UUID NOT NULL REFERENCES residencias(id) ON DELETE CASCADE,
  agente_id                UUID NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  nome                     TEXT NOT NULL,
  cpf                      TEXT,
  cartao_sus               TEXT,
  telefone                 TEXT,
  data_nascimento          DATE NOT NULL,
  cidade_nascimento        TEXT,
  nome_pai                 TEXT,
  nome_mae                 TEXT,
  sexo                     TEXT CHECK (sexo IN ('masculino','feminino','outro')),
  escolaridade             TEXT,
  profissao                TEXT,
  tem_doenca               BOOLEAN DEFAULT false,
  doencas                  TEXT,
  beneficio_bolsa_familia  BOOLEAN DEFAULT false,
  tem_convenio             BOOLEAN DEFAULT false,
  convenio_nome            TEXT,
  toma_medicamento         BOOLEAN DEFAULT false,
  medicamentos_lista       TEXT,
  is_responsavel           BOOLEAN DEFAULT false,
  is_hipertenso            BOOLEAN DEFAULT false,
  is_diabetico             BOOLEAN DEFAULT false,
  is_gestante              BOOLEAN DEFAULT false,
  is_domiciliado           BOOLEAN DEFAULT false,
  sync_status              TEXT DEFAULT 'sincronizado',
  deleted_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moradores_agente ON moradores(agente_id);
CREATE INDEX IF NOT EXISTS idx_moradores_cpf ON moradores(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moradores_sus ON moradores(cartao_sus) WHERE cartao_sus IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moradores_residencia ON moradores(residencia_id);

-- ─────────────────────────────────────────────
-- PRONTUÁRIOS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prontuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  morador_id    UUID UNIQUE NOT NULL REFERENCES moradores(id) ON DELETE CASCADE,
  agente_id     UUID NOT NULL REFERENCES agentes(id),
  versao        INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prontuario_saude (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prontuario_id       UUID UNIQUE NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  peso_kg             DECIMAL(5,2),
  altura_cm           DECIMAL(5,2),
  pressao_arterial    TEXT,
  glicemia            DECIMAL(6,2),
  tipo_sanguineo      TEXT,
  alergias            TEXT,
  deficiencias        TEXT,
  is_hipertenso       BOOLEAN DEFAULT false,
  is_diabetico        BOOLEAN DEFAULT false,
  is_domiciliado      BOOLEAN DEFAULT false,
  observacoes_gerais  TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prontuario_gestante (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prontuario_id           UUID UNIQUE NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  data_ultima_menstruacao DATE,
  data_provavel_parto     DATE,
  numero_consultas        INTEGER DEFAULT 0,
  alto_risco              BOOLEAN DEFAULT false,
  observacoes             TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prontuario_puericultura (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prontuario_id          UUID UNIQUE NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  peso_nascimento_g      INTEGER,
  comprimento_nascimento DECIMAL(4,1),
  apgar1                 INTEGER,
  apgar5                 INTEGER,
  aleitamento_materno    BOOLEAN DEFAULT false,
  cartao_vacina_ok       BOOLEAN DEFAULT false,
  perimetro_cefalico     DECIMAL(4,1),
  observacoes            TEXT,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prontuario_mulher (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prontuario_id          UUID UNIQUE NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  data_ultimo_preventivo DATE,
  fez_mamografia         BOOLEAN DEFAULT false,
  data_mamografia        DATE,
  metodo_anticoncepcional TEXT,
  numero_gestacoes       INTEGER DEFAULT 0,
  numero_partos          INTEGER DEFAULT 0,
  numero_abortos         INTEGER DEFAULT 0,
  observacoes            TEXT,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prontuario_social (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prontuario_id          UUID UNIQUE NOT NULL REFERENCES prontuarios(id) ON DELETE CASCADE,
  nivel_vulnerabilidade  TEXT CHECK (nivel_vulnerabilidade IN ('baixo','medio','alto','critico')),
  situacao_moradia       TEXT,
  renda_familiar         DECIMAL(10,2),
  numero_pessoas_casa    INTEGER,
  acesso_saneamento      BOOLEAN DEFAULT true,
  acesso_agua_potavel    BOOLEAN DEFAULT true,
  coleta_lixo            BOOLEAN DEFAULT true,
  observacoes            TEXT,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- VISITAS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitas (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id                UUID NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  residencia_id            UUID NOT NULL REFERENCES residencias(id),
  morador_id               UUID REFERENCES moradores(id),
  data_visita              TIMESTAMPTZ NOT NULL,
  status                   TEXT CHECK (status IN ('realizada','agendada','cancelada','nao_encontrado')),
  queixas                  TEXT,
  observacoes              TEXT,
  precisa_agendamento      BOOLEAN DEFAULT false,
  especialidade_agendamento TEXT,
  sync_status              TEXT DEFAULT 'sincronizado',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_agente ON visitas(agente_id);
CREATE INDEX IF NOT EXISTS idx_visitas_data ON visitas(data_visita);
CREATE INDEX IF NOT EXISTS idx_visitas_residencia ON visitas(residencia_id);

-- ─────────────────────────────────────────────
-- AGENDAMENTOS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agendamentos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id     UUID NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  residencia_id UUID NOT NULL REFERENCES residencias(id),
  morador_id    UUID REFERENCES moradores(id),
  data_agendada DATE NOT NULL,
  motivo        TEXT NOT NULL,
  observacoes   TEXT,
  status        TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','realizado','cancelado')),
  sync_status   TEXT DEFAULT 'sincronizado',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agendamentos_agente ON agendamentos(agente_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_agendada);

-- ─────────────────────────────────────────────
-- METAS DE VISITAS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metas_visitas (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id UUID NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  mes       INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano       INTEGER NOT NULL,
  meta      INTEGER NOT NULL CHECK (meta > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (agente_id, mes, ano)
);

-- ─────────────────────────────────────────────
-- LOG DE AUDITORIA (LGPD Art. 37)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agente_id        UUID REFERENCES agentes(id),
  acao             TEXT NOT NULL,
  tabela           TEXT NOT NULL,
  registro_id      TEXT NOT NULL,
  dados_anteriores JSONB,
  dados_novos      JSONB,
  ip_address       INET,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_agente ON audit_log(agente_id);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON audit_log(tabela, registro_id);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY: LGPD
-- Cada agente só acessa seus próprios dados.
-- ─────────────────────────────────────────────
ALTER TABLE residencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE moradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: agente_id deve corresponder ao usuário autenticado
DROP POLICY IF EXISTS agente_residencias ON residencias;
CREATE POLICY "agente_residencias" ON residencias
  USING (agente_id::text = auth.uid()::text);

DROP POLICY IF EXISTS agente_moradores ON moradores;
CREATE POLICY "agente_moradores" ON moradores
  USING (agente_id::text = auth.uid()::text);

DROP POLICY IF EXISTS agente_visitas ON visitas;
CREATE POLICY "agente_visitas" ON visitas
  USING (agente_id::text = auth.uid()::text);

DROP POLICY IF EXISTS agente_agendamentos ON agendamentos;
CREATE POLICY "agente_agendamentos" ON agendamentos
  USING (agente_id::text = auth.uid()::text);

DROP POLICY IF EXISTS agente_metas ON metas_visitas;
CREATE POLICY "agente_metas" ON metas_visitas
  USING (agente_id::text = auth.uid()::text);

DROP POLICY IF EXISTS agente_prontuarios ON prontuarios;
CREATE POLICY "agente_prontuarios" ON prontuarios
  USING (agente_id::text = auth.uid()::text);

-- ─────────────────────────────────────────────
-- FUNÇÃO: atualizar updated_at automaticamente
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['agentes','residencias','moradores','prontuarios',
    'prontuario_saude','prontuario_gestante','prontuario_puericultura',
    'prontuario_mulher','prontuario_social','visitas','agendamentos','metas_visitas']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated ON %I;
       CREATE TRIGGER trg_%I_updated
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- =========================================================================
-- migration_web.sql
-- Papel e microárea do agente, e as policies do painel
-- =========================================================================


-- ===========================================================================
-- ConectAgente Web Dashboard - Migration SQL
-- ===========================================================================
-- LGPD (Lei Geral de Proteção de Dados) Compliance Notes:
--   - All personal data (CPF, nome, endereço) is protected by RLS policies.
--   - Only authorized roles can access patient/resident data.
--   - Audit logging tracks all data access and modifications.
--   - Data minimization: aggregation functions return only necessary fields.
--   - SECURITY DEFINER functions run with elevated privileges but filter
--     results internally based on the caller's role and unidade_saude.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add role and microarea columns to agentes
-- ---------------------------------------------------------------------------
ALTER TABLE agentes
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agente'
    CHECK (role IN ('agente', 'coordenador', 'gerente', 'admin'));

ALTER TABLE agentes
  ADD COLUMN IF NOT EXISTS microarea TEXT;

COMMENT ON COLUMN agentes.role IS 'Papel do agente no sistema: agente, coordenador, gerente ou admin';
COMMENT ON COLUMN agentes.microarea IS 'Microárea de atuação do agente dentro da unidade de saúde';

-- ---------------------------------------------------------------------------
-- 2. Indexes for performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agentes_role ON agentes (role);
CREATE INDEX IF NOT EXISTS idx_agentes_microarea ON agentes (microarea);
CREATE INDEX IF NOT EXISTS idx_agentes_unidade_saude ON agentes (unidade_saude);
CREATE INDEX IF NOT EXISTS idx_agentes_ativo ON agentes (ativo);

CREATE INDEX IF NOT EXISTS idx_visitas_data_visita ON visitas (data_visita);
CREATE INDEX IF NOT EXISTS idx_visitas_status ON visitas (status);
CREATE INDEX IF NOT EXISTS idx_visitas_agente_data ON visitas (agente_id, data_visita);

CREATE INDEX IF NOT EXISTS idx_residencias_bairro ON residencias (bairro);
CREATE INDEX IF NOT EXISTS idx_residencias_agente_id ON residencias (agente_id);

CREATE INDEX IF NOT EXISTS idx_moradores_agente_id ON moradores (agente_id);
CREATE INDEX IF NOT EXISTS idx_moradores_residencia_id ON moradores (residencia_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_agente_id ON agendamentos (agente_id);
CREATE INDEX IF NOT EXISTS idx_metas_visitas_agente_id ON metas_visitas (agente_id);
CREATE INDEX IF NOT EXISTS idx_prontuarios_morador_id ON prontuarios (morador_id);

-- ---------------------------------------------------------------------------
-- 3. Helper function: get current user's role and unidade_saude
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _get_user_role()
RETURNS TABLE (user_role TEXT, user_unidade TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role, unidade_saude
  FROM agentes
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. Drop old RLS policies and create new role-based policies
-- ---------------------------------------------------------------------------

-- === RESIDENCIAS ===
ALTER TABLE residencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "residencias_select" ON residencias;
DROP POLICY IF EXISTS "residencias_insert" ON residencias;
DROP POLICY IF EXISTS "residencias_update" ON residencias;
DROP POLICY IF EXISTS "residencias_delete" ON residencias;
-- Drop any other common legacy policy names
DROP POLICY IF EXISTS "Agentes podem ver suas residencias" ON residencias;
DROP POLICY IF EXISTS "Agentes podem inserir residencias" ON residencias;
DROP POLICY IF EXISTS "Agentes podem atualizar suas residencias" ON residencias;

CREATE POLICY "residencias_select" ON residencias FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = residencias.agente_id
      ))
      OR (a.role = 'agente' AND residencias.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "residencias_insert" ON residencias FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "residencias_update" ON residencias FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = residencias.agente_id
      ))
      OR (a.role = 'agente' AND residencias.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "residencias_delete" ON residencias FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === MORADORES ===
ALTER TABLE moradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moradores_select" ON moradores;
DROP POLICY IF EXISTS "moradores_insert" ON moradores;
DROP POLICY IF EXISTS "moradores_update" ON moradores;
DROP POLICY IF EXISTS "moradores_delete" ON moradores;
DROP POLICY IF EXISTS "Agentes podem ver seus moradores" ON moradores;
DROP POLICY IF EXISTS "Agentes podem inserir moradores" ON moradores;
DROP POLICY IF EXISTS "Agentes podem atualizar seus moradores" ON moradores;

CREATE POLICY "moradores_select" ON moradores FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = moradores.agente_id
      ))
      OR (a.role = 'agente' AND moradores.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "moradores_insert" ON moradores FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "moradores_update" ON moradores FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = moradores.agente_id
      ))
      OR (a.role = 'agente' AND moradores.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "moradores_delete" ON moradores FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === VISITAS ===
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitas_select" ON visitas;
DROP POLICY IF EXISTS "visitas_insert" ON visitas;
DROP POLICY IF EXISTS "visitas_update" ON visitas;
DROP POLICY IF EXISTS "visitas_delete" ON visitas;
DROP POLICY IF EXISTS "Agentes podem ver suas visitas" ON visitas;
DROP POLICY IF EXISTS "Agentes podem inserir visitas" ON visitas;
DROP POLICY IF EXISTS "Agentes podem atualizar suas visitas" ON visitas;

CREATE POLICY "visitas_select" ON visitas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = visitas.agente_id
      ))
      OR (a.role = 'agente' AND visitas.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "visitas_insert" ON visitas FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "visitas_update" ON visitas FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = visitas.agente_id
      ))
      OR (a.role = 'agente' AND visitas.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "visitas_delete" ON visitas FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === AGENDAMENTOS ===
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agendamentos_select" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_update" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_delete" ON agendamentos;
DROP POLICY IF EXISTS "Agentes podem ver seus agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Agentes podem inserir agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Agentes podem atualizar seus agendamentos" ON agendamentos;

CREATE POLICY "agendamentos_select" ON agendamentos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = agendamentos.agente_id
      ))
      OR (a.role = 'agente' AND agendamentos.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "agendamentos_insert" ON agendamentos FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "agendamentos_update" ON agendamentos FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = agendamentos.agente_id
      ))
      OR (a.role = 'agente' AND agendamentos.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "agendamentos_delete" ON agendamentos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === METAS_VISITAS ===
ALTER TABLE metas_visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_visitas_select" ON metas_visitas;
DROP POLICY IF EXISTS "metas_visitas_insert" ON metas_visitas;
DROP POLICY IF EXISTS "metas_visitas_update" ON metas_visitas;
DROP POLICY IF EXISTS "metas_visitas_delete" ON metas_visitas;
DROP POLICY IF EXISTS "Agentes podem ver suas metas" ON metas_visitas;

CREATE POLICY "metas_visitas_select" ON metas_visitas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = metas_visitas.agente_id
      ))
      OR (a.role = 'agente' AND metas_visitas.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "metas_visitas_insert" ON metas_visitas FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('coordenador', 'gerente', 'admin')
  )
);

CREATE POLICY "metas_visitas_update" ON metas_visitas FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('coordenador', 'gerente', 'admin')
  )
);

CREATE POLICY "metas_visitas_delete" ON metas_visitas FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === PRONTUARIOS ===
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prontuarios_select" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_insert" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_update" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_delete" ON prontuarios;
DROP POLICY IF EXISTS "Agentes podem ver seus prontuarios" ON prontuarios;

-- LGPD: Prontuários contain sensitive health data. Access is strictly controlled.
CREATE POLICY "prontuarios_select" ON prontuarios FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM moradores m
    JOIN agentes a ON a.id = auth.uid()
    WHERE m.id = prontuarios.morador_id AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = m.agente_id
      ))
      OR (a.role = 'agente' AND m.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "prontuarios_insert" ON prontuarios FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM moradores m WHERE m.id = prontuarios.morador_id AND m.agente_id = auth.uid()
  )
);

CREATE POLICY "prontuarios_update" ON prontuarios FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM moradores m
    JOIN agentes a ON a.id = auth.uid()
    WHERE m.id = prontuarios.morador_id AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'agente' AND m.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "prontuarios_delete" ON prontuarios FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 5. RPC Functions for Dashboard Aggregation
-- ---------------------------------------------------------------------------
-- LGPD: These functions use SECURITY DEFINER to bypass RLS but apply their
-- own role-based filtering internally. They return only aggregated/anonymized
-- data suitable for dashboards and reports. No raw PII is exposed.
-- ---------------------------------------------------------------------------

-- === fn_dashboard_stats ===
-- Returns key statistics for the dashboard overview.
CREATE OR REPLACE FUNCTION fn_dashboard_stats(
  p_unidade TEXT DEFAULT NULL,
  p_agente_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
  v_result JSON;
BEGIN
  -- Get caller's role and unidade_saude
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  -- Agentes can only see their own stats
  IF v_role = 'agente' THEN
    p_agente_id := auth.uid();
    p_unidade := NULL;
  ELSIF v_role = 'coordenador' THEN
    -- Coordenadores are restricted to their unidade
    p_unidade := v_unidade;
  END IF;
  -- gerente and admin: no restrictions, use provided filters

  SELECT json_build_object(
    'visitas_hoje', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date = CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'visitas_semana', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date >= date_trunc('week', CURRENT_DATE)
        AND v.data_visita::date <= CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'visitas_mes', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date >= date_trunc('month', CURRENT_DATE)
        AND v.data_visita::date <= CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'total_familias', (
      SELECT COUNT(*) FROM residencias r
      JOIN agentes a ON a.id = r.agente_id
      WHERE r.deleted_at IS NULL
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR r.agente_id = p_agente_id)
    ),
    'total_moradores', (
      SELECT COUNT(*) FROM moradores m
      JOIN agentes a ON a.id = m.agente_id
      WHERE m.deleted_at IS NULL
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR m.agente_id = p_agente_id)
    ),
    'agentes_ativos', (
      SELECT COUNT(*) FROM agentes
      WHERE ativo = true
        AND (p_unidade IS NULL OR unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR id = p_agente_id)
    ),
    'visitas_realizadas', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.status = 'realizada'
        AND v.data_visita::date >= date_trunc('month', CURRENT_DATE)
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'visitas_pendentes', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.status = 'agendada'
        AND v.data_visita::date >= CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'taxa_conclusao', (
      SELECT COALESCE(
        ROUND(
          COUNT(*) FILTER (WHERE v.status = 'realizada')::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ), 0
      )
      FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date >= date_trunc('month', CURRENT_DATE)
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fn_dashboard_stats IS 'LGPD: Returns only aggregated counts. No PII exposed.';

-- === fn_visitas_por_periodo ===
-- Returns visit counts grouped by date for a given period.
CREATE OR REPLACE FUNCTION fn_visitas_por_periodo(
  p_inicio DATE,
  p_fim DATE,
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  data DATE,
  total_visitas BIGINT,
  realizadas BIGINT,
  canceladas BIGINT,
  nao_encontrado BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  IF v_role = 'agente' THEN
    RETURN QUERY
      SELECT
        v.data_visita::date AS data,
        COUNT(*) AS total_visitas,
        COUNT(*) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(*) FILTER (WHERE v.status = 'cancelada') AS canceladas,
        COUNT(*) FILTER (WHERE v.status = 'nao_encontrado') AS nao_encontrado
      FROM visitas v
      WHERE v.data_visita::date BETWEEN p_inicio AND p_fim
        AND v.agente_id = auth.uid()
      GROUP BY v.data_visita::date
      ORDER BY v.data_visita::date;
  ELSE
    RETURN QUERY
      SELECT
        v.data_visita::date AS data,
        COUNT(*) AS total_visitas,
        COUNT(*) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(*) FILTER (WHERE v.status = 'cancelada') AS canceladas,
        COUNT(*) FILTER (WHERE v.status = 'nao_encontrado') AS nao_encontrado
      FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date BETWEEN p_inicio AND p_fim
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
      GROUP BY v.data_visita::date
      ORDER BY v.data_visita::date;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_visitas_por_periodo IS 'LGPD: Returns only aggregated visit counts by date. No PII exposed.';

-- === fn_visitas_por_agente ===
-- Returns visit statistics grouped by agent.
CREATE OR REPLACE FUNCTION fn_visitas_por_agente(
  p_inicio DATE,
  p_fim DATE,
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  agente_id UUID,
  nome TEXT,
  total BIGINT,
  realizadas BIGINT,
  pendentes BIGINT,
  taxa NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  IF v_role = 'agente' THEN
    RETURN QUERY
      SELECT
        a.id AS agente_id,
        a.nome,
        COUNT(v.id) AS total,
        COUNT(v.id) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(v.id) FILTER (WHERE v.status = 'agendada') AS pendentes,
        COALESCE(
          ROUND(
            COUNT(v.id) FILTER (WHERE v.status = 'realizada')::numeric /
            NULLIF(COUNT(v.id), 0) * 100, 1
          ), 0
        ) AS taxa
      FROM agentes a
      LEFT JOIN visitas v ON v.agente_id = a.id
        AND v.data_visita::date BETWEEN p_inicio AND p_fim
      WHERE a.id = auth.uid()
      GROUP BY a.id, a.nome;
  ELSE
    RETURN QUERY
      SELECT
        a.id AS agente_id,
        a.nome,
        COUNT(v.id) AS total,
        COUNT(v.id) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(v.id) FILTER (WHERE v.status = 'agendada') AS pendentes,
        COALESCE(
          ROUND(
            COUNT(v.id) FILTER (WHERE v.status = 'realizada')::numeric /
            NULLIF(COUNT(v.id), 0) * 100, 1
          ), 0
        ) AS taxa
      FROM agentes a
      LEFT JOIN visitas v ON v.agente_id = a.id
        AND v.data_visita::date BETWEEN p_inicio AND p_fim
      WHERE a.ativo = true
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
      GROUP BY a.id, a.nome
      ORDER BY total DESC;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_visitas_por_agente IS 'LGPD: Returns agent names with aggregated stats. Minimal PII (agent names only).';

-- === fn_visitas_por_bairro ===
-- Returns visit and family statistics grouped by neighborhood.
CREATE OR REPLACE FUNCTION fn_visitas_por_bairro(
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  bairro TEXT,
  total_visitas BIGINT,
  total_familias BIGINT,
  cobertura_pct NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  RETURN QUERY
    SELECT
      r.bairro,
      COUNT(DISTINCT v.id) AS total_visitas,
      COUNT(DISTINCT r.id) AS total_familias,
      COALESCE(
        ROUND(
          COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN r.id END)::numeric /
          NULLIF(COUNT(DISTINCT r.id), 0) * 100, 1
        ), 0
      ) AS cobertura_pct
    FROM residencias r
    JOIN agentes a ON a.id = r.agente_id
    LEFT JOIN visitas v ON v.residencia_id = r.id
      AND v.data_visita::date BETWEEN p_inicio AND p_fim
      AND v.status = 'realizada'
    WHERE r.deleted_at IS NULL
      AND (
        v_role IN ('gerente', 'admin')
        OR (v_role = 'coordenador' AND a.unidade_saude = v_unidade)
        OR (v_role = 'agente' AND a.id = auth.uid())
      )
    GROUP BY r.bairro
    ORDER BY total_visitas DESC;
END;
$$;

COMMENT ON FUNCTION fn_visitas_por_bairro IS 'LGPD: Returns only neighborhood-level aggregations. No PII exposed.';

-- === fn_familias_em_atraso ===
-- Returns families that have not been visited within the specified number of days.
CREATE OR REPLACE FUNCTION fn_familias_em_atraso(
  p_dias INT DEFAULT 30,
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  residencia_id UUID,
  endereco TEXT,
  bairro TEXT,
  agente_nome TEXT,
  ultima_visita TIMESTAMPTZ,
  dias_sem_visita INT,
  nivel_criticidade TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  RETURN QUERY
    SELECT
      r.id AS residencia_id,
      CONCAT(r.logradouro, ', ', r.numero, ' - ', r.bairro) AS endereco,
      r.bairro,
      a.nome AS agente_nome,
      MAX(v.data_visita) AS ultima_visita,
      EXTRACT(DAY FROM NOW() - MAX(v.data_visita))::INT AS dias_sem_visita,
      CASE
        WHEN EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) > 30 THEN 'critico'
        WHEN EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) > 15 THEN 'alerta'
        WHEN EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) > 7 THEN 'atencao'
        ELSE 'normal'
      END AS nivel_criticidade
    FROM residencias r
    JOIN agentes a ON a.id = r.agente_id
    LEFT JOIN visitas v ON v.residencia_id = r.id AND v.status = 'realizada'
    WHERE r.deleted_at IS NULL
      AND (
        v_role IN ('gerente', 'admin')
        OR (v_role = 'coordenador' AND a.unidade_saude = v_unidade)
        OR (v_role = 'agente' AND a.id = auth.uid())
      )
      AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
    GROUP BY r.id, r.logradouro, r.numero, r.bairro, a.nome
    HAVING MAX(v.data_visita) IS NULL
      OR EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) >= p_dias
    ORDER BY dias_sem_visita DESC NULLS FIRST;
END;
$$;

COMMENT ON FUNCTION fn_familias_em_atraso IS 'LGPD: Returns address-level data for overdue visits. Access restricted by role.';

-- === fn_cobertura_por_microarea ===
-- Returns coverage statistics grouped by microarea.
CREATE OR REPLACE FUNCTION fn_cobertura_por_microarea(
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  microarea TEXT,
  total_familias BIGINT,
  familias_visitadas_30d BIGINT,
  cobertura_pct NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  IF v_role = 'agente' THEN
    RETURN QUERY
      SELECT
        COALESCE(a.microarea, 'Não definida') AS microarea,
        COUNT(DISTINCT r.id) AS total_familias,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM visitas v
            WHERE v.residencia_id = r.id
              AND v.status = 'realizada'
              AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
          ) THEN r.id
        END) AS familias_visitadas_30d,
        COALESCE(
          ROUND(
            COUNT(DISTINCT CASE
              WHEN EXISTS (
                SELECT 1 FROM visitas v
                WHERE v.residencia_id = r.id
                  AND v.status = 'realizada'
                  AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
              ) THEN r.id
            END)::numeric /
            NULLIF(COUNT(DISTINCT r.id), 0) * 100, 1
          ), 0
        ) AS cobertura_pct
      FROM agentes a
      JOIN residencias r ON r.agente_id = a.id AND r.deleted_at IS NULL
      WHERE a.id = auth.uid()
      GROUP BY a.microarea
      ORDER BY microarea;
  ELSE
    RETURN QUERY
      SELECT
        COALESCE(a.microarea, 'Não definida') AS microarea,
        COUNT(DISTINCT r.id) AS total_familias,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM visitas v
            WHERE v.residencia_id = r.id
              AND v.status = 'realizada'
              AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
          ) THEN r.id
        END) AS familias_visitadas_30d,
        COALESCE(
          ROUND(
            COUNT(DISTINCT CASE
              WHEN EXISTS (
                SELECT 1 FROM visitas v
                WHERE v.residencia_id = r.id
                  AND v.status = 'realizada'
                  AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
              ) THEN r.id
            END)::numeric /
            NULLIF(COUNT(DISTINCT r.id), 0) * 100, 1
          ), 0
        ) AS cobertura_pct
      FROM agentes a
      JOIN residencias r ON r.agente_id = a.id AND r.deleted_at IS NULL
      WHERE a.ativo = true
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
      GROUP BY a.microarea
      ORDER BY microarea;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_cobertura_por_microarea IS 'LGPD: Returns only microarea-level aggregations. No PII exposed.';

COMMIT;


-- =========================================================================
-- migration_registro.sql
-- Solicitação de cadastro público
-- =========================================================================


-- ===========================================================================
-- ConectAgente Web - Migration: Sistema de Registro com Aprovação
-- ===========================================================================
-- Cria tabela de solicitações de registro para novos usuários.
-- Fluxo: Pessoa se cadastra → Admin/Gerente aprova → Conta é criada.
-- LGPD: Dados pessoais protegidos por RLS, acesso restrito a admins.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tabela de solicitações de registro
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitacoes_registro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  telefone TEXT,
  cargo_pretendido TEXT NOT NULL CHECK (cargo_pretendido IN ('coordenador', 'gerente', 'outro')),
  cargo_outro TEXT,
  unidade_saude TEXT NOT NULL,
  area_atuacao TEXT NOT NULL,
  justificativa TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  motivo_rejeicao TEXT,
  aprovado_por UUID REFERENCES agentes(id),
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE solicitacoes_registro IS 'LGPD: Armazena solicitações de registro pendentes. Dados pessoais (CPF, nome) protegidos por RLS.';
COMMENT ON COLUMN solicitacoes_registro.cargo_pretendido IS 'Cargo solicitado: coordenador ou gerente. Admin só é criado por outro admin.';
COMMENT ON COLUMN solicitacoes_registro.justificativa IS 'Justificativa do solicitante para validação do cargo.';

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_solicitacoes_status ON solicitacoes_registro (status);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_cpf ON solicitacoes_registro (cpf);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_created ON solicitacoes_registro (created_at);

-- ---------------------------------------------------------------------------
-- 3. RLS Policies
-- ---------------------------------------------------------------------------
ALTER TABLE solicitacoes_registro ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa autenticada pode inserir (para se registrar)
-- Na prática, usamos a service role key para inserir sem autenticação
DROP POLICY IF EXISTS "solicitacoes_insert_anon" ON solicitacoes_registro;
CREATE POLICY "solicitacoes_insert_anon" ON solicitacoes_registro
  FOR INSERT WITH CHECK (true);

-- Apenas gerentes e admins podem ver as solicitações
DROP POLICY IF EXISTS "solicitacoes_select_admin" ON solicitacoes_registro;
CREATE POLICY "solicitacoes_select_admin" ON solicitacoes_registro
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agentes a
      WHERE a.id = auth.uid()
        AND a.role IN ('gerente', 'admin')
    )
  );

-- Apenas gerentes e admins podem atualizar (aprovar/rejeitar)
DROP POLICY IF EXISTS "solicitacoes_update_admin" ON solicitacoes_registro;
CREATE POLICY "solicitacoes_update_admin" ON solicitacoes_registro
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM agentes a
      WHERE a.id = auth.uid()
        AND a.role IN ('gerente', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Trigger para updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_solicitacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_solicitacoes_updated_at ON solicitacoes_registro;
CREATE TRIGGER trigger_solicitacoes_updated_at
  BEFORE UPDATE ON solicitacoes_registro
  FOR EACH ROW
  EXECUTE FUNCTION update_solicitacoes_updated_at();

COMMIT;


-- =========================================================================
-- migration_risco.sql
-- Classificação de risco da família
-- =========================================================================


-- ===========================================================================
-- ConectAgente - Migration to add nivel_risco to residencias
-- ===========================================================================

ALTER TABLE residencias 
  ADD COLUMN IF NOT EXISTS nivel_risco TEXT DEFAULT 'nenhum' 
  CHECK (nivel_risco IN ('nenhum', 'baixo', 'medio', 'alto', 'critico'));

COMMENT ON COLUMN residencias.nivel_risco IS 'Classificação de risco da residência/família (nenhum, baixo, medio, alto, critico)';


-- =========================================================================
-- migration_sync_mobile.sql
-- As oito colunas clínicas da visita
-- =========================================================================


-- ===========================================================================
-- Alinha o servidor com o que o aplicativo de campo realmente coleta
-- ===========================================================================
--
-- O problema, medido e nao suposto. O aplicativo monta o payload de sync com
-- o objeto local inteiro e manda para o Supabase. Rodando o schema real num
-- PostgreSQL e repetindo o insert que o aplicativo faz, o banco responde:
--
--   ERROR: column "status_sync" of relation "residencias" does not exist
--   ERROR: column "motivo_visita" of relation "visitas" does not exist
--
-- Ou seja: nenhuma residencia, nenhum morador e nenhuma visita registrada em
-- campo chegava ao painel. A fila de sync acumulava, tentava de novo ate o
-- limite de tentativas e marcava erro. Como o aplicativo e offline-first e
-- continua funcionando com o banco local, nada aparentava estar errado para
-- o agente.
--
-- Duas causas separadas:
--
--   1. O nome do campo de controle de sincronizacao. Local e `status_sync`,
--      servidor e `sync_status`. Isso se resolve no aplicativo, nao aqui: o
--      campo e escrituracao local (esta linha ja subiu?) e nao faz sentido
--      enviar. O servidor ja tem DEFAULT 'sincronizado', que e o estado
--      correto de uma linha que acabou de chegar.
--
--   2. A tabela `visitas` do servidor nao tem oito colunas que o aplicativo
--      preenche. E o conteudo clinico da visita: pressao, glicemia, peso,
--      medicacao em dia, cartao de vacina, encaminhamento, motivo e
--      assinatura. Isso se resolve aqui.
--
-- Esta migracao e idempotente e pode rodar em banco que ja tem dado.
-- ===========================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Conteudo clinico da visita
-- ─────────────────────────────────────────────────────────────────────
-- Todos entram como NULL permitido de proposito: visita antiga nao tem esse
-- dado e inventar valor seria pior que a ausencia.

ALTER TABLE visitas ADD COLUMN IF NOT EXISTS motivo_visita          TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS pa_visita              TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS glicemia_visita        TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS peso_visita            TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS medicamentos_em_dia    BOOLEAN;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS cartao_vacinas_em_dia  BOOLEAN;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS encaminhamentos        TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS assinatura_base64      TEXT;

COMMENT ON COLUMN visitas.pa_visita IS
  'Pressao arterial aferida na visita, como o agente anotou (ex: 130/85). Texto e nao numero porque o agente escreve do jeito que mede.';
COMMENT ON COLUMN visitas.glicemia_visita IS
  'Glicemia capilar aferida na visita, em mg/dL, como anotada.';
COMMENT ON COLUMN visitas.assinatura_base64 IS
  'Assinatura do morador no aparelho. Dado pessoal: so trafega sob as policies de visitas e nunca aparece em relatorio exportado.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Indice que o painel precisa e nao tinha
-- ─────────────────────────────────────────────────────────────────────
-- O painel filtra visita por status e por periodo ao mesmo tempo, em toda
-- tela de monitoramento. Sem indice composto o Postgres varre a tabela.

CREATE INDEX IF NOT EXISTS idx_visitas_status_data
  ON visitas (status, data_visita DESC);

-- Alerta de familia em atraso procura a ultima visita por residencia.
CREATE INDEX IF NOT EXISTS idx_visitas_residencia_data
  ON visitas (residencia_id, data_visita DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Conferencia
-- ─────────────────────────────────────────────────────────────────────
-- Falha alto e cedo se alguma coluna que o aplicativo manda ficou de fora.

DO $$
DECLARE
  faltando TEXT;
BEGIN
  SELECT string_agg(c.nome, ', ')
    INTO faltando
    FROM (VALUES
      ('motivo_visita'), ('pa_visita'), ('glicemia_visita'), ('peso_visita'),
      ('medicamentos_em_dia'), ('cartao_vacinas_em_dia'), ('encaminhamentos'),
      ('assinatura_base64'), ('queixas'), ('observacoes'),
      ('precisa_agendamento'), ('especialidade_agendamento')
    ) AS c(nome)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'visitas'
        AND column_name = c.nome
   );

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'visitas ainda sem as colunas que o aplicativo envia: %', faltando;
  END IF;
END $$;

COMMIT;


-- =========================================================================
-- migration_prontuario_sync.sql
-- As 53 colunas das cinco fichas de prontuário
-- =========================================================================


-- ===========================================================================
-- Faz o servidor aceitar o prontuario que o agente preenche em campo
-- ===========================================================================
--
-- As cinco tabelas de prontuario existem no servidor desde o inicio, com RLS
-- e policies, mas quase vazias de colunas. O aplicativo preenche 53 campos
-- que nao tinham destino nenhum. Comparando o CREATE TABLE do SQLite local
-- com o do Postgres, tabela por tabela:
--
--   prontuario_saude         13 colunas sem destino
--   prontuario_gestante      10
--   prontuario_puericultura   9
--   prontuario_mulher         9
--   prontuario_social        11
--   metas_visitas             1
--
-- Isso e o miolo do trabalho do agente comunitario de saude: pre-natal,
-- cartao de vacina da crianca, preventivo e mamografia, suspeita de
-- violencia domestica e de negligencia, encaminhamento para a assistente
-- social. Nenhum desses dados conseguia sair do aparelho.
--
-- O tipo de cada coluna espelha o do banco local de proposito. Onde o
-- aplicativo guarda texto livre, aqui tambem e TEXT: a pressao e a glicemia
-- sao anotadas como o agente mediu, por exemplo 130/85 ou 110 em jejum, e
-- trocar por numero agora perderia dado. As datas tambem ficam TEXT, porque
-- o formulario pode devolver string vazia e o Postgres recusa string vazia
-- para DATE, o que derrubaria a linha inteira. Apertar o tipo depois exige
-- normalizar a entrada no aplicativo primeiro, e e um passo separado.
--
-- Idempotente, pode rodar em banco que ja tem dado.
-- ===========================================================================

BEGIN;

-- --------------------------------------------------------------------
-- prontuario_saude
-- --------------------------------------------------------------------
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS is_tuberculose            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS is_hanseniase             BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS hgt_ultima_afericao       TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS hgt_valor                 TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS pa_ultima_afericao        TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS pa_valor                  TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS tem_receita_atualizada    BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS ultima_consulta           TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS proxima_consulta          TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS precisa_agendamento       BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS especialidade_agendamento TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS queixas                   TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS observacoes               TEXT;

-- --------------------------------------------------------------------
-- prontuario_gestante
-- --------------------------------------------------------------------
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS is_gestante                BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS data_dum                   TEXT;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS semanas_gestacao           INTEGER;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS pre_natal_em_dia           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS local_pre_natal            TEXT;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS proxima_consulta_pre_natal TEXT;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS vacina_tetano_em_dia       BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS vacina_hepatiteb_em_dia    BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS sulfato_ferroso            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS acido_folico               BOOLEAN DEFAULT false;

-- --------------------------------------------------------------------
-- prontuario_puericultura
-- --------------------------------------------------------------------
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS is_crianca                     BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS peso_atual                     TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS altura_atual                   TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS cartao_vacina_em_dia           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS vacinas_em_atraso              TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS consulta_acompanhamento_em_dia BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS proxima_consulta               TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS frequenta_escola               BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS nome_escola                    TEXT;

-- --------------------------------------------------------------------
-- prontuario_mulher
-- --------------------------------------------------------------------
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS ultima_menstruacao           TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS papanicolau_em_dia           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS data_ultimo_papanicolau      TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS mamografia_em_dia            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS data_ultima_mamografia       TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS usa_anticoncepcional         BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS tipo_anticoncepcional        TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS consulta_ginecologica_em_dia BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS prevencao_dts                BOOLEAN DEFAULT false;

-- --------------------------------------------------------------------
-- prontuario_social
-- --------------------------------------------------------------------
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS vulnerabilidade_social        TEXT DEFAULT 'nenhum';
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_vulnerabilidade     TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS negligencia_parental          BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_negligencia         TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS violencia_domestica           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_violencia           TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS depressao_suspeita            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS uso_alcool_drogas             BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_uso                 TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS encaminhado_assistente_social BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS data_encaminhamento           TEXT;

-- --------------------------------------------------------------------
-- metas_visitas: nada a acrescentar, e o aplicativo que precisa ceder
-- --------------------------------------------------------------------
-- O aplicativo guarda a meta em `meta_total`; o servidor tem `meta`, com
-- NOT NULL e CHECK (meta > 0). Acrescentar uma segunda coluna aqui criaria
-- duas fontes para o mesmo numero, que e o tipo de divergencia que deu
-- origem a esta migracao. O servidor fica como esta e a traducao do nome
-- acontece em um lugar so, no `prepararPayloadParaServidor` do aplicativo.
--
-- Medido: enviar o payload do aplicativo sem traducao da
--   ERROR: null value in column "meta" of relation "metas_visitas"
--          violates not-null constraint

-- --------------------------------------------------------------------
-- prontuario_social: o CHECK precisa aceitar o valor inicial
-- --------------------------------------------------------------------
-- O padrao do aplicativo e 'nenhum', que e o estado de toda ficha recem
-- criada. A coluna antiga do servidor (nivel_vulnerabilidade) tinha CHECK
-- que nao aceitava esse valor, o que recusaria a primeira gravacao de
-- qualquer prontuario social. Nenhum codigo le nivel_vulnerabilidade, nem no
-- painel nem no aplicativo, entao ela fica onde esta para nao mexer em
-- schema que o time compartilha, mas pode sair numa limpeza combinada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'prontuario_social_vulnerabilidade_check'
  ) THEN
    ALTER TABLE prontuario_social
      ADD CONSTRAINT prontuario_social_vulnerabilidade_check
      CHECK (vulnerabilidade_social IN ('nenhum','baixo','medio','alto','critico'));
  END IF;
END $$;

-- --------------------------------------------------------------------
-- agendamentos: o status estava em tres vocabularios diferentes
-- --------------------------------------------------------------------
-- Aparelho grava 'agendada' e 'cancelada'. Servidor aceitava apenas
-- 'pendente', 'realizado' e 'cancelado'. O tipo em TypeScript dizia ainda
-- uma terceira coisa. Resultado medido num Postgres de verdade, repetindo o
-- que o aplicativo faz ao cancelar um agendamento:
--
--   ERROR: new row for relation "agendamentos" violates check constraint
--          "agendamentos_status_check"
--
-- Cancelar agendamento nunca chegava ao servidor. O vocabulario escolhido e
-- o do aplicativo, que ja e o mesmo de visitas.status e o unico que aparece
-- na tela. O painel web nao le esta tabela, nada quebra do outro lado.

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;

UPDATE agendamentos SET status = 'agendada'  WHERE status = 'pendente';
UPDATE agendamentos SET status = 'realizada' WHERE status = 'realizado';
UPDATE agendamentos SET status = 'cancelada' WHERE status = 'cancelado';

ALTER TABLE agendamentos ALTER COLUMN status SET DEFAULT 'agendada';
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN ('agendada','realizada','cancelada','nao_encontrado'));

-- --------------------------------------------------------------------
-- Indices para o que de fato e consultado
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agendamentos_agente_data
  ON agendamentos (agente_id, data_agendada);
CREATE INDEX IF NOT EXISTS idx_metas_agente_periodo
  ON metas_visitas (agente_id, ano, mes);

-- --------------------------------------------------------------------
-- Conferencia: falha alto se ficou faltando coluna
-- --------------------------------------------------------------------
DO $$
DECLARE
  faltando TEXT;
BEGIN
  SELECT string_agg(t.tabela || '.' || t.coluna, ', ')
    INTO faltando
    FROM (VALUES
      ('prontuario_saude','is_tuberculose'),
      ('prontuario_saude','pa_valor'),
      ('prontuario_saude','queixas'),
      ('prontuario_gestante','is_gestante'),
      ('prontuario_gestante','semanas_gestacao'),
      ('prontuario_puericultura','cartao_vacina_em_dia'),
      ('prontuario_mulher','papanicolau_em_dia'),
      ('prontuario_social','vulnerabilidade_social'),
      ('prontuario_social','violencia_domestica'),
      ('metas_visitas','meta')
    ) AS t(tabela, coluna)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.tabela
        AND c.column_name = t.coluna
   );

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'colunas de prontuario ainda faltando: %', faltando;
  END IF;
END $$;

COMMIT;


-- =========================================================================
-- migration_rls_completo.sql
-- Row Level Security em todas as tabelas
-- =========================================================================


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
