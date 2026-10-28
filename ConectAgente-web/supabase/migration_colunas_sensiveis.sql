-- ===========================================================================
-- Colunas sensíveis de morador só saem pela leitura auditada
-- ===========================================================================
--
-- O problema que isto fecha.
--
-- `fn_ler_morador` grava o registro da leitura na mesma transação (LGPD,
-- art. 37). Só que a tabela continuava com GRANT de SELECT inteiro para
-- `authenticated`: qualquer usuário logado pedia `cpf`, `cartao_sus` ou
-- `doencas` direto ao PostgREST, sob RLS, e lia sem deixar rastro. O próprio
-- painel fazia isso na tela da família. A função auditada existia e era
-- contornável por qualquer um.
--
-- O conserto é o mesmo já usado em `agentes.senha_hash`: revogar a tabela e
-- conceder as colunas uma a uma. `REVOKE SELECT (coluna)` sozinho não tem
-- efeito enquanto houver GRANT na tabela inteira.
--
-- Fica legível direto o que as listas do painel precisam para coordenar o
-- trabalho: nome, idade, sexo e os marcadores de acompanhamento. Documento,
-- contato, filiação, doença, medicação, convênio, benefício e escolaridade
-- só saem por `fn_ler_morador`, que registra quem leu.
--
-- O aplicativo de campo só envia moradores ao servidor, nunca lê de volta, e
-- grava com upsert sem pedir retorno. INSERT e UPDATE continuam com o GRANT
-- que já tinham.
-- ===========================================================================

REVOKE SELECT ON moradores FROM anon, authenticated;

GRANT SELECT (
  id,
  residencia_id,
  agente_id,
  nome,
  data_nascimento,
  sexo,
  is_responsavel,
  is_hipertenso,
  is_diabetico,
  is_gestante,
  is_domiciliado,
  tem_doenca,
  sync_status,
  deleted_at,
  created_at,
  updated_at
) ON moradores TO authenticated;

-- ---------------------------------------------------------------------------
-- fn_buscar_morador_por_documento
-- ---------------------------------------------------------------------------
-- A busca do painel por CPF ou cartão do SUS filtrava no navegador, sobre a
-- lista inteira já carregada com os documentos. Sem a coluna legível, a busca
-- passa a ser aqui: comparação exata, para não servir de oráculo de prefixo,
-- devolvendo só as colunas de lista, e registrando a busca.
--
-- O documento procurado não vai para a trilha: ele é dado pessoal, e a trilha
-- é lida por gerente e admin. Fica registrado quem buscou e o que encontrou.
DROP FUNCTION IF EXISTS fn_buscar_morador_por_documento(TEXT);

CREATE OR REPLACE FUNCTION fn_buscar_morador_por_documento(p_documento TEXT)
RETURNS SETOF JSON
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_chamador UUID := auth.uid();
  v_digitos TEXT := regexp_replace(COALESCE(p_documento, ''), '\D', '', 'g');
  v_morador moradores%ROWTYPE;
  v_achados INT := 0;
BEGIN
  IF v_chamador IS NULL THEN
    RAISE EXCEPTION 'sem sessao: busca por documento exige usuario autenticado';
  END IF;

  -- CPF tem 11 dígitos e o cartão do SUS 15. Menos que isso não é documento,
  -- é tentativa de varrer.
  IF length(v_digitos) NOT IN (11, 15) THEN
    RETURN;
  END IF;

  FOR v_morador IN
    SELECT m.* FROM moradores m
    WHERE m.deleted_at IS NULL
      AND (regexp_replace(COALESCE(m.cpf, ''), '\D', '', 'g') = v_digitos
        OR regexp_replace(COALESCE(m.cartao_sus, ''), '\D', '', 'g') = v_digitos)
      -- Mesma regra da policy `moradores_select` e de `fn_ler_morador`.
      AND EXISTS (
        SELECT 1 FROM agentes a
        WHERE a.id = v_chamador AND (
          a.role IN ('gerente', 'admin')
          OR (a.role = 'coordenador' AND a.unidade_saude = (
            SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = m.agente_id
          ))
          OR (a.role = 'agente' AND m.agente_id = v_chamador)
        )
      )
  LOOP
    v_achados := v_achados + 1;
    RETURN NEXT json_build_object(
      'id', v_morador.id,
      'residencia_id', v_morador.residencia_id,
      'agente_id', v_morador.agente_id,
      'nome', v_morador.nome,
      'data_nascimento', v_morador.data_nascimento,
      'sexo', v_morador.sexo,
      'is_hipertenso', v_morador.is_hipertenso,
      'is_diabetico', v_morador.is_diabetico,
      'is_gestante', v_morador.is_gestante
    );
  END LOOP;

  INSERT INTO audit_log (agente_id, acao, tabela, registro_id, dados_novos, created_at)
  VALUES (
    v_chamador,
    'BUSCA_DOCUMENTO',
    'moradores',
    'busca',
    json_build_object('origem', 'painel web', 'encontrados', v_achados)::jsonb,
    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION fn_buscar_morador_por_documento(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_buscar_morador_por_documento(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION fn_buscar_morador_por_documento(TEXT) TO authenticated;

COMMENT ON FUNCTION fn_buscar_morador_por_documento(TEXT) IS
  'Busca morador por CPF ou cartao do SUS, com comparacao exata, devolve so colunas de lista e registra a busca no audit_log sem o documento.';
