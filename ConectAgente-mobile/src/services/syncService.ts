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
 */
import { syncQueueRepository } from '../database/repositories/syncQueueRepository';
import { residenciaRepository } from '../database/repositories/residenciaRepository';
import { moradorRepository } from '../database/repositories/moradorRepository';
import { visitaRepository } from '../database/repositories/visitaRepository';
import { supabase, SupabaseTable } from '../lib/supabase';
import { SYNC_BATCH_SIZE } from '../utils/constants';

export interface SyncStatus {
  sincronizando: boolean;
  pendentes: number;
  ultimaSync: string | null;
  erro: string | null;
}

export const syncService = {
  /**
   * Processa a fila de sync e envia para o Supabase.
   */
  async sincronizar(onProgress?: (progress: number, total: number) => void): Promise<void> {
    const itens = await syncQueueRepository.listarPendentes();
    if (itens.length === 0) return;

    const batch = itens.slice(0, SYNC_BATCH_SIZE);
    let processados = 0;

    for (const item of batch) {
      try {
        const payload = JSON.parse(item.payload);
        await syncParaSupabase(item.tabela as SupabaseTable, item.operacao, payload);

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
  payload: Record<string, unknown>
): Promise<void> {
  switch (operacao) {
    case 'insert': {
      const { error } = await supabase.from(tabela).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(error.message);
      break;
    }
    case 'update': {
      const { error } = await supabase
        .from(tabela)
        .update(payload)
        .eq('id', payload.id as string);
      if (error) throw new Error(error.message);
      break;
    }
    case 'delete': {
      const { error } = await supabase
        .from(tabela)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', payload.id as string);
      if (error) throw new Error(error.message);
      break;
    }
    default:
      throw new Error(`Operação desconhecida: ${operacao}`);
  }
}
