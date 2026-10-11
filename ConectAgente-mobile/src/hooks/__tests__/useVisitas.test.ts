/**
 * Testes para useVisitas hook
 */
jest.mock('../../database/repositories/visitaRepository', () => ({
  visitaRepository: {
    criar: jest.fn(),
    listar: jest.fn(),
    estatisticas: jest.fn(),
    definirMeta: jest.fn(),
    criarAgendamento: jest.fn(),
    cancelarAgendamento: jest.fn(),
    datasComAgendamento: jest.fn(),
    agendamentosPorData: jest.fn(),
    listarAgendamentos: jest.fn(),
  },
}));

// Referência estável para evitar loop infinito no useCallback([agente])
jest.mock('../../contexts/AuthContext', () => {
  const agente = { id: 'agente-uuid-123', nome: 'João Silva' };
  return { useAuth: () => ({ agente }) };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { useVisitas } from '../useVisitas';
import {
  Visita,
  StatusVisita,
  StatusSync,
  EstatisticasVisitas,
} from '../../types';

const mockedRepo = visitaRepository as jest.Mocked<typeof visitaRepository>;

// O campo de controle de sincronizacao chama-se `status_sync` no aparelho,
// e nao `sync_status`, que e o nome da coluna equivalente no servidor. O
// fixture usava o nome do servidor, entao descrevia um objeto que o
// aplicativo nunca produz.
const visitaBase: Visita = {
  id: 'visita-uuid-001',
  agente_id: 'agente-uuid-123',
  residencia_id: 'res-uuid-456',
  data_visita: '2024-03-15T10:00:00.000Z',
  status: StatusVisita.REALIZADA,
  precisa_agendamento: false,
  created_at: '2024-03-15T10:00:00.000Z',
  updated_at: '2024-03-15T10:00:00.000Z',
  status_sync: StatusSync.PENDENTE,
};

const estatisticasBase: EstatisticasVisitas = {
  total_realizadas: 47,
  realizadas_hoje: 2,
  realizadas_semana: 10,
  realizadas_mes: 35,
  total_agendadas: 5,
  meta_mensal: 100,
  percentual_meta: 35,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedRepo.listar.mockResolvedValue([visitaBase]);
  mockedRepo.estatisticas.mockResolvedValue(estatisticasBase);
  mockedRepo.criar.mockResolvedValue(visitaBase);
  mockedRepo.criarAgendamento.mockResolvedValue({
    id: 'agend-001',
    agente_id: 'agente-uuid-123',
    residencia_id: 'res-uuid-456',
    data_agendada: '2024-03-20',
    motivo: 'Retorno',
    // 'pendente' era o vocabulario antigo do servidor e nunca existiu no
    // aplicativo, que grava 'agendada'. Ver a migracao
    // migration_prontuario_sync.sql, que unificou os tres vocabularios.
    status: StatusVisita.AGENDADA,
    created_at: '2024-03-15T10:00:00.000Z',
    updated_at: '2024-03-15T10:00:00.000Z',
    status_sync: StatusSync.PENDENTE,
  });
  mockedRepo.cancelarAgendamento.mockResolvedValue(undefined);
  mockedRepo.definirMeta.mockResolvedValue(undefined);
  mockedRepo.datasComAgendamento.mockResolvedValue(['2024-03-20', '2024-03-25']);
  mockedRepo.listarAgendamentos.mockResolvedValue([]);
  mockedRepo.agendamentosPorData.mockResolvedValue([]);
});

describe('useVisitas.carregar', () => {
  it('carrega visitas e estatísticas', async () => {
    const { result } = renderHook(() => useVisitas());

    await act(async () => {
      await result.current.carregar();
    });

    expect(mockedRepo.listar).toHaveBeenCalledWith('agente-uuid-123', undefined);
    expect(result.current.visitas).toHaveLength(1);
    expect(result.current.estatisticas?.realizadas_hoje).toBe(2);
  });
});

describe('useVisitas.registrarVisita', () => {
  it('cria visita com agente_id do contexto', async () => {
    const { result } = renderHook(() => useVisitas());

    await act(async () => {
      await result.current.registrarVisita({
        residencia_id: 'res-uuid-456',
        data_visita: '2024-03-15T10:00:00.000Z',
        status: StatusVisita.REALIZADA,
        precisa_agendamento: false,
      });
    });

    expect(mockedRepo.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        agente_id: 'agente-uuid-123',
        residencia_id: 'res-uuid-456',
        status: StatusVisita.REALIZADA,
      })
    );
  });
});

describe('useVisitas.agendarVisita', () => {
  it('cria agendamento com agente_id do contexto', async () => {
    const { result } = renderHook(() => useVisitas());

    await act(async () => {
      await result.current.agendarVisita({
        residencia_id: 'res-uuid-456',
        data_agendada: '2024-03-20',
        motivo: 'Retorno',
      });
    });

    expect(mockedRepo.criarAgendamento).toHaveBeenCalledWith(
      expect.objectContaining({
        agente_id: 'agente-uuid-123',
        motivo: 'Retorno',
      })
    );
  });
});

describe('useVisitas.definirMeta', () => {
  it('salva meta mensal corretamente', async () => {
    const { result } = renderHook(() => useVisitas());

    await act(async () => {
      await result.current.definirMeta(3, 2024, 200);
    });

    expect(mockedRepo.definirMeta).toHaveBeenCalledWith('agente-uuid-123', 3, 2024, 200);
  });
});

describe('useVisitas.datasComAgendamento', () => {
  it('retorna datas com agendamentos', async () => {
    const { result } = renderHook(() => useVisitas());

    let datas: string[] = [];
    await act(async () => {
      datas = await result.current.datasComAgendamento();
    });

    expect(datas).toHaveLength(2);
    expect(mockedRepo.datasComAgendamento).toHaveBeenCalledWith('agente-uuid-123');
  });
});

describe('useVisitas.cancelarAgendamento', () => {
  it('cancela agendamento', async () => {
    const { result } = renderHook(() => useVisitas());

    await act(async () => {
      await result.current.cancelarAgendamento('agend-001');
    });

    expect(mockedRepo.cancelarAgendamento).toHaveBeenCalledWith('agend-001');
  });
});
