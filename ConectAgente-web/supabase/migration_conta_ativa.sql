-- ===========================================================================
-- Conta desativada perde o acesso ao dado, e as funções de painel falham fechadas
-- ===========================================================================
--
-- Dois problemas achados em 28/10/2026.
--
-- 1. `agentes.ativo` não protegia nada. Nenhuma policy o consultava, então
--    desativar um agente desligado, ou o de um aparelho roubado, só o tirava
--    das listas. Com a sessão aberta, ele continuava lendo prontuário.
--
--    A correção é uma policy RESTRICTIVE por tabela de dado. No Postgres, as
--    policies permissivas se somam com OU e as restritivas com E: esta nega
--    tudo para conta inativa sem precisar reescrever nenhuma das policies que
--    já existem. Ficam de fora `agentes` (o login lê o próprio cadastro para
--    dizer "conta inativa") e `solicitacoes_registro` (cadastro público).
--
-- 2. As seis funções de painel eram SECURITY DEFINER e decidiam o alcance
--    pelo papel. Papel nulo (sem login, ou login sem cadastro) não casava com
--    nenhum IF e caía no ramo de gerente: quatro delas devolviam os números da
--    cidade inteira para quem tivesse só a chave pública. O corpo delas agora
--    recusa papel nulo e conta inativa (no setup-completo.sql), trava o
--    `search_path`, e aqui o EXECUTE sai de `anon`.
--
-- A função `conta_ativa()` é criada no setup-completo.sql antes das funções
-- de painel, que a usam.
-- ===========================================================================

DO $$
DECLARE
  v_tabela TEXT;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'residencias', 'moradores', 'visitas', 'agendamentos', 'metas_visitas',
    'prontuarios', 'prontuario_saude', 'prontuario_gestante',
    'prontuario_puericultura', 'prontuario_mulher', 'prontuario_social',
    'consentimentos', 'audit_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "conta_ativa" ON %I', v_tabela);
    EXECUTE format(
      'CREATE POLICY "conta_ativa" ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (public.conta_ativa()) WITH CHECK (public.conta_ativa())',
      v_tabela);
  END LOOP;
END $$;

-- Pelo catálogo, e não pela assinatura escrita à mão: um parâmetro a mais
-- numa delas faria o REVOKE errar de função em silêncio.
DO $$
DECLARE
  v_funcao REGPROCEDURE;
BEGIN
  FOR v_funcao IN
    SELECT p.oid::REGPROCEDURE FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'fn_dashboard_stats', 'fn_visitas_por_periodo', 'fn_visitas_por_agente',
      'fn_visitas_por_bairro', 'fn_familias_em_atraso', 'fn_cobertura_por_microarea')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_funcao);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_funcao);
  END LOOP;
END $$;
