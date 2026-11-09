-- ===========================================================================
-- Fichas de prontuário: nenhuma coluna clínica sai pela API
-- ===========================================================================
--
-- Pressão, glicemia, pré-natal, vacina da criança, preventivo e relato de
-- violência ficavam legíveis direto pelo PostgREST para qualquer usuário
-- logado, dentro do RLS e sem registro na trilha. Era a pendência aberta em
-- docs/seguranca.md desde 28/10/2026.
--
-- Ninguém precisa dessa leitura: o painel não abre ficha de prontuário, e o
-- aplicativo guarda a ficha no aparelho e só envia. Fica a leitura das
-- chaves, que o UPDATE ... WHERE prontuario_id = ? da sincronização usa.
--
-- Depende do aplicativo 1.2.2, que grava as fichas com INSERT e, na
-- retentativa, UPDATE. O upsert das versões anteriores é recusado depois
-- desta migração, porque o Postgres exige ler as colunas que um
-- INSERT ... ON CONFLICT DO UPDATE atualiza.
--
-- REVOKE SELECT na tabela também tira o SELECT de cada coluna. Idempotente.
-- ===========================================================================

DO $$
DECLARE
  v_tabela TEXT;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'prontuario_saude', 'prontuario_gestante', 'prontuario_puericultura',
    'prontuario_mulher', 'prontuario_social'
  ] LOOP
    IF to_regclass('public.' || v_tabela) IS NOT NULL THEN
      EXECUTE format('REVOKE SELECT ON public.%I FROM authenticated', v_tabela);
      EXECUTE format('GRANT SELECT (id, prontuario_id) ON public.%I TO authenticated', v_tabela);
    END IF;
  END LOOP;
END $$;
