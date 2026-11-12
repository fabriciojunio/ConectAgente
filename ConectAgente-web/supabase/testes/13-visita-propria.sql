-- ===========================================================================
-- Visita só na família que é do agente
-- ===========================================================================
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('a13a13a1-0000-0000-0000-000000000001', 'Agente Treze A', '44000000001', 'ag13a@x.test', 'h', 'A', 'UBS Treze', 'agente', true),
  ('a13a13a1-0000-0000-0000-000000000002', 'Agente Treze B', '44000000002', 'ag13b@x.test', 'h', 'B', 'UBS Treze', 'agente', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO residencias (id, agente_id, cep, logradouro, numero, bairro, cidade, estado)
VALUES
  ('f13f13f1-0000-0000-0000-000000000001', 'a13a13a1-0000-0000-0000-000000000001', '17015000', 'Rua Treze', '1', 'Centro', 'Bauru', 'SP'),
  ('f13f13f1-0000-0000-0000-000000000002', 'a13a13a1-0000-0000-0000-000000000002', '17015000', 'Rua Treze', '2', 'Centro', 'Bauru', 'SP')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp.como(p_sub TEXT, p_sql TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v TEXT := 'ok';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_sub, false);
  SET ROLE authenticated;
  BEGIN
    EXECUTE p_sql;
  EXCEPTION
    WHEN insufficient_privilege THEN v := 'recusado';
    WHEN OTHERS THEN v := 'erro: ' || SQLSTATE;
  END;
  RESET ROLE;
  RETURN v;
END $$;

INSERT INTO resultado SELECT 'visita_na_propria_familia',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'INSERT INTO visitas (agente_id, residencia_id, data_visita, status) VALUES (''a13a13a1-0000-0000-0000-000000000001'', ''f13f13f1-0000-0000-0000-000000000001'', now(), ''realizada'')') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'visita_na_familia_de_outro_agente',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'INSERT INTO visitas (agente_id, residencia_id, data_visita, status) VALUES (''a13a13a1-0000-0000-0000-000000000001'', ''f13f13f1-0000-0000-0000-000000000002'', now(), ''realizada'')') = 'recusado'
   AND NOT EXISTS (SELECT 1 FROM visitas WHERE residencia_id = 'f13f13f1-0000-0000-0000-000000000002')
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'visita_movida_para_familia_de_outro',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'UPDATE visitas SET residencia_id = ''f13f13f1-0000-0000-0000-000000000002'' WHERE residencia_id = ''f13f13f1-0000-0000-0000-000000000001''') IN ('recusado', 'ok')
   AND NOT EXISTS (SELECT 1 FROM visitas WHERE residencia_id = 'f13f13f1-0000-0000-0000-000000000002')
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id)
VALUES ('e13e13e1-0000-0000-0000-000000000002', 'Morador do B', '1990-01-01', 'masculino', 'a13a13a1-0000-0000-0000-000000000002', 'f13f13f1-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO resultado SELECT 'morador_na_familia_de_outro_agente',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'INSERT INTO moradores (nome, data_nascimento, sexo, agente_id, residencia_id) VALUES (''Intruso'', ''1990-01-01'', ''masculino'', ''a13a13a1-0000-0000-0000-000000000001'', ''f13f13f1-0000-0000-0000-000000000002'')') = 'recusado'
   AND NOT EXISTS (SELECT 1 FROM moradores WHERE nome = 'Intruso')
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'agendamento_na_familia_de_outro_agente',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'INSERT INTO agendamentos (agente_id, residencia_id, data_agendada, motivo) VALUES (''a13a13a1-0000-0000-0000-000000000001'', ''f13f13f1-0000-0000-0000-000000000002'', current_date, ''intruso'')') = 'recusado'
   AND NOT EXISTS (SELECT 1 FROM agendamentos WHERE motivo = 'intruso')
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'agendamento_com_morador_de_outro_agente',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'INSERT INTO agendamentos (agente_id, residencia_id, morador_id, data_agendada, motivo) VALUES (''a13a13a1-0000-0000-0000-000000000001'', ''f13f13f1-0000-0000-0000-000000000001'', ''e13e13e1-0000-0000-0000-000000000002'', current_date, ''intruso2'')') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'agendamento_na_propria_familia',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'INSERT INTO agendamentos (agente_id, residencia_id, data_agendada, motivo) VALUES (''a13a13a1-0000-0000-0000-000000000001'', ''f13f13f1-0000-0000-0000-000000000001'', current_date, ''retorno'')') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

-- As regras de exclusão valem: visita e morador só saem pela gerência.
INSERT INTO resultado SELECT 'agente_nao_apaga_a_propria_visita',
  CASE WHEN pg_temp.como('a13a13a1-0000-0000-0000-000000000001',
    'DELETE FROM visitas WHERE agente_id = ''a13a13a1-0000-0000-0000-000000000001''') IN ('ok', 'recusado')
   AND EXISTS (SELECT 1 FROM visitas WHERE agente_id = 'a13a13a1-0000-0000-0000-000000000001')
  THEN 'OK' ELSE 'FALHOU' END;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
