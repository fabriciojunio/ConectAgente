import { getDatabase } from '../database';
import { Visita, Agendamento, StatusVisita, StatusSync, EstatisticasVisitas } from '../../types';
import { generateUUID, isoNow } from '../../utils/formatters';
import { syncQueueRepository } from './syncQueueRepository';

export const visitaRepository = {
  async criar(data: {
    residencia_id: string;
    morador_id?: string;
    agente_id: string;
    data_visita: string;
    status: StatusVisita;
    motivo_visita?: string;
    queixas?: string;
    observacoes?: string;
    pa_visita?: string;
    glicemia_visita?: string;
    peso_visita?: string;
    medicamentos_em_dia?: boolean;
    cartao_vacinas_em_dia?: boolean;
    encaminhamentos?: string;
    precisa_agendamento: boolean;
    especialidade_agendamento?: string;
    assinatura_base64?: string;
  }): Promise<Visita> {
    const db = await getDatabase();
    const id = generateUUID();
    const now = isoNow();

    await db.runAsync(
      `INSERT INTO visitas (
        id, residencia_id, morador_id, agente_id, data_visita, status,
        motivo_visita, queixas, observacoes,
        pa_visita, glicemia_visita, peso_visita,
        medicamentos_em_dia, cartao_vacinas_em_dia, encaminhamentos,
        precisa_agendamento, especialidade_agendamento,
        assinatura_base64, status_sync, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, data.residencia_id, data.morador_id ?? null, data.agente_id,
        data.data_visita, data.status,
        data.motivo_visita ?? null,
        data.queixas ?? null, data.observacoes ?? null,
        data.pa_visita ?? null, data.glicemia_visita ?? null, data.peso_visita ?? null,
        data.medicamentos_em_dia != null ? (data.medicamentos_em_dia ? 1 : 0) : null,
        data.cartao_vacinas_em_dia != null ? (data.cartao_vacinas_em_dia ? 1 : 0) : null,
        data.encaminhamentos ?? null,
        data.precisa_agendamento ? 1 : 0, data.especialidade_agendamento ?? null,
        data.assinatura_base64 ?? null,
        StatusSync.PENDENTE, now, now,
      ]
    );

    const visita = await this.buscarPorId(id);
    await syncQueueRepository.enqueue('visitas', 'insert', id, data);
    return visita!;
  },

  async listar(agenteId: string, filtros?: {
    data_inicio?: string;
    data_fim?: string;
    status?: StatusVisita;
  }): Promise<Visita[]> {
    const db = await getDatabase();
    let sql = `
      SELECT v.*, r.logradouro, r.numero, r.bairro, m.nome as morador_nome
      FROM visitas v
      JOIN residencias r ON r.id = v.residencia_id
      LEFT JOIN moradores m ON m.id = v.morador_id
      WHERE v.agente_id = ?
    `;
    const params: unknown[] = [agenteId];

    if (filtros?.data_inicio) {
      sql += ` AND v.data_visita >= ?`;
      params.push(filtros.data_inicio);
    }
    if (filtros?.data_fim) {
      sql += ` AND v.data_visita <= ?`;
      params.push(filtros.data_fim);
    }
    if (filtros?.status) {
      sql += ` AND v.status = ?`;
      params.push(filtros.status);
    }

    sql += ` ORDER BY v.data_visita DESC`;

    const rows = await db.getAllAsync<Record<string, unknown>>(sql, params);
    return rows.map(mapRow);
  },

  async buscarPorId(id: string): Promise<Visita | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT v.*, r.logradouro, r.numero, r.bairro
       FROM visitas v
       JOIN residencias r ON r.id = v.residencia_id
       WHERE v.id = ?`,
      [id]
    );
    return row ? mapRow(row) : null;
  },

  async buscarPorMorador(moradorId: string): Promise<Visita[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT v.*, r.logradouro, r.numero, r.bairro
       FROM visitas v
       JOIN residencias r ON r.id = v.residencia_id
       WHERE v.morador_id = ?
       ORDER BY v.data_visita DESC`,
      [moradorId]
    );
    return rows.map(mapRow);
  },

  async buscarPorData(agenteId: string, data: string): Promise<Visita[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT v.*, r.logradouro, r.numero, r.bairro
       FROM visitas v
       JOIN residencias r ON r.id = v.residencia_id
       WHERE v.agente_id = ? AND date(v.data_visita) = date(?)
       ORDER BY v.data_visita ASC`,
      [agenteId, data]
    );
    return rows.map(mapRow);
  },

  async estatisticas(agenteId: string): Promise<EstatisticasVisitas> {
    const db = await getDatabase();
    const hoje = new Date();
    const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
    const inicioSemana = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay()).toISOString();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString();

    const [total, agendadas, hoje_count, semana_count, mes_count, meta] = await Promise.all([
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM visitas WHERE agente_id = ? AND status = 'realizada'`,
        [agenteId]
      ),
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM agendamentos WHERE agente_id = ? AND status = 'agendada'`,
        [agenteId]
      ),
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM visitas WHERE agente_id = ? AND status = 'realizada' AND data_visita >= ?`,
        [agenteId, inicioHoje]
      ),
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM visitas WHERE agente_id = ? AND status = 'realizada' AND data_visita >= ?`,
        [agenteId, inicioSemana]
      ),
      db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM visitas WHERE agente_id = ? AND status = 'realizada' AND data_visita >= ? AND data_visita <= ?`,
        [agenteId, inicioMes, fimMes]
      ),
      db.getFirstAsync<{ meta_total: number }>(
        `SELECT meta_total FROM metas_visitas WHERE agente_id = ? AND mes = ? AND ano = ?`,
        [agenteId, hoje.getMonth() + 1, hoje.getFullYear()]
      ),
    ]);

    const meta_mensal = meta?.meta_total ?? 0;
    const realizadas_mes = mes_count?.count ?? 0;

    return {
      total_realizadas: total?.count ?? 0,
      total_agendadas: agendadas?.count ?? 0,
      meta_mensal,
      realizadas_hoje: hoje_count?.count ?? 0,
      realizadas_semana: semana_count?.count ?? 0,
      realizadas_mes,
      percentual_meta: meta_mensal > 0 ? Math.round((realizadas_mes / meta_mensal) * 100) : 0,
    };
  },

  async marcarComoSincronizado(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE visitas SET status_sync = 'sincronizado' WHERE id = ?`,
      [id]
    );
  },

  // ============================================================
  // AGENDAMENTOS
  // ============================================================
  async criarAgendamento(data: {
    residencia_id: string;
    morador_id?: string;
    agente_id: string;
    data_agendada: string;
    motivo: string;
    observacoes?: string;
  }): Promise<Agendamento> {
    const db = await getDatabase();
    const id = generateUUID();
    const now = isoNow();

    await db.runAsync(
      `INSERT INTO agendamentos (
        id, residencia_id, morador_id, agente_id, data_agendada, motivo,
        observacoes, status, status_sync, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,'agendada','pendente',?,?)`,
      [
        id, data.residencia_id, data.morador_id ?? null, data.agente_id,
        data.data_agendada, data.motivo, data.observacoes ?? null, now, now,
      ]
    );

    await syncQueueRepository.enqueue('agendamentos', 'insert', id, data);

    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM agendamentos WHERE id = ?`,
      [id]
    );
    return mapAgendamento(row!);
  },

  async listarAgendamentos(agenteId: string): Promise<Agendamento[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT a.*, r.logradouro, r.numero, r.bairro, m.nome as morador_nome
       FROM agendamentos a
       JOIN residencias r ON r.id = a.residencia_id
       LEFT JOIN moradores m ON m.id = a.morador_id
       WHERE a.agente_id = ? AND a.status = 'agendada'
       ORDER BY a.data_agendada ASC`,
      [agenteId]
    );
    return rows.map(mapAgendamento);
  },

  async agendamentosPorData(agenteId: string, data: string): Promise<Agendamento[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT a.*, r.logradouro, r.numero, r.bairro
       FROM agendamentos a
       JOIN residencias r ON r.id = a.residencia_id
       WHERE a.agente_id = ? AND date(a.data_agendada) = date(?) AND a.status = 'agendada'
       ORDER BY a.data_agendada ASC`,
      [agenteId, data]
    );
    return rows.map(mapAgendamento);
  },

  async datasComAgendamento(agenteId: string): Promise<string[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ data: string }>(
      `SELECT DISTINCT date(data_agendada) as data
       FROM agendamentos
       WHERE agente_id = ? AND status = 'agendada'
       ORDER BY data ASC`,
      [agenteId]
    );
    return rows.map((r) => r.data);
  },

  async cancelarAgendamento(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE agendamentos SET status = 'cancelada', status_sync = 'pendente', updated_at = ? WHERE id = ?`,
      [isoNow(), id]
    );
    await syncQueueRepository.enqueue('agendamentos', 'update', id, { status: 'cancelada' });
  },

  async listarPorResidencia(residenciaId: string): Promise<Visita[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT v.*, m.nome as morador_nome
       FROM visitas v
       LEFT JOIN moradores m ON m.id = v.morador_id
       WHERE v.residencia_id = ?
       ORDER BY v.data_visita DESC`,
      [residenciaId]
    );
    return rows.map(mapRow);
  },

  async buscarUltimaVisitaPorResidencia(residenciaId: string): Promise<Visita | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM visitas WHERE residencia_id = ? AND status = 'realizada' ORDER BY data_visita DESC LIMIT 1`,
      [residenciaId]
    );
    return row ? mapRow(row) : null;
  },

  // ADMIN — lista visitas de todos os agentes
  async listarTodas(filtros?: {
    agente_id?: string;
    data_inicio?: string;
    data_fim?: string;
    status?: StatusVisita;
  }): Promise<Array<Visita & { agente_nome?: string }>> {
    const db = await getDatabase();
    let sql = `
      SELECT v.*, r.logradouro, r.numero, r.bairro, m.nome as morador_nome, a.nome as agente_nome
      FROM visitas v
      JOIN residencias r ON r.id = v.residencia_id
      LEFT JOIN moradores m ON m.id = v.morador_id
      LEFT JOIN agentes a ON a.id = v.agente_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filtros?.agente_id) { sql += ` AND v.agente_id = ?`; params.push(filtros.agente_id); }
    if (filtros?.data_inicio) { sql += ` AND v.data_visita >= ?`; params.push(filtros.data_inicio); }
    if (filtros?.data_fim) { sql += ` AND v.data_visita <= ?`; params.push(filtros.data_fim); }
    if (filtros?.status) { sql += ` AND v.status = ?`; params.push(filtros.status); }
    sql += ` ORDER BY v.data_visita DESC LIMIT 300`;
    const rows = await db.getAllAsync<Record<string, unknown>>(sql, params);
    return rows.map((row) => ({
      ...mapRow(row),
      agente_nome: row.agente_nome as string | undefined,
      logradouro: row.logradouro as string | undefined,
      numero: row.numero as string | undefined,
      bairro: row.bairro as string | undefined,
    }));
  },

  async obterUltimasVisitas(limite = 10): Promise<Array<Visita & { agente_nome?: string }>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT v.*, r.logradouro, r.numero, r.bairro, a.nome as agente_nome
       FROM visitas v
       JOIN residencias r ON r.id = v.residencia_id
       LEFT JOIN agentes a ON a.id = v.agente_id
       ORDER BY v.created_at DESC LIMIT ?`,
      [limite]
    );
    return rows.map((row) => ({
      ...mapRow(row),
      agente_nome: row.agente_nome as string | undefined,
      logradouro: row.logradouro as string | undefined,
      numero: row.numero as string | undefined,
      bairro: row.bairro as string | undefined,
    }));
  },

  async definirMeta(agenteId: string, mes: number, ano: number, meta: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO metas_visitas (id, agente_id, mes, ano, meta_total, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [generateUUID(), agenteId, mes, ano, meta, isoNow()]
    );
  },
};

