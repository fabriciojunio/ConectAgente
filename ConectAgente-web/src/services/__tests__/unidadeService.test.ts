jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@/lib/supabase/client';
import { cacheClear } from '@/lib/cache';
import {
  designarUnidade,
  listarEquipe,
  escolherMinhaUnidade,
  listarUnidades,
  mensagemDeErroUnidade,
  nomeUnidadeValido,
  normalizarNomeUnidade,
} from '../unidadeService';

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

function montarSupabase() {
  const order = jest.fn();
  const select = jest.fn(() => ({ order }));
  const from = jest.fn(() => ({ select }));
  const rpc = jest.fn();
  return { from, select, order, rpc };
}

let sb: ReturnType<typeof montarSupabase>;

beforeEach(() => {
  jest.clearAllMocks();
  sb = montarSupabase();
  mockCreateClient.mockReturnValue(sb as unknown as ReturnType<typeof createClient>);
});

describe('regras do nome da unidade', () => {
  it('tira espaço sobrando, como o banco', () => {
    expect(normalizarNomeUnidade('  UBS   Jardim  ')).toBe('UBS Jardim');
  });

  it('aceita de 3 a 120 caracteres, como o CHECK da tabela', () => {
    expect(nomeUnidadeValido('AB')).toBe(false);
    expect(nomeUnidadeValido('UBS')).toBe(true);
    expect(nomeUnidadeValido('x'.repeat(120))).toBe(true);
    expect(nomeUnidadeValido('x'.repeat(121))).toBe(false);
  });
});

describe('mensagens de erro', () => {
  it('troca recusada explica que é com a gerência', () => {
    expect(mensagemDeErroUnidade({ code: '42501', message: 'a unidade já foi escolhida; a troca é feita pela gerência' }))
      .toBe('Sua área já está definida. Para trocar, peça à gerência.');
  });

  it('não mostra o texto técnico do banco', () => {
    const msg = mensagemDeErroUnidade({ code: 'XX000', message: 'relation "x" does not exist' });
    expect(msg).not.toContain('relation');
  });
});

describe('listarUnidades', () => {
  it('lê só id e nome, em ordem alfabética', async () => {
    sb.order.mockResolvedValue({ data: [{ id: '1', nome: 'UBS Centro' }], error: null });
    const lista = await listarUnidades();
    expect(sb.from).toHaveBeenCalledWith('unidades_saude');
    expect(sb.select).toHaveBeenCalledWith('id, nome');
    expect(sb.order).toHaveBeenCalledWith('nome', { ascending: true });
    expect(lista).toEqual([{ id: '1', nome: 'UBS Centro' }]);
  });

  it('falha com mensagem, e não com lista vazia', async () => {
    sb.order.mockResolvedValue({ data: null, error: { message: 'rede' } });
    await expect(listarUnidades()).rejects.toThrow('Não foi possível carregar as unidades.');
  });
});

describe('escolherMinhaUnidade', () => {
  it('manda o nome limpo para a função do banco', async () => {
    sb.rpc.mockResolvedValue({ data: 'UBS Jardim', error: null });
    await expect(escolherMinhaUnidade('  UBS  Jardim ')).resolves.toBe('UBS Jardim');
    expect(sb.rpc).toHaveBeenCalledWith('fn_escolher_minha_unidade', { p_nome: 'UBS Jardim' });
  });

  it('nome curto nem vai ao servidor', async () => {
    await expect(escolherMinhaUnidade('U')).rejects.toThrow('de 3 a 120');
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('apaga o cache, porque o escopo dos dados mudou', async () => {
    sb.rpc.mockResolvedValue({ data: 'UBS Jardim', error: null });
    await escolherMinhaUnidade('UBS Jardim');
    expect(cacheClear).toHaveBeenCalled();
  });

  it('recusa do banco vira mensagem clara', async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'a unidade já foi escolhida; a troca é feita pela gerência' } });
    await expect(escolherMinhaUnidade('UBS Outra')).rejects.toThrow('peça à gerência');
  });
});

describe('designarUnidade', () => {
  it('chama a função da gerência com o profissional e a unidade', async () => {
    sb.rpc.mockResolvedValue({ data: 'UBS Sede', error: null });
    await designarUnidade('agente-1', 'UBS Sede');
    expect(sb.rpc).toHaveBeenCalledWith('fn_designar_unidade', { p_agente_id: 'agente-1', p_nome: 'UBS Sede' });
  });

  it('sem permissão avisa sem detalhe técnico', async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'só a gerência designa unidade' } });
    await expect(designarUnidade('agente-1', 'UBS Sede')).rejects.toThrow('não tem permissão');
  });
});

describe('listarEquipe', () => {
  it('não pede CPF, e-mail nem telefone', async () => {
    sb.order.mockResolvedValue({ data: [], error: null });
    await listarEquipe();
    const colunas = (sb.select.mock.calls[0] as unknown[])[0] as string;
    expect(colunas).not.toMatch(/cpf|email|telefone|senha/);
    expect(sb.from).toHaveBeenCalledWith('agentes');
  });
});
