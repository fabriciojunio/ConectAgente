'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFilters } from '@/hooks/useFilters';
import { usePagination } from '@/hooks/usePagination';
import { FilterBar } from '@/components/layout/FilterBar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getVisitas, getEstatisticasVisitas } from '@/services/visitaService';
import { cacheGetStale } from '@/lib/cache';
import { formatDate, withTimeout } from '@/lib/utils';
import type { VisitaComDetalhes, PaginatedResult } from '@/types';
import {
  Search,
  FileText,
  FileSpreadsheet,
  ClipboardList,
  CheckCircle,
  Clock,
  TrendingUp,
  X,
  Eye,
} from 'lucide-react';

function SkeletonRows() {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/6" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
        </div>
      ))}
    </div>
  );
}

const statusConfig: Record<string, { label: string; className: string }> = {
  realizada: { label: 'Realizada', className: 'bg-green-100 text-green-700' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-700' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
  nao_encontrado: { label: 'Não Encontrado', className: 'bg-yellow-100 text-yellow-700' },
};

const noop = () => {};

export default function VisitasPage() {
  const { filters } = useFilters();
  const { page, perPage, setPage, setTotalPages, totalPages } = usePagination();

  const initVisitas = cacheGetStale<PaginatedResult<VisitaComDetalhes>>(`visitas_${JSON.stringify(filters ?? {})}_${page}_${perPage}`);
  const initStats = cacheGetStale<{ total: number; realizadas: number; agendadas: number; canceladas: number; nao_encontrado: number; taxa_conclusao: number }>(`visitas_stats_${JSON.stringify(filters ?? {})}`);

  const [loading, setLoading] = useState(!initVisitas);
  const [error, setError] = useState('');
  const [visitas, setVisitas] = useState<VisitaComDetalhes[]>(initVisitas?.data ?? []);
  const [search, setSearch] = useState('');
  const [selectedVisita, setSelectedVisita] = useState<VisitaComDetalhes | null>(null);
  const [estatisticas, setEstatisticas] = useState(initStats ?? {
    total: 0,
    realizadas: 0,
    agendadas: 0,
    canceladas: 0,
    nao_encontrado: 0,
    taxa_conclusao: 0,
  });

  const fetchData = useCallback(async () => {
    if (visitas.length === 0) setLoading(true);
    setError('');
    try {
      // Progressive: each updates independently
      withTimeout(getEstatisticasVisitas(filters), { total: 0, realizadas: 0, agendadas: 0, canceladas: 0, nao_encontrado: 0, taxa_conclusao: 0 })
        .then(setEstatisticas).catch(noop);

      const visitasResult = await withTimeout(
        getVisitas(filters, { page, per_page: perPage }),
        { data: [], total: 0, page, per_page: perPage, total_pages: 0 }
      );
      setVisitas(visitasResult.data);
      setTotalPages(visitasResult.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar visitas');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredVisitas = search
    ? visitas.filter(
        (v) =>
          v.agente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
          v.residencia?.logradouro?.toLowerCase().includes(search.toLowerCase()) ||
          v.residencia?.bairro?.toLowerCase().includes(search.toLowerCase())
      )
    : visitas;

  const statCards = [
    { label: 'Total', value: estatisticas.total, icon: ClipboardList, color: 'text-gray-700' },
    { label: 'Realizadas', value: estatisticas.realizadas, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Pendentes', value: estatisticas.agendadas, icon: Clock, color: 'text-yellow-600' },
    { label: 'Taxa de Conclusão', value: `${estatisticas.taxa_conclusao}%`, icon: TrendingUp, color: 'text-primary-600' },
  ];

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Visitas</h1>
        <p className="page-subtitle">Gerenciamento e acompanhamento de visitas domiciliares</p>
      </div>

      <FilterBar variant="visitas" />

      {/* Stats Cards */}
      <div className="card-grid">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-50 ${stat.color}`}>
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Search and Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por agente, endereço ou bairro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-1" />
            PDF
          </Button>
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Excel
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading && visitas.length === 0 ? (
        <SkeletonRows />
      ) : filteredVisitas.length === 0 ? (
        <EmptyState
          title="Nenhuma visita encontrada"
          description="Não foram encontradas visitas com os filtros selecionados."
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Agente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Endereço</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Observações</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitas.map((visita) => {
                  const status = statusConfig[visita.status] ?? statusConfig.realizada;
                  return (
                    <tr
                      key={visita.id}
                      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedVisita(visita)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(visita.data_visita)}
                      </td>
                      <td className="px-4 py-3">{visita.agente?.nome ?? '-'}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {visita.residencia
                          ? `${visita.residencia.logradouro}, ${visita.residencia.numero}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {visita.residencia?.bairro ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell max-w-[200px] truncate">
                        {visita.observacoes || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVisita(visita);
                          }}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Dialog */}
      {selectedVisita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold">Detalhes da Visita</h2>
              <button
                onClick={() => setSelectedVisita(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="font-medium">{formatDate(selectedVisita.data_visita)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      statusConfig[selectedVisita.status]?.className ?? ''
                    }`}
                  >
                    {statusConfig[selectedVisita.status]?.label ?? selectedVisita.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Agente</p>
                  <p className="font-medium">{selectedVisita.agente?.nome ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Morador</p>
                  <p className="font-medium">{selectedVisita.morador?.nome ?? '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Endereço</p>
                <p className="font-medium">
                  {selectedVisita.residencia
                    ? `${selectedVisita.residencia.logradouro}, ${selectedVisita.residencia.numero} - ${selectedVisita.residencia.bairro}`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Observações</p>
                <p className="text-gray-700">{selectedVisita.observacoes || 'Sem observações'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
