import { getDatabase } from '../database';
import { SyncQueueItem, OperacaoSync, StatusSync } from '../../types';
import { generateUUID, isoNow } from '../../utils/formatters';
import { SYNC_MAX_TENTATIVAS } from '../../utils/constants';

/**
 * Campos que existem só no banco local e não podem ir para o servidor.
 *
 * `status_sync` responde "esta linha já subiu?", pergunta que só faz sentido
 * no aparelho. O servidor tem a coluna equivalente com outro nome
 * (`sync_status`) e com DEFAULT próprio, então mandar o campo local fazia o
 * PostgREST recusar a linha inteira:
 *
 *   column "status_sync" of relation "residencias" does not exist
 *
 * O efeito era o pior possível: o aplicativo é offline-first, continuava
 * gravando no SQLite e nada parecia errado para o agente, enquanto nenhuma
 * residência, morador ou visita chegava ao painel.
 */
export const CAMPOS_SO_LOCAIS = ['status_sync'] as const;

/**
 * Campos cujo nome muda entre o banco local e o servidor.
 *
 * `meta_total` no aparelho é `meta` no servidor, e lá a coluna é NOT NULL com
 * CHECK (meta > 0). Enviar sem traduzir dava:
 *
 *   null value in column "meta" of relation "metas_visitas" violates
 *   not-null constraint
 *
 * A alternativa seria criar uma segunda coluna no servidor, o que deixaria
 * duas fontes para o mesmo número. A tradução mora aqui, num lugar só, e o
 * teste de contrato consulta esta mesma tabela de nomes, de modo que os dois
 * lados nunca divergem em silêncio.
 */
export const RENOMEAR_PARA_SERVIDOR: Record<string, string> = {
  meta_total: 'meta',
  // O formulário e o tipo da ficha de saúde usam "aferição" com acento; a
  // coluna do servidor é sem acento. O servidor recusava a ficha inteira por
  // coluna inexistente, e nenhuma ficha de saúde chegou. Achado conferindo o
  // banco de produção depois do teste no aparelho.
  'hgt_ultima_aferição': 'hgt_ultima_afericao',
  'pa_ultima_aferição': 'pa_ultima_afericao',
};

/**
 * Campos que o aparelho guarda como texto e o servidor espera como JSON.
 *
 * No SQLite não existe tipo JSON, então `dados_novos` e `dados_anteriores` da
 * trilha de auditoria são TEXT com o JSON serializado dentro. No PostgreSQL as
 * mesmas colunas são JSONB.
 *
 * Mandando a string sem converter, o PostgREST aceita e grava um JSONB que é
 * uma string, não um objeto: `"{\"origem\":\"tela\"}"` em vez de
 * `{"origem": "tela"}`. Não dá erro, e a consulta por campo dentro do JSON
 * deixa de encontrar qualquer coisa. É do tipo de defeito que só aparece
 * quando alguém precisa investigar um incidente e a trilha não responde.
 */
export const CAMPOS_JSON_NO_SERVIDOR = ['dados_novos', 'dados_anteriores'] as const;

/**
 * Deixa o payload no formato que o servidor aceita.
 *
 * A limpeza fica aqui, num lugar só, de propósito. Antes cada repositório
 * passava o objeto local inteiro e bastava um esquecer para a linha voltar a
 * ser recusada em silêncio.
 */
export function prepararPayloadParaServidor(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const entrada = payload as Record<string, unknown>;
  const saida: Record<string, unknown> = {};

  for (const [campo, valor] of Object.entries(entrada)) {
    if ((CAMPOS_SO_LOCAIS as readonly string[]).includes(campo)) continue;

    let convertido = valor;
    if (
      (CAMPOS_JSON_NO_SERVIDOR as readonly string[]).includes(campo) &&
      typeof valor === 'string' &&
      valor.length > 0
    ) {
      try {
        convertido = JSON.parse(valor);
      } catch {
        // Texto que não é JSON vai como está. Recusar aqui perderia a linha
        // inteira da trilha por causa de um campo de contexto.
        convertido = valor;
      }
    }

    saida[RENOMEAR_PARA_SERVIDOR[campo] ?? campo] = convertido;
  }

  return saida;
}

export const syncQueueRepository = {
  async enqueue(
    tabela: string,
    operacao: 'insert' | 'update' | 'delete',
    registroId: string,
    payload: unknown
  ): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO sync_queue (id, tabela, operacao, registro_id, payload, tentativas, status, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'pendente', ?)`,
      [
        generateUUID(),
        tabela,
        operacao,
        registroId,
        JSON.stringify(prepararPayloadParaServidor(payload)),
        isoNow(),
      ]
    );
  },

  async listarPendentes(): Promise<SyncQueueItem[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM sync_queue
       WHERE status = 'pendente' AND tentativas < ?
       ORDER BY created_at ASC`,
      [SYNC_MAX_TENTATIVAS]
    );
    return rows.map(mapRow);
  },

  async marcarSucesso(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET status = 'sincronizado' WHERE id = ?`,
      [id]
    );
  },

  async marcarErro(id: string, erro: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE sync_queue SET tentativas = tentativas + 1, erro = ?,
       status = CASE WHEN tentativas + 1 >= ? THEN 'erro' ELSE 'pendente' END
       WHERE id = ?`,
      [erro, SYNC_MAX_TENTATIVAS, id]
    );
  },

  /**
   * Quanto ainda não chegou ao servidor, inclusive o que desistiu.
   *
   * Contava só `pendente`: o item que esgotava as tentativas virava `erro`,
   * sumia da conta, e o selo de pendências desaparecia como se estivesse tudo
   * enviado. Achado no aparelho.
   */
  async contarPendentes(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pendente', 'erro')`
    );
    return row?.count ?? 0;
  },

  /**
   * Devolve à fila o que desistiu, com as tentativas zeradas.
   *
   * Chamado quando a sessão do servidor abre e quando o agente pede para
   * tentar de novo. A causa mais comum de desistência era a falta de sessão
   * ou de conta liberada, e resolvida a causa o item precisa voltar a subir.
   * Devolve quantos voltaram.
   */
  async reabrirComErro(): Promise<number> {
    const db = await getDatabase();
    const r = await db.runAsync(
      `UPDATE sync_queue SET status = 'pendente', tentativas = 0, erro = NULL WHERE status = 'erro'`
    );
    return r?.changes ?? 0;
  },

  async limparSincronizados(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM sync_queue WHERE status = 'sincronizado'`
    );
  },
};

function mapRow(row: Record<string, unknown>): SyncQueueItem {
  return {
    id: row.id as string,
    tabela: row.tabela as string,
    operacao: row.operacao as OperacaoSync,
    registro_id: row.registro_id as string,
    payload: row.payload as string,
    tentativas: row.tentativas as number,
    status: row.status as StatusSync,
    erro: row.erro as string | undefined,
    created_at: row.created_at as string,
  };
}