function mapRow(row: Record<string, unknown>): Visita {
  return {
    id: row.id as string,
    residencia_id: row.residencia_id as string,
    morador_id: row.morador_id as string | undefined,
    agente_id: row.agente_id as string,
    data_visita: row.data_visita as string,
    status: row.status as StatusVisita,
    motivo_visita: row.motivo_visita as string | undefined,
    queixas: row.queixas as string | undefined,
    observacoes: row.observacoes as string | undefined,
    pa_visita: row.pa_visita as string | undefined,
    glicemia_visita: row.glicemia_visita as string | undefined,
    peso_visita: row.peso_visita as string | undefined,
    medicamentos_em_dia: row.medicamentos_em_dia != null ? Boolean(row.medicamentos_em_dia) : undefined,
    cartao_vacinas_em_dia: row.cartao_vacinas_em_dia != null ? Boolean(row.cartao_vacinas_em_dia) : undefined,
    encaminhamentos: row.encaminhamentos as string | undefined,
    precisa_agendamento: Boolean(row.precisa_agendamento),
    especialidade_agendamento: row.especialidade_agendamento as string | undefined,
    assinatura_base64: row.assinatura_base64 as string | undefined,
    status_sync: row.status_sync as StatusSync,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapAgendamento(row: Record<string, unknown>): Agendamento {
  return {
    id: row.id as string,
    residencia_id: row.residencia_id as string,
    morador_id: row.morador_id as string | undefined,
    agente_id: row.agente_id as string,
    data_agendada: row.data_agendada as string,
    motivo: row.motivo as string,
    observacoes: row.observacoes as string | undefined,
    status: row.status as StatusVisita,
    status_sync: row.status_sync as StatusSync,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
