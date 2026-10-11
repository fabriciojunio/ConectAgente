-- ===========================================================================
-- Faz o servidor aceitar o prontuario que o agente preenche em campo
-- ===========================================================================
--
-- As cinco tabelas de prontuario existem no servidor desde o inicio, com RLS
-- e policies, mas quase vazias de colunas. O aplicativo preenche 53 campos
-- que nao tinham destino nenhum. Comparando o CREATE TABLE do SQLite local
-- com o do Postgres, tabela por tabela:
--
--   prontuario_saude         13 colunas sem destino
--   prontuario_gestante      10
--   prontuario_puericultura   9
--   prontuario_mulher         9
--   prontuario_social        11
--   metas_visitas             1
--
-- Isso e o miolo do trabalho do agente comunitario de saude: pre-natal,
-- cartao de vacina da crianca, preventivo e mamografia, suspeita de
-- violencia domestica e de negligencia, encaminhamento para a assistente
-- social. Nenhum desses dados conseguia sair do aparelho.
--
-- O tipo de cada coluna espelha o do banco local de proposito. Onde o
-- aplicativo guarda texto livre, aqui tambem e TEXT: a pressao e a glicemia
-- sao anotadas como o agente mediu, por exemplo 130/85 ou 110 em jejum, e
-- trocar por numero agora perderia dado. As datas tambem ficam TEXT, porque
-- o formulario pode devolver string vazia e o Postgres recusa string vazia
-- para DATE, o que derrubaria a linha inteira. Apertar o tipo depois exige
-- normalizar a entrada no aplicativo primeiro, e e um passo separado.
--
-- Idempotente, pode rodar em banco que ja tem dado.
-- ===========================================================================

BEGIN;

-- --------------------------------------------------------------------
-- prontuario_saude
-- --------------------------------------------------------------------
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS is_tuberculose            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS is_hanseniase             BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS hgt_ultima_afericao       TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS hgt_valor                 TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS pa_ultima_afericao        TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS pa_valor                  TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS tem_receita_atualizada    BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS ultima_consulta           TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS proxima_consulta          TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS precisa_agendamento       BOOLEAN DEFAULT false;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS especialidade_agendamento TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS queixas                   TEXT;
ALTER TABLE prontuario_saude ADD COLUMN IF NOT EXISTS observacoes               TEXT;

-- --------------------------------------------------------------------
-- prontuario_gestante
-- --------------------------------------------------------------------
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS is_gestante                BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS data_dum                   TEXT;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS semanas_gestacao           INTEGER;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS pre_natal_em_dia           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS local_pre_natal            TEXT;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS proxima_consulta_pre_natal TEXT;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS vacina_tetano_em_dia       BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS vacina_hepatiteb_em_dia    BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS sulfato_ferroso            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_gestante ADD COLUMN IF NOT EXISTS acido_folico               BOOLEAN DEFAULT false;

-- --------------------------------------------------------------------
-- prontuario_puericultura
-- --------------------------------------------------------------------
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS is_crianca                     BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS peso_atual                     TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS altura_atual                   TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS cartao_vacina_em_dia           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS vacinas_em_atraso              TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS consulta_acompanhamento_em_dia BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS proxima_consulta               TEXT;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS frequenta_escola               BOOLEAN DEFAULT false;
ALTER TABLE prontuario_puericultura ADD COLUMN IF NOT EXISTS nome_escola                    TEXT;

-- --------------------------------------------------------------------
-- prontuario_mulher
-- --------------------------------------------------------------------
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS ultima_menstruacao           TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS papanicolau_em_dia           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS data_ultimo_papanicolau      TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS mamografia_em_dia            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS data_ultima_mamografia       TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS usa_anticoncepcional         BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS tipo_anticoncepcional        TEXT;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS consulta_ginecologica_em_dia BOOLEAN DEFAULT false;
ALTER TABLE prontuario_mulher ADD COLUMN IF NOT EXISTS prevencao_dts                BOOLEAN DEFAULT false;

-- --------------------------------------------------------------------
-- prontuario_social
-- --------------------------------------------------------------------
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS vulnerabilidade_social        TEXT DEFAULT 'nenhum';
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_vulnerabilidade     TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS negligencia_parental          BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_negligencia         TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS violencia_domestica           BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_violencia           TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS depressao_suspeita            BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS uso_alcool_drogas             BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS descricao_uso                 TEXT;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS encaminhado_assistente_social BOOLEAN DEFAULT false;
ALTER TABLE prontuario_social ADD COLUMN IF NOT EXISTS data_encaminhamento           TEXT;

