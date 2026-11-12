-- ===========================================================================
-- Papel, unidade e situação da conta só mudam por quem tem autoridade
-- ===========================================================================
--
-- Achado em 12/11/2026, confirmado em produção só por leitura do catálogo.
--
-- A policy `agentes_update` libera a própria linha (`id = auth.uid()`), para
-- a pessoa poder corrigir telefone e e-mail. O GRANT de UPDATE, porém, inclui
-- `role`, `unidade_saude` e `ativo`. RLS filtra linha, não coluna: juntos, os
-- dois deixavam qualquer conta logada mandar, pela API pública,
--
--   PATCH /rest/v1/agentes?id=eq.<o próprio id>   {"role": "admin"}
--
-- e virar administrador (escalada vertical de privilégio, OWASP A01 e
-- API5:2023). Do mesmo jeito, a coordenação trocava de unidade sem passar pela
-- regra de `fn_escolher_minha_unidade` (e passava a ler os pacientes de
-- outra), e uma conta desativada se reativava sozinha.
--
-- Por que trigger e não só tirar as colunas do GRANT: a tela de usuários do
-- administrador muda papel e situação por UPDATE, e gerente designa unidade.
-- A regra depende de QUEM pede e de QUAL linha, coisa que GRANT não expressa.
--
-- Regras, para chamadas que vêm da API (papel `authenticated` ou `anon`):
--   role           só admin muda, e nunca o próprio
--   ativo          só gerente ou admin muda, e nunca o próprio
--   unidade_saude  só gerente ou admin muda direto; a coordenação usa
--                  fn_escolher_minha_unidade (que roda como dona da tabela e
--                  por isso não passa por aqui)
--   linha de admin só outro admin altera
-- Quem pede precisa estar com a conta ativa.
--
-- A service role e as funções SECURITY DEFINER rodam como dona da tabela e
-- não entram nas regras: são caminhos do servidor, já controlados.
--
-- Idempotente.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.fn_proteger_campos_de_agente()
RETURNS TRIGGER
LANGUAGE plpgsql
-- SECURITY INVOKER de propósito: `current_user` precisa ser quem fez o
-- UPDATE. Vindo da API ele é `authenticated`; vindo de uma função SECURITY
-- DEFINER (fn_escolher_minha_unidade) ele é a dona da tabela, e a regra
-- daquela função já foi aplicada lá dentro.
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_papel TEXT;
  v_eu    UUID := auth.uid();
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.ativo IS NOT DISTINCT FROM OLD.ativo
     AND NEW.unidade_saude IS NOT DISTINCT FROM OLD.unidade_saude
     AND OLD.role <> 'admin' THEN
    RETURN NEW;
  END IF;

  IF v_eu IS NULL OR NOT public.conta_ativa() THEN
    RAISE EXCEPTION 'sem permissão para alterar este cadastro' USING ERRCODE = '42501';
  END IF;
  v_papel := public.agente_papel();

  IF OLD.role = 'admin' AND OLD.id <> v_eu AND v_papel <> 'admin' THEN
    RAISE EXCEPTION 'só a administração altera o cadastro de um administrador' USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF v_papel <> 'admin' THEN
      RAISE EXCEPTION 'só a administração muda o papel de uma conta' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = v_eu THEN
      RAISE EXCEPTION 'ninguém muda o próprio papel' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    IF v_papel NOT IN ('gerente', 'admin') THEN
      RAISE EXCEPTION 'só a gerência ativa ou desativa contas' USING ERRCODE = '42501';
    END IF;
    IF OLD.id = v_eu THEN
      RAISE EXCEPTION 'ninguém ativa ou desativa a própria conta' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.unidade_saude IS DISTINCT FROM OLD.unidade_saude
     AND v_papel NOT IN ('gerente', 'admin') THEN
    RAISE EXCEPTION 'a unidade é definida pela gerência' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_proteger_campos_de_agente() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_agentes_proteger_campos ON public.agentes;
CREATE TRIGGER trg_agentes_proteger_campos
  BEFORE UPDATE ON public.agentes
  FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_campos_de_agente();

-- Toda mudança de papel e de situação vai para a trilha, venha de onde vier.
CREATE OR REPLACE FUNCTION public.fn_auditar_papel_de_agente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    INSERT INTO audit_log (agente_id, acao, tabela, registro_id, dados_anteriores, dados_novos)
    VALUES (
      auth.uid(), 'UPDATE', 'agentes', NEW.id,
      jsonb_build_object('role', OLD.role, 'ativo', OLD.ativo),
      jsonb_build_object('role', NEW.role, 'ativo', NEW.ativo)
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_auditar_papel_de_agente() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_agentes_auditar_papel ON public.agentes;
CREATE TRIGGER trg_agentes_auditar_papel
  AFTER UPDATE ON public.agentes
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditar_papel_de_agente();
