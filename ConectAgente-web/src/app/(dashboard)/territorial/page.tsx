'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { FilterBar } from '@/components/layout/FilterBar';
import HeatmapBairros from '@/components/charts/HeatmapBairros';
import { EmptyState } from '@/components/ui/empty-state';
import { getVisitasPorBairro } from '@/services/dashboardService';
import { getCoberturaPorMicroarea } from '@/services/monitoramentoService';
import type { VisitaPorBairro, CoberturaMicroarea } from '@/types';
import { cacheGetStale } from '@/lib/cache';
import { withTimeout } from '@/lib/utils';
import { MapPin } from 'lucide-react';

function SkeletonRows() {
  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="h-5 bg-gray-200 rounded w-1/4 mb-4 animate-pulse" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b last:border-0 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
        </div>
      ))}
    </div>
  );
}

export default function TerritorialPage() {
  const { filters } = useFilters();

  const initCobertura = cacheGetStale<CoberturaMicroarea[]>(`cobertura_${(filters as Record<string, string>)?.unidade_saude ?? ''}`);

  const [loading, setLoading] = useState(!initCobertura);
  const [error, setError] = useState('');
  const [bairros, setBairros] = useState<VisitaPorBairro[]>([]);
  const [cobertura, setCobertura] = useState<CoberturaMicroarea[]>(initCobertura ?? []);

  const fetchData = useCallback(async () => {
    if (bairros.length === 0 && cobertura.length === 0) setLoading(true);
    setError('');

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inicio = filters.periodo_inicio ?? thirtyDaysAgo.toISOString().split('T')[0];
    const fim = filters.periodo_fim ?? now.toISOString().split('T')[0];

    const done = { count: 0, total: 2 };
    const checkDone = () => { if (++done.count >= done.total) setLoading(false); };

    withTimeout(getCoberturaPorMicroarea(filters), [])
      .then(setCobertura).catch(() => {}).finally(checkDone);
    withTimeout(getVisitasPorBairro(inicio, fim), [])
      .then(setBairros).catch((err) => { setError(err instanceof Error ? err.message : 'Erro ao carregar dados territoriais'); }).finally(checkDone);
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Visão Territorial</h1>
        <p className="page-subtitle">Distribuição geográfica de visitas e cobertura</p>
      </div>

      <FilterBar variant="territorial" />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading && bairros.length === 0 ? (
        <SkeletonRows />
      ) : (
        <>
          {/* Heatmap */}
          {bairros.length > 0 ? (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="section-title flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-600" />
                Mapa de Calor por Bairro
              </h3>
              <HeatmapBairros data={bairros} loading={false} />
            </div>
          ) : (
            <EmptyState
              title="Sem dados territoriais"
              description="Não há dados de visitas por bairro para o período selecionado."
            />
          )}

          {/* Bairro Table */}
          {bairros.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="section-title">Detalhamento por Bairro</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Bairro</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Total Visitas</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Cobertura</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell min-w-[200px]">Progresso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bairros
                      .sort((a, b) => b.total_visitas - a.total_visitas)
                      .map((bairro) => (
                        <tr key={bairro.bairro} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{bairro.bairro}</td>
                          <td className="px-4 py-3">{bairro.total_visitas}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-medium ${
                                bairro.cobertura_pct >= 80
                                  ? 'text-green-600'
                                  : bairro.cobertura_pct >= 50
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {Math.round(bairro.cobertura_pct)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  bairro.cobertura_pct >= 80
                                    ? 'bg-green-500'
                                    : bairro.cobertura_pct >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(bairro.cobertura_pct, 100)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Coverage by Microarea */}
          {cobertura.length > 0 && (
            <div className="bg-white rounded-xl border p-6">
              <h3 className="section-title">Ranking de Cobertura por Microárea</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cobertura
                  .sort((a, b) => a.cobertura_pct - b.cobertura_pct)
                  .map((area) => (
                    <div key={area.microarea} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{area.microarea}</span>
                        <span
                          className={`text-sm font-bold ${
                            area.cobertura_pct >= 80
                              ? 'text-green-600'
                              : area.cobertura_pct >= 50
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {Math.round(area.cobertura_pct)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full ${
                            area.cobertura_pct >= 80
                              ? 'bg-green-500'
                              : area.cobertura_pct >= 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(area.cobertura_pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        {area.familias_visitadas_30d} de {area.total_familias} famílias
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
