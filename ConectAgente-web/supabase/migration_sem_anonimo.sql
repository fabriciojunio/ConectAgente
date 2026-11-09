-- ===========================================================================
-- Quem não fez login não toca em nada
-- ===========================================================================
--
-- O Supabase concede ALL nas tabelas novas a `anon` e a `authenticated`. Até
-- aqui quem decidia era só o RLS, e o consultor de segurança do Supabase
-- apontou o que sobrava em 09/11/2026:
--
--   * `anon` tinha SELECT nas colunas de `agentes` (CPF, e-mail, telefone),
--     INSERT, UPDATE, DELETE e TRUNCATE nas tabelas de dado. O RLS filtrava
--     as linhas, mas TRUNCATE nem passa pelo RLS;
--   * as funções auxiliares das policies (agente_papel, pode_ler_prontuario
--     e as outras) eram executáveis sem login, pela rota /rest/v1/rpc;
--   * duas funções de gatilho estavam sem search_path fixo;
--   * a policy solicitacoes_insert_anon (WITH CHECK true) deixava qualquer
--     pessoa gravar pedido de cadastro direto pela API, por fora da
--     validação e do limite de tentativas da tela. A tela grava pelo
--     servidor, com a chave de serviço, e não precisa dela.
--
-- Nada do sistema usa `anon` para dado: o login é pelo Supabase Auth e toda
-- leitura acontece depois dele. O health check do painel e o ping semanal
-- tratam a recusa (42501 e 401) como prova de que o banco respondeu.
--
-- Idempotente: pode rodar mais de uma vez, como o resto do setup.
-- ===========================================================================

-- Tabelas e sequências: nada para `anon`, agora e nas próximas.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

-- TRUNCATE ignora o RLS, e TRIGGER e REFERENCES não têm uso pelo cliente.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;

-- Funções: EXECUTE vem de PUBLIC por padrão, e `anon` herda de PUBLIC.
-- Revogar só de `anon` não adiantaria.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public._get_user_role()',
    'public.agente_papel()',
    'public.agente_unidade()',
    'public.conta_ativa()',
    'public.pode_ler_prontuario(uuid)',
    'public.pode_criar_prontuario(uuid)',
    'public.pode_alterar_prontuario(uuid)',
    'public.pode_excluir_prontuario()'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
    END IF;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;

-- Funções de gatilho com search_path fixo: sem isso, quem cria um objeto
-- com o mesmo nome num schema anterior do caminho muda o que o gatilho chama.
DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;
  END IF;
  IF to_regprocedure('public.update_solicitacoes_updated_at()') IS NOT NULL THEN
    ALTER FUNCTION public.update_solicitacoes_updated_at() SET search_path = pg_catalog, public;
  END IF;
END $$;

-- Pedido de cadastro só pelo servidor, que valida e limita tentativas.
DROP POLICY IF EXISTS "solicitacoes_insert_anon" ON solicitacoes_registro;
