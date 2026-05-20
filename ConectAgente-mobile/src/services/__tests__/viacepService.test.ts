import { buscarEnderecoPorCEP } from '../viacepService';

global.fetch = jest.fn();

describe('viacepService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deve lancar erro para CEP com menos de 8 digitos', async () => {
    await expect(buscarEnderecoPorCEP('1234')).rejects.toThrow('CEP inválido');
  });

  it('deve retornar endereco para CEP valido', async () => {
    const mockData = {
      cep: '17012-900',
      logradouro: 'Praça da Sé',
      complemento: '',
      bairro: 'Sé',
      localidade: 'Bauru',
      uf: 'SP',
      ibge: '3506003',
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const resultado = await buscarEnderecoPorCEP('17012900');
    expect(resultado.localidade).toBe('Bauru');
    expect(resultado.uf).toBe('SP');
  });

  it('deve lancar erro quando CEP nao existe (campo erro: true)', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ erro: true }),
    });

    await expect(buscarEnderecoPorCEP('00000000')).rejects.toThrow('CEP não encontrado');
  });
});
