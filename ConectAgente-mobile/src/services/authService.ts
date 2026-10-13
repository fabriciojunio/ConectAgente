/**
 * Serviço de autenticação, offline-first.
 * Login funciona 100% offline via SQLite local.
 * Quando online, sincroniza com o servidor.
 */
import * as SecureStore from 'expo-secure-store';
import { agenteRepository } from '../database/repositories/agenteRepository';
import { Agente } from '../types';
import { SECURE_KEYS, SESSION_TIMEOUT_MS } from '../utils/constants';
import { isoNow } from '../utils/formatters';
import { supabase } from '../lib/supabase';
import { ACOES_AUDITORIA, auditRepository } from '../database/repositories/auditRepository';
import { limparLembretes } from './notificationService';
import { pararSincronizacaoEmSegundoPlano } from '../tasks/backgroundSync';

export interface SessionData {
  agente: Agente;
  token: string;
  expires_at: string;
}

export const authService = {
  /**
   * Login, tenta local primeiro, depois sincroniza com servidor se online.
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

    // 4. Abrir sessão no Supabase, que é o que permite sincronizar.
    //
    // Isto não é opcional para o dado sair do aparelho, e antes não existia.
    // O aplicativo autenticava só localmente e falava com o Supabase usando a
    // chave anon, sem sessão. Com `auth.uid()` nulo, toda policy de RLS nega a
    // escrita. Medido num PostgreSQL com o schema e as policies reais:
    //
    //   sem sessão: new row violates row-level security policy for table
    //               "residencias"
    //   com sessão: as oito tabelas aceitam a gravação
    //
    // Não dá para contornar isso afrouxando a policy: quem usa a chave anon
    // não tem identidade verificável, e qualquer regra que aceitasse a
    // gravação aceitaria de qualquer pessoa com a chave, que é pública por
    // desenho.
    //
    // Continua sem bloquear o login: se estiver offline, ou se o agente ainda
    // não tiver usuário no Supabase Auth, o acesso ao aplicativo funciona
    // normalmente e a fila espera. O que muda é que a falha passa a ser
    // visível em vez de silenciosa.
    await this.abrirSessaoNoServidor(agente.email, senha);

    // Entrada no sistema. Junto com a leitura de prontuario, e o que permite
    // responder "quem estava com este aparelho quando o dado foi aberto".
    void auditRepository.registrar({
      agenteId: agente.id,
      acao: ACOES_AUDITORIA.LOGIN,
      tabela: 'agentes',
      registroId: agente.id,
    });

    return { agente, token: localToken, expires_at };
  },

  /**
   * Abre a sessão do Supabase, usada pela sincronização.
   *
   * Devolve o motivo da falha em vez de lançar, porque o login local já
   * terminou com sucesso e derrubar a entrada do agente por causa da rede
   * contraria o próprio desenho offline-first.
   */
  async abrirSessaoNoServidor(
    email: string,
    senha: string
  ): Promise<{ ok: boolean; motivo?: string }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      if (error) {
        // O caso mais comum em implantação nova: o agente existe na tabela
        // `agentes` mas não tem usuário correspondente no Supabase Auth.
        // Quem provisiona isso é a aprovação do cadastro no painel.
        console.warn(
          '[auth] Sem sessão no servidor, a sincronização vai ficar parada:',
          error.message
        );
        return { ok: false, motivo: error.message };
      }

      return { ok: true };
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : 'falha de rede';
      console.warn('[auth] Não foi possível abrir sessão no servidor:', motivo);
      return { ok: false, motivo };
    }
  },

  /**
   * Diz se existe sessão no servidor neste momento.
   *
   * A sessão fica no AsyncStorage e o cliente a renova sozinho
   * (`autoRefreshToken`), então ela sobrevive a reinício do aplicativo.
   */
  async temSessaoNoServidor(): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session != null;
    } catch {
      return false;
    }
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
   * Logout, limpa todos os dados de sessão.
   */
  async logout(): Promise<void> {
    // Nao ha mais cache de chave de cifra para limpar: a cifra de campo foi
    // removida porque nenhuma linha a chamava. O que o logout apaga e a
    // sessao, que e o que de fato existe.
    // Lembrete de visita e aviso pessoal: o aparelho nao pode avisar da visita
    // de um agente para o proximo que entrar. A tarefa de segundo plano para
    // junto, para o aparelho nao acordar por conta de quem ja saiu.
    await limparLembretes();
    await pararSincronizacaoEmSegundoPlano();

    await SecureStore.deleteItemAsync(SECURE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(SECURE_KEYS.AGENTE_ID);
    await SecureStore.deleteItemAsync(SECURE_KEYS.SESSION_EXPIRES);

    // Encerra a sessão do servidor também. Sem isto, o aparelho continuaria
    // com um token válido do Supabase depois do logout, e quem pegasse o
    // aparelho poderia ler o dado do agente anterior pela API.
    try {
      await supabase.auth.signOut();
    } catch {
      // Offline: a sessão local já foi apagada, e o token do servidor expira
      // por conta própria.
    }
  },

  /**
   * Primeiro acesso, cadastro local do agente.
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
