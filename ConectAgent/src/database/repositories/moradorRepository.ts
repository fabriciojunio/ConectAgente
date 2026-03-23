import { getDatabase } from '../database';
import { Morador, MoradorFormData, StatusSync } from '../../types';
import { generateUUID, isoNow } from '../../utils/formatters';
import { escapeForLike } from '../../utils/validators';
import { syncQueueRepository } from './syncQueueRepository';

export const moradorRepository = {
  async criar(data: MoradorFormData, agenteId: string): Promise<Morador> {
    const db = await getDatabase();
    const id = generateUUID();
    const now = isoNow();

    const morador: Morador = {
      id, ...data, agente_id: agenteId,
      status_sync: StatusSync.PENDENTE,
      created_at: now, updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO moradores (
        id, residencia_id, nome, cpf, cartao_sus, telefone, data_nascimento,
        cidade_nascimento, nome_pai, nome_mae, sexo, escolaridade, profissao,
        tem_doenca, doencas, beneficio_bolsa_familia, tem_convenio, convenio_nome,
        toma_medicamento, medicamentos_lista, is_responsavel, agente_id,
        status_sync, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        morador.id, morador.residencia_id, morador.nome,
        morador.cpf ?? null, morador.cartao_sus ?? null, morador.telefone ?? null,
        morador.data_nascimento, morador.cidade_nascimento ?? null,
        morador.nome_pai ?? null, morador.nome_mae ?? null,
        morador.sexo, morador.escolaridade ?? null, morador.profissao ?? null,
        morador.tem_doenca ? 1 : 0, morador.doencas ?? null,
        morador.beneficio_bolsa_familia ? 1 : 0,
        morador.tem_convenio ? 1 : 0, morador.convenio_nome ?? null,
        morador.toma_medicamento ? 1 : 0, morador.medicamentos_lista ?? null,
        morador.is_responsavel ? 1 : 0,
        morador.agente_id, morador.status_sync, morador.created_at, morador.updated_at,
      ]
    );

    if (data.is_responsavel) {
      await db.runAsync(
        `UPDATE residencias SET morador_responsavel_id = ?, status_sync = 'pendente', updated_at = ?
         WHERE id = ?`,
        [id, now, data.residencia_id]
      );
    }

    await syncQueueRepository.enqueue('moradores', 'insert', id, morador);
    return morador;
  },

  async listarPorResidencia(residenciaId: string): Promise<Morador[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM moradores
       WHERE residencia_id = ? AND deleted_at IS NULL
       ORDER BY is_responsavel DESC, nome ASC`,
      [residenciaId]
    );
    return rows.map(mapRow);
  },

  async buscarPorId(id: string): Promise<Morador | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM moradores WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return row ? mapRow(row) : null;
  },

  async buscarPorCpf(cpf: string, agenteId: string): Promise<Morador | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM moradores WHERE cpf = ? AND agente_id = ? AND deleted_at IS NULL`,
      [cpf, agenteId]
    );
    return row ? mapRow(row) : null;
  },

  async buscarPorCartaoSUS(cartaoSUS: string, agenteId: string): Promise<Morador | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM moradores WHERE cartao_sus = ? AND agente_id = ? AND deleted_at IS NULL`,
      [cartaoSUS, agenteId]
    );
    return row ? mapRow(row) : null;
  },

  async buscarPorNome(nome: string, agenteId: string): Promise<Morador[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM moradores
       WHERE nome LIKE ? ESCAPE '\\' AND agente_id = ? AND deleted_at IS NULL
       ORDER BY nome ASC LIMIT 50`,
      [`%${escapeForLike(nome)}%`, agenteId]
    );
    return rows.map(mapRow);
  },

  async atualizar(id: string, data: Partial<MoradorFormData>): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();

    await db.runAsync(
      `UPDATE moradores SET
        nome = COALESCE(?, nome),
        cpf = COALESCE(?, cpf),
        cartao_sus = COALESCE(?, cartao_sus),
        telefone = COALESCE(?, telefone),
        data_nascimento = COALESCE(?, data_nascimento),
        cidade_nascimento = COALESCE(?, cidade_nascimento),
        nome_pai = COALESCE(?, nome_pai),
        nome_mae = COALESCE(?, nome_mae),
        sexo = COALESCE(?, sexo),
        escolaridade = COALESCE(?, escolaridade),
        profissao = COALESCE(?, profissao),
        tem_doenca = COALESCE(?, tem_doenca),
        doencas = COALESCE(?, doencas),
        beneficio_bolsa_familia = COALESCE(?, beneficio_bolsa_familia),
        tem_convenio = COALESCE(?, tem_convenio),
        convenio_nome = COALESCE(?, convenio_nome),
        toma_medicamento = COALESCE(?, toma_medicamento),
        medicamentos_lista = COALESCE(?, medicamentos_lista),
        status_sync = 'pendente',
        updated_at = ?
      WHERE id = ?`,
      [
        data.nome ?? null, data.cpf ?? null, data.cartao_sus ?? null,
        data.telefone ?? null, data.data_nascimento ?? null, data.cidade_nascimento ?? null,
        data.nome_pai ?? null, data.nome_mae ?? null, data.sexo ?? null,
        data.escolaridade ?? null, data.profissao ?? null,
        data.tem_doenca !== undefined ? (data.tem_doenca ? 1 : 0) : null,
        data.doencas ?? null,
        data.beneficio_bolsa_familia !== undefined ? (data.beneficio_bolsa_familia ? 1 : 0) : null,
        data.tem_convenio !== undefined ? (data.tem_convenio ? 1 : 0) : null,
        data.convenio_nome ?? null,
        data.toma_medicamento !== undefined ? (data.toma_medicamento ? 1 : 0) : null,
        data.medicamentos_lista ?? null,
        now, id,
      ]
    );

    await syncQueueRepository.enqueue('moradores', 'update', id, { id, ...data, updated_at: now });
  },

  async excluir(id: string): Promise<void> {
    const db = await getDatabase();
    const now = isoNow();
    // Soft delete + anonimização LGPD
    await db.runAsync(
      `UPDATE moradores SET
        nome = 'ANONIMIZADO', cpf = NULL, cartao_sus = NULL, telefone = NULL,
        nome_pai = NULL, nome_mae = NULL,
        deleted_at = ?, status_sync = 'pendente', updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    );
    await syncQueueRepository.enqueue('moradores', 'delete', id, { id, deleted_at: now });
  },

  async marcarComoSincronizado(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE moradores SET status_sync = 'sincronizado' WHERE id = ?`,
      [id]
    );
  },

  async contar(agenteId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM moradores WHERE agente_id = ? AND deleted_at IS NULL`,
      [agenteId]
    );
    return row?.count ?? 0;
  },

  // ADMIN — sem filtro por agente_id
  async listarTodos(filtroAgenteId?: string): Promise<Array<Morador & { agente_nome?: string }>> {
    const db = await getDatabase();
    const sql = filtroAgenteId
      ? `SELECT m.*, a.nome as agente_nome FROM moradores m LEFT JOIN agentes a ON a.id = m.agente_id WHERE m.agente_id = ? AND m.deleted_at IS NULL ORDER BY m.nome ASC`
      : `SELECT m.*, a.nome as agente_nome FROM moradores m LEFT JOIN agentes a ON a.id = m.agente_id WHERE m.deleted_at IS NULL ORDER BY m.nome ASC`;
    const rows = await db.getAllAsync<Record<string, unknown>>(sql, filtroAgenteId ? [filtroAgenteId] : []);
    return rows.map((row) => ({ ...mapRow(row), agente_nome: row.agente_nome as string | undefined }));
  },

  async buscarGlobal(query: string): Promise<Array<Morador & { agente_nome?: string }>> {
    const db = await getDatabase();
    const safe = `%${escapeForLike(query)}%`;
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT m.*, a.nome as agente_nome FROM moradores m LEFT JOIN agentes a ON a.id = m.agente_id
       WHERE (m.nome LIKE ? ESCAPE '\\' OR m.cpf LIKE ? ESCAPE '\\') AND m.deleted_at IS NULL
       ORDER BY m.nome ASC LIMIT 50`,
      [safe, safe]
    );
    return rows.map((row) => ({ ...mapRow(row), agente_nome: row.agente_nome as string | undefined }));
  },

  async listarResponsaveis(agenteId?: string): Promise<Pick<Morador, 'id' | 'residencia_id' | 'nome'>[]> {
    const db = await getDatabase();
    const query = agenteId
      ? `SELECT id, residencia_id, nome FROM moradores WHERE is_responsavel = 1 AND agente_id = ? AND deleted_at IS NULL`
      : `SELECT id, residencia_id, nome FROM moradores WHERE is_responsavel = 1 AND deleted_at IS NULL`;
    const rows = await db.getAllAsync<{ id: string; residencia_id: string; nome: string }>(
      query,
      agenteId ? [agenteId] : []
    );
    return rows;
  },
};

