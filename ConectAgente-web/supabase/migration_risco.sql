-- ===========================================================================
-- ConectAgente - Migration to add nivel_risco to residencias
-- ===========================================================================

ALTER TABLE residencias 
  ADD COLUMN IF NOT EXISTS nivel_risco TEXT DEFAULT 'nenhum' 
  CHECK (nivel_risco IN ('nenhum', 'baixo', 'medio', 'alto', 'critico'));

COMMENT ON COLUMN residencias.nivel_risco IS 'Classificação de risco da residência/família (nenhum, baixo, medio, alto, critico)';
