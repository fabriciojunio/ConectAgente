/**
 * Serviço de autenticação, offline-first.
 * Login funciona 100% offline via SQLite local.
 * Quando online, sincroniza com o servidor.
 */
import * as SecureStore from 'expo-secure-store';
import { agenteRepository } from '../database/repositories/agenteRepository';
import { syncQueueRepository } from '../database/repositories/syncQueueRepository';
import { Agente } from '../types';
import { SECURE_KEYS, SESSION_TIMEOUT_MS } from '../utils/constants';
import { isoNow } from '../utils/formatters';
import { supabase } from '../lib/supabase';
import { ACOES_AUDITORIA, auditRepository } from '../database/repositories/auditRepository';
import { limparLembretes } from './notificationService';
import { pararSincronizacaoEmSegundoPlano } from '../tasks/backgroundSync';
import { falhaDeConta, MENSAGEM_CONTA_NAO_LIBERADA } from '../utils/falhaDeSincronizacao';

export interface SessionData {
  agente: Agente;
  token: string;
  expires_at: string;
  /** Aviso para a tela mostrar depois de entrar, quando há um. */
  aviso?: string;
}

/**
 * Aviso de quem trocou a senha pela recuperação e o servidor não acompanhou.
 *
 * A conta do agente no Supabase usa um e-mail interno
 * (`<cpf>@conectagente.local`), que não recebe mensagem, então não existe
 * "esqueci a senha" do lado do servidor. Quem resolve é a coordenação, no
 * painel, em Agentes → detalhes → Senha de sincronização.
 */
export const AVISO_SENHA_DO_SERVIDOR =
  'Sua senha foi trocada só neste aparelho. A sincronização fica parada até a ' +
  'coordenação redefinir a sua senha de sincronização no painel, usando a mesma senha nova.';

/**
 * E-mail da conta do agente no servidor.
 *
 * A aprovação no painel cria a conta do Supabase Auth com `<cpf>@conectagente.local`,
 * e o login do painel usa o mesmo formato. O aplicativo usava o e-mail que o
 * agente digitou no cadastro do celular, que é outro endereço: o servidor
 * respondia "Invalid login credentials" mesmo com a senha certa, nenhuma
 * sessão abria e nada sincronizava. Achado no aparelho, com 19 registros
 * presos na fila.
 */
export function emailNoServidor(cpf: string): string {
  return `${cpf.replace(/\D/g, '')}@conectagente.local`;
}

function chaveDaPendencia(agenteId: string): string {
  return `${SECURE_KEYS.SENHA_SERVIDOR_PENDENTE}${agenteId}`;
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
    // O administrador do aparelho não tem conta no servidor: tentar abrir
    // sessão para ele só produzia o aviso de "conta não reconhecida".
    const servidor = agente.is_admin
      ? { ok: true as const, motivo: undefined }
      : await this.abrirSessaoNoServidor(emailNoServidor(agente.cpf), senha);

    // Senha trocada pela recuperação: enquanto o servidor tiver a antiga, a
    // sincronização fica parada, e o agente precisa saber disso agora, e não
    // quando perceber que a coleta da semana não subiu.
    let aviso: string | undefined;
    const pendente = await SecureStore.getItemAsync(chaveDaPendencia(agente.id)).catch(() => null);
    if (pendente) {
      if (servidor.ok) {
        await SecureStore.deleteItemAsync(chaveDaPendencia(agente.id)).catch(() => undefined);
      } else {
        aviso = AVISO_SENHA_DO_SERVIDOR;
      }
    } else if (!servidor.ok && falhaDeConta(servidor.motivo)) {
      // Sem este aviso o agente entrava, trabalhava o dia inteiro e nada
      // subia: o único sinal era o número de pendências crescendo.
      aviso = MENSAGEM_CONTA_NAO_LIBERADA;
    }

    // Com a sessão aberta, o que desistiu por falta dela volta para a fila.
    if (servidor.ok && !agente.is_admin) {
      await syncQueueRepository.reabrirComErro().catch(() => 0);
    }

    // Entrada no sistema. Junto com a leitura de prontuario, e o que permite
    // responder "quem estava com este aparelho quando o dado foi aberto".
    void auditRepository.registrar({
      agenteId: agente.id,
      acao: ACOES_AUDITORIA.LOGIN,
      tabela: 'agentes',
      registroId: agente.id,
    });

    return { agente, token: localToken, expires_at, aviso };
  },

  /**
   * Recupera a senha com o código e tenta levar a senha nova ao servidor.
   *
   * A troca local é a que vale para entrar no aplicativo. O servidor só
   * acompanha se este aparelho ainda tem uma sessão aberta da mesma pessoa:
   * aí `updateUser` troca a senha lá também. Sem sessão não há como provar ao
   * servidor quem é quem, e a troca fica marcada como pendente; o próximo
   * login avisa (ver `AVISO_SENHA_DO_SERVIDOR`).
   *
   * Devolve `null` quando CPF ou código não conferem.
   */
  async recuperarSenha(
    cpf: string,
    codigo: string,
    novaSenha: string
  ): Promise<{ codigo: string; servidorAtualizado: boolean } | null> {
    const novoCodigo = await agenteRepository.redefinirSenhaComCodigo(cpf, codigo, novaSenha);
    if (!novoCodigo) return null;

    const agente = await agenteRepository.buscarPorCpf(cpf);
    // O administrador do aparelho não tem conta no servidor.
    if (!agente || agente.is_admin) return { codigo: novoCodigo, servidorAtualizado: true };

    const servidorAtualizado = await this.atualizarSenhaNoServidor(agente, novaSenha);
    if (servidorAtualizado) {
      await SecureStore.deleteItemAsync(chaveDaPendencia(agente.id)).catch(() => undefined);
    } else {
      await SecureStore.setItemAsync(chaveDaPendencia(agente.id), new Date().toISOString());
    }
    return { codigo: novoCodigo, servidorAtualizado };
  },

  /** Troca a senha no Supabase, se a sessão aberta for da mesma pessoa. */
  async atualizarSenhaNoServidor(agente: Agente, novaSenha: string): Promise<boolean> {
    try {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email?.toLowerCase();
      if (!email || email !== emailNoServidor(agente.cpf)) return false;

      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) {
        console.warn('[auth] O servidor recusou a senha nova:', error.message);
        return false;
      }
      return true;
    } catch (erro) {
      console.warn('[auth] Sem acesso ao servidor para trocar a senha:', erro);
      return false;
    }
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
   *
   * Devolve também o código de recuperação da conta, que a tela mostra uma
   * vez. É ele que permite redefinir a senha depois, em "Esqueci minha senha".
   */
  async cadastrarAgente(data: {
    nome: string;
    cpf: string;
    email: string;
    senha: string;
    area_atuacao: string;
    unidade_saude: string;
  }): Promise<{ agente: Agente; codigoRecuperacao: string }> {
    // Verifica se CPF já existe
    const existe = await agenteRepository.buscarPorCpf(data.cpf);
    if (existe) throw new Error('CPF já cadastrado');

    const agente = await agenteRepository.criar(data);
    const codigoRecuperacao = await agenteRepository.gerarCodigoRecuperacao(agente.id);
    return { agente, codigoRecuperacao };
  },

  async obterAgenteAtual(): Promise<Agente | null> {
    const id = await SecureStore.getItemAsync(SECURE_KEYS.AGENTE_ID);
    if (!id) return null;
    return agenteRepository.buscarPorId(id);
  },
};
