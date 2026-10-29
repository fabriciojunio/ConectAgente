-- ===========================================================================
-- Leitura auditada de morador
-- ===========================================================================
--
-- Por que isto existe no banco e não na aplicação.
--
-- O art. 37 da Lei 13.709/2018 obriga a manter registro das operações de
-- tratamento. No aplicativo isso foi resolvido na tela, porque lá a leitura
-- passa por código nosso. No painel não passa: o navegador fala direto com o
-- PostgREST usando a chave `anon`, sob RLS, e não existe servidor nosso no
-- meio onde gravar o registro.
--
-- Pôr a gravação no cliente seria teatro: quem quisesse ler sem deixar rastro
-- bastaria não chamar a função. Aqui dentro, a gravação acontece na mesma
-- transação da leitura. Quem lê pela função, audita; e os campos sensíveis só
-- saem por ela.
--
-- A função é SECURITY DEFINER porque precisa escrever em `audit_log` em nome
-- de quem chamou. Como isso ignora o RLS, ela repete a regra da policy
-- `moradores_select` à mão, e o `search_path` fica preso: sem isso, quem
-- controla o `search_path` da sessão poderia plantar uma tabela `agentes` sua
-- e passar pela conferência.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- fn_ler_morador
-- ---------------------------------------------------------------------------
-- Devolve o cadastro completo de um morador e registra a leitura.
-- Devolve NULL quando quem chama não pode ver aquele morador, e nesse caso
-- grava uma tentativa negada: acesso recusado também é informação de
-- segurança, e sem ele uma varredura de ids não deixa marca.
DROP FUNCTION IF EXISTS fn_ler_morador(UUID);

CREATE OR REPLACE FUNCTION fn_ler_morador(p_morador_id UUID)
RETURNS JSON
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_chamador UUID := auth.uid();
  v_pode BOOLEAN;
  v_morador moradores%ROWTYPE;
  v_resultado JSON;
BEGIN
  -- Sem sessão não há a quem atribuir a leitura, e sem isso o registro não
  -- serve para nada. Recusa antes de tocar no dado.
  IF v_chamador IS NULL THEN
    RAISE EXCEPTION 'sem sessao: leitura de morador exige usuario autenticado';
  END IF;

  -- Conta desativada não lê, nem deixa registro de tentativa: para ela o
  -- sistema simplesmente não existe mais.
  IF NOT public.conta_ativa() THEN
    RAISE EXCEPTION 'sem permissao' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_morador FROM moradores WHERE id = p_morador_id;

  -- Mesma regra da policy `moradores_select`. Se ela mudar, esta muda junto:
  -- o teste de banco compara as duas num cenário com três papéis.
  v_pode := EXISTS (
    SELECT 1 FROM agentes a
    WHERE a.id = v_chamador AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = v_morador.agente_id
      ))
      OR (a.role = 'agente' AND v_morador.agente_id = v_chamador)
    )
  );

  INSERT INTO audit_log (agente_id, acao, tabela, registro_id, dados_novos, created_at)
  VALUES (
    v_chamador,
    CASE WHEN v_pode THEN 'LEITURA' ELSE 'LEITURA_NEGADA' END,
    'moradores',
    p_morador_id::TEXT,
    json_build_object('origem', 'painel web')::jsonb,
    NOW()
  );

  IF NOT v_pode OR v_morador.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- `to_json` da linha inteira: a função é o caminho do cadastro completo, e
  -- escolher coluna a coluna aqui faria o painel quebrar em silêncio a cada
  -- campo novo.
  SELECT to_json(v_morador) INTO v_resultado;
  RETURN v_resultado;
END;
$$;

-- Só quem tem sessão. A chave `anon` sem login não chega aqui.
REVOKE ALL ON FUNCTION fn_ler_morador(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_ler_morador(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION fn_ler_morador(UUID) TO authenticated;

COMMENT ON FUNCTION fn_ler_morador(UUID) IS
  'Le o cadastro de um morador e registra a leitura no audit_log (LGPD art. 37). Devolve NULL e grava LEITURA_NEGADA quando o chamador nao tem permissao.';
