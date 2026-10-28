-- ===========================================================================
-- Colunas sensíveis de morador: só pela leitura auditada
-- ===========================================================================
--
-- O que estes casos provam:
--
-- 1. Usuário logado lê as colunas de lista do próprio morador direto.
-- 2. Usuário logado NÃO lê cpf, cartão do SUS, doença ou medicação direto,
--    nem com `select *`, que é o que o PostgREST gera para `*`.
-- 3. A chave anônima não lê nada.
-- 4. O aplicativo continua gravando como o `syncService` faz: INSERT, UPDATE
--    na retentativa e exclusão lógica, sob o papel `authenticated`.
-- 5. `fn_ler_morador` continua devolvendo o cadastro completo.
-- 6. A busca por documento acha com o documento exato, não acha com pedaço
--    dele, não acha morador de outro agente, e registra a busca sem guardar
--    o documento.
--
-- Cada caso troca de papel com SET ROLE dentro de um bloco, guarda o
-- resultado numa variável e volta para o superusuário antes de anotar.
-- ===========================================================================

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agente Um',   '10000000001', 'a1@x.test', 'h', 'A1', 'UBS Centro', 'agente', true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agente Dois', '10000000002', 'a2@x.test', 'h', 'A2', 'UBS Norte',  'agente', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO residencias (id, agente_id, cep, logradouro, numero, bairro, cidade, estado)
VALUES
  ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '17012000', 'Rua Um', '1', 'Centro', 'Bauru', 'SP'),
  ('ffffffff-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   '17013000', 'Rua Dois', '2', 'Norte', 'Bauru', 'SP')
ON CONFLICT (id) DO NOTHING;

-- Dados simulados.
INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id,
                       cpf, cartao_sus, doencas, medicamentos_lista)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'Morador do Um', '1980-01-01', 'masculino',
   'aaaaaaaa-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001',
   '111.444.777-35', '898001160665209', 'Hipertensao', 'Losartana'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Morador do Dois', '1985-01-01', 'feminino',
   'bbbbbbbb-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000002',
   '529.982.247-25', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

DELETE FROM audit_log WHERE tabela = 'moradores';

-- Executa um comando sob um papel e diz se ele foi recusado por permissão.
CREATE OR REPLACE FUNCTION pg_temp.recusado(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_recusado BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN insufficient_privilege THEN
    v_recusado := true;
  END;
  RESET ROLE;
  RETURN v_recusado;
END $$;

-- Conta linhas visíveis de uma consulta sob um papel (-1 se recusada).
CREATE OR REPLACE FUNCTION pg_temp.contar(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE 'SELECT count(*) FROM (' || p_sql || ') q' INTO v_n;
  EXCEPTION WHEN insufficient_privilege THEN
    v_n := -1;
  END;
  RESET ROLE;
  RETURN v_n;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Colunas de lista continuam legíveis, sob RLS
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'lista_legivel_para_o_dono',
  CASE WHEN pg_temp.contar('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
    'SELECT id, nome, data_nascimento, is_hipertenso FROM moradores') = 1
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 2. Colunas sensíveis recusadas para o usuário logado
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'cpf_direto_recusado',
  CASE WHEN pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
    'SELECT cpf FROM moradores') THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'cartao_sus_direto_recusado',
  CASE WHEN pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
    'SELECT cartao_sus FROM moradores') THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'doenca_e_medicacao_recusadas',
  CASE WHEN pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
    'SELECT doencas, medicamentos_lista FROM moradores') THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'select_asterisco_recusado',
  CASE WHEN pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
    'SELECT * FROM moradores') THEN 'OK' ELSE 'FALHOU' END;

-- Filtrar por coluna sensível também é ler: `where cpf = ...` serviria de
-- oráculo para descobrir se um documento existe.
INSERT INTO resultado SELECT 'filtro_por_cpf_recusado',
  CASE WHEN pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
    'SELECT id FROM moradores WHERE cpf = ''111.444.777-35''') THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 3. A chave anônima não lê nada
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'anon_nao_le_nem_o_nome',
  CASE WHEN pg_temp.recusado('anon', NULL, 'SELECT nome FROM moradores')
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 4. O aplicativo continua gravando como o syncService grava
-- ---------------------------------------------------------------------------
-- Primeiro envio: INSERT puro, com documento e doença.
INSERT INTO resultado SELECT 'insert_do_aplicativo_funciona',
  CASE WHEN NOT pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001', $sql$
    INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id, cpf, doencas)
    VALUES ('eeeeeeee-0000-0000-0000-000000000003', 'Morador Novo', '1990-05-05', 'feminino',
            'aaaaaaaa-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001',
            '390.533.447-05', 'Asma')
  $sql$)
  THEN 'GRAVOU' ELSE 'FALHOU' END;
-- Conferido em outro comando: no mesmo, o EXISTS veria o banco de antes.
UPDATE resultado SET status = CASE WHEN EXISTS (SELECT 1 FROM moradores WHERE id = 'eeeeeeee-0000-0000-0000-000000000003'
                     AND cpf = '390.533.447-05') THEN 'OK' ELSE 'FALHOU' END
WHERE nome = 'insert_do_aplicativo_funciona' AND status = 'GRAVOU';

