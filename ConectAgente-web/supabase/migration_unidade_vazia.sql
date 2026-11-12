-- ===========================================================================
-- Unidade vazia não casa com nada
-- ===========================================================================
--
-- As policies da coordenação comparam `unidade_saude = agente_unidade()`.
-- Coordenação recém-criada tem a unidade vazia (''), e '' = '' é verdadeiro:
-- ela via toda conta, e os pacientes de toda conta, que também estivessem sem
-- unidade. Com NULL no lugar do vazio, a comparação dá nulo e a policy nega,
-- que é o comportamento certo até a área ser escolhida.
--
-- Idempotente.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.agente_unidade()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT nullif(btrim(unidade_saude), '') FROM public.agentes WHERE id = auth.uid()
$$;

COMMENT ON FUNCTION public.agente_unidade() IS
  'Unidade de saude do usuario autenticado; NULL quando ainda nao definida, para nenhuma policy casar com vazio.';
