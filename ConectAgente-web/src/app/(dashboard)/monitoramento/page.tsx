'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { FilterBar } from '@/components/layout/FilterBar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import CoberturaChart from '@/components/charts/CoberturaChart';
import { getCoberturaPorMicroarea, getRankingAtrasos } from '@/services/monitoramentoService';
import { getFamiliasEmAtraso } from '@/services/familiaService';
import { cacheGetStale } from '@/lib/cache';
import { getCriticidadeColor, withTimeout } from '@/lib/utils';
import type { FamiliaEmAtraso, CoberturaMicroarea } from '@/types';
import {
  AlertTriangle,
  Shield,
  MapPin,
  FileText,
  Users,
} from 'lucide-react';

function SkeletonRows() {
  return (
    <div className="overflow-x-auto">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
        </div>
      ))}
    </div>
  );
}

export default function MonitoramentoPage() {
  const { filters } = useFilters();

  const unidade = (filters as Record<string, string>)?.unidade_saude ?? '';
  const initAtrasos = cacheGetStale<FamiliaEmAtraso[]>(`familias_atraso_0_${unidade}`);
  const initCobertura = cacheGetStale<CoberturaMicroarea[]>(`cobertura_${unidade}`);
  const initRanking = cacheGetStale<{ microareas: Array<{ microarea: string; total_atraso: number }>; agentes: Array<{ agente_nome: string; total_atraso: number }> }>(`ranking_atrasos_${unidade}`);

  const [loading, setLoading] = useState(!initAtrasos);
  const [error, setError] = useState('');
  const [familiasAtraso, setFamiliasAtraso] = useState<FamiliaEmAtraso[]>(initAtrasos ?? []);
  const [cobertura, setCobertura] = useState<CoberturaMicroarea[]>(initCobertura ?? []);
  const [rankingMicroareas, setRankingMicroareas] = useState<Array<{ microarea: string; total_atraso: number }>>(initRanking?.microareas ?? []);
  const [rankingAgentes, setRankingAgentes] = useState<Array<{ agente_nome: string; total_atraso: number }>>(initRanking?.agentes ?? []);

  const fetchData = useCallback(async () => {
    if (familiasAtraso.length === 0) setLoading(true);
    setError('');
    const done = { count: 0, total: 3 };
    const checkDone = () => { if (++done.count >= done.total) setLoading(false); };

    withTimeout(getCoberturaPorMicroarea(filters), [])
      .then(setCobertura).catch(() => {}).finally(checkDone);
    withTimeout(getRankingAtrasos(filters), { microareas: [], agentes: [] })
      .then((d) => { setRankingMicroareas(d.microareas ?? []); setRankingAgentes(d.agentes ?? []); }).catch(() => {}).finally(checkDone);
    withTimeout(getFamiliasEmAtraso(0, filters), [])
      .then(setFamiliasAtraso).catch((err) => { setError(err instanceof Error ? err.message : 'Erro ao carregar monitoramento'); }).finally(checkDone);
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Distribution counts
  const distribuicao = {
    normal: familiasAtraso.filter((f) => f.nivel_criticidade === 'normal').length,
    atencao: familiasAtraso.filter((f) => f.nivel_criticidade === 'atencao').length,
    alerta: familiasAtraso.filter((f) => f.nivel_criticidade === 'alerta').length,
    critico: familiasAtraso.filter((f) => f.nivel_criticidade === 'critico').length,
  };

  const coberturaGeral =
    cobertura.length > 0
      ? Math.round(
          cobertura.reduce((sum, c) => sum + c.cobertura_pct, 0) / cobertura.length
        )
      : 0;

  const areasCriticas = cobertura.filter((c) => c.cobertura_pct < 50).length;

  const statCards = [
    { label: 'Famílias em Atraso', value: familiasAtraso.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Cobertura Geral', value: `${coberturaGeral}%`, icon: Shield, color: 'text-primary-600 bg-primary-50' },
    { label: 'Áreas Críticas', value: areasCriticas, icon: MapPin, color: 'text-yellow-600 bg-yellow-50' },
  ];

  const distribuicaoCards = [
    { label: 'Normal (0-7d)', count: distribuicao.normal, className: 'border-l-4 border-l-green-500 bg-green-50' },
    { label: 'Atenção (8-15d)', count: distribuicao.atencao, className: 'border-l-4 border-l-yellow-500 bg-yellow-50' },
    { label: 'Alerta (16-30d)', count: distribuicao.alerta, className: 'border-l-4 border-l-orange-500 bg-orange-50' },
    { label: 'Crítico (30+d)', count: distribuicao.critico, className: 'border-l-4 border-l-red-500 bg-red-50' },
  ];

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Monitoramento</h1>
          <p className="page-subtitle">Acompanhamento de cobertura e atrasos de visitas</p>
        </div>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-1" />
          Exportar
        </Button>
      </div>

      <FilterBar variant="monitoramento" />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Distribution Cards */}
      <div className="card-grid">
        {distribuicaoCards.map((card) => (
          <div key={card.label} className={`rounded-xl p-4 ${card.className}`}>
            <p className="text-sm font-medium text-gray-700">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.count}</p>
          </div>
        ))}
      </div>

      {/* Coverage Chart */}
      {cobertura.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title">Cobertura por Microárea</h3>
          <CoberturaChart data={cobertura} loading={false} />
        </div>
      )}

      {/* Families in delay table */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="section-title">Famílias em Atraso</h3>
        {loading && familiasAtraso.length === 0 ? (
          <SkeletonRows />
        ) : familiasAtraso.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Família</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Agente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dias s/ Visita</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Criticidade</th>
                </tr>
              </thead>
              <tbody>
                {familiasAtraso
                  .sort((a, b) => b.dias_sem_visita - a.dias_sem_visita)
                  .slice(0, 50)
                  .map((familia) => (
                    <tr key={familia.residencia_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{familia.endereco}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{familia.bairro}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{familia.agente_nome}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{familia.dias_sem_visita}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getCriticidadeColor(familia.nivel_criticidade)}`}>
                          {familia.nivel_criticidade === 'normal'
                            ? 'Normal'
                            : familia.nivel_criticidade === 'atencao'
                            ? 'Atenção'
                            : familia.nivel_criticidade === 'alerta'
                            ? 'Alerta'
                            : 'Crítico'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nenhuma família em atraso"
            description="Todas as famílias estão com visitas em dia."
          />
        )}
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title flex items-center gap-2">
            <MapPin className="w-5 h-5 text-yellow-500" />
            Microáreas com Mais Atraso
          </h3>
          {rankingMicroareas.length > 0 ? (
            <div className="space-y-3">
              {rankingMicroareas.slice(0, 10).map((item, index) => (
                <div key={item.microarea} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-6">{index + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{item.microarea}</span>
                      <span className="text-sm text-red-600 font-medium">{item.total_atraso}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-red-500 h-1.5 rounded-full"
                        style={{
                          width: `${Math.min((item.total_atraso / (rankingMicroareas[0]?.total_atraso || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sem dados disponíveis.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h3 className="section-title flex items-center gap-2">
            <Users className="w-5 h-5 text-orange-500" />
            Agentes com Mais Famílias Atrasadas
          </h3>
          {rankingAgentes.length > 0 ? (
            <div className="space-y-3">
              {rankingAgentes.slice(0, 10).map((item, index) => (
                <div key={item.agente_nome} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-400 w-6">{index + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{item.agente_nome}</span>
                      <span className="text-sm text-orange-600 font-medium">{item.total_atraso}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-orange-500 h-1.5 rounded-full"
                        style={{
                          width: `${Math.min((item.total_atraso / (rankingAgentes[0]?.total_atraso || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Sem dados disponíveis.</p>
          )}
        </div>
      </div>
    </div>
  );
}
