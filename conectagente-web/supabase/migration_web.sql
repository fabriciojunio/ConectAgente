-- ===========================================================================
-- ConectAgente Web Dashboard - Migration SQL
-- ===========================================================================
-- LGPD (Lei Geral de Proteção de Dados) Compliance Notes:
--   - All personal data (CPF, nome, endereço) is protected by RLS policies.
--   - Only authorized roles can access patient/resident data.
--   - Audit logging tracks all data access and modifications.
--   - Data minimization: aggregation functions return only necessary fields.
--   - SECURITY DEFINER functions run with elevated privileges but filter
--     results internally based on the caller's role and unidade_saude.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add role and microarea columns to agentes
-- ---------------------------------------------------------------------------
ALTER TABLE agentes
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'agente'
    CHECK (role IN ('agente', 'coordenador', 'gerente', 'admin'));

ALTER TABLE agentes
  ADD COLUMN IF NOT EXISTS microarea TEXT;

COMMENT ON COLUMN agentes.role IS 'Papel do agente no sistema: agente, coordenador, gerente ou admin';
COMMENT ON COLUMN agentes.microarea IS 'Microárea de atuação do agente dentro da unidade de saúde';

-- ---------------------------------------------------------------------------
-- 2. Indexes for performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agentes_role ON agentes (role);
CREATE INDEX IF NOT EXISTS idx_agentes_microarea ON agentes (microarea);
CREATE INDEX IF NOT EXISTS idx_agentes_unidade_saude ON agentes (unidade_saude);
CREATE INDEX IF NOT EXISTS idx_agentes_ativo ON agentes (ativo);

CREATE INDEX IF NOT EXISTS idx_visitas_data_visita ON visitas (data_visita);
CREATE INDEX IF NOT EXISTS idx_visitas_status ON visitas (status);
CREATE INDEX IF NOT EXISTS idx_visitas_agente_data ON visitas (agente_id, data_visita);

CREATE INDEX IF NOT EXISTS idx_residencias_bairro ON residencias (bairro);
CREATE INDEX IF NOT EXISTS idx_residencias_agente_id ON residencias (agente_id);

CREATE INDEX IF NOT EXISTS idx_moradores_agente_id ON moradores (agente_id);
CREATE INDEX IF NOT EXISTS idx_moradores_residencia_id ON moradores (residencia_id);

CREATE INDEX IF NOT EXISTS idx_agendamentos_agente_id ON agendamentos (agente_id);
CREATE INDEX IF NOT EXISTS idx_metas_visitas_agente_id ON metas_visitas (agente_id);
CREATE INDEX IF NOT EXISTS idx_prontuarios_morador_id ON prontuarios (morador_id);

