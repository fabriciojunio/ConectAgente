-- ===========================================================================
-- Agente só registra visita na família que é dele
-- ===========================================================================
--
-- Achado em 12/11/2026 no pentest do próprio sistema (gray box, OWASP
-- API1:2023). A policy de INSERT conferia só `agente_id = auth.uid()`: o
-- agente gravava uma visita dele na família de outro agente, bastando saber
-- o id da residência. O dano não é de leitura, é de integridade: a família
-- passava a constar como visitada, saía da lista de atraso e do alerta do
-- painel, e podia ficar sem atendimento. Pelo UPDATE dava para mover uma
-- visita já gravada para a família de outro.
--
-- A regra agora exige que a residência seja do próprio agente, na gravação e
-- na alteração. Coordenação, gerência e administração continuam com o
-- alcance que já tinham.
--
-- Idempotente.
-- ===========================================================================

DROP POLICY IF EXISTS "visitas_insert" ON public.visitas;
CREATE POLICY "visitas_insert" ON public.visitas FOR INSERT WITH CHECK (
  agente_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.residencias r
    WHERE r.id = visitas.residencia_id AND r.agente_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "visitas_update" ON public.visitas;
CREATE POLICY "visitas_update" ON public.visitas FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM public.agentes a2 WHERE a2.id = visitas.agente_id
      ))
      OR (a.role = 'agente' AND visitas.agente_id = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM public.agentes a2 WHERE a2.id = visitas.agente_id
      ))
      OR (a.role = 'agente' AND visitas.agente_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.residencias r
        WHERE r.id = visitas.residencia_id AND r.agente_id = auth.uid()
      ))
    )
  )
);
