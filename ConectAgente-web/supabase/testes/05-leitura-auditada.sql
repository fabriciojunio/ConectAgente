-- ===========================================================================
-- Leitura auditada de morador: fn_ler_morador
-- ===========================================================================
--
-- O que estes casos provam, e por que cada um importa:
--
-- 1. Quem pode ler, lê, e a leitura fica registrada. É o art. 37 da LGPD.
-- 2. Quem não pode, recebe NULL, e a tentativa fica registrada. Sem isso,
--    varrer ids não deixaria marca nenhuma.
-- 3. Sem sessão a função recusa: registro que não sabe de quem é não serve.
-- 4. A regra da função e a da policy `moradores_select` concordam. Se alguém
--    mexer numa e esquecer a outra, o painel passa a mostrar o que o banco
--    nega, ou o contrário.
--
-- Os resultados vão para uma tabela temporária e saem no fim, em linhas
-- `nome|OK`. É o que permite testar também o caso que lança exceção, que num
-- `SELECT` solto abortaria o arquivo inteiro.
-- ===========================================================================

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

CREATE TEMP TABLE resultado (nome TEXT, status TEXT);

-- ---------------------------------------------------------------------------
-- Cenário: dois agentes de unidades diferentes, um coordenador, um gerente,
-- e um morador de cada agente.
-- ---------------------------------------------------------------------------
INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, role, ativo)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agente Um',   '10000000001', 'a1@x.test', 'h', 'A1', 'UBS Centro', 'agente',      true),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agente Dois', '10000000002', 'a2@x.test', 'h', 'A2', 'UBS Norte',  'agente',      true),
  ('cccccccc-0000-0000-0000-000000000001', 'Coord Centro','10000000003', 'c1@x.test', 'h', 'C1', 'UBS Centro', 'coordenador', true),
  ('dddddddd-0000-0000-0000-000000000001', 'Gerente',     '10000000004', 'g1@x.test', 'h', 'G1', 'UBS Centro', 'gerente',     true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO residencias (id, agente_id, cep, logradouro, numero, bairro, cidade, estado)
VALUES
  ('ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   '17012000', 'Rua Um', '1', 'Centro', 'Bauru', 'SP'),
  ('ffffffff-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
   '17013000', 'Rua Dois', '2', 'Norte', 'Bauru', 'SP')
ON CONFLICT (id) DO NOTHING;

INSERT INTO moradores (id, nome, data_nascimento, sexo, agente_id, residencia_id)
VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'Morador do Um',   '1980-01-01', 'masculino',
   'aaaaaaaa-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000001'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Morador do Dois', '1985-01-01', 'feminino',
   'bbbbbbbb-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

DELETE FROM audit_log WHERE tabela = 'moradores';

-- ---------------------------------------------------------------------------
-- 1. O dono lê o próprio morador, e a leitura fica registrada
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

INSERT INTO resultado
SELECT 'dono_le_o_proprio',
  CASE WHEN fn_ler_morador('eeeeeeee-0000-0000-0000-000000000001') IS NOT NULL
       THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado
SELECT 'dono_leitura_registrada',
  CASE WHEN EXISTS (
    SELECT 1 FROM audit_log
    WHERE acao = 'LEITURA' AND tabela = 'moradores'
      AND agente_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      AND registro_id = 'eeeeeeee-0000-0000-0000-000000000001'
  ) THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 2. Agente de outra área não lê, e a tentativa fica registrada
-- ---------------------------------------------------------------------------
INSERT INTO resultado
SELECT 'outro_agente_nao_le',
  CASE WHEN fn_ler_morador('eeeeeeee-0000-0000-0000-000000000002') IS NULL
       THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado
SELECT 'tentativa_negada_registrada',
  CASE WHEN EXISTS (
    SELECT 1 FROM audit_log
    WHERE acao = 'LEITURA_NEGADA'
      AND agente_id = 'aaaaaaaa-0000-0000-0000-000000000001'
      AND registro_id = 'eeeeeeee-0000-0000-0000-000000000002'
  ) THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 3. Coordenador: lê da unidade dele, não lê de outra
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000001', false);

INSERT INTO resultado
SELECT 'coordenador_le_da_unidade',
  CASE WHEN fn_ler_morador('eeeeeeee-0000-0000-0000-000000000001') IS NOT NULL
       THEN 'OK' ELSE 'FALHOU' END;

INSERT INTO resultado
SELECT 'coordenador_nao_le_de_outra',
  CASE WHEN fn_ler_morador('eeeeeeee-0000-0000-0000-000000000002') IS NULL
       THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 4. Gerente lê qualquer um
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000001', false);

INSERT INTO resultado
SELECT 'gerente_le_qualquer',
  CASE WHEN fn_ler_morador('eeeeeeee-0000-0000-0000-000000000002') IS NOT NULL
       THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- 5. Sem sessão a função recusa, em vez de devolver dado sem dono
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_lancou BOOLEAN := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', false);
  BEGIN
    PERFORM fn_ler_morador('eeeeeeee-0000-0000-0000-000000000001');
  EXCEPTION WHEN OTHERS THEN
    v_lancou := true;
  END;
  INSERT INTO resultado VALUES ('sem_sessao_recusa', CASE WHEN v_lancou THEN 'OK' ELSE 'FALHOU' END);
END $$;

-- ---------------------------------------------------------------------------
-- 6. A função e a policy concordam, para toda combinação de papel e morador
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_quem UUID;
  v_alvo UUID;
  v_policy BOOLEAN;
  v_funcao BOOLEAN;
  v_divergencias INT := 0;
BEGIN
  FOREACH v_quem IN ARRAY ARRAY[
    'aaaaaaaa-0000-0000-0000-000000000001'::UUID,
    'bbbbbbbb-0000-0000-0000-000000000002'::UUID,
    'cccccccc-0000-0000-0000-000000000001'::UUID,
    'dddddddd-0000-0000-0000-000000000001'::UUID
  ] LOOP
    FOREACH v_alvo IN ARRAY ARRAY[
      'eeeeeeee-0000-0000-0000-000000000001'::UUID,
      'eeeeeeee-0000-0000-0000-000000000002'::UUID
    ] LOOP
      SELECT EXISTS (
        SELECT 1 FROM agentes a, moradores m
        WHERE a.id = v_quem AND m.id = v_alvo AND (
          a.role IN ('gerente', 'admin')
          OR (a.role = 'coordenador' AND a.unidade_saude = (
            SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = m.agente_id
          ))
          OR (a.role = 'agente' AND m.agente_id = v_quem)
        )
      ) INTO v_policy;

      PERFORM set_config('request.jwt.claim.sub', v_quem::text, false);
      SELECT fn_ler_morador(v_alvo) IS NOT NULL INTO v_funcao;

      IF v_policy IS DISTINCT FROM v_funcao THEN
        v_divergencias := v_divergencias + 1;
      END IF;
    END LOOP;
  END LOOP;

  INSERT INTO resultado
  VALUES ('funcao_e_policy_concordam', CASE WHEN v_divergencias = 0 THEN 'OK' ELSE 'FALHOU' END);
END $$;

-- ---------------------------------------------------------------------------
-- 7. A trilha não guarda dado pessoal do morador
-- ---------------------------------------------------------------------------
INSERT INTO resultado
SELECT 'trilha_sem_dado_pessoal',
  CASE WHEN NOT EXISTS (
    SELECT 1 FROM audit_log
    WHERE tabela = 'moradores'
      AND (dados_novos::text ILIKE '%Morador do%'
        OR dados_novos::text ILIKE '%1980-01-01%')
  ) THEN 'OK' ELSE 'FALHOU' END;

-- ---------------------------------------------------------------------------
-- Saída
-- ---------------------------------------------------------------------------
SELECT nome || '|' || status FROM resultado ORDER BY nome;
