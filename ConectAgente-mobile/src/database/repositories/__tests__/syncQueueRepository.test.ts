jest.mock('../../../database/database', () => ({ getDatabase: jest.fn() }));

import { getDatabase } from '../../../database/database';
import { syncQueueRepository } from '../syncQueueRepository';

const db = { runAsync: jest.fn(), getFirstAsync: jest.fn(), getAllAsync: jest.fn() };
(getDatabase as jest.Mock).mockResolvedValue(db);

beforeEach(() => jest.clearAllMocks());

describe('fila de sincronização', () => {
  it('a contagem inclui o que desistiu, para o selo não esconder dado preso', async () => {
    db.getFirstAsync.mockResolvedValue({ count: 24 });
    await expect(syncQueueRepository.contarPendentes()).resolves.toBe(24);
    expect(db.getFirstAsync.mock.calls[0][0]).toMatch(/status IN \('pendente', 'erro'\)/);
  });

  it('reabrir devolve à fila o que desistiu, com as tentativas zeradas', async () => {
    db.runAsync.mockResolvedValue({ changes: 24 });
    await expect(syncQueueRepository.reabrirComErro()).resolves.toBe(24);
    const sql = db.runAsync.mock.calls[0][0] as string;
    expect(sql).toMatch(/SET status = 'pendente', tentativas = 0, erro = NULL/);
    expect(sql).toMatch(/WHERE status = 'erro'/);
  });

  it('a fila só pega o que ainda tem tentativa', async () => {
    db.getAllAsync.mockResolvedValue([]);
    await syncQueueRepository.listarPendentes();
    expect(db.getAllAsync.mock.calls[0][0]).toMatch(/status = 'pendente' AND tentativas < \?/);
  });
});
