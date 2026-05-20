-- ============================================================
-- ConectAgente — Schema Supabase (PostgreSQL)
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
-- ROW LEVEL SECURITY — LGPD
-- Cada agente só acessa seus próprios dados.
-- ─────────────────────────────────────────────
ALTER TABLE residencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE moradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS — agente_id deve corresponder ao usuário autenticado
CREATE POLICY "agente_residencias" ON residencias
  USING (agente_id::text = auth.uid()::text);

CREATE POLICY "agente_moradores" ON moradores
  USING (agente_id::text = auth.uid()::text);

CREATE POLICY "agente_visitas" ON visitas
  USING (agente_id::text = auth.uid()::text);

CREATE POLICY "agente_agendamentos" ON agendamentos
  USING (agente_id::text = auth.uid()::text);

CREATE POLICY "agente_metas" ON metas_visitas
  USING (agente_id::text = auth.uid()::text);

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
