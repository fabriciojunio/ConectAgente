-- ===========================================================================
-- Conta desativada e funções de painel que falham fechadas
-- ===========================================================================
--
-- O que estes casos provam:
--
-- 1. Agente ativo lê os próprios moradores e usa o painel normalmente.
-- 2. O mesmo agente, desativado, não lê nem grava nada, mesmo com a sessão
--    ainda aberta, e não abre ficha pela função auditada.
-- 3. Usuário logado sem cadastro em `agentes` não recebe os números da cidade
--    pelas funções de painel: antes ele caía no ramo de gerente.
-- 4. A chave anônima não executa as funções de painel.
-- ===========================================================================

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('a7a7a7a7-0000-0000-0000-000000000001', 'Agente Ativo',   '20000000001', 'at@x.test', 'h', 'A', 'UBS Sul', 'agente', true),
  ('a7a7a7a7-0000-0000-0000-000000000002', 'Agente Inativo', '20000000002', 'in@x.test', 'h', 'B', 'UBS Sul', 'agente', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO residencias (id, agente_id, cep, logradouro, numero, bairro, cidade, estado)
VALUES
  ('f7f7f7f7-0000-0000-0000-000000000001', 'a7a7a7a7-0000-0000-0000-000000000001',
   '17014000', 'Rua Sul', '1', 'Sul', 'Bauru', 'SP'),
  ('f7f7f7f7-0000-0000-0000-000000000002', 'a7a7a7a7-0000-0000-0000-000000000002',
   '17014000', 'Rua Sul', '2', 'Sul', 'Bauru', 'SP')
ON CONFLICT (id) DO NOTHING;

-- Dados simulados.
INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id)
VALUES
  ('e7e7e7e7-0000-0000-0000-000000000001', 'Morador do Ativo', '1970-01-01', 'masculino',
   'a7a7a7a7-0000-0000-0000-000000000001', 'f7f7f7f7-0000-0000-0000-000000000001'),
  ('e7e7e7e7-0000-0000-0000-000000000002', 'Morador do Inativo', '1971-01-01', 'feminino',
   'a7a7a7a7-0000-0000-0000-000000000002', 'f7f7f7f7-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Roda um comando sob um papel. Devolve o número de linhas, -1 se recusado
-- por permissão, ou -2 se a função levantou outra exceção.
--
-- Função escalar precisa ser usada no WHERE: num `count(*)` sobre ela, o
-- Postgres nem a executa, porque o valor não é necessário.
CREATE OR REPLACE FUNCTION pg_temp.como(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_n INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE 'SELECT count(*) FROM (' || p_sql || ') q' INTO v_n;
  EXCEPTION
    WHEN insufficient_privilege THEN v_n := -1;
    WHEN OTHERS THEN v_n := -2;
  END;
  RESET ROLE;
  RETURN v_n;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.grava(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE v_ok BOOLEAN := true;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN v_ok := false;
  END;
  RESET ROLE;
  RETURN v_ok;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Ativo funciona
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'ativo_le_os_proprios',
  CASE WHEN pg_temp.como('authenticated', 'a7a7a7a7-0000-0000-0000-000000000001',
    'SELECT id FROM moradores') = 1 THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'ativo_usa_o_painel',
  CASE WHEN pg_temp.como('authenticated', 'a7a7a7a7-0000-0000-0000-000000000001',
    'SELECT r FROM (SELECT fn_dashboard_stats() AS r) d WHERE r IS NOT NULL') = 1 THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 2. Desativado, com a sessão ainda aberta
-- ---------------------------------------------------------------------------
UPDATE agentes SET ativo = false WHERE id = 'a7a7a7a7-0000-0000-0000-000000000002';

INSERT INTO resultado SELECT 'inativo_nao_le_morador',
  CASE WHEN pg_temp.como('authenticated', 'a7a7a7a7-0000-0000-0000-000000000002',
    'SELECT id FROM moradores') = 0 THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'inativo_nao_le_residencia',
  CASE WHEN pg_temp.como('authenticated', 'a7a7a7a7-0000-0000-0000-000000000002',
    'SELECT id FROM residencias') = 0 THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'inativo_nao_grava',
  CASE WHEN NOT pg_temp.grava('authenticated', 'a7a7a7a7-0000-0000-0000-000000000002', $sql$
    INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id)
    VALUES ('e7e7e7e7-0000-0000-0000-000000000003', 'Novo', '1990-01-01', 'outro',
            'a7a7a7a7-0000-0000-0000-000000000002', 'f7f7f7f7-0000-0000-0000-000000000002')
  $sql$) THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'inativo_nao_abre_ficha',
  CASE WHEN pg_temp.como('authenticated', 'a7a7a7a7-0000-0000-0000-000000000002',
    'SELECT fn_ler_morador(''e7e7e7e7-0000-0000-0000-000000000002'')') = -1 THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'inativo_nao_usa_o_painel',
  CASE WHEN pg_temp.como('authenticated', 'a7a7a7a7-0000-0000-0000-000000000002',
    'SELECT r FROM (SELECT fn_dashboard_stats() AS r) d WHERE r IS NOT NULL') = -1 THEN 'OK' ELSE 'FALHOU' END;

-- O ativo da mesma unidade não é afetado pela desativação do colega.
INSERT INTO resultado SELECT 'colega_ativo_segue_normal',
  CASE WHEN pg_temp.como('authenticated', 'a7a7a7a7-0000-0000-0000-000000000001',
    'SELECT id FROM moradores') = 1 THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 3. Logado sem cadastro: as seis funções de painel recusam
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'sem_cadastro_' || f,
  CASE WHEN pg_temp.como('authenticated', '99999999-0000-0000-0000-000000000009', s) = -1
  THEN 'OK' ELSE 'FALHOU' END
FROM (VALUES
  ('dashboard',       'SELECT r FROM (SELECT fn_dashboard_stats() AS r) d WHERE r IS NOT NULL'),
  ('periodo',         'SELECT * FROM fn_visitas_por_periodo(CURRENT_DATE - 30, CURRENT_DATE)'),
  ('por_agente',      'SELECT * FROM fn_visitas_por_agente(CURRENT_DATE - 30, CURRENT_DATE)'),
  ('por_bairro',      'SELECT * FROM fn_visitas_por_bairro(CURRENT_DATE - 30, CURRENT_DATE)'),
  ('em_atraso',       'SELECT * FROM fn_familias_em_atraso()'),
  ('microarea',       'SELECT * FROM fn_cobertura_por_microarea()')
) AS t(f, s);

-- ---------------------------------------------------------------------------
-- 4. A chave anônima nem executa
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'anon_nao_executa_o_painel',
  CASE WHEN pg_temp.como('anon', NULL, 'SELECT r FROM (SELECT fn_dashboard_stats() AS r) d WHERE r IS NOT NULL') = -1
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'funcoes_de_painel_com_search_path',
  CASE WHEN (SELECT count(*) FROM pg_proc
             WHERE proname IN ('fn_dashboard_stats', 'fn_visitas_por_periodo', 'fn_visitas_por_agente',
                               'fn_visitas_por_bairro', 'fn_familias_em_atraso', 'fn_cobertura_por_microarea')
               AND proconfig::text LIKE '%search_path=public, pg_temp%') = 6
  THEN 'OK' ELSE 'FALHOU' END;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
