-- ===========================================================================
-- Fichas de prontuário: gravação sem leitura
-- ===========================================================================
--
-- O que estes casos provam, depois do setup-completo:
--
-- 1. O agente dono não lê coluna clínica da própria ficha pela API.
-- 2. Lê as chaves, que a sincronização usa no UPDATE.
-- 3. Grava como o aplicativo 1.2.2 grava: INSERT, e na retentativa a chave
--    repetida e o UPDATE pela prontuario_id.
-- 4. O upsert das versões anteriores é recusado, e não aceito em silêncio.
-- 5. Outro agente não altera a ficha.
-- ===========================================================================

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('a9a9a9a9-0000-0000-0000-000000000001', 'Agente Dona',  '40000000001', 'dona@x.test',  'h', 'A', 'UBS Leste', 'agente', true),
  ('a9a9a9a9-0000-0000-0000-000000000002', 'Agente Outra', '40000000002', 'outra@x.test', 'h', 'B', 'UBS Leste', 'agente', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO residencias (id, agente_id, cep, logradouro, numero, bairro, cidade, estado)
VALUES ('f9f9f9f9-0000-0000-0000-000000000001', 'a9a9a9a9-0000-0000-0000-000000000001',
        '17015000', 'Rua Leste', '9', 'Leste', 'Bauru', 'SP')
ON CONFLICT (id) DO NOTHING;

-- Dados simulados.
INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id)
VALUES ('e9e9e9e9-0000-0000-0000-000000000001', 'Moradora Simulada', '1980-05-05', 'feminino',
        'a9a9a9a9-0000-0000-0000-000000000001', 'f9f9f9f9-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO prontuarios (id, morador_id, agente_id)
VALUES ('d9d9d9d9-0000-0000-0000-000000000001', 'e9e9e9e9-0000-0000-0000-000000000001',
        'a9a9a9a9-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Roda um comando sob um papel e devolve: 'ok', 'recusado' (permissão),
-- 'repetida' (chave única) ou 'erro: <estado>'.
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
    WHEN unique_violation THEN v := 'repetida';
    WHEN OTHERS THEN v := 'erro: ' || SQLSTATE;
  END;
  RESET ROLE;
  RETURN v;
END $$;

-- Conta linhas afetadas por um UPDATE sob um papel.
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
-- Gravação como o aplicativo faz
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'ficha_insert_do_dono',
  CASE WHEN pg_temp.como('authenticated', 'a9a9a9a9-0000-0000-0000-000000000001',
    'INSERT INTO prontuario_saude (prontuario_id, pressao_arterial, observacoes)
     VALUES (''d9d9d9d9-0000-0000-0000-000000000001'', ''130/85'', ''Dados simulados'')') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'ficha_retentativa_da_chave_repetida',
  CASE WHEN pg_temp.como('authenticated', 'a9a9a9a9-0000-0000-0000-000000000001',
    'INSERT INTO prontuario_saude (prontuario_id, pressao_arterial)
     VALUES (''d9d9d9d9-0000-0000-0000-000000000001'', ''140/90'')') = 'repetida'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'ficha_update_pela_chave',
  CASE WHEN pg_temp.afetadas('authenticated', 'a9a9a9a9-0000-0000-0000-000000000001',
    'UPDATE prontuario_saude SET pressao_arterial = ''140/90''
      WHERE prontuario_id = ''d9d9d9d9-0000-0000-0000-000000000001''') = 1
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'ficha_gravada_de_fato',
  CASE WHEN (SELECT pressao_arterial FROM prontuario_saude
             WHERE prontuario_id = 'd9d9d9d9-0000-0000-0000-000000000001') = '140/90'
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- Leitura fechada
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'dono_nao_le_coluna_clinica',
  CASE WHEN pg_temp.como('authenticated', 'a9a9a9a9-0000-0000-0000-000000000001',
    'SELECT pressao_arterial FROM prontuario_saude') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'dono_nao_le_com_asterisco',
  CASE WHEN pg_temp.como('authenticated', 'a9a9a9a9-0000-0000-0000-000000000001',
    'SELECT * FROM prontuario_gestante') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'dono_le_as_chaves',
  CASE WHEN pg_temp.como('authenticated', 'a9a9a9a9-0000-0000-0000-000000000001',
    'SELECT id, prontuario_id FROM prontuario_social') = 'ok'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'nenhuma_ficha_legivel_por_completo',
  CASE WHEN (SELECT count(*) FROM information_schema.role_table_grants
             WHERE table_schema = 'public' AND grantee = 'authenticated'
               AND privilege_type = 'SELECT'
               AND table_name IN ('prontuario_saude', 'prontuario_gestante', 'prontuario_puericultura',
                                  'prontuario_mulher', 'prontuario_social')) = 0
  THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- O que não pode passar
-- ---------------------------------------------------------------------------
INSERT INTO resultado SELECT 'upsert_antigo_recusado',
  CASE WHEN pg_temp.como('authenticated', 'a9a9a9a9-0000-0000-0000-000000000001',
    'INSERT INTO prontuario_saude (prontuario_id, pressao_arterial)
     VALUES (''d9d9d9d9-0000-0000-0000-000000000001'', ''150/95'')
     ON CONFLICT (prontuario_id) DO UPDATE SET pressao_arterial = EXCLUDED.pressao_arterial') = 'recusado'
  THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado SELECT 'outro_agente_nao_altera_a_ficha',
  CASE WHEN pg_temp.afetadas('authenticated', 'a9a9a9a9-0000-0000-0000-000000000002',
    'UPDATE prontuario_saude SET pressao_arterial = ''0/0''
      WHERE prontuario_id = ''d9d9d9d9-0000-0000-0000-000000000001''') = 0
  THEN 'OK' ELSE 'FALHOU' END;

SELECT nome || '|' || status FROM resultado ORDER BY nome;
