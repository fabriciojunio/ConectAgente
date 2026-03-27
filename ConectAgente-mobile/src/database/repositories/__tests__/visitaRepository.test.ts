/**
 * Testes para visitaRepository
 */
jest.mock('../../../database/database', () => ({
  getDatabase: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import { getDatabase } from '../../../database/database';
import { visitaRepository } from '../visitaRepository';

const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;

const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn(),
  withTransactionAsync: jest.fn((cb: () => Promise<void>) => cb()),
};

const visitaBase = {
  id: 'visita-uuid-001',
  agente_id: 'agente-uuid-123',
  residencia_id: 'res-uuid-456',
  morador_id: null,
  data_visita: '2024-03-15T10:00:00.000Z',
  status: 'realizada',
  queixas: null,
  observacoes: 'Paciente bem',
  precisa_agendamento: 0,
  especialidade_agendamento: null,
  created_at: '2024-03-15T10:00:00.000Z',
  updated_at: '2024-03-15T10:00:00.000Z',
  sync_status: 'pendente',
};

const agendamentoBase = {
  id: 'agend-uuid-001',
  agente_id: 'agente-uuid-123',
  residencia_id: 'res-uuid-456',
  morador_id: null,
  data_agendada: '2024-03-20',
  motivo: 'Retorno',
  observacoes: null,
  status: 'pendente',
  created_at: '2024-03-15T10:00:00.000Z',
  updated_at: '2024-03-15T10:00:00.000Z',
  sync_status: 'pendente',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.runAsync.mockResolvedValue({ changes: 1 });
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.getAllAsync.mockResolvedValue([]);
  mockGetDatabase.mockResolvedValue(mockDb as any);
});

describe('visitaRepository.criar', () => {
  it('cria visita e retorna o objeto', async () => {
    mockDb.getFirstAsync.mockResolvedValue(visitaBase);

    const visita = await visitaRepository.criar({
      agente_id: 'agente-uuid-123',
      residencia_id: 'res-uuid-456',
      data_visita: '2024-03-15T10:00:00.000Z',
      status: 'realizada',
      precisa_agendamento: false,
    });

    expect(mockDb.runAsync).toHaveBeenCalled();
    expect(visita).toBeDefined();
  });
});

describe('visitaRepository.listar', () => {
  it('lista visitas do agente', async () => {
    mockDb.getAllAsync.mockResolvedValue([visitaBase]);

    const visitas = await visitaRepository.listar('agente-uuid-123');

    expect(visitas).toHaveLength(1);
    expect(visitas[0].status).toBe('realizada');
  });

  it('filtra por período quando fornecido', async () => {
    mockDb.getAllAsync.mockResolvedValue([visitaBase]);

    await visitaRepository.listar('agente-uuid-123', {
      data_inicio: '2024-03-01T00:00:00.000Z',
      data_fim: '2024-03-31T23:59:59.000Z',
    });

    const query: string = mockDb.getAllAsync.mock.calls[0][0];
    expect(query).toContain('data_visita');
  });

  it('retorna lista vazia quando sem visitas', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    const visitas = await visitaRepository.listar('agente-sem-visitas');

    expect(visitas).toHaveLength(0);
  });
});

describe('visitaRepository.estatisticas', () => {
  // Promise.all order: [total, agendadas, hoje_count, semana_count, mes_count, meta]
  it('retorna estatísticas com valores corretos', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ count: 50 })          // total_realizadas
      .mockResolvedValueOnce({ count: 7 })            // total_agendadas
      .mockResolvedValueOnce({ count: 3 })            // realizadas_hoje
      .mockResolvedValueOnce({ count: 12 })           // realizadas_semana
      .mockResolvedValueOnce({ count: 45 })           // realizadas_mes
      .mockResolvedValueOnce({ meta_total: 100 });    // meta_mensal

    const stats = await visitaRepository.estatisticas('agente-uuid-123');

    expect(stats.realizadas_hoje).toBe(3);
    expect(stats.realizadas_semana).toBe(12);
    expect(stats.realizadas_mes).toBe(45);
    expect(stats.total_agendadas).toBe(7);
    expect(stats.meta_mensal).toBe(100);
  });

  it('calcula percentual da meta corretamente', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ count: 0 })            // total_realizadas
      .mockResolvedValueOnce({ count: 0 })            // total_agendadas
      .mockResolvedValueOnce({ count: 0 })            // realizadas_hoje
      .mockResolvedValueOnce({ count: 0 })            // realizadas_semana
      .mockResolvedValueOnce({ count: 75 })           // realizadas_mes
      .mockResolvedValueOnce({ meta_total: 100 });    // meta_mensal

    const stats = await visitaRepository.estatisticas('agente-uuid-123');

    expect(stats.percentual_meta).toBe(75);
  });

  it('define percentual 0 quando sem meta', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ count: 10 })           // total_realizadas
      .mockResolvedValueOnce({ count: 0 })            // total_agendadas
      .mockResolvedValueOnce({ count: 10 })           // realizadas_hoje
      .mockResolvedValueOnce({ count: 10 })           // realizadas_semana
      .mockResolvedValueOnce({ count: 10 })           // realizadas_mes
      .mockResolvedValueOnce({ meta_total: 0 });      // meta_mensal

    const stats = await visitaRepository.estatisticas('agente-uuid-123');

    expect(stats.percentual_meta).toBe(0);
  });
});

describe('visitaRepository.definirMeta', () => {
  it('salva meta mensal com INSERT OR REPLACE', async () => {
    await visitaRepository.definirMeta('agente-uuid-123', 3, 2024, 200);

    expect(mockDb.runAsync).toHaveBeenCalled();
    const query: string = mockDb.runAsync.mock.calls[0][0];
    expect(query.toUpperCase()).toContain('INSERT OR REPLACE');
  });
});

describe('visitaRepository.criarAgendamento', () => {
  it('cria agendamento e retorna o objeto', async () => {
    mockDb.getFirstAsync.mockResolvedValue(agendamentoBase);

    const agendamento = await visitaRepository.criarAgendamento({
      agente_id: 'agente-uuid-123',
      residencia_id: 'res-uuid-456',
      data_agendada: '2024-03-20',
      motivo: 'Retorno',
    });

    expect(agendamento).toBeDefined();
    expect(agendamento.motivo).toBe('Retorno');
  });
});

describe('visitaRepository.datasComAgendamento', () => {
  it('retorna lista de datas com agendamentos', async () => {
    // SQL: SELECT DISTINCT date(data_agendada) as data → campo retornado é "data"
    mockDb.getAllAsync.mockResolvedValue([
      { data: '2024-03-20' },
      { data: '2024-03-25' },
    ]);

    const datas = await visitaRepository.datasComAgendamento('agente-uuid-123');

    expect(datas).toHaveLength(2);
    expect(datas).toContain('2024-03-20');
  });
});

describe('visitaRepository.cancelarAgendamento', () => {
  it('cancela agendamento existente', async () => {
    await visitaRepository.cancelarAgendamento('agend-uuid-001');

    expect(mockDb.runAsync).toHaveBeenCalled();
    const query: string = mockDb.runAsync.mock.calls[0][0];
    expect(query.toLowerCase()).toContain('cancelada');
  });
});