-- --------------------------------------------------------------------
-- metas_visitas: nada a acrescentar, e o aplicativo que precisa ceder
-- --------------------------------------------------------------------
-- O aplicativo guarda a meta em `meta_total`; o servidor tem `meta`, com
-- NOT NULL e CHECK (meta > 0). Acrescentar uma segunda coluna aqui criaria
-- duas fontes para o mesmo numero, que e o tipo de divergencia que deu
-- origem a esta migracao. O servidor fica como esta e a traducao do nome
-- acontece em um lugar so, no `prepararPayloadParaServidor` do aplicativo.
--
-- Medido: enviar o payload do aplicativo sem traducao da
--   ERROR: null value in column "meta" of relation "metas_visitas"
--          violates not-null constraint

-- --------------------------------------------------------------------
-- prontuario_social: o CHECK precisa aceitar o valor inicial
-- --------------------------------------------------------------------
-- O padrao do aplicativo e 'nenhum', que e o estado de toda ficha recem
-- criada. A coluna antiga do servidor (nivel_vulnerabilidade) tinha CHECK
-- que nao aceitava esse valor, o que recusaria a primeira gravacao de
-- qualquer prontuario social. Nenhum codigo le nivel_vulnerabilidade, nem no
-- painel nem no aplicativo, entao ela fica onde esta para nao mexer em
-- schema que o time compartilha, mas pode sair numa limpeza combinada.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'prontuario_social_vulnerabilidade_check'
  ) THEN
    ALTER TABLE prontuario_social
      ADD CONSTRAINT prontuario_social_vulnerabilidade_check
      CHECK (vulnerabilidade_social IN ('nenhum','baixo','medio','alto','critico'));
  END IF;
END $$;

-- --------------------------------------------------------------------
-- agendamentos: o status estava em tres vocabularios diferentes
-- --------------------------------------------------------------------
-- Aparelho grava 'agendada' e 'cancelada'. Servidor aceitava apenas
-- 'pendente', 'realizado' e 'cancelado'. O tipo em TypeScript dizia ainda
-- uma terceira coisa. Resultado medido num Postgres de verdade, repetindo o
-- que o aplicativo faz ao cancelar um agendamento:
--
--   ERROR: new row for relation "agendamentos" violates check constraint
--          "agendamentos_status_check"
--
-- Cancelar agendamento nunca chegava ao servidor. O vocabulario escolhido e
-- o do aplicativo, que ja e o mesmo de visitas.status e o unico que aparece
-- na tela. O painel web nao le esta tabela, nada quebra do outro lado.

ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;

UPDATE agendamentos SET status = 'agendada'  WHERE status = 'pendente';
UPDATE agendamentos SET status = 'realizada' WHERE status = 'realizado';
UPDATE agendamentos SET status = 'cancelada' WHERE status = 'cancelado';

ALTER TABLE agendamentos ALTER COLUMN status SET DEFAULT 'agendada';
ALTER TABLE agendamentos
  ADD CONSTRAINT agendamentos_status_check
  CHECK (status IN ('agendada','realizada','cancelada','nao_encontrado'));

-- --------------------------------------------------------------------
-- Indices para o que de fato e consultado
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agendamentos_agente_data
  ON agendamentos (agente_id, data_agendada);
CREATE INDEX IF NOT EXISTS idx_metas_agente_periodo
  ON metas_visitas (agente_id, ano, mes);

-- --------------------------------------------------------------------
-- Conferencia: falha alto se ficou faltando coluna
-- --------------------------------------------------------------------
DO $$
DECLARE
  faltando TEXT;
BEGIN
  SELECT string_agg(t.tabela || '.' || t.coluna, ', ')
    INTO faltando
    FROM (VALUES
      ('prontuario_saude','is_tuberculose'),
      ('prontuario_saude','pa_valor'),
      ('prontuario_saude','queixas'),
      ('prontuario_gestante','is_gestante'),
      ('prontuario_gestante','semanas_gestacao'),
      ('prontuario_puericultura','cartao_vacina_em_dia'),
      ('prontuario_mulher','papanicolau_em_dia'),
      ('prontuario_social','vulnerabilidade_social'),
      ('prontuario_social','violencia_domestica'),
      ('metas_visitas','meta')
    ) AS t(tabela, coluna)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.tabela
        AND c.column_name = t.coluna
   );

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'colunas de prontuario ainda faltando: %', faltando;
  END IF;
END $$;

COMMIT;
