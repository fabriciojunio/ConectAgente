/**
 * Serviço de sincronização offline-first com Supabase.
 *
 * Fluxo:
 *   1. Escrita local (SQLite) → enfileira na sync_queue
 *   2. Quando online → processa fila em lotes
 *   3. Supabase recebe os dados e distribui entre dispositivos
 *
 * O Supabase (free tier) suporta 500 MB de dados, sem limite
 * de requisições (fair use) — ideal para o volume de um ACS.
 *
 * ─────────────────────────────────────────────────────────────
 * Sobre o identificador do registro
 * ─────────────────────────────────────────────────────────────
 * A versão anterior tirava o identificador do próprio payload
 * (`payload.id`) e isso falhava de três formas diferentes, todas medidas
 * contra um PostgreSQL de verdade com o schema real:
 *
 *   1. `visitas` e `agendamentos` enfileiram o objeto de entrada, que não
 *      tem `id`. O servidor então gerava um UUID novo a cada envio, com dois
 *      efeitos: o registro ficava com identificador diferente do local, e
 *      cada retentativa criava uma linha duplicada, porque `onConflict: 'id'`
 *      não tem como detectar conflito sem o id no payload.
 *
 *   2. O cancelamento de agendamento enfileira `{ status: 'cancelada' }`,
 *      sem `id`. O `.eq('id', undefined)` não atualizava nada.
 *
 *   3. As cinco tabelas de prontuário são identificadas por `prontuario_id`,
 *      não por `id`. Mesmo com o id certo no payload, o filtro apontava para
 *      a coluna errada.
 *
 * A fila sempre soube o identificador correto: está em `registro_id`, que
 * cada repositório preenche ao enfileirar. Passar esse valor resolve os três
 * casos de uma vez e não depende do que cada repositório lembrou de incluir
 * no payload.
 */
import { syncQueueRepository } from '../database/repositories/syncQueueRepository';
import { residenciaRepository } from '../database/repositories/residenciaRepository';
import { moradorRepository } from '../database/repositories/moradorRepository';
import { visitaRepository } from '../database/repositories/visitaRepository';
import { supabase, SupabaseTable } from '../lib/supabase';
import { authService } from './authService';
import { SYNC_BATCH_SIZE } from '../utils/constants';

export interface SyncStatus {
  sincronizando: boolean;
  pendentes: number;
  ultimaSync: string | null;
  erro: string | null;
}

/**
 * Coluna que identifica o registro em cada tabela.
 *
 * As tabelas de prontuário têm `id` próprio, mas quem as liga ao prontuário
 * é `prontuario_id`, declarado UNIQUE no servidor. É por ele que o aplicativo
 * grava e lê, e portanto é a chave de sincronização.
 */
const CHAVE_POR_TABELA: Partial<Record<SupabaseTable, string>> = {
  prontuario_saude: 'prontuario_id',
  prontuario_gestante: 'prontuario_id',
  prontuario_puericultura: 'prontuario_id',
  prontuario_mulher: 'prontuario_id',
  prontuario_social: 'prontuario_id',
};

function chaveDa(tabela: SupabaseTable): string {
  return CHAVE_POR_TABELA[tabela] ?? 'id';
}

/**
 * Alvo de conflito do UPSERT, quando nao e a chave primaria.
 *
 * `metas_visitas` tem UNIQUE (agente_id, mes, ano) no servidor, e no
 * aparelho o `INSERT OR REPLACE` gera um id novo a cada vez que o agente
 * redefine a meta do mes. Conflitando por `id`, a segunda definicao do mesmo
 * mes tentaria criar uma linha nova e bateria na chave unica composta. O
 * alvo certo e o trio.
 */
const CONFLITO_POR_TABELA: Partial<Record<SupabaseTable, string>> = {
  metas_visitas: 'agente_id,mes,ano',
};

function conflitoDa(tabela: SupabaseTable): string {
  return CONFLITO_POR_TABELA[tabela] ?? chaveDa(tabela);
}

