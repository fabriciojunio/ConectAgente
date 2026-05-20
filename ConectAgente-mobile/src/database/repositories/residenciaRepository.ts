import { getDatabase } from '../database';
import { Residencia, ResidenciaFormData, StatusSync } from '../../types';
import { generateUUID, isoNow } from '../../utils/formatters';
import { syncQueueRepository } from './syncQueueRepository';

export const residenciaRepository = {
  async criar(data: ResidenciaFormData, agenteId: string): Promise<Residencia> {
    const db = await getDatabase();
    const id = generateUUID();
    const now = isoNow();

    const residencia: Residencia = {
      id,
      ...data,
      num_comodos: Number(data.num_comodos),
      morador_responsavel_id: undefined,
      agente_id: agenteId,
      status_sync: StatusSync.PENDENTE,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO residencias (
        id, cep, logradouro, numero, complemento, bairro, cidade, estado,
        tipo_imovel, num_comodos, tem_animais, animais_info,
        morador_responsavel_id, agente_id, status_sync, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        residencia.id, residencia.cep, residencia.logradouro, residencia.numero,
        residencia.complemento ?? null, residencia.bairro, residencia.cidade, residencia.estado,
        residencia.tipo_imovel, residencia.num_comodos, residencia.tem_animais ? 1 : 0,
        residencia.animais_info ?? null, null, residencia.agente_id,
        residencia.status_sync, residencia.created_at, residencia.updated_at,
      ]
    );

    await syncQueueRepository.enqueue('residencias', 'insert', id, residencia);
    return residencia;
  },

  async listar(agenteId: string): Promise<Residencia[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT r.*, m.nome as responsavel_nome
       FROM residencias r
       LEFT JOIN moradores m ON m.id = r.morador_responsavel_id
       WHERE r.agente_id = ? AND r.deleted_at IS NULL
       ORDER BY r.updated_at DESC`,
      [agenteId]
    );
    return rows.map(mapRowToResidencia);
  },

  async buscarPorId(id: string): Promise<Residencia | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM residencias WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row ? mapRowToResidencia(row) : null;
  },

  async atualizar(id: string, data: Partial<ResidenciaFormData>, agenteId: string): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();

    await db.runAsync(
      `UPDATE residencias SET
        cep = COALESCE(?, cep),
        logradouro = COALESCE(?, logradouro),
        numero = COALESCE(?, numero),
        complemento = COALESCE(?, complemento),
        bairro = COALESCE(?, bairro),
        cidade = COALESCE(?, cidade),
        estado = COALESCE(?, estado),
        tipo_imovel = COALESCE(?, tipo_imovel),
        num_comodos = COALESCE(?, num_comodos),
        tem_animais = COALESCE(?, tem_animais),
        animais_info = COALESCE(?, animais_info),
        status_sync = 'pendente',
        updated_at = ?
      WHERE id = ?`,
      [
        data.cep ?? null, data.logradouro ?? null, data.numero ?? null,
        data.complemento ?? null, data.bairro ?? null, data.cidade ?? null,
        data.estado ?? null, data.tipo_imovel ?? null, data.num_comodos ?? null,
        data.tem_animais !== undefined ? (data.tem_animais ? 1 : 0) : null,
        data.animais_info ?? null, now, id,
      ]
    );

    await syncQueueRepository.enqueue('residencias', 'update', id, { id, ...data, updated_at: now });
  },

  async definirResponsavel(residenciaId: string, moradorId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE residencias SET morador_responsavel_id = ?, status_sync = 'pendente', updated_at = ?
       WHERE id = ?`,
      [moradorId, isoNow(), residenciaId]
    );
  },

  async excluir(id: string): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();
    await db.runAsync(
      `UPDATE residencias SET deleted_at = ?, status_sync = 'pendente', updated_at = ? WHERE id = ?`,
      [now, now, id]
    );
    await syncQueueRepository.enqueue('residencias', 'delete', id, { id, deleted_at: now });
  },

  async buscarPorCep(cep: string, agenteId: string): Promise<Residencia[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM residencias WHERE cep = ? AND agente_id = ? AND deleted_at IS NULL`,
      [cep, agenteId]
    );
    return rows.map(mapRowToResidencia);
  },

  async marcarComoSincronizado(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE residencias SET status_sync = 'sincronizado' WHERE id = ?`,
      [id]
    );
  },

  async pendentesSync(): Promise<Residencia[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM residencias WHERE status_sync = 'pendente'`
    );
    return rows.map(mapRowToResidencia);
  },

  // ADMIN — sem filtro por agente_id
  async listarTodos(filtroAgenteId?: string): Promise<Array<Residencia & { agente_nome?: string }>> {
    const db = await getDatabase();
    const sql = filtroAgenteId
      ? `SELECT r.*, a.nome as agente_nome FROM residencias r LEFT JOIN agentes a ON a.id = r.agente_id WHERE r.agente_id = ? AND r.deleted_at IS NULL ORDER BY r.updated_at DESC`
      : `SELECT r.*, a.nome as agente_nome FROM residencias r LEFT JOIN agentes a ON a.id = r.agente_id WHERE r.deleted_at IS NULL ORDER BY r.updated_at DESC`;
    const rows = await db.getAllAsync<Record<string, unknown>>(sql, filtroAgenteId ? [filtroAgenteId] : []);
    return rows.map((row) => ({ ...mapRowToResidencia(row), agente_nome: row.agente_nome as string | undefined }));
  },
};

function mapRowToResidencia(row: Record<string, unknown>): Residencia {
  return {
    id: row.id as string,
    cep: row.cep as string,
    logradouro: row.logradouro as string,
    numero: row.numero as string,
    complemento: row.complemento as string | undefined,
    bairro: row.bairro as string,
    cidade: row.cidade as string,
    estado: row.estado as string,
    tipo_imovel: row.tipo_imovel as Residencia['tipo_imovel'],
    num_comodos: row.num_comodos as number,
    tem_animais: Boolean(row.tem_animais),
    animais_info: row.animais_info as string | undefined,
    morador_responsavel_id: row.morador_responsavel_id as string | undefined,
    agente_id: row.agente_id as string,
    status_sync: row.status_sync as StatusSync,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: row.deleted_at as string | undefined,
  };
}
