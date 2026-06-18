/**
 * Serviço de autenticação — offline-first.
 * Login funciona 100% offline via SQLite local.
 * Quando online, sincroniza com o servidor.
 */
import * as SecureStore from 'expo-secure-store';
import { agenteRepository } from '../database/repositories/agenteRepository';
import { Agente } from '../types';
import { SECURE_KEYS, SESSION_TIMEOUT_MS } from '../utils/constants';
import { clearEncryptionKeyCache } from '../utils/encryption';
import { isoNow } from '../utils/formatters';
import api from './api';

export interface SessionData {
  agente: Agente;
  token: string;
  expires_at: string;
}

export const authService = {
  /**
   * Login — tenta local primeiro, depois sincroniza com servidor se online.
   */
  async login(cpf: string, senha: string): Promise<SessionData> {
    // 1. Autenticar localmente (funciona offline)
    const agente = await agenteRepository.autenticar(cpf, senha);
    if (!agente) {
      throw new Error('CPF ou senha inválidos');
    }

    // 2. Gerar token de sessão local
    const expires_at = new Date(Date.now() + SESSION_TIMEOUT_MS).toISOString();
    const localToken = `local_${agente.id}_${Date.now()}`;

    // 3. Persistir sessão
    await SecureStore.setItemAsync(SECURE_KEYS.AUTH_TOKEN, localToken);
    await SecureStore.setItemAsync(SECURE_KEYS.AGENTE_ID, agente.id);
    await SecureStore.setItemAsync(SECURE_KEYS.SESSION_EXPIRES, expires_at);

    // 4. Tentar autenticar no servidor (opcional - não bloqueia se offline)
    try {
      const response = await api.post('/auth/login', { cpf, senha });
      if (response.data.token) {
        await SecureStore.setItemAsync(SECURE_KEYS.AUTH_TOKEN, response.data.token);
        if (response.data.refresh_token) {
          await SecureStore.setItemAsync(SECURE_KEYS.REFRESH_TOKEN, response.data.refresh_token);
        }
      }
    } catch {
      // Offline ou servidor indisponível — continua com sessão local
    }

    return { agente, token: localToken, expires_at };
  },

  /**
   * Verifica se há sessão válida armazenada.
   */
  async verificarSessao(): Promise<Agente | null> {
    try {
      const agenteId = await SecureStore.getItemAsync(SECURE_KEYS.AGENTE_ID);
      const expiresAt = await SecureStore.getItemAsync(SECURE_KEYS.SESSION_EXPIRES);

      if (!agenteId || !expiresAt) return null;

      // Verificar se sessão expirou
      if (new Date(expiresAt) < new Date()) {
        await this.logout();
        return null;
      }

      return agenteRepository.buscarPorId(agenteId);
    } catch {
      return null;
    }
  },

  /**
   * Renovar expiração da sessão (chamado em atividade do usuário).
   */
  async renovarSessao(): Promise<void> {
    const expires_at = new Date(Date.now() + SESSION_TIMEOUT_MS).toISOString();
    await SecureStore.setItemAsync(SECURE_KEYS.SESSION_EXPIRES, expires_at);
  },

  /**
   * Logout — limpa todos os dados de sessão.
   */
  async logout(): Promise<void> {
    clearEncryptionKeyCache();
    await SecureStore.deleteItemAsync(SECURE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_KEYS.AGENTE_ID);
    await SecureStore.deleteItemAsync(SECURE_KEYS.SESSION_EXPIRES);

    // Notificar servidor (não crítico se falhar)
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
  },

  /**
   * Primeiro acesso — cadastro local do agente.
   */
  async cadastrarAgente(data: {
    nome: string;
    cpf: string;
    email: string;
    senha: string;
    area_atuacao: string;
    unidade_saude: string;
  }): Promise<Agente> {
    // Verifica se CPF já existe
    const existe = await agenteRepository.buscarPorCpf(data.cpf);
    if (existe) throw new Error('CPF já cadastrado');

    return agenteRepository.criar(data);
  },

  async obterAgenteAtual(): Promise<Agente | null> {
    const id = await SecureStore.getItemAsync(SECURE_KEYS.AGENTE_ID);
    if (!id) return null;
    return agenteRepository.buscarPorId(id);
  },
};