/**
 * Tabelas em que o aplicativo salva por substituição e não por alteração.
 *
 * `salvarSaude` e as irmãs fazem insere-ou-atualiza no banco local. Mandar
 * isso como UPDATE puro perdia dado em silêncio: se a linha ainda não existe
 * no servidor, o UPDATE afeta zero linhas e o PostgREST não devolve erro.
 * Como UPSERT, o primeiro envio cria e os seguintes atualizam.
 */
const SALVAS_POR_UPSERT = new Set<SupabaseTable>([
  'prontuario_saude',
  'prontuario_gestante',
  'prontuario_puericultura',
  'prontuario_mulher',
  'prontuario_social',
]);

export const syncService = {
  /**
   * Processa a fila de sync e envia para o Supabase.
   */
  async sincronizar(onProgress?: (progress: number, total: number) => void): Promise<void> {
    const itens = await syncQueueRepository.listarPendentes();
    if (itens.length === 0) return;

    // Sem sessão no servidor, o RLS nega toda gravação. Medido com o schema e
    // as policies reais: `new row violates row-level security policy`.
    //
    // Parar aqui não é detalhe de elegância. A fila conta tentativas e marca
    // o item como erro definitivo depois de SYNC_MAX_TENTATIVAS. Se a
    // sincronização rodasse sem sessão, cada ciclo queimaria uma tentativa de
    // cada item, e em cinco ciclos a coleta de um dia inteiro ficaria presa
    // como erro permanente, por uma causa que não tem nada a ver com o dado.
    if (!(await authService.temSessaoNoServidor())) {
      throw new Error(
        'Sem sessão no servidor. Entre novamente para a sincronização voltar.'
      );
    }

    const batch = itens.slice(0, SYNC_BATCH_SIZE);
    let processados = 0;

    for (const item of batch) {
      try {
        const payload = JSON.parse(item.payload);
        await syncParaSupabase(
          item.tabela as SupabaseTable,
          item.operacao,
          payload,
          item.registro_id
        );

        // Marcar como sincronizado no repositório local
        if (item.operacao === 'insert' || item.operacao === 'update') {
          if (item.tabela === 'residencias') {
            await residenciaRepository.marcarComoSincronizado(item.registro_id);
          } else if (item.tabela === 'moradores') {
            await moradorRepository.marcarComoSincronizado(item.registro_id);
          } else if (item.tabela === 'visitas') {
            await visitaRepository.marcarComoSincronizado(item.registro_id);
          }
        }

        await syncQueueRepository.marcarSucesso(item.id);
        processados++;
        onProgress?.(processados, batch.length);
      } catch (error) {
        const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
        await syncQueueRepository.marcarErro(item.id, mensagem);
      }
    }

    if (processados > 0) {
      await syncQueueRepository.limparSincronizados();
    }
  },

  async contarPendentes(): Promise<number> {
    return syncQueueRepository.contarPendentes();
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers de sincronização com Supabase
// ─────────────────────────────────────────────────────────────

async function syncParaSupabase(
  tabela: SupabaseTable,
  operacao: string,
  payload: Record<string, unknown>,
  registroId: string
): Promise<void> {
  const chave = chaveDa(tabela);

  switch (operacao) {
    case 'insert': {
      // O identificador entra à força: vem da fila, não do payload, para que
      // o registro no servidor tenha o mesmo id do local e para que a
      // retentativa atualize em vez de duplicar.
      const comChave = { ...payload, [chave]: registroId };
      const { error } = await supabase
        .from(tabela)
        .upsert(comChave, { onConflict: conflitoDa(tabela) });
      if (error) throw new Error(error.message);
      break;
    }
    case 'update': {
      if (SALVAS_POR_UPSERT.has(tabela)) {
        const comChave = { ...payload, [chave]: registroId };
        const { error } = await supabase
          .from(tabela)
          .upsert(comChave, { onConflict: conflitoDa(tabela) });
        if (error) throw new Error(error.message);
        break;
      }
      const { error } = await supabase.from(tabela).update(payload).eq(chave, registroId);
      if (error) throw new Error(error.message);
      break;
    }
    case 'delete': {
      const { error } = await supabase
        .from(tabela)
        .update({ deleted_at: new Date().toISOString() })
        .eq(chave, registroId);
      if (error) throw new Error(error.message);
      break;
    }
    default:
      throw new Error(`Operação desconhecida: ${operacao}`);
  }
}
