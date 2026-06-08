import { cacheGet } from '@/lib/cache';
import { getAgentes } from '@/services/agenteService';
import { getFamilias, getFamiliasEmAtraso } from '@/services/familiaService';
import { getVisitas, getEstatisticasVisitas } from '@/services/visitaService';
import { getCoberturaPorMicroarea, getRankingAtrasos } from '@/services/monitoramentoService';
import { getDashboardStats, getVisitasPorPeriodo, getVisitasPorAgente, getVisitasPorBairro, getVisitasRecentes, getAlertasAtraso } from '@/services/dashboardService';
import { getEstatisticasSistema, getAuditLogs, getUsuarios } from '@/services/adminService';
import { getSolicitacoes } from '@/services/registroService';
import { getMoradores, getEstatisticasMoradores } from '@/services/moradorService';

const noop = () => {};

function fire(key: string, fn: () => Promise<unknown>) {
  if (!cacheGet(key)) fn().catch(noop);
}

function getDates() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return {
    inicio: thirtyDaysAgo.toISOString().split('T')[0],
    fim: now.toISOString().split('T')[0],
  };
}

// Guarda quais rotas ja foram pre-carregadas via hover
const prefetched = new Set<string>();

/**
 * Pre-carrega os dados de uma rota especifica.
 * Chamado ao passar o mouse sobre um link da sidebar.
 * So dispara uma vez por rota.
 */
export function prefetchByRoute(route: string) {
  if (prefetched.has(route)) return;
  prefetched.add(route);

  const { inicio, fim } = getDates();

  switch (route) {
    case '/':
      fire(`dash_stats_{}`, () => getDashboardStats());
      fire('dash_recentes_10', () => getVisitasRecentes(10));
      fire('dash_alertas_30', () => getAlertasAtraso(30));
      fire(`dash_periodo_${inicio}_${fim}_`, () => getVisitasPorPeriodo(inicio, fim));
      fire(`dash_agente_${inicio}_${fim}_`, () => getVisitasPorAgente(inicio, fim));
      fire(`dash_bairro_${inicio}_${fim}`, () => getVisitasPorBairro(inicio, fim));
      break;

    case '/visitas':
      fire('visitas_{}_1_20', () => getVisitas(undefined, { page: 1, per_page: 20 }));
      fire('visitas_stats_{}', () => getEstatisticasVisitas());
      break;

    case '/familias':
      fire('familias_{}_1_20', () => getFamilias(undefined, { page: 1, per_page: 20 }));
      fire('familias_atraso_30_', () => getFamiliasEmAtraso(30));
      break;

    case '/moradores':
      fire('moradores_{}_1_20', () => getMoradores(undefined, { page: 1, per_page: 20 }));
      fire('moradores_stats', () => getEstatisticasMoradores());
      break;

    case '/agentes':
      fire('agentes_{}_1_20', () => getAgentes(undefined, { page: 1, per_page: 20 }));
      break;

    case '/monitoramento':
      fire('familias_atraso_0_', () => getFamiliasEmAtraso(0));
      fire('cobertura_', () => getCoberturaPorMicroarea());
      fire('ranking_atrasos_', () => getRankingAtrasos());
      break;

    case '/territorial':
      fire('cobertura_', () => getCoberturaPorMicroarea());
      fire(`dash_bairro_${inicio}_${fim}`, () => getVisitasPorBairro(inicio, fim));
      break;

    case '/admin':
      fire('estatisticas_sistema', () => getEstatisticasSistema());
      fire('audit_logs_{}_1_20', () => getAuditLogs(undefined, { page: 1, per_page: 20 }));
      break;

    case '/admin/usuarios':
      fire('usuarios_1_20', () => getUsuarios({ page: 1, per_page: 20 }));
      break;

    case '/admin/solicitacoes':
      fire('solicitacoes_pendente_1_20', () => getSolicitacoes('pendente'));
      break;
  }
}