function mapRow(row: Record<string, unknown>): Morador {
  return {
    id: row.id as string,
    residencia_id: row.residencia_id as string,
    nome: row.nome as string,
    cpf: row.cpf as string | undefined,
    cartao_sus: row.cartao_sus as string | undefined,
    telefone: row.telefone as string | undefined,
    data_nascimento: row.data_nascimento as string,
    cidade_nascimento: row.cidade_nascimento as string | undefined,
    nome_pai: row.nome_pai as string | undefined,
    nome_mae: row.nome_mae as string | undefined,
    sexo: row.sexo as Morador['sexo'],
    escolaridade: row.escolaridade as Morador['escolaridade'],
    profissao: row.profissao as string | undefined,
    tem_doenca: Boolean(row.tem_doenca),
    doencas: row.doencas as string | undefined,
    beneficio_bolsa_familia: Boolean(row.beneficio_bolsa_familia),
    tem_convenio: Boolean(row.tem_convenio),
    convenio_nome: row.convenio_nome as string | undefined,
    toma_medicamento: Boolean(row.toma_medicamento),
    medicamentos_lista: row.medicamentos_lista as string | undefined,
    is_responsavel: Boolean(row.is_responsavel),
    agente_id: row.agente_id as string,
    status_sync: row.status_sync as StatusSync,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: row.deleted_at as string | undefined,
  };
}
