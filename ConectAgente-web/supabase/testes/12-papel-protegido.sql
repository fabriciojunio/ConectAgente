-- ===========================================================================
-- Ninguém muda o próprio papel, a própria unidade ou reativa a própria conta
-- ===========================================================================
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('a12a12a1-0000-0000-0000-000000000001', 'Agente Doze',       '43000000001', 'ag12@x.test',    'h', 'A', 'UBS Doze',  'agente',      true),
  ('a12a12a1-0000-0000-0000-000000000002', 'Coordenadora Doze', '43000000002', 'coord12@x.test', 'h', 'B', 'UBS Doze',  'coordenador', true),
  ('a12a12a1-0000-0000-0000-000000000003', 'Gerente Doze',      '43000000003', 'ger12@x.test',   'h', 'C', 'UBS Sede',  'gerente',     true),
  ('a12a12a1-0000-0000-0000-000000000004', 'Admin Doze',        '43000000004', 'adm12@x.test',   'h', 'D', 'UBS Sede',  'admin',       true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.como(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v TEXT := 'ok'; n INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN v := 'nada'; END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN v := 'recusado';
    WHEN OTHERS THEN v := 'erro: ' || SQLSTATE;
  END;
  RESET ROLE;
  RETURN v;
END $$;

CREATE TEMP TABLE chamada (nome TEXT, retorno TEXT);

-- O ataque: conta comum se promove pelo PATCH direto na própria linha.
INSERT INTO chamada SELECT 'agente_vira_admin', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000001',
  'UPDATE agentes SET role = ''admin'' WHERE id = ''a12a12a1-0000-0000-0000-000000000001''');
INSERT INTO resultado SELECT 'papel_agente_nao_se_promove',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'agente_vira_admin') <> 'ok'
   AND (SELECT role FROM agentes WHERE id = 'a12a12a1-0000-0000-0000-000000000001') = 'agente'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'coord_troca_unidade', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000002',
  'UPDATE agentes SET unidade_saude = ''UBS Sede'' WHERE id = ''a12a12a1-0000-0000-0000-000000000002''');
INSERT INTO resultado SELECT 'papel_coordenador_nao_troca_unidade_direto',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'coord_troca_unidade') <> 'ok'
   AND (SELECT unidade_saude FROM agentes WHERE id = 'a12a12a1-0000-0000-0000-000000000002') = 'UBS Doze'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'gerente_vira_admin', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000003',
  'UPDATE agentes SET role = ''admin'' WHERE id = ''a12a12a1-0000-0000-0000-000000000003''');
INSERT INTO resultado SELECT 'papel_gerente_nao_vira_admin',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'gerente_vira_admin') <> 'ok'
   AND (SELECT role FROM agentes WHERE id = 'a12a12a1-0000-0000-0000-000000000003') = 'gerente'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'gerente_cria_admin', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000003',
  'UPDATE agentes SET role = ''admin'' WHERE id = ''a12a12a1-0000-0000-0000-000000000001''');
INSERT INTO resultado SELECT 'papel_gerente_nao_cria_admin',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'gerente_cria_admin') <> 'ok'
   AND (SELECT role FROM agentes WHERE id = 'a12a12a1-0000-0000-0000-000000000001') = 'agente'
  THEN 'OK' ELSE 'FALHOU' END;

-- O uso legítimo continua funcionando.
INSERT INTO chamada SELECT 'agente_muda_telefone', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000001',
  'UPDATE agentes SET telefone = ''14999990000'' WHERE id = ''a12a12a1-0000-0000-0000-000000000001''');
INSERT INTO resultado SELECT 'papel_agente_edita_o_proprio_contato',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'agente_muda_telefone') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'admin_promove', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000004',
  'UPDATE agentes SET role = ''coordenador'' WHERE id = ''a12a12a1-0000-0000-0000-000000000001''');
INSERT INTO resultado SELECT 'papel_admin_muda_papel_de_outro',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'admin_promove') = 'ok'
   AND (SELECT role FROM agentes WHERE id = 'a12a12a1-0000-0000-0000-000000000001') = 'coordenador'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'gerente_desativa', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000003',
  'UPDATE agentes SET ativo = false WHERE id = ''a12a12a1-0000-0000-0000-000000000002''');
INSERT INTO resultado SELECT 'papel_gerente_desativa_conta',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'gerente_desativa') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'coord_se_reativa', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000002',
  'UPDATE agentes SET ativo = true WHERE id = ''a12a12a1-0000-0000-0000-000000000002''');
INSERT INTO resultado SELECT 'papel_conta_desativada_nao_se_reativa',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'coord_se_reativa') <> 'ok'
   AND (SELECT ativo FROM agentes WHERE id = 'a12a12a1-0000-0000-0000-000000000002') = false
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO chamada SELECT 'gerente_desativa_admin', pg_temp.como('authenticated', 'a12a12a1-0000-0000-0000-000000000003',
  'UPDATE agentes SET ativo = false WHERE id = ''a12a12a1-0000-0000-0000-000000000004''');
INSERT INTO resultado SELECT 'papel_gerente_nao_desativa_admin',
  CASE WHEN (SELECT retorno FROM chamada WHERE nome = 'gerente_desativa_admin') <> 'ok'
   AND (SELECT ativo FROM agentes WHERE id = 'a12a12a1-0000-0000-0000-000000000004') = true
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'papel_mudanca_de_papel_fica_na_trilha',
  CASE WHEN EXISTS (SELECT 1 FROM audit_log
                    WHERE registro_id = 'a12a12a1-0000-0000-0000-000000000001'
                      AND dados_anteriores ->> 'role' = 'agente'
                      AND dados_novos ->> 'role' = 'coordenador')
  THEN 'OK' ELSE 'FALHOU' END;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
