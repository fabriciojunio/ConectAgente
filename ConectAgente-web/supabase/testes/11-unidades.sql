-- ===========================================================================
-- Unidades: cada coordenação escolhe a sua área uma vez; a gerência designa
-- ===========================================================================
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('a11a11a1-0000-0000-0000-000000000001', 'Coordenadora Nova',   '42000000001', 'coord11@x.test',  'h', 'A', '',           'coordenador', true),
  ('a11a11a1-0000-0000-0000-000000000002', 'Coordenadora Antiga', '42000000002', 'coord11b@x.test', 'h', 'B', 'UBS Antiga', 'coordenador', true),
  ('a11a11a1-0000-0000-0000-000000000003', 'Gerente Onze',        '42000000003', 'ger11@x.test',    'h', 'C', 'UBS Sede',   'gerente',     true),
  ('a11a11a1-0000-0000-0000-000000000004', 'Agente Onze',         '42000000004', 'ag11@x.test',     'h', 'D', '',           'agente',      true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.como(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v TEXT := 'ok';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE p_sql;
  EXCEPTION
    WHEN insufficient_privilege THEN v := 'recusado';
    WHEN invalid_parameter_value THEN v := 'invalido';
    WHEN OTHERS THEN v := 'erro: ' || SQLSTATE;
  END;
  RESET ROLE;
  RETURN v;
END $$;

-- Uso legítimo -------------------------------------------------------------
-- Chamada e conferência em comandos separados: dentro do mesmo comando a
-- conferência enxergaria os dados de antes da chamada.
CREATE TEMP TABLE chamada (nome TEXT, retorno TEXT);
INSERT INTO chamada SELECT 'escolha', pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000001',
  'SELECT public.fn_escolher_minha_unidade(''  UBS Jardim Onze  '')');
INSERT INTO resultado SELECT 'unid_coordenador_sem_area_cria_a_sua',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'escolha') = 'ok'
   AND (SELECT unidade_saude FROM agentes WHERE id = 'a11a11a1-0000-0000-0000-000000000001') = 'UBS Jardim Onze'
   AND EXISTS (SELECT 1 FROM unidades_saude WHERE nome = 'UBS Jardim Onze')
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'unid_escolha_fica_na_trilha',
  CASE WHEN EXISTS (SELECT 1 FROM audit_log WHERE agente_id = 'a11a11a1-0000-0000-0000-000000000001'
                    AND dados_novos ->> 'unidade_escolhida' = 'UBS Jardim Onze')
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'designacao', pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000003',
  'SELECT public.fn_designar_unidade(''a11a11a1-0000-0000-0000-000000000004'', ''UBS Jardim Onze'')');
INSERT INTO resultado SELECT 'unid_gerente_designa_agente',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'designacao') = 'ok'
   AND (SELECT unidade_saude FROM agentes WHERE id = 'a11a11a1-0000-0000-0000-000000000004') = 'UBS Jardim Onze'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'unid_catalogo_legivel_logado',
  CASE WHEN pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000004',
    'SELECT count(*) FROM unidades_saude') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

-- O que não pode passar ------------------------------------------------------
INSERT INTO resultado SELECT 'unid_coordenador_nao_troca_sozinho',
  CASE WHEN pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000002',
    'SELECT public.fn_escolher_minha_unidade(''UBS Sede'')') = 'recusado'
   AND (SELECT unidade_saude FROM agentes WHERE id = 'a11a11a1-0000-0000-0000-000000000002') = 'UBS Antiga'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'unid_agente_nao_escolhe',
  CASE WHEN pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000004',
    'SELECT public.fn_escolher_minha_unidade(''UBS Qualquer'')') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'unid_coordenador_nao_designa',
  CASE WHEN pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000002',
    'SELECT public.fn_designar_unidade(''a11a11a1-0000-0000-0000-000000000004'', ''UBS Antiga'')') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'unid_ninguem_grava_direto',
  CASE WHEN pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000003',
    'INSERT INTO unidades_saude (nome) VALUES (''UBS Direta'')') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'unid_visitante_nao_le',
  CASE WHEN pg_temp.como('anon', NULL, 'SELECT count(*) FROM unidades_saude') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'unid_nome_curto_recusado',
  CASE WHEN pg_temp.como('authenticated', 'a11a11a1-0000-0000-0000-000000000003',
    'SELECT public.fn_designar_unidade(''a11a11a1-0000-0000-0000-000000000004'', ''X'')') = 'invalido'
  THEN 'OK' ELSE 'FALHOU' END;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
