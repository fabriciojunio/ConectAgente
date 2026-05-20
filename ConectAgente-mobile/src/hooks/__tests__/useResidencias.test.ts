/**
 * Testes para useResidencias hook
 */
jest.mock('../../database/repositories/residenciaRepository', () => ({
  residenciaRepository: {
    listar: jest.fn(),
    criar: jest.fn(),
    atualizar: jest.fn(),
    excluir: jest.fn(),
    buscarPorId: jest.fn(),
    definirResponsavel: jest.fn(),
  },
}));

// O agente precisa ser criado UMA vez (referência estável).
// Se o mock criar um novo objeto a cada chamada, o useCallback([agente])
// recria carregar() em todo render, disparando o useEffect em loop infinito.
jest.mock('../../contexts/AuthContext', () => {
  const agente = {
    id: 'agente-uuid-123',
    nome: 'João Silva',
    cpf: '52998224725',
    unidade_saude: 'UBS Central',
  };
  return { useAuth: () => ({ agente }) };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import { residenciaRepository } from '../../database/repositories/residenciaRepository';
import { useResidencias } from '../useResidencias';

const mockedRepo = residenciaRepository as jest.Mocked<typeof residenciaRepository>;

const residenciaBase = {
  id: 'res-uuid-456',
  agente_id: 'agente-uuid-123',
  cep: '01310100',
  logradouro: 'Avenida Paulista',
  numero: '1000',
  complemento: null,
  bairro: 'Bela Vista',
  cidade: 'São Paulo',
  estado: 'SP',
  tipo_imovel: 'proprio' as const,
  num_comodos: 4,
  tem_animais: false,
  animais_info: null,
  morador_responsavel_id: null,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  sync_status: 'pendente' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedRepo.listar.mockResolvedValue([residenciaBase]);
  mockedRepo.criar.mockResolvedValue(residenciaBase);
  mockedRepo.atualizar.mockResolvedValue({ ...residenciaBase });
  mockedRepo.excluir.mockResolvedValue(undefined);
  mockedRepo.definirResponsavel.mockResolvedValue(undefined);
});

describe('useResidencias.carregar', () => {
  it('carrega residências ao montar o hook', async () => {
    const { result } = renderHook(() => useResidencias());

    // Hook chama carregar() automaticamente via useEffect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockedRepo.listar).toHaveBeenCalledWith('agente-uuid-123');
    expect(result.current.residencias).toHaveLength(1);
  });

  it('define isLoading false após carregamento', async () => {
    const { result } = renderHook(() => useResidencias());

    await act(async () => {
      await result.current.carregar();
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe('useResidencias.criar', () => {
  it('cria residência com agente_id do contexto e retorna o objeto', async () => {
    const { result } = renderHook(() => useResidencias());

    let novaResidencia: typeof residenciaBase | undefined;
    await act(async () => {
      novaResidencia = await result.current.criar({
        cep: '01310100',
        logradouro: 'Avenida Paulista',
        numero: '1000',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        estado: 'SP',
        tipo_imovel: 'proprio',
        num_comodos: 4,
        tem_animais: false,
      });
    });

    expect(mockedRepo.criar).toHaveBeenCalledWith(
      expect.objectContaining({ logradouro: 'Avenida Paulista' }),
      'agente-uuid-123'
    );
    expect(novaResidencia?.id).toBe('res-uuid-456');
  });
});

describe('useResidencias.excluir', () => {
  it('exclui residência e remove da lista local', async () => {
    const { result } = renderHook(() => useResidencias());

    // Aguarda carregamento inicial
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    await act(async () => {
      await result.current.excluir('res-uuid-456');
    });

    expect(mockedRepo.excluir).toHaveBeenCalledWith('res-uuid-456');
    expect(result.current.residencias).toHaveLength(0);
  });
});

describe('useResidencias.atualizar', () => {
  it('atualiza residência e recarrega lista', async () => {
    const { result } = renderHook(() => useResidencias());

    await act(async () => {
      await result.current.atualizar('res-uuid-456', { numero: '2000' });
    });

    expect(mockedRepo.atualizar).toHaveBeenCalledWith('res-uuid-456', { numero: '2000' }, 'agente-uuid-123');
  });
});
