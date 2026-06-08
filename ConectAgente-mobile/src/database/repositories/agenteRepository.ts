import { getDatabase } from '../database';
import { Agente } from '../../types';
import { generateUUID, isoNow } from '../../utils/formatters';
import { hashSenha, verificarSenha } from '../../utils/encryption';

// Credenciais do administrador padrão do sistema
// AVISO: Em produção, troque a senha no primeiro login e remova essas constantes.
const ADMIN_CPF = '11144477735';
const ADMIN_SENHA = 'Admin@2025';

// ============================================================
// RATE LIMITING — proteção contra força bruta
// In-memory: persiste enquanto o processo estiver ativo.
// ============================================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

const _loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function _isLocked(cpf: string): boolean {
  const entry = _loginAttempts.get(cpf);
  if (!entry) return false;
  if (entry.lockedUntil === 0) return false; // ainda acumulando falhas, sem bloqueio ativo
  if (entry.lockedUntil > Date.now()) return true;
  _loginAttempts.delete(cpf); // bloqueio expirou — reseta contador
  return false;
}

function _registerFailure(cpf: string): void {
  const entry = _loginAttempts.get(cpf) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  _loginAttempts.set(cpf, entry);
}

function _clearFailures(cpf: string): void {
  _loginAttempts.delete(cpf);
}

/** Limpa todo o estado de rate limiting — USE APENAS EM TESTES. */
export function _resetLoginAttemptsForTesting(): void {
  _loginAttempts.clear();
}

/** Expõe tentativas restantes e tempo de desbloqueio (para testes e UI). */
export function loginRateStatus(cpf: string): { locked: boolean; remaining: number; unlocksAt?: number } {
  const entry = _loginAttempts.get(cpf);
  if (!entry) return { locked: false, remaining: MAX_LOGIN_ATTEMPTS };
  if (entry.lockedUntil > Date.now()) {
    return { locked: true, remaining: 0, unlocksAt: entry.lockedUntil };
  }
  return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - entry.count };
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
    // 1. Rate limiting — bloqueia após MAX_LOGIN_ATTEMPTS falhas
    if (_isLocked(cpf)) {
      throw new Error('Conta temporariamente bloqueada. Tente novamente em 15 minutos.');
    }

    const db = await getDatabase();

    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM agentes WHERE cpf = ? AND ativo = 1`,
      [cpf]
    );

    // 2. Sempre executa verificarSenha, mesmo quando usuário não existe.
    //    Isso iguala o tempo de resposta para CPF válido/inválido (anti-timing-attack).
    const hashParaVerificar = (row?.senha_hash as string) ?? '0000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
    const senhaValida = await verificarSenha(senha, hashParaVerificar);

    if (!row || !senhaValida) {
      _registerFailure(cpf);
      return null;
    }

    // 3. Login bem-sucedido — limpa contagem de falhas
    _clearFailures(cpf);

    // 4. Migração automática: formato legado (sem salt) → formato novo
    const storedHash = row.senha_hash as string;
    if (!storedHash.includes('$')) {
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

  /**
   * Verifica identidade do agente pelo CPF + e-mail cadastrado.
   * Retorna true se a combinação é válida (sem revelar qual campo é inválido — LGPD).
   */
  async verificarIdentidade(cpf: string, email: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM agentes WHERE cpf = ? AND email = ? AND ativo = 1`,
      [cpf, email.toLowerCase().trim()]
    );
    return (row?.count ?? 0) > 0;
  },

  /**
   * Reseta a senha após verificação de identidade bem-sucedida.
   * Registra o evento no audit_log para conformidade LGPD.
   */
  async resetarSenha(cpf: string, email: string, novaSenha: string): Promise<boolean> {
    const db = await getDatabase();
    const ok = await this.verificarIdentidade(cpf, email);
    if (!ok) return false;

    const senhaHash = await hashSenha(novaSenha);
    const now = isoNow();

    await db.runAsync(
      `UPDATE agentes SET senha_hash = ?, updated_at = ? WHERE cpf = ? AND ativo = 1`,
      [senhaHash, now, cpf]
    );

    // Audit log LGPD — registra o evento sem guardar dados sensíveis
    const agente = await this.buscarPorCpf(cpf);
    if (agente) {
      await db.runAsync(
        `INSERT INTO audit_log (id, agente_id, acao, tabela, registro_id, detalhes, created_at)
         VALUES (?, ?, 'RESET_SENHA', 'agentes', ?, ?, ?)`,
        [generateUUID(), agente.id, agente.id, 'Recuperação de senha via verificação CPF+email', now]
      );
    }

    return true;
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
    const mesAtual = new Date().toISOString().slice(0, 7);
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
    const hoje = new Date().toISOString().split('T')[0];
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

  /**
   * Garante que o administrador padrão existe no banco.
   * Chamado na inicialização do app — idempotente.
   */
  async garantirAdminPadrao(): Promise<void> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM agentes WHERE cpf = ? AND is_admin = 1`,
      [ADMIN_CPF]
    );
    if ((row?.count ?? 0) > 0) return; // já existe

    const senhaHash = await hashSenha(ADMIN_SENHA);
    const id = generateUUID();
    const now = isoNow();

    await db.runAsync(
      `INSERT INTO agentes (
        id, nome, cpf, email, senha_hash, telefone, area_atuacao, unidade_saude, ativo, is_admin, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      [id, 'Administrador', ADMIN_CPF, 'admin@conectagente.local',
       senhaHash, null, 'Administração', 'Sistema', now, now]
    );
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
