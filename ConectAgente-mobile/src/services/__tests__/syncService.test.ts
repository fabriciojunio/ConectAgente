/**
 * Testes para syncService (com Supabase)
 */
jest.mock('../../database/repositories/syncQueueRepository', () => ({
  // A preparação do payload é pura e roda de verdade: o envio a aplica de novo.
  prepararPayloadParaServidor: jest.requireActual('../../database/repositories/syncQueueRepository')
    .prepararPayloadParaServidor,
  syncQueueRepository: {
    listarPendentes: jest.fn(),
    marcarSucesso: jest.fn(),
    marcarErro: jest.fn(),
    contarPendentes: jest.fn(),
    limparSincronizados: jest.fn(),
  },
}));

jest.mock('../../database/repositories/residenciaRepository', () => ({
  residenciaRepository: { marcarComoSincronizado: jest.fn() },
}));

jest.mock('../../database/repositories/moradorRepository', () => ({
  moradorRepository: { marcarComoSincronizado: jest.fn() },
}));

jest.mock('../../database/repositories/visitaRepository', () => ({
  visitaRepository: { marcarComoSincronizado: jest.fn() },
}));

// Mock do Supabase
const mockSupabaseUpsert = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdate = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseDelete = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseEq = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseInsert = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseUpdateComEq = jest.fn(() => ({ eq: mockSupabaseEq }));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: mockSupabaseUpsert,
      insert: mockSupabaseInsert,
      update: mockSupabaseUpdateComEq,
    })),
  },
  handleSupabaseError: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// A sincronizacao agora exige sessao no servidor: sem ela o RLS nega toda
// gravacao, e deixar a fila tentar queimaria as cinco tentativas de cada
// item por uma causa que nao tem relacao com o dado.
const mockTemSessao = jest.fn().mockResolvedValue(true);
jest.mock('../authService', () => ({
  authService: {
    temSessaoNoServidor: () => mockTemSessao(),
  },
}));

import { syncQueueRepository } from '../../database/repositories/syncQueueRepository';
import { syncService } from '../syncService';

const mockedQueue = syncQueueRepository as jest.Mocked<typeof syncQueueRepository>;

const itemSyncBase = {
  id: 'sync-001',
  tabela: 'residencias',
  operacao: 'insert' as const,
  registro_id: 'res-uuid-456',
  payload: JSON.stringify({ id: 'res-uuid-456', logradouro: 'Rua X' }),
  tentativas: 0,
  status: 'pendente' as const,
  created_at: '2024-03-15T10:00:00.000Z',
  updated_at: '2024-03-15T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTemSessao.mockResolvedValue(true);
  mockedQueue.marcarSucesso.mockResolvedValue(undefined);
  mockedQueue.marcarErro.mockResolvedValue(undefined);
  mockedQueue.limparSincronizados.mockResolvedValue(undefined);
  mockSupabaseUpsert.mockResolvedValue({ error: null });
  mockSupabaseInsert.mockResolvedValue({ error: null });
  mockSupabaseEq.mockResolvedValue({ error: null });
});

describe('syncService.contarPendentes', () => {
  it('retorna contagem de itens pendentes', async () => {
    mockedQueue.contarPendentes.mockResolvedValue(5);

    const count = await syncService.contarPendentes();

    expect(count).toBe(5);
  });

  it('retorna 0 quando não há pendentes', async () => {
    mockedQueue.contarPendentes.mockResolvedValue(0);

    const count = await syncService.contarPendentes();

    expect(count).toBe(0);
  });
});

describe('syncService.sincronizar', () => {
  it('não processa quando fila está vazia', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
  });

  it('processa INSERT usando Supabase upsert', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-001');
  });

  it('marca erro quando Supabase falha', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);
    mockSupabaseUpsert.mockResolvedValueOnce({ error: { message: 'Conexão recusada' } });

    await syncService.sincronizar();

    expect(mockedQueue.marcarErro).toHaveBeenCalledWith('sync-001', 'Conexão recusada');
    expect(mockedQueue.marcarSucesso).not.toHaveBeenCalled();
  });

  it('processa múltiplos itens', async () => {
    const itens = [
      { ...itemSyncBase, id: 'sync-a', registro_id: 'res-a' },
      { ...itemSyncBase, id: 'sync-b', registro_id: 'res-b', tabela: 'moradores' },
    ];
    mockedQueue.listarPendentes.mockResolvedValue(itens);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).toHaveBeenCalledTimes(1);
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledTimes(2);
  });
});

