-- ===========================================================================
-- Consentimentos no servidor
-- ===========================================================================
--
-- A tabela existia só no banco do aparelho. A prova do aceite ficava no
-- celular do agente: se o aparelho sumisse, sumia junto a demonstração de que
-- o titular foi informado. Para o órgão, o registro precisa chegar ao
-- servidor.
--
-- As colunas são as mesmas do schema local, para a fila de sincronização
-- poder enviar a linha sem traduzir campo. A diferença é de tipo, como no
-- resto do projeto: UUID e TIMESTAMPTZ aqui, TEXT lá.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS consentimentos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  morador_id       UUID NOT NULL REFERENCES moradores(id) ON DELETE CASCADE,
  tipo             TEXT NOT NULL,
  aceito           BOOLEAN NOT NULL DEFAULT true,
  versao_politica  TEXT NOT NULL,
  data_aceite      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dados_coletados  TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consentimentos_morador ON consentimentos (morador_id);
CREATE INDEX IF NOT EXISTS idx_consentimentos_data ON consentimentos (data_aceite DESC);

ALTER TABLE consentimentos ENABLE ROW LEVEL SECURITY;

-- Quem vê o morador vê o consentimento dele. A regra espelha
-- `moradores_select` de propósito: consentimento separado do morador a que se
-- refere não serve para nada, e duas regras diferentes para o mesmo dado é
-- como uma das duas acaba mais frouxa.
DROP POLICY IF EXISTS "consentimentos_select" ON consentimentos;
CREATE POLICY "consentimentos_select" ON consentimentos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM moradores m
    JOIN agentes a ON a.id = auth.uid()
    WHERE m.id = consentimentos.morador_id AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = m.agente_id
      ))
      OR (a.role = 'agente' AND m.agente_id = auth.uid())
    )
  )
);

-- Só o agente dono do morador registra o aceite, porque é ele quem esteve na
-- casa. Aceite gravado por quem não atendeu não prova nada.
DROP POLICY IF EXISTS "consentimentos_insert" ON consentimentos;
CREATE POLICY "consentimentos_insert" ON consentimentos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM moradores m
    WHERE m.id = consentimentos.morador_id AND m.agente_id = auth.uid()
  )
);

-- Consentimento não se edita nem se apaga: revogar grava uma linha nova com
-- `aceito` falso. Apagar tiraria justamente a prova de que o aceite existiu, e
-- a lei pede o histórico, não o estado final.
REVOKE UPDATE, DELETE ON consentimentos FROM anon, authenticated;

COMMENT ON TABLE consentimentos IS
  'Registro do aceite do titular (LGPD). Append-only: revogacao e uma linha nova com aceito=false.';
