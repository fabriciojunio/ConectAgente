-- ===========================================================================
-- Sem unidade é NULL, nunca texto vazio
-- ===========================================================================
--
-- Achado em 12/11/2026 no pentest do próprio sistema (gray box). A correção
-- de `agente_unidade()` fechava só as policies que usam a função. Outras 12
-- policies e 8 funções comparam a unidade direto, `a.unidade_saude =
-- a2.unidade_saude`, e texto vazio é igual a texto vazio: uma coordenação
-- recém-criada, ainda sem área, lia a ficha completa dos pacientes de
-- qualquer agente também sem unidade.
--
-- Em vez de reescrever vinte comparações (e esquecer a vigésima primeira no
-- futuro), a correção vai no dado: sem unidade passa a ser NULL. NULL não é
-- igual a nada, nem a outro NULL, então toda comparação desse tipo nega.
-- Um trigger transforma texto vazio em NULL na gravação, para quem ainda
-- mandar ''.
--
-- Idempotente.
-- ===========================================================================

ALTER TABLE public.agentes ALTER COLUMN unidade_saude DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_normalizar_unidade_de_agente()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.unidade_saude := nullif(btrim(NEW.unidade_saude), '');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_normalizar_unidade_de_agente() FROM PUBLIC, anon, authenticated;

-- O nome começa antes de `trg_agentes_proteger_campos` em ordem alfabética,
-- que é a ordem em que o Postgres dispara os BEFORE: a proteção já compara o
-- valor normalizado.
DROP TRIGGER IF EXISTS trg_agentes_normalizar_unidade ON public.agentes;
CREATE TRIGGER trg_agentes_normalizar_unidade
  BEFORE INSERT OR UPDATE OF unidade_saude ON public.agentes
  FOR EACH ROW EXECUTE FUNCTION public.fn_normalizar_unidade_de_agente();

UPDATE public.agentes SET unidade_saude = NULL
WHERE unidade_saude IS NOT NULL AND btrim(unidade_saude) = '';

ALTER TABLE public.agentes DROP CONSTRAINT IF EXISTS agentes_unidade_sem_vazio;
ALTER TABLE public.agentes ADD CONSTRAINT agentes_unidade_sem_vazio
  CHECK (unidade_saude IS NULL OR btrim(unidade_saude) <> '');
