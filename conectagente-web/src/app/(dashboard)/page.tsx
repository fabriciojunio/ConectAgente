'use client';

import { useState, useEffect, useRef } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { FilterBar } from '@/components/layout/FilterBar';
import DashboardCards from '@/components/dashboard/DashboardCards';
import VisitasLineChart from '@/components/charts/VisitasLineChart';
import StatusPieChart from '@/components/charts/StatusPieChart';
import AgentesBarChart from '@/components/charts/AgentesBarChart';
import HeatmapBairros from '@/components/charts/HeatmapBairros';
import RecentVisitas from '@/components/dashboard/RecentVisitas';
import AlertasAtraso from '@/components/dashboard/AlertasAtraso';
import {
  getDashboardStats,
  getVisitasPorPeriodo,
  getVisitasPorAgente,
  getVisitasPorBairro,
  getVisitasRecentes,
  getAlertasAtraso,
} from '@/services/dashboardService';
import { cacheGetStale } from '@/lib/cache';
import { withTimeout } from '@/lib/utils';
import type {
  DashboardStats,
  VisitaPorPeriodo,
  VisitaPorAgente,
  VisitaPorBairro,
  VisitaComDetalhes,
  FamiliaEmAtraso,
} from '@/types';

const EMPTY_STATS: DashboardStats = {
  visitas_hoje: 0,
  visitas_semana: 0,
  visitas_mes: 0,
  total_familias: 0,
  total_moradores: 0,
  agentes_ativos: 0,
  visitas_realizadas: 0,
  visitas_pendentes: 0,
  taxa_conclusao: 0,
};

export default function DashboardPage() {
  const { filters } = useFilters();

  const initStats = cacheGetStale<DashboardStats>(`dash_stats_${JSON.stringify(filters ?? {})}`);
  const initRecentes = cacheGetStale<VisitaComDetalhes[]>('dash_recentes_10');
  const initAlertas = cacheGetStale<FamiliaEmAtraso[]>('dash_alertas_30');

  const [loading, setLoading] = useState(!initStats);
  const [stats, setStats] = useState<DashboardStats>(initStats ?? EMPTY_STATS);
  const [visitasPeriodo, setVisitasPeriodo] = useState<VisitaPorPeriodo[]>([]);
  const [visitasAgente, setVisitasAgente] = useState<VisitaPorAgente[]>([]);
  const [visitasBairro, setVisitasBairro] = useState<VisitaPorBairro[]>([]);
  const [visitasRecentes, setVisitasRecentes] = useState<VisitaComDetalhes[]>(initRecentes ?? []);
  const [alertas, setAlertas] = useState<FamiliaEmAtraso[]>(initAlertas ?? []);

  // Use ref to avoid stale closure without re-creating the effect
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    let cancelled = false;

    const f = filtersRef.current;
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inicio = f.periodo_inicio ?? thirtyDaysAgo.toISOString().split('T')[0];
    const fim = f.periodo_fim ?? now.toISOString().split('T')[0];

    // Progressive rendering: each piece of data appears as soon as it arrives
    // instead of waiting for all 6 queries via Promise.all
    const done = { count: 0, total: 6 };
    const checkDone = () => { if (++done.count >= done.total && !cancelled) setLoading(false); };

    withTimeout(getDashboardStats(f), EMPTY_STATS).then((d) => { if (!cancelled) setStats(d); }).finally(checkDone);
    withTimeout(getVisitasPorPeriodo(inicio, fim, f), []).then((d) => { if (!cancelled) setVisitasPeriodo(d); }).finally(checkDone);
    withTimeout(getVisitasPorAgente(inicio, fim, f), []).then((d) => { if (!cancelled) setVisitasAgente(d); }).finally(checkDone);
    withTimeout(getVisitasPorBairro(inicio, fim), []).then((d) => { if (!cancelled) setVisitasBairro(d); }).finally(checkDone);
    withTimeout(getVisitasRecentes(10), []).then((d) => { if (!cancelled) setVisitasRecentes(d); }).finally(checkDone);
    withTimeout(getAlertasAtraso(30), []).then((d) => { if (!cancelled) setAlertas(d); }).finally(checkDone);

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Visão geral das operações</p>
      </div>

      <FilterBar variant="dashboard" />

      <DashboardCards stats={stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Visitas nos Últimos 30 Dias</h3>
          <VisitasLineChart data={visitasPeriodo} loading={loading} />
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Distribuição por Status</h3>
          <StatusPieChart
            data={[
              { name: 'Realizadas', value: (stats?.visitas_mes ?? 0) - (stats?.visitas_pendentes ?? 0), color: '#1565C0' },
              { name: 'Pendentes',  value: stats?.visitas_pendentes ?? 0, color: '#42A5F5' },
            ]}
            loading={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Top Agentes</h3>
          <AgentesBarChart data={visitasAgente} loading={loading} />
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Visitas por Bairro</h3>
          <HeatmapBairros data={visitasBairro} loading={loading} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Visitas Recentes</h3>
          <RecentVisitas visitas={visitasRecentes} loading={loading} />
        </div>
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Alertas de Atraso</h3>
          <AlertasAtraso alertas={alertas} loading={loading} />
        </div>
      </div>
    </div>
  );
}