// O servidor fecha a leitura de cpf, cartão do SUS, doença e medicação, e o
// Postgres recusa upsert que atualize coluna que o usuário não pode ler.
describe('syncService.sincronizar - morador sem upsert', () => {
  const itemMorador = {
    ...itemSyncBase,
    id: 'sync-m',
    tabela: 'moradores',
    registro_id: 'mor-1',
    payload: JSON.stringify({ nome: 'Dados simulados', cpf: '11144477735' }),
  };

  it('insere o morador novo sem usar upsert', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).toHaveBeenCalledWith({ nome: 'Dados simulados', cpf: '11144477735', id: 'mor-1' });
    expect(mockSupabaseUpdateComEq).not.toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-m');
  });

  it('na retentativa, chave repetida vira update pelo id', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });

    await syncService.sincronizar();

    expect(mockSupabaseUpdateComEq).toHaveBeenCalledWith({ nome: 'Dados simulados', cpf: '11144477735' });
    expect(mockSupabaseEq).toHaveBeenCalledWith('id', 'mor-1');
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-m');
  });

  it('outro erro no insert não vira update e marca erro', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '42501', message: 'permission denied' } });

    await syncService.sincronizar();

    expect(mockSupabaseUpdateComEq).not.toHaveBeenCalled();
    expect(mockedQueue.marcarErro).toHaveBeenCalledWith('sync-m', 'permission denied');
  });

  it('erro no update da retentativa marca erro', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([itemMorador]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });
    mockSupabaseEq.mockResolvedValueOnce({ error: { message: 'Conexão recusada' } });

    await syncService.sincronizar();

    expect(mockedQueue.marcarErro).toHaveBeenCalledWith('sync-m', 'Conexão recusada');
  });
});

// Nenhuma coluna clínica das fichas sai pela API, então upsert nelas é
// recusado pelo Postgres. A ficha é salva por substituição: tanto o insert
// quanto o update da fila tentam inserir e, se já existe, atualizam pela
// chave prontuario_id.
describe('syncService.sincronizar - fichas de prontuário sem upsert', () => {
  const fichas = [
    'prontuario_saude',
    'prontuario_gestante',
    'prontuario_puericultura',
    'prontuario_mulher',
    'prontuario_social',
  ];

  it.each(fichas)('%s: insert da fila insere sem upsert', async (tabela) => {
    mockedQueue.listarPendentes.mockResolvedValue([{
      ...itemSyncBase, id: 'sync-f', tabela, registro_id: 'pront-1',
      payload: JSON.stringify({ observacoes: 'Dados simulados' }),
    }]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).toHaveBeenCalledWith({ observacoes: 'Dados simulados', prontuario_id: 'pront-1' });
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-f');
  });

  it.each(fichas)('%s: update da fila cria a ficha que ainda não existe no servidor', async (tabela) => {
    mockedQueue.listarPendentes.mockResolvedValue([{
      ...itemSyncBase, id: 'sync-f', tabela, operacao: 'update' as const, registro_id: 'pront-1',
      payload: JSON.stringify({ observacoes: 'Dados simulados' }),
    }]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).toHaveBeenCalledWith({ observacoes: 'Dados simulados', prontuario_id: 'pront-1' });
    expect(mockSupabaseUpdateComEq).not.toHaveBeenCalled();
  });

  it('update de ficha que já existe atualiza por prontuario_id', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([{
      ...itemSyncBase, id: 'sync-f', tabela: 'prontuario_saude', operacao: 'update' as const,
      registro_id: 'pront-1', payload: JSON.stringify({ observacoes: 'Dados simulados' }),
    }]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });

    await syncService.sincronizar();

    expect(mockSupabaseUpdateComEq).toHaveBeenCalledWith({ observacoes: 'Dados simulados' });
    expect(mockSupabaseEq).toHaveBeenCalledWith('prontuario_id', 'pront-1');
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-f');
  });
});

describe('syncService.sincronizar - sem sessao no servidor', () => {
  // Sem sessao, `auth.uid()` e nulo e toda policy de RLS nega a gravacao.
  // Medido com o schema e as policies reais num PostgreSQL:
  //   new row violates row-level security policy for table "residencias"
  //
  // O teste importante nao e que falha, e que falha SEM gastar tentativa:
  // a fila marca o item como erro definitivo depois de cinco, e perder a
  // coleta de um dia por falta de login seria o pior resultado possivel.

  it('nao tenta enviar e avisa o motivo', async () => {
    mockTemSessao.mockResolvedValue(false);
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);

    await expect(syncService.sincronizar()).rejects.toThrow('Sem sessão no servidor');

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
  });

  it('nao gasta tentativa da fila', async () => {
    mockTemSessao.mockResolvedValue(false);
    mockedQueue.listarPendentes.mockResolvedValue([itemSyncBase]);

    await expect(syncService.sincronizar()).rejects.toThrow();

    expect(mockedQueue.marcarErro).not.toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).not.toHaveBeenCalled();
  });

  it('nao checa sessao quando a fila esta vazia', async () => {
    // Nao faz sentido exigir login para nao fazer nada, e o aplicativo
    // chama a sincronizacao em intervalo fixo.
    mockedQueue.listarPendentes.mockResolvedValue([]);

    await expect(syncService.sincronizar()).resolves.toBeUndefined();
    expect(mockTemSessao).not.toHaveBeenCalled();
  });
});

