'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { MapPinned } from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import { useAuth } from '@/hooks/useAuth';
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
import { SEM_INDICADORES } from '@/services/dashboardService';
import type {
  DashboardStats,
  VisitaPorPeriodo,
  VisitaPorAgente,
  VisitaPorBairro,
  VisitaComDetalhes,
  FamiliaEmAtraso,
} from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const semArea = user?.role === 'coordenador' && !user.unidade_saude?.trim();
  const { filters } = useFilters();

  const initStats = cacheGetStale<DashboardStats>(`dash_stats_${JSON.stringify(filters ?? {})}`);
  const initRecentes = cacheGetStale<VisitaComDetalhes[]>('dash_recentes_10');
  const initAlertas = cacheGetStale<FamiliaEmAtraso[]>('dash_alertas_30');

  const [loading, setLoading] = useState(!initStats);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats>(initStats ?? SEM_INDICADORES);
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
    // Um bloco que falha fica vazio e a tela avisa, em vez de mostrar zero
    // como se fosse o número real.
    const falhou = (err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar o dashboard');
    };

    withTimeout(getDashboardStats(f)).then((d) => { if (!cancelled) setStats(d); }).catch(falhou).finally(checkDone);
    withTimeout(getVisitasPorPeriodo(inicio, fim, f)).then((d) => { if (!cancelled) setVisitasPeriodo(d); }).catch(falhou).finally(checkDone);
    withTimeout(getVisitasPorAgente(inicio, fim, f)).then((d) => { if (!cancelled) setVisitasAgente(d); }).catch(falhou).finally(checkDone);
    withTimeout(getVisitasPorBairro(inicio, fim)).then((d) => { if (!cancelled) setVisitasBairro(d); }).catch(falhou).finally(checkDone);
    withTimeout(getVisitasRecentes(10)).then((d) => { if (!cancelled) setVisitasRecentes(d); }).catch(falhou).finally(checkDone);
    withTimeout(getAlertasAtraso(30)).then((d) => { if (!cancelled) setAlertas(d); }).catch(falhou).finally(checkDone);

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Visão geral</h1>
        <p className="page-subtitle">Visitas, famílias e equipe no recorte da sua conta</p>
      </div>

      {semArea && (
        <Link
          href="/minha-area"
          className="flex items-center gap-3 rounded-[var(--radius)] border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700 hover:border-primary-500"
        >
          <MapPinned size={18} aria-hidden="true" />
          <span>
            <strong>Defina a sua área.</strong> Enquanto a conta não tem unidade, o painel não mostra a equipe nem os
            pacientes. Clique para escolher.
          </span>
        </Link>
      )}

      <FilterBar variant="dashboard" />

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <DashboardCards stats={stats} loading={loading} />

      {/* Cada gráfico já vem no próprio cartão, com título: sem moldura em volta. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VisitasLineChart data={visitasPeriodo} loading={loading} />
        <StatusPieChart
          data={[
            { name: 'Realizadas', value: stats?.visitas_realizadas ?? 0, color: 'var(--primaria)' },
            { name: 'Pendentes', value: stats?.visitas_pendentes ?? 0, color: 'var(--primaria-clara)' },
          ]}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgentesBarChart data={visitasAgente} loading={loading} />
        <HeatmapBairros data={visitasBairro} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentVisitas visitas={visitasRecentes} loading={loading} />
        <AlertasAtraso alertas={alertas} loading={loading} />
      </div>
    </div>
  );
}