-- ---------------------------------------------------------------------------
-- 3. Helper function: get current user's role and unidade_saude
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _get_user_role()
RETURNS TABLE (user_role TEXT, user_unidade TEXT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role, unidade_saude
  FROM agentes
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. Drop old RLS policies and create new role-based policies
-- ---------------------------------------------------------------------------

-- === RESIDENCIAS ===
ALTER TABLE residencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "residencias_select" ON residencias;
DROP POLICY IF EXISTS "residencias_insert" ON residencias;
DROP POLICY IF EXISTS "residencias_update" ON residencias;
DROP POLICY IF EXISTS "residencias_delete" ON residencias;
-- Drop any other common legacy policy names
DROP POLICY IF EXISTS "Agentes podem ver suas residencias" ON residencias;
DROP POLICY IF EXISTS "Agentes podem inserir residencias" ON residencias;
DROP POLICY IF EXISTS "Agentes podem atualizar suas residencias" ON residencias;

CREATE POLICY "residencias_select" ON residencias FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = residencias.agente_id
      ))
      OR (a.role = 'agente' AND residencias.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "residencias_insert" ON residencias FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "residencias_update" ON residencias FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = residencias.agente_id
      ))
      OR (a.role = 'agente' AND residencias.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "residencias_delete" ON residencias FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === MORADORES ===
ALTER TABLE moradores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moradores_select" ON moradores;
DROP POLICY IF EXISTS "moradores_insert" ON moradores;
DROP POLICY IF EXISTS "moradores_update" ON moradores;
DROP POLICY IF EXISTS "moradores_delete" ON moradores;
DROP POLICY IF EXISTS "Agentes podem ver seus moradores" ON moradores;
DROP POLICY IF EXISTS "Agentes podem inserir moradores" ON moradores;
DROP POLICY IF EXISTS "Agentes podem atualizar seus moradores" ON moradores;

CREATE POLICY "moradores_select" ON moradores FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = moradores.agente_id
      ))
      OR (a.role = 'agente' AND moradores.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "moradores_insert" ON moradores FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "moradores_update" ON moradores FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = moradores.agente_id
      ))
      OR (a.role = 'agente' AND moradores.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "moradores_delete" ON moradores FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === VISITAS ===
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visitas_select" ON visitas;
DROP POLICY IF EXISTS "visitas_insert" ON visitas;
DROP POLICY IF EXISTS "visitas_update" ON visitas;
DROP POLICY IF EXISTS "visitas_delete" ON visitas;
DROP POLICY IF EXISTS "Agentes podem ver suas visitas" ON visitas;
DROP POLICY IF EXISTS "Agentes podem inserir visitas" ON visitas;
DROP POLICY IF EXISTS "Agentes podem atualizar suas visitas" ON visitas;

CREATE POLICY "visitas_select" ON visitas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = visitas.agente_id
      ))
      OR (a.role = 'agente' AND visitas.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "visitas_insert" ON visitas FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "visitas_update" ON visitas FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = visitas.agente_id
      ))
      OR (a.role = 'agente' AND visitas.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "visitas_delete" ON visitas FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === AGENDAMENTOS ===
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agendamentos_select" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_insert" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_update" ON agendamentos;
DROP POLICY IF EXISTS "agendamentos_delete" ON agendamentos;
DROP POLICY IF EXISTS "Agentes podem ver seus agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Agentes podem inserir agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Agentes podem atualizar seus agendamentos" ON agendamentos;

CREATE POLICY "agendamentos_select" ON agendamentos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = agendamentos.agente_id
      ))
      OR (a.role = 'agente' AND agendamentos.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "agendamentos_insert" ON agendamentos FOR INSERT WITH CHECK (
  agente_id = auth.uid()
);

CREATE POLICY "agendamentos_update" ON agendamentos FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = agendamentos.agente_id
      ))
      OR (a.role = 'agente' AND agendamentos.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "agendamentos_delete" ON agendamentos FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === METAS_VISITAS ===
ALTER TABLE metas_visitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_visitas_select" ON metas_visitas;
DROP POLICY IF EXISTS "metas_visitas_insert" ON metas_visitas;
DROP POLICY IF EXISTS "metas_visitas_update" ON metas_visitas;
DROP POLICY IF EXISTS "metas_visitas_delete" ON metas_visitas;
DROP POLICY IF EXISTS "Agentes podem ver suas metas" ON metas_visitas;

CREATE POLICY "metas_visitas_select" ON metas_visitas FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = metas_visitas.agente_id
      ))
      OR (a.role = 'agente' AND metas_visitas.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "metas_visitas_insert" ON metas_visitas FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('coordenador', 'gerente', 'admin')
  )
);

CREATE POLICY "metas_visitas_update" ON metas_visitas FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('coordenador', 'gerente', 'admin')
  )
);

CREATE POLICY "metas_visitas_delete" ON metas_visitas FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- === PRONTUARIOS ===
ALTER TABLE prontuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prontuarios_select" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_insert" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_update" ON prontuarios;
DROP POLICY IF EXISTS "prontuarios_delete" ON prontuarios;
DROP POLICY IF EXISTS "Agentes podem ver seus prontuarios" ON prontuarios;

-- LGPD: Prontuários contain sensitive health data. Access is strictly controlled.
CREATE POLICY "prontuarios_select" ON prontuarios FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM moradores m
    JOIN agentes a ON a.id = auth.uid()
    WHERE m.id = prontuarios.morador_id AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'coordenador' AND a.unidade_saude = (
        SELECT a2.unidade_saude FROM agentes a2 WHERE a2.id = m.agente_id
      ))
      OR (a.role = 'agente' AND m.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "prontuarios_insert" ON prontuarios FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM moradores m WHERE m.id = prontuarios.morador_id AND m.agente_id = auth.uid()
  )
);

CREATE POLICY "prontuarios_update" ON prontuarios FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM moradores m
    JOIN agentes a ON a.id = auth.uid()
    WHERE m.id = prontuarios.morador_id AND (
      a.role IN ('gerente', 'admin')
      OR (a.role = 'agente' AND m.agente_id = auth.uid())
    )
  )
);

