import { getDatabase } from '../database';
import { generateUUID, isoNow } from '../../utils/formatters';
import { syncQueueRepository } from './syncQueueRepository';
import { ACOES_AUDITORIA, auditRepository } from './auditRepository';
import { serializarProblemas, type MedicamentoForm, type RespostaForm } from '../../features/medicamentos/regras';

export interface Medicamento {
  id: string;
  morador_id: string;
  agente_id: string;
  nome: string;
  dosagem: string | null;
  frequencia: string | null;
  problemas_uso: string | null;
  duvida: string | null;
  duvida_respondida: boolean;
  resposta_medico: string | null;
  respondido_por: string | null;
  data_resposta: string | null;
  created_at: string;
  updated_at: string;
}

type Linha = Omit<Medicamento, 'duvida_respondida'> & { duvida_respondida: number };

function paraMedicamento(linha: Linha): Medicamento {
  return { ...linha, duvida_respondida: linha.duvida_respondida === 1 };
}

/**
 * Medicamentos que o morador usa e as dúvidas que o agente leva à equipe.
 *
 * O banco do aparelho é a fonte da tela; o servidor só recebe. Lá as colunas
 * clínicas não saem pela API (migration_medicamentos.sql), do mesmo jeito que
 * as fichas de prontuário.
 */
export const medicamentoRepository = {
  async listarPorMorador(moradorId: string): Promise<Medicamento[]> {
    const db = await getDatabase();
    const linhas = await db.getAllAsync<Linha>(
      `SELECT id, morador_id, agente_id, nome, dosagem, frequencia, problemas_uso, duvida,
              duvida_respondida, resposta_medico, respondido_por, data_resposta, created_at, updated_at
       FROM medicamentos WHERE morador_id = ? ORDER BY nome COLLATE NOCASE`,
      [moradorId]
    );
    return linhas.map(paraMedicamento);
  },

  async criar(
    moradorId: string,
    agenteId: string,
    dados: MedicamentoForm,
    problemas: readonly string[]
  ): Promise<Medicamento> {
    const db = await getDatabase();
    const agora = isoNow();
    const novo: Medicamento = {
      id: generateUUID(),
      morador_id: moradorId,
      agente_id: agenteId,
      nome: dados.nome,
      dosagem: dados.dosagem ?? null,
      frequencia: dados.frequencia ?? null,
      problemas_uso: serializarProblemas(problemas),
      duvida: dados.duvida ?? null,
      duvida_respondida: false,
      resposta_medico: null,
      respondido_por: null,
      data_resposta: null,
      created_at: agora,
      updated_at: agora,
    };

    await db.runAsync(
      `INSERT INTO medicamentos (
        id, morador_id, agente_id, nome, dosagem, frequencia, problemas_uso, duvida,
        duvida_respondida, resposta_medico, respondido_por, data_resposta, status_sync, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, 'pendente', ?, ?)`,
      [
        novo.id, novo.morador_id, novo.agente_id, novo.nome, novo.dosagem, novo.frequencia,
        novo.problemas_uso, novo.duvida, agora, agora,
      ]
    );
    await syncQueueRepository.enqueue('medicamentos', 'insert', novo.id, novo);
    // Contexto sem o nome do remédio nem a dúvida: a trilha diz quem fez o
    // quê e quando, não repete o dado de saúde.
    void auditRepository.registrar({
      agenteId, acao: ACOES_AUDITORIA.INSERT, tabela: 'medicamentos', registroId: novo.id,
      contexto: { com_duvida: !!novo.duvida },
    });
    return novo;
  },

  /** Anota a resposta que a equipe deu à dúvida. */
  async registrarResposta(id: string, agenteId: string, resposta: RespostaForm): Promise<void> {
    const db = await getDatabase();
    const agora = isoNow();
    await db.runAsync(
      `UPDATE medicamentos SET duvida_respondida = 1, resposta_medico = ?, respondido_por = ?,
         data_resposta = ?, status_sync = 'pendente', updated_at = ?
       WHERE id = ?`,
      [resposta.resposta, resposta.respondido_por, agora, agora, id]
    );
    await syncQueueRepository.enqueue('medicamentos', 'update', id, {
      duvida_respondida: true,
      resposta_medico: resposta.resposta,
      respondido_por: resposta.respondido_por,
      data_resposta: agora,
      updated_at: agora,
    });
    void auditRepository.registrar({
      agenteId, acao: ACOES_AUDITORIA.UPDATE, tabela: 'medicamentos', registroId: id,
      contexto: { resposta_de: resposta.respondido_por },
    });
  },

  async remover(id: string, agenteId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM medicamentos WHERE id = ?`, [id]);
    await syncQueueRepository.enqueue('medicamentos', 'delete', id, { id });
    void auditRepository.registrar({
      agenteId, acao: ACOES_AUDITORIA.DELETE, tabela: 'medicamentos', registroId: id,
    });
  },

  async marcarComoSincronizado(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`UPDATE medicamentos SET status_sync = 'sincronizado' WHERE id = ?`, [id]);
  },
};
