jest.mock('../../../database/database', () => ({ getDatabase: jest.fn() }));
jest.mock('../syncQueueRepository', () => ({ syncQueueRepository: { enqueue: jest.fn() } }));
jest.mock('../auditRepository', () => ({
  ACOES_AUDITORIA: { INSERT: 'INSERT', UPDATE: 'UPDATE', DELETE: 'DELETE' },
  auditRepository: { registrar: jest.fn() },
}));

import { getDatabase } from '../../../database/database';
import { syncQueueRepository } from '../syncQueueRepository';
import { medicamentoRepository } from '../medicamentoRepository';
import { auditRepository } from '../auditRepository';

const registrar = auditRepository.registrar as jest.Mock;

const mockDb = { runAsync: jest.fn(), getAllAsync: jest.fn() };
(getDatabase as jest.Mock).mockResolvedValue(mockDb);
const enqueue = syncQueueRepository.enqueue as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('medicamentoRepository', () => {
  it('cria no aparelho e põe na fila com os problemas serializados', async () => {
    const novo = await medicamentoRepository.criar(
      'mor-1', 'ag-1',
      { nome: 'Losartana', dosagem: '50 mg', frequencia: '8h', duvida: 'Pode tomar à noite?' },
      ['esquece', 'desconhecido']
    );

    expect(novo).toMatchObject({
      morador_id: 'mor-1', agente_id: 'ag-1', nome: 'Losartana',
      problemas_uso: 'esquece', duvida_respondida: false, resposta_medico: null,
    });
    const [sql, valores] = mockDb.runAsync.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO medicamentos/);
    expect(valores).toContain('Pode tomar à noite?');
    expect(enqueue).toHaveBeenCalledWith('medicamentos', 'insert', novo.id, novo);
    // A trilha registra o fato sem repetir o dado de saúde.
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ agenteId: 'ag-1', acao: 'INSERT', tabela: 'medicamentos' }));
    expect(JSON.stringify(registrar.mock.calls[0][0])).not.toMatch(/Losartana|noite/);
  });

  it('sem dose, horário nem dúvida grava nulo', async () => {
    const novo = await medicamentoRepository.criar('mor-1', 'ag-1', { nome: 'Dipirona', dosagem: undefined, frequencia: undefined, duvida: undefined }, []);
    expect(novo).toMatchObject({ dosagem: null, frequencia: null, duvida: null, problemas_uso: null });
  });

  it('a resposta marca a dúvida como respondida e vai para a fila', async () => {
    await medicamentoRepository.registrarResposta('med-1', 'ag-1', { respondido_por: 'enfermeiro', resposta: 'Pode, após o jantar.' });

    const [sql, valores] = mockDb.runAsync.mock.calls[0];
    expect(sql).toMatch(/duvida_respondida = 1/);
    expect(valores[0]).toBe('Pode, após o jantar.');
    expect(valores[1]).toBe('enfermeiro');
    expect(valores.at(-1)).toBe('med-1');
    expect(enqueue).toHaveBeenCalledWith('medicamentos', 'update', 'med-1', expect.objectContaining({
      duvida_respondida: true, respondido_por: 'enfermeiro', resposta_medico: 'Pode, após o jantar.',
    }));
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'UPDATE', registroId: 'med-1' }));
  });

  it('remover apaga no aparelho e manda apagar no servidor', async () => {
    await medicamentoRepository.remover('med-1', 'ag-1');
    expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM medicamentos WHERE id = ?', ['med-1']);
    expect(enqueue).toHaveBeenCalledWith('medicamentos', 'delete', 'med-1', { id: 'med-1' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'DELETE', registroId: 'med-1' }));
  });

  it('lista convertendo o 0/1 do SQLite em verdadeiro e falso', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { id: 'a', nome: 'A', duvida_respondida: 1 },
      { id: 'b', nome: 'B', duvida_respondida: 0 },
    ]);
    const lista = await medicamentoRepository.listarPorMorador('mor-1');
    expect(lista.map((m) => m.duvida_respondida)).toEqual([true, false]);
    expect(mockDb.getAllAsync.mock.calls[0][1]).toEqual(['mor-1']);
  });
});