-- Retentativa ou edição: UPDATE pelo id, mexendo em coluna sensível.
INSERT INTO resultado SELECT 'update_do_aplicativo_funciona',
  CASE WHEN NOT pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001', $sql$
    UPDATE moradores SET doencas = 'Asma controlada', cpf = '390.533.447-05'
    WHERE id = 'eeeeeeee-0000-0000-0000-000000000003'
  $sql$)
  THEN 'GRAVOU' ELSE 'FALHOU' END;
-- Conferido em outro comando: no mesmo, o EXISTS veria o banco de antes.
UPDATE resultado SET status = CASE WHEN EXISTS (SELECT 1 FROM moradores WHERE id = 'eeeeeeee-0000-0000-0000-000000000003'
                     AND doencas = 'Asma controlada') THEN 'OK' ELSE 'FALHOU' END
WHERE nome = 'update_do_aplicativo_funciona' AND status = 'GRAVOU';

-- O upsert é recusado: ON CONFLICT DO UPDATE exige ler a coluna que atualiza.
-- É por isso que o aplicativo grava morador sem upsert. Se este caso um dia
-- passar, alguém reabriu a leitura das colunas.
INSERT INTO resultado SELECT 'upsert_com_coluna_sensivel_recusado',
  CASE WHEN pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001', $sql$
    INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id, doencas)
    VALUES ('eeeeeeee-0000-0000-0000-000000000003', 'Morador Novo', '1990-05-05', 'feminino',
            'aaaaaaaa-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001', 'x')
    ON CONFLICT (id) DO UPDATE SET doencas = EXCLUDED.doencas
  $sql$) THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'exclusao_logica_funciona',
  CASE WHEN NOT pg_temp.recusado('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
    'UPDATE moradores SET deleted_at = NOW() WHERE id = ''eeeeeeee-0000-0000-0000-000000000003''')
  THEN 'GRAVOU' ELSE 'FALHOU' END;
-- Conferido em outro comando: no mesmo, o EXISTS veria o banco de antes.
UPDATE resultado SET status = CASE WHEN EXISTS (SELECT 1 FROM moradores WHERE id = 'eeeeeeee-0000-0000-0000-000000000003'
               AND deleted_at IS NOT NULL) THEN 'OK' ELSE 'FALHOU' END
WHERE nome = 'exclusao_logica_funciona' AND status = 'GRAVOU';

-- ---------------------------------------------------------------------------
-- 5. A leitura auditada continua entregando o cadastro completo
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_json JSON;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  SET ROLE authenticated;
  v_json := fn_ler_morador('eeeeeeee-0000-0000-0000-000000000001');
  RESET ROLE;
  INSERT INTO resultado VALUES ('leitura_auditada_traz_o_cpf',
    CASE WHEN v_json->>'cpf' = '111.444.777-35' THEN 'OK' ELSE 'FALHOU' END);
END $$;

-- ---------------------------------------------------------------------------
-- 6. Busca por documento
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_exato INT; v_sus INT; v_pedaco INT; v_alheio INT;
BEGIN
  DELETE FROM audit_log WHERE acao = 'BUSCA_DOCUMENTO';
  PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  SET ROLE authenticated;
  SELECT count(*) INTO v_exato  FROM fn_buscar_morador_por_documento('11144477735');
  SELECT count(*) INTO v_sus    FROM fn_buscar_morador_por_documento('898 0011 6066 5209');
  SELECT count(*) INTO v_pedaco FROM fn_buscar_morador_por_documento('111444');
  -- Documento válido, mas o morador é do Agente Dois.
  SELECT count(*) INTO v_alheio FROM fn_buscar_morador_por_documento('52998224725');
  RESET ROLE;

  INSERT INTO resultado VALUES
    ('busca_acha_cpf_exato',          CASE WHEN v_exato  = 1 THEN 'OK' ELSE 'FALHOU' END),
    ('busca_acha_cartao_sus',         CASE WHEN v_sus    = 1 THEN 'OK' ELSE 'FALHOU' END),
    ('busca_nao_aceita_pedaco',       CASE WHEN v_pedaco = 0 THEN 'OK' ELSE 'FALHOU' END),
    ('busca_nao_acha_de_outro_agente', CASE WHEN v_alheio = 0 THEN 'OK' ELSE 'FALHOU' END);
END $$;

INSERT INTO resultado SELECT 'busca_registrada',
  CASE WHEN (SELECT count(*) FROM audit_log WHERE acao = 'BUSCA_DOCUMENTO'
             AND agente_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'busca_nao_guarda_o_documento',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM audit_log WHERE acao = 'BUSCA_DOCUMENTO'
      AND (dados_novos::text LIKE '%11144477735%' OR dados_novos::text LIKE '%52998224725%'
        OR registro_id LIKE '%111444%')
  ) THEN 'OK' ELSE 'FALHOU' END;

DO $$
DECLARE v_lancou BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', false);
  BEGIN
    PERFORM fn_buscar_morador_por_documento('11144477735');
  EXCEPTION WHEN OTHERS THEN v_lancou := true;
  END;
  INSERT INTO resultado VALUES ('busca_sem_sessao_recusa', CASE WHEN v_lancou THEN 'OK' ELSE 'FALHOU' END);
END $$;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
