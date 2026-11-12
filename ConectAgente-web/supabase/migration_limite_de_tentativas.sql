-- ===========================================================================
-- Limite de tentativas no banco, igual para todas as instâncias do painel
-- ===========================================================================
--
-- O limite de login, de cadastro e das ações de aprovação contava num Map em
-- memória do processo. Na Vercel cada instância tem a própria memória, e uma
-- instância nova começa do zero: com o tráfego espalhado, quem testa senhas
-- ganha um limite por instância, e um deploy zera tudo. A contagem passa a
-- morar aqui, num lugar só.
--
-- A chave chega do servidor já como hash SHA-256 (`login_cpf:<hash>`): CPF e
-- IP são dado pessoal, e esta tabela não precisa saber de quem é a tentativa,
-- só quantas foram.
--
-- Só o servidor do painel (service_role) chama a função. Nem `anon` nem
-- `authenticated` leem a tabela ou executam a função: se executassem, qualquer
-- um poderia gastar o limite de outra pessoa e trancá-la do lado de fora.
--
-- Idempotente.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.limite_de_tentativas (
  chave     TEXT PRIMARY KEY CHECK (length(chave) BETWEEN 1 AND 200),
  contagem  INTEGER NOT NULL CHECK (contagem >= 1),
  expira_em TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.limite_de_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.limite_de_tentativas FROM PUBLIC, anon, authenticated;

-- A varredura de cobertura exige policy em toda tabela. Esta diz o que vale:
-- ninguém de fora lê nem grava; o acesso é só pela função abaixo.
DROP POLICY IF EXISTS "sem_acesso_direto" ON public.limite_de_tentativas;
CREATE POLICY "sem_acesso_direto" ON public.limite_de_tentativas
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Conta mais uma tentativa e responde se ela pode seguir.
--
-- Um único INSERT ... ON CONFLICT faz a leitura e a escrita juntas, então
-- duas requisições ao mesmo tempo não leem a mesma contagem antiga. A
-- tentativa recusada também conta: insistir durante o bloqueio não ajuda.
CREATE OR REPLACE FUNCTION public.registrar_tentativa(
  p_chave TEXT,
  p_maximo INTEGER,
  p_janela_ms INTEGER
)
RETURNS TABLE (permitido BOOLEAN, espera_ms INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contagem INTEGER;
  v_expira   TIMESTAMPTZ;
BEGIN
  IF p_chave IS NULL OR p_maximo IS NULL OR p_maximo < 1
     OR p_janela_ms IS NULL OR p_janela_ms < 1 THEN
    RAISE EXCEPTION 'parâmetros inválidos para o limite de tentativas';
  END IF;

  INSERT INTO limite_de_tentativas AS l (chave, contagem, expira_em)
  VALUES (p_chave, 1, clock_timestamp() + make_interval(secs => p_janela_ms / 1000.0))
  ON CONFLICT (chave) DO UPDATE SET
    contagem  = CASE WHEN l.expira_em <= clock_timestamp() THEN 1 ELSE l.contagem + 1 END,
    expira_em = CASE WHEN l.expira_em <= clock_timestamp() THEN EXCLUDED.expira_em ELSE l.expira_em END
  RETURNING l.contagem, l.expira_em INTO v_contagem, v_expira;

  -- Limpeza de vez em quando, para a tabela não crescer com chave que não volta.
  IF random() < 0.01 THEN
    DELETE FROM limite_de_tentativas WHERE expira_em < clock_timestamp();
  END IF;

  IF v_contagem <= p_maximo THEN
    RETURN QUERY SELECT true, 0;
  ELSE
    RETURN QUERY SELECT false,
      GREATEST(0, ceil(EXTRACT(EPOCH FROM (v_expira - clock_timestamp())) * 1000))::INTEGER;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_tentativa(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_tentativa(TEXT, INTEGER, INTEGER) TO service_role;
