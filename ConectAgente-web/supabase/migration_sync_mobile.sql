-- ===========================================================================
-- Alinha o servidor com o que o aplicativo de campo realmente coleta
-- ===========================================================================
--
-- O problema, medido e nao suposto. O aplicativo monta o payload de sync com
-- o objeto local inteiro e manda para o Supabase. Rodando o schema real num
-- PostgreSQL e repetindo o insert que o aplicativo faz, o banco responde:
--
--   ERROR: column "status_sync" of relation "residencias" does not exist
--   ERROR: column "motivo_visita" of relation "visitas" does not exist
--
-- Ou seja: nenhuma residencia, nenhum morador e nenhuma visita registrada em
-- campo chegava ao painel. A fila de sync acumulava, tentava de novo ate o
-- limite de tentativas e marcava erro. Como o aplicativo e offline-first e
-- continua funcionando com o banco local, nada aparentava estar errado para
-- o agente.
--
-- Duas causas separadas:
--
--   1. O nome do campo de controle de sincronizacao. Local e `status_sync`,
--      servidor e `sync_status`. Isso se resolve no aplicativo, nao aqui: o
--      campo e escrituracao local (esta linha ja subiu?) e nao faz sentido
--      enviar. O servidor ja tem DEFAULT 'sincronizado', que e o estado
--      correto de uma linha que acabou de chegar.
--
--   2. A tabela `visitas` do servidor nao tem oito colunas que o aplicativo
--      preenche. E o conteudo clinico da visita: pressao, glicemia, peso,
--      medicacao em dia, cartao de vacina, encaminhamento, motivo e
--      assinatura. Isso se resolve aqui.
--
-- Esta migracao e idempotente e pode rodar em banco que ja tem dado.
-- ===========================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Conteudo clinico da visita
-- ─────────────────────────────────────────────────────────────────────
-- Todos entram como NULL permitido de proposito: visita antiga nao tem esse
-- dado e inventar valor seria pior que a ausencia.

ALTER TABLE visitas ADD COLUMN IF NOT EXISTS motivo_visita          TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS pa_visita              TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS glicemia_visita        TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS peso_visita            TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS medicamentos_em_dia    BOOLEAN;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS cartao_vacinas_em_dia  BOOLEAN;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS encaminhamentos        TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS assinatura_base64      TEXT;

COMMENT ON COLUMN visitas.pa_visita IS
  'Pressao arterial aferida na visita, como o agente anotou (ex: 130/85). Texto e nao numero porque o agente escreve do jeito que mede.';
COMMENT ON COLUMN visitas.glicemia_visita IS
  'Glicemia capilar aferida na visita, em mg/dL, como anotada.';
COMMENT ON COLUMN visitas.assinatura_base64 IS
  'Assinatura do morador no aparelho. Dado pessoal: so trafega sob as policies de visitas e nunca aparece em relatorio exportado.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. Indice que o painel precisa e nao tinha
-- ─────────────────────────────────────────────────────────────────────
-- O painel filtra visita por status e por periodo ao mesmo tempo, em toda
-- tela de monitoramento. Sem indice composto o Postgres varre a tabela.

CREATE INDEX IF NOT EXISTS idx_visitas_status_data
  ON visitas (status, data_visita DESC);

-- Alerta de familia em atraso procura a ultima visita por residencia.
CREATE INDEX IF NOT EXISTS idx_visitas_residencia_data
  ON visitas (residencia_id, data_visita DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. Conferencia
-- ─────────────────────────────────────────────────────────────────────
-- Falha alto e cedo se alguma coluna que o aplicativo manda ficou de fora.

DO $$
DECLARE
  faltando TEXT;
BEGIN
  SELECT string_agg(c.nome, ', ')
    INTO faltando
    FROM (VALUES
      ('motivo_visita'), ('pa_visita'), ('glicemia_visita'), ('peso_visita'),
      ('medicamentos_em_dia'), ('cartao_vacinas_em_dia'), ('encaminhamentos'),
      ('assinatura_base64'), ('queixas'), ('observacoes'),
      ('precisa_agendamento'), ('especialidade_agendamento')
    ) AS c(nome)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'visitas'
        AND column_name = c.nome
   );

  IF faltando IS NOT NULL THEN
    RAISE EXCEPTION 'visitas ainda sem as colunas que o aplicativo envia: %', faltando;
  END IF;
END $$;

COMMIT;
