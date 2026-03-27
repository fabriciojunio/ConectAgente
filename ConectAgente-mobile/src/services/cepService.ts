/**
 * Serviço de busca de CEP via ViaCEP (gratuito, sem autenticação).
 * https://viacep.com.br/
 */
import axios from 'axios';
import { EnderecoViaCep } from '../types';
import { stripCEP } from '../utils/formatters';

const VIACEP_BASE = 'https://viacep.com.br/ws';

export const cepService = {
  async buscar(cep: string): Promise<EnderecoViaCep> {
    const cepLimpo = stripCEP(cep);

    if (cepLimpo.length !== 8) {
      throw new Error('CEP deve ter 8 dígitos');
    }

    const response = await axios.get<EnderecoViaCep>(
      `${VIACEP_BASE}/${cepLimpo}/json/`,
      { timeout: 10000 }
    );

    if (response.data.erro) {
      throw new Error('CEP não encontrado');
    }

    return response.data;
  },

  /**
   * Tenta buscar CEP e retorna null se offline ou não encontrado.
   * Uso seguro — não propaga erros.
   */
  async buscarSeguro(cep: string): Promise<EnderecoViaCep | null> {
    try {
      return await this.buscar(cep);
    } catch {
      return null;
    }
  },
};
