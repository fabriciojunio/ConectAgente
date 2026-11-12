-- ===========================================================================
-- Agente só grava na família que é dele, e as policies antigas saem
-- ===========================================================================
--
-- Achado em 12/11/2026 no pentest do próprio sistema (gray box, OWASP
-- API1:2023, CWE-639). Duas causas juntas:
--
-- 1. Seis policies da primeira versão do app (`agente_residencias`,
--    `agente_moradores`, `agente_visitas`, `agente_agendamentos`,
--    `agente_metas`, `agente_prontuarios`) eram `FOR ALL` com a regra
--    `agente_id = auth.uid()`. Policies permissivas se somam com OU, então
--    elas passavam por cima das regras finas escritas depois para cada
--    operação. Hoje toda tabela tem policy própria de SELECT, INSERT,
--    UPDATE e DELETE, e as antigas só abriam brecha.
--
-- 2. As regras de INSERT de visita, morador e agendamento conferiam o dono
--    do registro, não o dono da família. Um agente gravava visita, morador
--    ou agendamento dele na família de outro agente, bastando saber o id. A
--    família passava a constar como visitada, saía da lista de atraso e do
--    alerta do painel, e podia ficar sem atendimento.
--
-- A regra da família vai num trigger, e não só na policy: vale qualquer que
-- seja a policy que exista ou venha a existir. Só se aplica ao papel agente
-- vindo da API; coordenação e gestão seguem com o alcance das policies.
--
-- Idempotente.
-- ===========================================================================

DROP POLICY IF EXISTS "agente_residencias"  ON public.residencias;
DROP POLICY IF EXISTS "agente_moradores"    ON public.moradores;
DROP POLICY IF EXISTS "agente_visitas"      ON public.visitas;
DROP POLICY IF EXISTS "agente_agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "agente_metas"        ON public.metas_visitas;
DROP POLICY IF EXISTS "agente_prontuarios"  ON public.prontuarios;

CREATE OR REPLACE FUNCTION public.fn_exigir_familia_propria()
RETURNS TRIGGER
LANGUAGE plpgsql
-- INVOKER: a conferência enxerga as residências pelo RLS de quem grava, e
-- `current_user` diz se a gravação veio da API.
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_morador UUID;
BEGIN
  IF current_user <> 'authenticated' OR coalesce(public.agente_papel(), '') <> 'agente' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.residencias r
    WHERE r.id = NEW.residencia_id AND r.agente_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'a família não é deste agente' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'agendamentos' THEN
    v_morador := NEW.morador_id;
    IF v_morador IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.moradores m
      WHERE m.id = v_morador AND m.residencia_id = NEW.residencia_id
    ) THEN
      RAISE EXCEPTION 'o morador não é desta família' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_exigir_familia_propria() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_visitas_familia_propria ON public.visitas;
CREATE TRIGGER trg_visitas_familia_propria
  BEFORE INSERT OR UPDATE OF residencia_id ON public.visitas
  FOR EACH ROW EXECUTE FUNCTION public.fn_exigir_familia_propria();

DROP TRIGGER IF EXISTS trg_moradores_familia_propria ON public.moradores;
CREATE TRIGGER trg_moradores_familia_propria
  BEFORE INSERT OR UPDATE OF residencia_id ON public.moradores
  FOR EACH ROW EXECUTE FUNCTION public.fn_exigir_familia_propria();

DROP TRIGGER IF EXISTS trg_agendamentos_familia_propria ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_familia_propria
  BEFORE INSERT OR UPDATE OF residencia_id, morador_id ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_exigir_familia_propria();