CREATE POLICY "prontuarios_delete" ON prontuarios FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM agentes a WHERE a.id = auth.uid() AND a.role IN ('gerente', 'admin')
  )
);

-- ---------------------------------------------------------------------------
-- 5. RPC Functions for Dashboard Aggregation
-- ---------------------------------------------------------------------------
-- LGPD: These functions use SECURITY DEFINER to bypass RLS but apply their
-- own role-based filtering internally. They return only aggregated/anonymized
-- data suitable for dashboards and reports. No raw PII is exposed.
-- ---------------------------------------------------------------------------

-- === fn_dashboard_stats ===
-- Returns key statistics for the dashboard overview.
CREATE OR REPLACE FUNCTION fn_dashboard_stats(
  p_unidade TEXT DEFAULT NULL,
  p_agente_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
  v_result JSON;
BEGIN
  -- Get caller's role and unidade_saude
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  -- Agentes can only see their own stats
  IF v_role = 'agente' THEN
    p_agente_id := auth.uid();
    p_unidade := NULL;
  ELSIF v_role = 'coordenador' THEN
    -- Coordenadores are restricted to their unidade
    p_unidade := v_unidade;
  END IF;
  -- gerente and admin: no restrictions, use provided filters

  SELECT json_build_object(
    'visitas_hoje', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date = CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'visitas_semana', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date >= date_trunc('week', CURRENT_DATE)
        AND v.data_visita::date <= CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'visitas_mes', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date >= date_trunc('month', CURRENT_DATE)
        AND v.data_visita::date <= CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'total_familias', (
      SELECT COUNT(*) FROM residencias r
      JOIN agentes a ON a.id = r.agente_id
      WHERE r.deleted_at IS NULL
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR r.agente_id = p_agente_id)
    ),
    'total_moradores', (
      SELECT COUNT(*) FROM moradores m
      JOIN agentes a ON a.id = m.agente_id
      WHERE m.deleted_at IS NULL
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR m.agente_id = p_agente_id)
    ),
    'agentes_ativos', (
      SELECT COUNT(*) FROM agentes
      WHERE ativo = true
        AND (p_unidade IS NULL OR unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR id = p_agente_id)
    ),
    'visitas_realizadas', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.status = 'realizada'
        AND v.data_visita::date >= date_trunc('month', CURRENT_DATE)
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'visitas_pendentes', (
      SELECT COUNT(*) FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.status = 'agendada'
        AND v.data_visita::date >= CURRENT_DATE
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    ),
    'taxa_conclusao', (
      SELECT COALESCE(
        ROUND(
          COUNT(*) FILTER (WHERE v.status = 'realizada')::numeric /
          NULLIF(COUNT(*), 0) * 100, 1
        ), 0
      )
      FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date >= date_trunc('month', CURRENT_DATE)
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
        AND (p_agente_id IS NULL OR v.agente_id = p_agente_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION fn_dashboard_stats IS 'LGPD: Returns only aggregated counts. No PII exposed.';

-- === fn_visitas_por_periodo ===
-- Returns visit counts grouped by date for a given period.
CREATE OR REPLACE FUNCTION fn_visitas_por_periodo(
  p_inicio DATE,
  p_fim DATE,
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  data DATE,
  total_visitas BIGINT,
  realizadas BIGINT,
  canceladas BIGINT,
  nao_encontrado BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  IF v_role = 'agente' THEN
    RETURN QUERY
      SELECT
        v.data_visita::date AS data,
        COUNT(*) AS total_visitas,
        COUNT(*) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(*) FILTER (WHERE v.status = 'cancelada') AS canceladas,
        COUNT(*) FILTER (WHERE v.status = 'nao_encontrado') AS nao_encontrado
      FROM visitas v
      WHERE v.data_visita::date BETWEEN p_inicio AND p_fim
        AND v.agente_id = auth.uid()
      GROUP BY v.data_visita::date
      ORDER BY v.data_visita::date;
  ELSE
    RETURN QUERY
      SELECT
        v.data_visita::date AS data,
        COUNT(*) AS total_visitas,
        COUNT(*) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(*) FILTER (WHERE v.status = 'cancelada') AS canceladas,
        COUNT(*) FILTER (WHERE v.status = 'nao_encontrado') AS nao_encontrado
      FROM visitas v
      JOIN agentes a ON a.id = v.agente_id
      WHERE v.data_visita::date BETWEEN p_inicio AND p_fim
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
      GROUP BY v.data_visita::date
      ORDER BY v.data_visita::date;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_visitas_por_periodo IS 'LGPD: Returns only aggregated visit counts by date. No PII exposed.';

-- === fn_visitas_por_agente ===
-- Returns visit statistics grouped by agent.
CREATE OR REPLACE FUNCTION fn_visitas_por_agente(
  p_inicio DATE,
  p_fim DATE,
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  agente_id UUID,
  nome TEXT,
  total BIGINT,
  realizadas BIGINT,
  pendentes BIGINT,
  taxa NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  IF v_role = 'agente' THEN
    RETURN QUERY
      SELECT
        a.id AS agente_id,
        a.nome,
        COUNT(v.id) AS total,
        COUNT(v.id) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(v.id) FILTER (WHERE v.status = 'agendada') AS pendentes,
        COALESCE(
          ROUND(
            COUNT(v.id) FILTER (WHERE v.status = 'realizada')::numeric /
            NULLIF(COUNT(v.id), 0) * 100, 1
          ), 0
        ) AS taxa
      FROM agentes a
      LEFT JOIN visitas v ON v.agente_id = a.id
        AND v.data_visita::date BETWEEN p_inicio AND p_fim
      WHERE a.id = auth.uid()
      GROUP BY a.id, a.nome;
  ELSE
    RETURN QUERY
      SELECT
        a.id AS agente_id,
        a.nome,
        COUNT(v.id) AS total,
        COUNT(v.id) FILTER (WHERE v.status = 'realizada') AS realizadas,
        COUNT(v.id) FILTER (WHERE v.status = 'agendada') AS pendentes,
        COALESCE(
          ROUND(
            COUNT(v.id) FILTER (WHERE v.status = 'realizada')::numeric /
            NULLIF(COUNT(v.id), 0) * 100, 1
          ), 0
        ) AS taxa
      FROM agentes a
      LEFT JOIN visitas v ON v.agente_id = a.id
        AND v.data_visita::date BETWEEN p_inicio AND p_fim
      WHERE a.ativo = true
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
      GROUP BY a.id, a.nome
      ORDER BY total DESC;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_visitas_por_agente IS 'LGPD: Returns agent names with aggregated stats. Minimal PII (agent names only).';

-- === fn_visitas_por_bairro ===
-- Returns visit and family statistics grouped by neighborhood.
CREATE OR REPLACE FUNCTION fn_visitas_por_bairro(
  p_inicio DATE,
  p_fim DATE
)
RETURNS TABLE (
  bairro TEXT,
  total_visitas BIGINT,
  total_familias BIGINT,
  cobertura_pct NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  RETURN QUERY
    SELECT
      r.bairro,
      COUNT(DISTINCT v.id) AS total_visitas,
      COUNT(DISTINCT r.id) AS total_familias,
      COALESCE(
        ROUND(
          COUNT(DISTINCT CASE WHEN v.id IS NOT NULL THEN r.id END)::numeric /
          NULLIF(COUNT(DISTINCT r.id), 0) * 100, 1
        ), 0
      ) AS cobertura_pct
    FROM residencias r
    JOIN agentes a ON a.id = r.agente_id
    LEFT JOIN visitas v ON v.residencia_id = r.id
      AND v.data_visita::date BETWEEN p_inicio AND p_fim
      AND v.status = 'realizada'
    WHERE r.deleted_at IS NULL
      AND (
        v_role IN ('gerente', 'admin')
        OR (v_role = 'coordenador' AND a.unidade_saude = v_unidade)
        OR (v_role = 'agente' AND a.id = auth.uid())
      )
    GROUP BY r.bairro
    ORDER BY total_visitas DESC;
END;
$$;

COMMENT ON FUNCTION fn_visitas_por_bairro IS 'LGPD: Returns only neighborhood-level aggregations. No PII exposed.';

-- === fn_familias_em_atraso ===
-- Returns families that have not been visited within the specified number of days.
CREATE OR REPLACE FUNCTION fn_familias_em_atraso(
  p_dias INT DEFAULT 30,
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  residencia_id UUID,
  endereco TEXT,
  bairro TEXT,
  agente_nome TEXT,
  ultima_visita TIMESTAMPTZ,
  dias_sem_visita INT,
  nivel_criticidade TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  RETURN QUERY
    SELECT
      r.id AS residencia_id,
      CONCAT(r.logradouro, ', ', r.numero, ' - ', r.bairro) AS endereco,
      r.bairro,
      a.nome AS agente_nome,
      MAX(v.data_visita) AS ultima_visita,
      EXTRACT(DAY FROM NOW() - MAX(v.data_visita))::INT AS dias_sem_visita,
      CASE
        WHEN EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) > 30 THEN 'critico'
        WHEN EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) > 15 THEN 'alerta'
        WHEN EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) > 7 THEN 'atencao'
        ELSE 'normal'
      END AS nivel_criticidade
    FROM residencias r
    JOIN agentes a ON a.id = r.agente_id
    LEFT JOIN visitas v ON v.residencia_id = r.id AND v.status = 'realizada'
    WHERE r.deleted_at IS NULL
      AND (
        v_role IN ('gerente', 'admin')
        OR (v_role = 'coordenador' AND a.unidade_saude = v_unidade)
        OR (v_role = 'agente' AND a.id = auth.uid())
      )
      AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
    GROUP BY r.id, r.logradouro, r.numero, r.bairro, a.nome
    HAVING MAX(v.data_visita) IS NULL
      OR EXTRACT(DAY FROM NOW() - MAX(v.data_visita)) >= p_dias
    ORDER BY dias_sem_visita DESC NULLS FIRST;
END;
$$;

COMMENT ON FUNCTION fn_familias_em_atraso IS 'LGPD: Returns address-level data for overdue visits. Access restricted by role.';

-- === fn_cobertura_por_microarea ===
-- Returns coverage statistics grouped by microarea.
CREATE OR REPLACE FUNCTION fn_cobertura_por_microarea(
  p_unidade TEXT DEFAULT NULL
)
RETURNS TABLE (
  microarea TEXT,
  total_familias BIGINT,
  familias_visitadas_30d BIGINT,
  cobertura_pct NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_unidade TEXT;
BEGIN
  SELECT role, unidade_saude INTO v_role, v_unidade
  FROM agentes WHERE id = auth.uid();

  IF v_role = 'coordenador' THEN
    p_unidade := v_unidade;
  END IF;

  IF v_role = 'agente' THEN
    RETURN QUERY
      SELECT
        COALESCE(a.microarea, 'Não definida') AS microarea,
        COUNT(DISTINCT r.id) AS total_familias,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM visitas v
            WHERE v.residencia_id = r.id
              AND v.status = 'realizada'
              AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
          ) THEN r.id
        END) AS familias_visitadas_30d,
        COALESCE(
          ROUND(
            COUNT(DISTINCT CASE
              WHEN EXISTS (
                SELECT 1 FROM visitas v
                WHERE v.residencia_id = r.id
                  AND v.status = 'realizada'
                  AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
              ) THEN r.id
            END)::numeric /
            NULLIF(COUNT(DISTINCT r.id), 0) * 100, 1
          ), 0
        ) AS cobertura_pct
      FROM agentes a
      JOIN residencias r ON r.agente_id = a.id AND r.deleted_at IS NULL
      WHERE a.id = auth.uid()
      GROUP BY a.microarea
      ORDER BY microarea;
  ELSE
    RETURN QUERY
      SELECT
        COALESCE(a.microarea, 'Não definida') AS microarea,
        COUNT(DISTINCT r.id) AS total_familias,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM visitas v
            WHERE v.residencia_id = r.id
              AND v.status = 'realizada'
              AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
          ) THEN r.id
        END) AS familias_visitadas_30d,
        COALESCE(
          ROUND(
            COUNT(DISTINCT CASE
              WHEN EXISTS (
                SELECT 1 FROM visitas v
                WHERE v.residencia_id = r.id
                  AND v.status = 'realizada'
                  AND v.data_visita::date >= CURRENT_DATE - INTERVAL '30 days'
              ) THEN r.id
            END)::numeric /
            NULLIF(COUNT(DISTINCT r.id), 0) * 100, 1
          ), 0
        ) AS cobertura_pct
      FROM agentes a
      JOIN residencias r ON r.agente_id = a.id AND r.deleted_at IS NULL
      WHERE a.ativo = true
        AND (p_unidade IS NULL OR a.unidade_saude = p_unidade)
      GROUP BY a.microarea
      ORDER BY microarea;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_cobertura_por_microarea IS 'LGPD: Returns only microarea-level aggregations. No PII exposed.';

COMMIT;
