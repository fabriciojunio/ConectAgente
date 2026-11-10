import { getDatabase } from '../database';
import { Agente } from '../../types';
import { apenasData, generateUUID, isoNow } from '../../utils/formatters';
import * as SecureStore from 'expo-secure-store';
import {
  hashSenha,
  verificarSenha,
  precisaAtualizarHash,
  HASH_QUE_NUNCA_CONFERE,
  sortearCodigoRecuperacao,
  normalizarCodigoRecuperacao,
} from '../../utils/encryption';
import { SECURE_KEYS } from '../../utils/constants';
import { ACOES_AUDITORIA, auditRepository } from './auditRepository';
import {
  estaBloqueado,
  registrarFalha,
  limparFalhas,
  situacaoDasTentativas,
  apagarTentativas,
} from '../limiteDeTentativas';

/**
 * CPF da conta de administrador do aparelho.
 *
 * O CPF não é segredo, e não precisa ser: o que protege a conta é a senha,
 * que quem instala o aplicativo escolhe no primeiro uso (`configurarAdmin`).
 *
 * Histórico, porque explica o desenho atual:
 * - até a 1.1, a senha era a constante `Admin@2025`, publicada no README;
 * - na 1.2, passou a ser sorteada e mostrada na tela de entrada até alguém
 *   tocar em "Já anotei". Na prática ficava lá: a tela dizia que o aviso
 *   sumia quando a senha fosse trocada, mas nada apagava o aviso na troca;
 * - e a recuperação por CPF e e-mail redefinia a senha de qualquer conta,
 *   porque o CPF do administrador estava na tela e o e-mail no código.
 */
export const ADMIN_CPF = '11144477735';

/**
 * Valor de `senha_hash` do administrador que ainda não escolheu a senha.
 *
 * Não tem `$`, então não é um hash no formato atual, e o `autenticar`
 * recusa a conta nesse estado antes de comparar qualquer coisa.
 */
const SENHA_NAO_DEFINIDA = 'senha-nao-definida';

function chaveDoCodigo(agenteId: string): string {
  return `${SECURE_KEYS.CODIGO_RECUPERACAO}${agenteId}`;
}

async function lerDoCofre(chave: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(chave);
  } catch {
    return null;
  }
}

// ============================================================
// RATE LIMITING: proteção contra força bruta
// A contagem fica gravada no aparelho (limiteDeTentativas.ts) e sobrevive
// ao reinício do aplicativo.
// ============================================================

/** Limpa todo o estado de rate limiting. USE APENAS EM TESTES. */
export async function _resetLoginAttemptsForTesting(): Promise<void> {
  await apagarTentativas();
}

/** Expõe tentativas restantes e tempo de desbloqueio (para testes e UI). */
export function loginRateStatus(cpf: string): { locked: boolean; remaining: number; unlocksAt?: number } {
  return situacaoDasTentativas(cpf);
}

