-- ===========================================================================
-- Medicamentos e dúvidas do morador
-- ===========================================================================
--
-- A tela do aplicativo (versão 1.2.5) lista os remédios de cada morador, os
-- problemas de uso que o agente observou na visita e as dúvidas que ele leva
-- para a equipe da UBS, com a resposta que volta. É dado de saúde (LGPD,
-- art. 5º, II) e segue o desenho das fichas de prontuário depois de
-- migration_prontuario_fechado.sql:
--
--   * o aparelho é a fonte da tela; o servidor só recebe;
--   * nenhuma coluna clínica sai pela API: o usuário logado lê só as chaves
--     (id, morador_id, agente_id), que o UPDATE e o DELETE da sincronização
--     usam no WHERE;
--   * só o agente dono grava, e só para morador dele;
--   * conta desativada não grava nada (policy restritiva conta_ativa);
--   * visitante sem login não tem privilégio nenhum.
--
-- O aplicativo grava com INSERT e, na retentativa, UPDATE pelo id, sem
-- upsert: o Postgres exige ler as colunas que um ON CONFLICT DO UPDATE
-- atualiza, e elas estão fechadas.
--
-- Idempotente.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS medicamentos (
  id                UUID PRIMARY KEY,
  morador_id        UUID NOT NULL REFERENCES public.moradores(id) ON DELETE CASCADE,
  agente_id         UUID NOT NULL REFERENCES public.agentes(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 120),
  dosagem           TEXT CHECK (length(dosagem) <= 80),
  frequencia        TEXT CHECK (length(frequencia) <= 80),
  problemas_uso     TEXT CHECK (length(problemas_uso) <= 200),
  duvida            TEXT CHECK (length(duvida) <= 1000),
  duvida_respondida BOOLEAN NOT NULL DEFAULT false,
  resposta_medico   TEXT CHECK (length(resposta_medico) <= 2000),
  respondido_por    TEXT CHECK (respondido_por IN ('enfermeiro', 'medico', 'farmaceutico')),
  data_resposta     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medicamentos_morador ON public.medicamentos(morador_id);
CREATE INDEX IF NOT EXISTS idx_medicamentos_agente ON public.medicamentos(agente_id);

-- Confere se o morador é do agente logado sem depender do que o agente pode
-- ler em `moradores` (colunas fechadas desde migration_colunas_sensiveis.sql).
CREATE OR REPLACE FUNCTION public.morador_do_agente(p_morador_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.moradores m
    WHERE m.id = p_morador_id AND m.agente_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.morador_do_agente(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.morador_do_agente(UUID) TO authenticated;

ALTER TABLE public.medicamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicamentos FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.medicamentos FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.medicamentos TO authenticated;
GRANT SELECT (id, morador_id, agente_id) ON public.medicamentos TO authenticated;

DROP POLICY IF EXISTS "medicamentos_select" ON public.medicamentos;
CREATE POLICY "medicamentos_select" ON public.medicamentos FOR SELECT TO authenticated
  USING (agente_id = auth.uid());

DROP POLICY IF EXISTS "medicamentos_insert" ON public.medicamentos;
CREATE POLICY "medicamentos_insert" ON public.medicamentos FOR INSERT TO authenticated
  WITH CHECK (agente_id = auth.uid() AND public.morador_do_agente(morador_id));

DROP POLICY IF EXISTS "medicamentos_update" ON public.medicamentos;
CREATE POLICY "medicamentos_update" ON public.medicamentos FOR UPDATE TO authenticated
  USING (agente_id = auth.uid())
  WITH CHECK (agente_id = auth.uid() AND public.morador_do_agente(morador_id));

DROP POLICY IF EXISTS "medicamentos_delete" ON public.medicamentos;
CREATE POLICY "medicamentos_delete" ON public.medicamentos FOR DELETE TO authenticated
  USING (agente_id = auth.uid());

DROP POLICY IF EXISTS "conta_ativa" ON public.medicamentos;
CREATE POLICY "conta_ativa" ON public.medicamentos AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.conta_ativa()) WITH CHECK (public.conta_ativa());
