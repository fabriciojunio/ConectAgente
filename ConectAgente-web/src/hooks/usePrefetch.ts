'use client';

import { useEffect, useRef, useState } from 'react';
import { cacheGet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';

// Service imports — cada chamada popula o cache automaticamente
import { getAgentes } from '@/services/agenteService';
import { getFamilias, getFamiliasEmAtraso } from '@/services/familiaService';
import { getVisitas, getEstatisticasVisitas } from '@/services/visitaService';
import { getCoberturaPorMicroarea, getRankingAtrasos } from '@/services/monitoramentoService';
import { getDashboardStats, getVisitasPorPeriodo, getVisitasPorAgente, getVisitasPorBairro, getVisitasRecentes, getAlertasAtraso } from '@/services/dashboardService';
import { getEstatisticasSistema, getAuditLogs, getUsuarios } from '@/services/adminService';
import { getSolicitacoes } from '@/services/registroService';
import { getMoradores, getEstatisticasMoradores } from '@/services/moradorService';

const noop = () => {};

/**
 * Dispara request via fila de prioridade BAIXA se nao estiver no cache.
 * Retorna a Promise ou null se ja estiver no cache.
 */
function prefetch(key: string, fn: () => Promise<unknown>): Promise<unknown> | null {
  if (cacheGet(key)) return null; // ja no cache, nada a fazer
  return enqueue(fn, 'low').catch(noop);
}

/**
 * Estado global do prefetch — evita rodar 2x e permite
 * que o componente de progresso leia o status.
 */
let globalProgress = { loaded: 0, total: 0, done: false };
let globalListeners: Array<() => void> = [];
function notifyListeners() { globalListeners.forEach((fn) => fn()); }

/**
 * Hook para acompanhar o progresso do prefetch.
 * Retorna { loaded, total, done, pct }.
 */
export function usePrefetchProgress() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    globalListeners.push(listener);
    return () => { globalListeners = globalListeners.filter((l) => l !== listener); };
  }, []);

  const pct = globalProgress.total === 0 ? 0 : Math.round((globalProgress.loaded / globalProgress.total) * 100);
  return { ...globalProgress, pct };
}

/**
 * Pre-carrega dados de todas as paginas em segundo plano.
 *
 * IMPORTANTE: espera 3 segundos antes de começar, para dar prioridade
 * às requisições da página que o usuário está vendo.
 * Usa a fila com prioridade 'low', então mesmo quando começa,
 * qualquer request da página atual (prioridade 'high') passa na frente.
 */
export function usePrefetch() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Espera 3s para a página atual carregar primeiro
    const timer = setTimeout(() => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const inicio = thirtyDaysAgo.toISOString().split('T')[0];
      const fim = now.toISOString().split('T')[0];

      // Lista de TODAS as requests que precisam ser feitas
      const tasks: Array<Promise<unknown> | null> = [
        // Dashboard
        prefetch(`dash_stats_{}`, () => getDashboardStats()),
        prefetch('dash_recentes_10', () => getVisitasRecentes(10)),
        prefetch('dash_alertas_30', () => getAlertasAtraso(30)),
        prefetch(`dash_periodo_${inicio}_${fim}_`, () => getVisitasPorPeriodo(inicio, fim)),
        prefetch(`dash_agente_${inicio}_${fim}_`, () => getVisitasPorAgente(inicio, fim)),
        prefetch(`dash_bairro_${inicio}_${fim}`, () => getVisitasPorBairro(inicio, fim)),
        // Visitas
        prefetch('visitas_{}_1_20', () => getVisitas(undefined, { page: 1, per_page: 20 })),
        prefetch('visitas_stats_{}', () => getEstatisticasVisitas()),
        // Agentes
        prefetch('agentes_{}_1_20', () => getAgentes(undefined, { page: 1, per_page: 20 })),
        // Familias
        prefetch('familias_{}_1_20', () => getFamilias(undefined, { page: 1, per_page: 20 })),
        prefetch('familias_atraso_30_', () => getFamiliasEmAtraso(30)),
        prefetch('familias_atraso_0_', () => getFamiliasEmAtraso(0)),
        // Moradores / Pacientes
        prefetch('moradores_{}_1_20', () => getMoradores(undefined, { page: 1, per_page: 20 })),
        prefetch('moradores_stats', () => getEstatisticasMoradores()),
        // Monitoramento
        prefetch('cobertura_', () => getCoberturaPorMicroarea()),
        prefetch('ranking_atrasos_', () => getRankingAtrasos()),
        // Admin
        prefetch('estatisticas_sistema', () => getEstatisticasSistema()),
        prefetch('audit_logs_{}_1_20', () => getAuditLogs(undefined, { page: 1, per_page: 20 })),
        prefetch('usuarios_1_20', () => getUsuarios({ page: 1, per_page: 20 })),
        prefetch('solicitacoes_pendente_1_20', () => getSolicitacoes('pendente')),
      ];

      // Filtra os que ja estavam no cache (retornaram null)
      const pending = tasks.filter((t): t is Promise<unknown> => t !== null);
      const alreadyCached = tasks.length - pending.length;

      globalProgress = { loaded: alreadyCached, total: tasks.length, done: pending.length === 0 };
      notifyListeners();

      // Cada request que termina atualiza o progresso
      pending.forEach((p) => {
        p.finally(() => {
          globalProgress.loaded++;
          if (globalProgress.loaded >= globalProgress.total) {
            globalProgress.done = true;
          }
          notifyListeners();
        });
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, []);
}
