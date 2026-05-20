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