export const agenteRepository = {
  async criar(data: {
    nome: string;
    cpf: string;
    email: string;
    senha: string;
    telefone?: string;
    area_atuacao: string;
    unidade_saude: string;
    is_admin?: boolean;
  }): Promise<Agente> {
    const db = await getDatabase();
    const id = generateUUID();
    const now = isoNow();
    const senhaHash = await hashSenha(data.senha);
    const isAdmin = data.is_admin ? 1 : 0;

    await db.runAsync(
      `INSERT INTO agentes (
        id, nome, cpf, email, senha_hash, telefone, area_atuacao, unidade_saude, ativo, is_admin, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [id, data.nome, data.cpf, data.email, senhaHash, data.telefone ?? null,
       data.area_atuacao, data.unidade_saude, isAdmin, now, now]
    );

    return {
      id, nome: data.nome, cpf: data.cpf, email: data.email,
      telefone: data.telefone, area_atuacao: data.area_atuacao,
      unidade_saude: data.unidade_saude, ativo: true, is_admin: !!data.is_admin,
      created_at: now, updated_at: now,
    };
  },

  async autenticar(cpf: string, senha: string): Promise<Agente | null> {
    // 1. Rate limiting, bloqueia após MAX_TENTATIVAS falhas
    if (await estaBloqueado(cpf)) {
      throw new Error('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
    }

    const db = await getDatabase();

    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM agentes WHERE cpf = ? AND ativo = 1`,
      [cpf]
    );

    // 2. Sempre executa verificarSenha, mesmo quando usuário não existe.
    //    Isso iguala o tempo de resposta para CPF válido/inválido (anti-timing-attack).
    //    Conta sem senha definida (administrador não configurado) também
    //    passa pela comparação, contra um hash que nunca confere.
    const semSenha = row?.senha_hash === SENHA_NAO_DEFINIDA;
    const hashParaVerificar =
      row && !semSenha ? (row.senha_hash as string) : HASH_QUE_NUNCA_CONFERE;
    const senhaValida = await verificarSenha(senha, hashParaVerificar);

    if (!row || semSenha || !senhaValida) {
      await registrarFalha(cpf);
      return null;
    }

    // 3. Login bem-sucedido, limpa contagem de falhas
    await limparFalhas(cpf);

    // 4. Migração automática: SHA-256 (com ou sem sal) ou PBKDF2 com menos
    //    iterações que o atual → PBKDF2 atual. Só dá para fazer aqui, que é
    //    o único momento em que a senha em texto está disponível.
    const storedHash = row.senha_hash as string;
    if (precisaAtualizarHash(storedHash)) {
      const novoHash = await hashSenha(senha);
      await db.runAsync(
        `UPDATE agentes SET senha_hash = ?, updated_at = ? WHERE id = ?`,
        [novoHash, isoNow(), row.id as string]
      );
    }

    return mapRow(row);
  },

  async buscarPorId(id: string): Promise<Agente | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM agentes WHERE id = ? AND ativo = 1`,
      [id]
    );
    return row ? mapRow(row) : null;
  },

  async buscarPorCpf(cpf: string): Promise<Agente | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM agentes WHERE cpf = ? AND ativo = 1`,
      [cpf]
    );
    return row ? mapRow(row) : null;
  },

  async atualizar(id: string, data: Partial<Omit<Agente, 'id' | 'created_at'>>): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE agentes SET
        nome = COALESCE(?, nome),
        email = COALESCE(?, email),
        telefone = COALESCE(?, telefone),
        area_atuacao = COALESCE(?, area_atuacao),
        unidade_saude = COALESCE(?, unidade_saude),
        updated_at = ?
      WHERE id = ?`,
      [data.nome ?? null, data.email ?? null, data.telefone ?? null,
       data.area_atuacao ?? null, data.unidade_saude ?? null, isoNow(), id]
    );
  },

  // ============================================================
  // CÓDIGO DE RECUPERAÇÃO
  // ============================================================

  /**
   * Sorteia um código de recuperação novo para a conta e devolve o código.
   *
   * Só o hash fica guardado, no cofre do sistema (Keystore no Android,
   * Keychain no iOS). O código em si é mostrado uma vez a quem pediu e não
   * pode ser lido de volta. Um código novo invalida o anterior.
   */
  async gerarCodigoRecuperacao(agenteId: string): Promise<string> {
    const codigo = await sortearCodigoRecuperacao();
    const hash = await hashSenha(normalizarCodigoRecuperacao(codigo));
    await SecureStore.setItemAsync(chaveDoCodigo(agenteId), hash);
    return codigo;
  },

  /**
   * Redefine a senha com CPF e código de recuperação.
   *
   * Substitui a antiga recuperação por CPF e e-mail, que não pedia nenhum
   * segredo: CPF e e-mail de um colega de unidade qualquer um sabe, e os do
   * administrador estavam na tela de entrada e no código-fonte.
   *
   * O código vale uma vez. Em caso de sucesso devolve um código novo, para a
   * tela mostrar, porque sem ele a pessoa ficaria sem como recuperar a conta
   * da próxima vez. Em caso de falha devolve `null`, sem dizer se o erro foi
   * no CPF ou no código.
   */
  async redefinirSenhaComCodigo(
    cpf: string,
    codigo: string,
    novaSenha: string
  ): Promise<string | null> {
    const chaveDoLimite = `recuperacao:${cpf}`;
    if (await estaBloqueado(chaveDoLimite)) {
      throw new Error('Muitas tentativas. Tente novamente em 15 minutos.');
    }

    const agente = await this.buscarPorCpf(cpf);
    const guardado = agente ? await lerDoCofre(chaveDoCodigo(agente.id)) : null;
    // Compara mesmo sem conta ou sem código guardado, para o tempo de
    // resposta não dizer qual dos dois existe.
    const confere = await verificarSenha(
      normalizarCodigoRecuperacao(codigo),
      guardado ?? HASH_QUE_NUNCA_CONFERE
    );

    if (!agente || !guardado || !confere) {
      await registrarFalha(chaveDoLimite);
      return null;
    }
    await limparFalhas(chaveDoLimite);

    const db = await getDatabase();
    await db.runAsync(
      `UPDATE agentes SET senha_hash = ?, updated_at = ? WHERE id = ?`,
      [await hashSenha(novaSenha), isoNow(), agente.id]
    );

    // Código usado não vale de novo. Se o cofre falhar ao gravar o novo, o
    // antigo continua lá; por isso o novo é gravado por cima, e não depois de
    // apagar o antigo.
    const novoCodigo = await this.gerarCodigoRecuperacao(agente.id);

    // A falha de auditoria não desfaz a troca de senha, que já aconteceu
    // (ver cabeçalho do auditRepository).
    void auditRepository.registrar({
      agenteId: agente.id,
      acao: ACOES_AUDITORIA.RESET_SENHA,
      tabela: 'agentes',
      registroId: agente.id,
      contexto: { origem: 'codigo de recuperacao' },
    });

    return novoCodigo;
  },

  async existeAgenteCadastrado(): Promise<boolean> {
    const db = await getDatabase();
    // Conta apenas agentes normais (não admin) para o fluxo de "Primeiro acesso"
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM agentes WHERE ativo = 1 AND is_admin = 0`
    );
    return (row?.count ?? 0) > 0;
  },

  // ============================================================
  // MÉTODOS ADMIN
  // ============================================================

  async listarTodos(): Promise<Array<Agente & { total_residencias: number; total_moradores: number; visitas_mes: number }>> {
    const db = await getDatabase();
    // `apenasData`, e nao `toISOString()`: o recorte da data em UTC vira o
    // dia seguinte a partir das 21h no fuso do Brasil, e no fim do mes isso
    // troca o mes inteiro da consulta.
    const mesAtual = apenasData(new Date()).slice(0, 7);
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT a.*,
        (SELECT COUNT(*) FROM residencias r WHERE r.agente_id = a.id AND r.deleted_at IS NULL) as total_residencias,
        (SELECT COUNT(*) FROM moradores m WHERE m.agente_id = a.id AND m.deleted_at IS NULL) as total_moradores,
        (SELECT COUNT(*) FROM visitas v WHERE v.agente_id = a.id AND substr(v.data_visita,1,7) = ?) as visitas_mes
       FROM agentes a WHERE a.is_admin = 0 AND a.ativo = 1 ORDER BY a.nome ASC`,
      [mesAtual]
    );
    return rows.map((row) => ({
      ...mapRow(row),
      total_residencias: Number(row.total_residencias ?? 0),
      total_moradores: Number(row.total_moradores ?? 0),
      visitas_mes: Number(row.visitas_mes ?? 0),
    }));
  },

  async obterEstatisticasGlobais() {
    const db = await getDatabase();
    const hoje = apenasData(new Date());
    const mesAtual = hoje.slice(0, 7);
    const [agentes, residencias, moradores, visitasMes, visitasHoje, syncPendente, totalAudit] =
      await Promise.all([
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM agentes WHERE is_admin = 0 AND ativo = 1`),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM residencias WHERE deleted_at IS NULL`),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM moradores WHERE deleted_at IS NULL`),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM visitas WHERE substr(data_visita,1,7) = ?`, [mesAtual]),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM visitas WHERE data_visita = ?`, [hoje]),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pendente'`),
        db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM audit_log`),
      ]);
    return {
      totalAgentes: agentes?.count ?? 0,
      totalResidencias: residencias?.count ?? 0,
      totalMoradores: moradores?.count ?? 0,
      totalVisitasMes: visitasMes?.count ?? 0,
      totalVisitasHoje: visitasHoje?.count ?? 0,
      visitasPendentesSync: syncPendente?.count ?? 0,
      totalAuditLog: totalAudit?.count ?? 0,
    };
  },

  async listarAuditLog(limite = 50): Promise<Array<{ id: string; agente_nome: string; acao: string; tabela: string; registro_id: string; created_at: string }>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT al.*, a.nome as agente_nome FROM audit_log al
       LEFT JOIN agentes a ON a.id = al.agente_id
       ORDER BY al.created_at DESC LIMIT ?`,
      [limite]
    );
    return rows.map((row) => ({
      id: row.id as string,
      agente_nome: (row.agente_nome as string) ?? 'Sistema',
      acao: row.acao as string,
      tabela: row.tabela as string,
      registro_id: row.registro_id as string,
      created_at: row.created_at as string,
    }));
  },

  // ============================================================
  // ADMINISTRADOR DO APARELHO
  // ============================================================

  /**
   * Garante que a conta de administrador existe. Chamado na abertura do app.
   *
   * Instalação nova: cria a conta **sem senha**. Ninguém entra nela até
   * alguém escolher a senha em "Configurar administrador" na tela de
   * entrada. Nenhuma senha é sorteada, guardada ou mostrada.
   *
   * Instalação que veio da 1.2.x: se a senha sorteada daquela versão ainda
   * está no cofre, ela foi exibida na tela de entrada e precisa ser tratada
   * como vazada. A chave é apagada e a conta volta para "sem senha", e o
   * administrador escolhe uma senha nova no próximo uso.
   *
   * A chave é apagada antes de a conta voltar para "sem senha", e não
   * depois: se a ordem fosse a outra e o cofre falhasse, a próxima abertura
   * acharia a chave de novo e desfaria a senha que o administrador acabou de
   * escolher.
   */
  async garantirAdminPadrao(): Promise<void> {
    const db = await getDatabase();
    const admin = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM agentes WHERE cpf = ? AND is_admin = 1`,
      [ADMIN_CPF]
    );

    if (!admin) {
      const now = isoNow();
      await db.runAsync(
        `INSERT INTO agentes (
          id, nome, cpf, email, senha_hash, telefone, area_atuacao, unidade_saude, ativo, is_admin, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
        [generateUUID(), 'Administrador', ADMIN_CPF, 'admin@conectagente.local',
         SENHA_NAO_DEFINIDA, null, 'Administração', 'Sistema', now, now]
      );
      return;
    }

    const senhaVazada = await lerDoCofre(SECURE_KEYS.SENHA_ADMIN_INICIAL);
    if (!senhaVazada) return;

    try {
      await SecureStore.deleteItemAsync(SECURE_KEYS.SENHA_ADMIN_INICIAL);
    } catch (erro) {
      console.error('Não foi possível apagar a senha inicial antiga:', erro);
      return;
    }
    await db.runAsync(
      `UPDATE agentes SET senha_hash = ?, updated_at = ? WHERE id = ?`,
      [SENHA_NAO_DEFINIDA, isoNow(), admin.id]
    );
  },

  /**
   * Diz se o administrador deste aparelho ainda não escolheu a senha.
   *
   * Conta que ainda não existe também conta como "precisa configurar": na
   * primeira abertura, a tela de entrada pode perguntar antes de
   * `garantirAdminPadrao` terminar de criar a conta, e o botão de
   * configurar não pode sumir por causa dessa corrida.
   */
  async adminPrecisaConfigurar(): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ senha_hash: string }>(
      `SELECT senha_hash FROM agentes WHERE cpf = ? AND is_admin = 1`,
      [ADMIN_CPF]
    );
    return !row || row.senha_hash === SENHA_NAO_DEFINIDA;
  },

  /**
   * Define a senha do administrador no primeiro uso e devolve o código de
   * recuperação, para a tela mostrar uma vez.
   *
   * Só funciona enquanto a conta está sem senha: o `WHERE` exige o
   * marcador, então depois de configurada ninguém usa este caminho para
   * trocar a senha de quem já configurou.
   */
  async configurarAdmin(senha: string): Promise<string> {
    // Mesma corrida de `adminPrecisaConfigurar`: garante a conta antes. Se a
    // abertura do aplicativo criou a conta ao mesmo tempo, o CPF único recusa
    // a segunda inserção, e isso não é erro aqui.
    await this.garantirAdminPadrao().catch(() => undefined);

    const db = await getDatabase();
    const resultado = await db.runAsync(
      `UPDATE agentes SET senha_hash = ?, updated_at = ?
       WHERE cpf = ? AND is_admin = 1 AND senha_hash = ?`,
      [await hashSenha(senha), isoNow(), ADMIN_CPF, SENHA_NAO_DEFINIDA]
    );
    if (resultado.changes !== 1) {
      throw new Error('O administrador deste aparelho já foi configurado.');
    }

    const admin = await this.buscarPorCpf(ADMIN_CPF);
    if (!admin) throw new Error('Conta de administrador não encontrada.');

    void auditRepository.registrar({
      agenteId: admin.id,
      acao: ACOES_AUDITORIA.RESET_SENHA,
      tabela: 'agentes',
      registroId: admin.id,
      contexto: { origem: 'configuracao do administrador' },
    });

    return this.gerarCodigoRecuperacao(admin.id);
  },
};

function mapRow(row: Record<string, unknown>): Agente {
  return {
    id: row.id as string,
    nome: row.nome as string,
    cpf: row.cpf as string,
    email: row.email as string,
    telefone: row.telefone as string | undefined,
    area_atuacao: row.area_atuacao as string,
    unidade_saude: row.unidade_saude as string,
    ativo: Boolean(row.ativo),
    is_admin: Boolean(row.is_admin),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
