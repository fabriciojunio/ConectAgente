-- ===========================================================================
-- Unidades de saúde: cada coordenação cuida da sua área
-- ===========================================================================
--
-- A unidade era um texto livre em `agentes.unidade_saude`, digitado em cada
-- cadastro. O RLS já limita o coordenador à unidade dele pela igualdade desse
-- texto, então "UBS Centro" e "UBS centro" viravam duas áreas, e o filtro do
-- painel era um campo de digitar. Agora existe um catálogo, e o texto continua
-- sendo a chave que as policies usam (nada nelas muda).
--
-- Regras:
--   * Qualquer usuário logado lê o catálogo (é só o nome da unidade).
--   * Ninguém grava direto: só pelas duas funções abaixo.
--   * Coordenador SEM unidade escolhe uma existente ou cria a dele. Depois de
--     escolhida, só gerente ou admin troca: se o coordenador trocasse sozinho,
--     bastaria escolher outra unidade para ler os pacientes de lá.
--   * Gerente e admin criam unidades e designam a unidade de qualquer agente.
--   * Toda escolha e designação vai para a trilha de auditoria.
--
-- Idempotente.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS unidades_saude (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL UNIQUE CHECK (length(btrim(nome)) BETWEEN 3 AND 120),
  criada_por UUID REFERENCES public.agentes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O que já existe vira catálogo, sem perder nada.
INSERT INTO public.unidades_saude (nome)
SELECT DISTINCT btrim(unidade_saude) FROM public.agentes
WHERE unidade_saude IS NOT NULL AND length(btrim(unidade_saude)) >= 3
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.unidades_saude ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_saude FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.unidades_saude FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.unidades_saude TO authenticated;

DROP POLICY IF EXISTS "unidades_select" ON public.unidades_saude;
CREATE POLICY "unidades_select" ON public.unidades_saude FOR SELECT TO authenticated
  USING (public.conta_ativa());

-- ---------------------------------------------------------------------------
-- Coordenador (ou gestor) escolhe ou cria a própria unidade
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_escolher_minha_unidade(p_nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome  TEXT := btrim(coalesce(p_nome, ''));
  v_papel TEXT;
  v_atual TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.conta_ativa() THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '42501';
  END IF;
  SELECT role, nullif(btrim(unidade_saude), '') INTO v_papel, v_atual
  FROM agentes WHERE id = auth.uid();
  IF v_papel NOT IN ('coordenador', 'gerente', 'admin') THEN
    RAISE EXCEPTION 'só a coordenação escolhe a unidade' USING ERRCODE = '42501';
  END IF;
  IF v_papel = 'coordenador' AND v_atual IS NOT NULL THEN
    RAISE EXCEPTION 'a unidade já foi escolhida; a troca é feita pela gerência' USING ERRCODE = '42501';
  END IF;
  IF length(v_nome) < 3 OR length(v_nome) > 120 THEN
    RAISE EXCEPTION 'nome de unidade inválido' USING ERRCODE = '22023';
  END IF;

  INSERT INTO unidades_saude (nome, criada_por) VALUES (v_nome, auth.uid())
  ON CONFLICT (nome) DO NOTHING;
  UPDATE agentes SET unidade_saude = v_nome, updated_at = now() WHERE id = auth.uid();
  INSERT INTO audit_log (agente_id, acao, tabela, registro_id, dados_novos)
  VALUES (auth.uid(), 'UPDATE', 'agentes', auth.uid(), jsonb_build_object('unidade_escolhida', v_nome));
  RETURN v_nome;
END;
$$;

-- ---------------------------------------------------------------------------
-- Gerente ou admin designa a unidade de um agente da equipe
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_designar_unidade(p_agente_id UUID, p_nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome TEXT := btrim(coalesce(p_nome, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.conta_ativa()
     OR coalesce(public.agente_papel(), '') NOT IN ('gerente', 'admin') THEN
    RAISE EXCEPTION 'só a gerência designa unidade' USING ERRCODE = '42501';
  END IF;
  IF length(v_nome) < 3 OR length(v_nome) > 120 THEN
    RAISE EXCEPTION 'nome de unidade inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM agentes WHERE id = p_agente_id) THEN
    RAISE EXCEPTION 'agente não encontrado' USING ERRCODE = 'P0002';
  END IF;
  -- Mesma regra do trigger de agentes: linha de admin, só admin mexe.
  IF (SELECT role FROM agentes WHERE id = p_agente_id) = 'admin'
     AND public.agente_papel() <> 'admin' THEN
    RAISE EXCEPTION 'só a administração altera o cadastro de um administrador' USING ERRCODE = '42501';
  END IF;

  INSERT INTO unidades_saude (nome, criada_por) VALUES (v_nome, auth.uid())
  ON CONFLICT (nome) DO NOTHING;
  UPDATE agentes SET unidade_saude = v_nome, updated_at = now() WHERE id = p_agente_id;
  INSERT INTO audit_log (agente_id, acao, tabela, registro_id, dados_novos)
  VALUES (auth.uid(), 'UPDATE', 'agentes', p_agente_id, jsonb_build_object('unidade_designada', v_nome));
  RETURN v_nome;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_escolher_minha_unidade(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_designar_unidade(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_escolher_minha_unidade(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_designar_unidade(UUID, TEXT) TO authenticated;
