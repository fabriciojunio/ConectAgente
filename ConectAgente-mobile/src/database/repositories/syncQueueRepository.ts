import { getDatabase } from '../database';
import { SyncQueueItem, OperacaoSync, StatusSync } from '../../types';
import { generateUUID, isoNow } from '../../utils/formatters';
import { SYNC_MAX_TENTATIVAS } from '../../utils/constants';

export const syncQueueRepository = {
  async enqueue(
    tabela: string,
    operacao: 'insert' | 'update' | 'delete',
    registroId: string,
    payload: unknown
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_queue (id, tabela, operacao, registro_id, payload, tentativas, status, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'pendente', ?)`,
      [generateUUID(), tabela, operacao, registroId, JSON.stringify(payload), isoNow()]
    );
  },

  async listarPendentes(): Promise<SyncQueueItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM sync_queue
       WHERE status = 'pendente' AND tentativas < ?
       ORDER BY created_at ASC`,
      [SYNC_MAX_TENTATIVAS]
    );
    return rows.map(mapRow);
  },

  async marcarSucesso(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'sincronizado' WHERE id = ?`,
      [id]
    );
  },

  async marcarErro(id: string, erro: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET tentativas = tentativas + 1, erro = ?,
       status = CASE WHEN tentativas + 1 >= ? THEN 'erro' ELSE 'pendente' END
       WHERE id = ?`,
      [erro, SYNC_MAX_TENTATIVAS, id]
    );
  },

  async contarPendentes(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pendente'`
    );
    return row?.count ?? 0;
  },

  async limparSincronizados(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM sync_queue WHERE status = 'sincronizado'`
    );
  },
};

function mapRow(row: Record<string, unknown>): SyncQueueItem {
  return {
    id: row.id as string,
    tabela: row.tabela as string,
    operacao: row.operacao as OperacaoSync,
    registro_id: row.registro_id as string,
    payload: row.payload as string,
    tentativas: row.tentativas as number,
    status: row.status as StatusSync,
    erro: row.erro as string | undefined,
    created_at: row.created_at as string,
  };
}
