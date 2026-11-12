-- ===========================================================================
-- Medicamentos e dúvidas: gravação sem leitura, só o agente dono
-- ===========================================================================
--
-- O que estes casos provam, depois do setup-completo:
--
-- 1. O agente grava o medicamento do próprio morador como o aplicativo 1.2.5
--    grava: INSERT, e a resposta da equipe por UPDATE pelo id.
-- 2. Não lê coluna clínica pela API (nome, dúvida, resposta), só as chaves.
-- 3. Não grava para morador de outro agente, nem em nome de outro agente.
-- 4. Outro agente não altera nem apaga.
-- 5. Visitante sem login não tem privilégio; conta desativada não grava.
-- 6. O banco recusa profissional fora da lista.
-- ===========================================================================

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('a10a10a1-0000-0000-0000-000000000001', 'Agente Dona',      '41000000001', 'dona10@x.test',  'h', 'A', 'UBS Leste', 'agente', true),
  ('a10a10a1-0000-0000-0000-000000000002', 'Agente Outra',     '41000000002', 'outra10@x.test', 'h', 'B', 'UBS Leste', 'agente', true),
  ('a10a10a1-0000-0000-0000-000000000003', 'Agente Desligada', '41000000003', 'desl10@x.test',  'h', 'C', 'UBS Leste', 'agente', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO residencias (id, agente_id, cep, logradouro, numero, bairro, cidade, estado)
VALUES
  ('f10f10f1-0000-0000-0000-000000000001', 'a10a10a1-0000-0000-0000-000000000001', '17015000', 'Rua Leste', '10', 'Leste', 'Bauru', 'SP'),
  ('f10f10f1-0000-0000-0000-000000000002', 'a10a10a1-0000-0000-0000-000000000002', '17015000', 'Rua Leste', '12', 'Leste', 'Bauru', 'SP'),
  ('f10f10f1-0000-0000-0000-000000000003', 'a10a10a1-0000-0000-0000-000000000003', '17015000', 'Rua Leste', '14', 'Leste', 'Bauru', 'SP')
ON CONFLICT (id) DO NOTHING;

-- Dados simulados.
INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id)
VALUES
  ('e10e10e1-0000-0000-0000-000000000001', 'Moradora da Dona',      '1970-01-01', 'feminino',  'a10a10a1-0000-0000-0000-000000000001', 'f10f10f1-0000-0000-0000-000000000001'),
  ('e10e10e1-0000-0000-0000-000000000002', 'Morador da Outra',      '1960-01-01', 'masculino', 'a10a10a1-0000-0000-0000-000000000002', 'f10f10f1-0000-0000-0000-000000000002'),
  ('e10e10e1-0000-0000-0000-000000000003', 'Morador da Desligada',  '1950-01-01', 'masculino', 'a10a10a1-0000-0000-0000-000000000003', 'f10f10f1-0000-0000-0000-000000000003')
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
    WHEN check_violation THEN v := 'invalido';
    WHEN OTHERS THEN v := 'erro: ' || SQLSTATE;
  END;
  RESET ROLE;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.afetadas(p_papel TEXT, p_sub TEXT, p_sql TEXT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_sub, ''), false);
  EXECUTE format('SET ROLE %I', p_papel);
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS v = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN v := -1;
  END;
  RESET ROLE;
  RETURN v;
END $$;

-- ---------------------------------------------------------------------------
-- Uso legítimo
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'med_insert_do_dono',
  CASE WHEN pg_temp.como('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'INSERT INTO medicamentos (id, morador_id, agente_id, nome, dosagem, duvida, problemas_uso)
     VALUES (''c10c10c1-0000-0000-0000-000000000001'', ''e10e10e1-0000-0000-0000-000000000001'',
             ''a10a10a1-0000-0000-0000-000000000001'', ''Losartana'', ''50 mg'',
             ''Pode tomar a noite?'', ''esquece'')') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_resposta_do_dono',
  CASE WHEN pg_temp.afetadas('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'UPDATE medicamentos SET duvida_respondida = true, resposta_medico = ''Pode, apos o jantar.'',
            respondido_por = ''enfermeiro'', data_resposta = now()
      WHERE id = ''c10c10c1-0000-0000-0000-000000000001''') = 1
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_dono_le_as_chaves',
  CASE WHEN pg_temp.como('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'SELECT id, morador_id, agente_id FROM medicamentos') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- O que não pode passar
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'med_dono_nao_le_a_duvida',
  CASE WHEN pg_temp.como('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'SELECT duvida, resposta_medico FROM medicamentos') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_nao_grava_morador_de_outro',
  CASE WHEN pg_temp.como('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'INSERT INTO medicamentos (id, morador_id, agente_id, nome)
     VALUES (''c10c10c1-0000-0000-0000-000000000002'', ''e10e10e1-0000-0000-0000-000000000002'',
             ''a10a10a1-0000-0000-0000-000000000001'', ''Dipirona'')') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_nao_grava_em_nome_de_outro',
  CASE WHEN pg_temp.como('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'INSERT INTO medicamentos (id, morador_id, agente_id, nome)
     VALUES (''c10c10c1-0000-0000-0000-000000000003'', ''e10e10e1-0000-0000-0000-000000000001'',
             ''a10a10a1-0000-0000-0000-000000000002'', ''Dipirona'')') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_outro_agente_nao_altera',
  CASE WHEN pg_temp.afetadas('authenticated', 'a10a10a1-0000-0000-0000-000000000002',
    'UPDATE medicamentos SET resposta_medico = ''x'' WHERE id = ''c10c10c1-0000-0000-0000-000000000001''') = 0
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_outro_agente_nao_apaga',
  CASE WHEN pg_temp.afetadas('authenticated', 'a10a10a1-0000-0000-0000-000000000002',
    'DELETE FROM medicamentos WHERE id = ''c10c10c1-0000-0000-0000-000000000001''') = 0
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_visitante_recusado',
  CASE WHEN pg_temp.como('anon', NULL, 'SELECT count(*) FROM medicamentos') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_conta_desativada_nao_grava',
  CASE WHEN pg_temp.como('authenticated', 'a10a10a1-0000-0000-0000-000000000003',
    'INSERT INTO medicamentos (id, morador_id, agente_id, nome)
     VALUES (''c10c10c1-0000-0000-0000-000000000004'', ''e10e10e1-0000-0000-0000-000000000003'',
             ''a10a10a1-0000-0000-0000-000000000003'', ''Dipirona'')') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_profissional_fora_da_lista',
  CASE WHEN pg_temp.como('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'UPDATE medicamentos SET respondido_por = ''vizinho'' WHERE id = ''c10c10c1-0000-0000-0000-000000000001''') = 'invalido'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'med_dono_apaga_o_proprio',
  CASE WHEN pg_temp.afetadas('authenticated', 'a10a10a1-0000-0000-0000-000000000001',
    'DELETE FROM medicamentos WHERE id = ''c10c10c1-0000-0000-0000-000000000001''') = 1
  THEN 'OK' ELSE 'FALHOU' END;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
