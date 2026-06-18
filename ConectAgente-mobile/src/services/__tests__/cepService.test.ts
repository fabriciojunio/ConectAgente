/**
 * Testes para cepService (ViaCEP)
 */
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  get: jest.fn(),
  default: { get: jest.fn() },
}));

import axios from 'axios';
import { cepService } from '../cepService';

const mockedAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

const cepValido = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  complemento: 'de 1 a 610 - lado par',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
  ibge: '3550308',
  ddd: '11',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('cepService.buscar', () => {
  it('retorna endereço para CEP válido', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: cepValido });

    const endereco = await cepService.buscar('01310100');

    expect(endereco).toBeDefined();
    expect(endereco.logradouro).toBe('Avenida Paulista');
    expect(endereco.localidade).toBe('São Paulo');
    expect(endereco.uf).toBe('SP');
  });

  it('aceita CEP com traço', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: cepValido });

    const endereco = await cepService.buscar('01310-100');

    expect(endereco).toBeDefined();
  });

  it('lança erro para CEP com menos de 8 dígitos', async () => {
    await expect(cepService.buscar('0131')).rejects.toThrow();
  });

  it('lança erro quando ViaCEP retorna erro (CEP inexistente)', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: { erro: true } });

    await expect(cepService.buscar('99999999')).rejects.toThrow();
  });

  it('propaga erro de rede', async () => {
    mockedAxiosGet.mockRejectedValueOnce(new Error('Network Error'));

    await expect(cepService.buscar('01310100')).rejects.toThrow('Network Error');
  });
});

describe('cepService.buscarSeguro', () => {
  it('retorna dados para CEP válido', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: cepValido });

    const endereco = await cepService.buscarSeguro('01310100');

    expect(endereco).not.toBeNull();
  });

  it('retorna null para CEP inválido', async () => {
    const endereco = await cepService.buscarSeguro('0131');

    expect(endereco).toBeNull();
  });

  it('retorna null em caso de erro de rede', async () => {
    mockedAxiosGet.mockRejectedValueOnce(new Error('Network Error'));

    const endereco = await cepService.buscarSeguro('01310100');

    expect(endereco).toBeNull();
  });

  it('retorna null quando ViaCEP retorna erro', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ data: { erro: true } });

    const endereco = await cepService.buscarSeguro('99999999');

    expect(endereco).toBeNull();
  });
});