describe('dono do registro na sincronização', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { trocarDonoParaOServidor } = require('../syncService');
  const dono = { local: 'id-do-aparelho', servidor: 'id-da-conta' };

  it('registro do agente do aparelho sobe com o id da conta do servidor', () => {
    const r = trocarDonoParaOServidor({ id: 'res-1', agente_id: 'id-do-aparelho', bairro: 'Centro' }, dono);
    expect(r).toEqual({ id: 'res-1', agente_id: 'id-da-conta', bairro: 'Centro' });
  });

  it('registro de outro dono passa como está, e o servidor decide', () => {
    const outro = { id: 'res-2', agente_id: 'outra-pessoa' };
    expect(trocarDonoParaOServidor(outro, dono)).toBe(outro);
  });

  it('sem sessão, ou ids iguais, nada muda', () => {
    const p = { agente_id: 'id-do-aparelho' };
    expect(trocarDonoParaOServidor(p, { local: 'id-do-aparelho', servidor: null })).toBe(p);
    expect(trocarDonoParaOServidor(p, { local: 'id-do-aparelho', servidor: 'id-do-aparelho' })).toBe(p);
  });

  it('payload sem agente_id (exclusão, ficha) passa intacto', () => {
    const p = { id: 'x' };
    expect(trocarDonoParaOServidor(p, dono)).toBe(p);
    expect(trocarDonoParaOServidor(null, dono)).toBeNull();
  });
});

describe('syncService.sincronizar - tabelas só de inclusão', () => {
  // Trilha e consentimento não dão UPDATE no servidor; o upsert era recusado
  // e nada deles chegou. Conferido no banco de produção.
  it.each(['audit_log', 'consentimentos'])('%s sobe com INSERT simples, nunca upsert', async (tabela) => {
    mockedQueue.listarPendentes.mockResolvedValue([
      { ...itemSyncBase, id: `sync-${tabela}`, tabela, registro_id: 'r-1', payload: JSON.stringify({ acao: 'LOGIN' }) },
    ]);

    await syncService.sincronizar();

    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).toHaveBeenCalledWith({ acao: 'LOGIN', id: 'r-1' });
    expect(mockSupabaseUpdateComEq).not.toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith(`sync-${tabela}`);
  });

  it('reenvio de algo que já chegou conta como enviado, sem tentar alterar', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([
      { ...itemSyncBase, id: 'sync-a', tabela: 'audit_log', registro_id: 'r-1', payload: '{}' },
    ]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key' } });

    await syncService.sincronizar();

    expect(mockSupabaseUpdateComEq).not.toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-a');
  });

  it('outra recusa marca erro', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([
      { ...itemSyncBase, id: 'sync-a', tabela: 'audit_log', registro_id: 'r-1', payload: '{}' },
    ]);
    mockSupabaseInsert.mockResolvedValueOnce({ error: { code: '42501', message: 'permission denied' } });

    await syncService.sincronizar();

    expect(mockedQueue.marcarErro).toHaveBeenCalledWith('sync-a', 'permission denied');
  });
});

describe('syncService.sincronizar - nome de coluna corrigido na saída', () => {
  it('ficha de saúde que entrou na fila com "aferição" acentuado sobe com o nome da coluna', async () => {
    mockedQueue.listarPendentes.mockResolvedValue([
      {
        ...itemSyncBase, id: 'sync-s', tabela: 'prontuario_saude', operacao: 'update', registro_id: 'pront-1',
        payload: JSON.stringify({ 'pa_ultima_aferição': '11/11/2026', pa_valor: '140/90', 'hgt_ultima_aferição': '11/11/2026' }),
      },
    ]);

    await syncService.sincronizar();

    const enviado = mockSupabaseInsert.mock.calls[0][0];
    expect(enviado).toMatchObject({ pa_ultima_afericao: '11/11/2026', hgt_ultima_afericao: '11/11/2026', pa_valor: '140/90' });
    expect(Object.keys(enviado).join(' ')).not.toMatch(/ç|ã/);
  });
});

describe('syncService.sincronizar - item do administrador do aparelho', () => {
  it('sai da fila sem ser enviado, porque nunca seria aceito', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const database = require('../../database/database');
    const espiao = jest.spyOn(database, 'getDatabase').mockResolvedValue({
      getAllAsync: jest.fn().mockResolvedValue([{ id: 'admin-local' }]),
    });
    mockedQueue.listarPendentes.mockResolvedValue([
      { ...itemSyncBase, id: 'sync-adm', tabela: 'audit_log', registro_id: 'a-1', payload: JSON.stringify({ agente_id: 'admin-local', acao: 'LOGIN' }) },
    ]);

    await syncService.sincronizar();

    expect(mockSupabaseInsert).not.toHaveBeenCalled();
    expect(mockSupabaseUpsert).not.toHaveBeenCalled();
    expect(mockedQueue.marcarSucesso).toHaveBeenCalledWith('sync-adm');
    espiao.mockRestore();
  });
});
