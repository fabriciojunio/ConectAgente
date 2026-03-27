'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFilters } from '@/hooks/useFilters';
import { usePagination } from '@/hooks/usePagination';
import { FilterBar } from '@/components/layout/FilterBar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getFamilias, getFamiliasEmAtraso } from '@/services/familiaService';
import { cacheGetStale } from '@/lib/cache';
import { formatDate, calcularDiasSemVisita, getNivelCriticidade, getCriticidadeColor, withTimeout } from '@/lib/utils';
import type { ResidenciaComDetalhes, FamiliaEmAtraso, PaginatedResult } from '@/types';
import {
  Search,
  Users,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

function SkeletonRows() {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/5" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
        </div>
      ))}
    </div>
  );
}

export default function FamiliasPage() {
  const { filters } = useFilters();
  const { page, perPage, setPage, setTotalPages, totalPages } = usePagination();

  const initFamilias = cacheGetStale<PaginatedResult<ResidenciaComDetalhes>>(`familias_${JSON.stringify(filters ?? {})}_${page}_${perPage}`);
  const initAtrasos = cacheGetStale<FamiliaEmAtraso[]>(`familias_atraso_30_${(filters as Record<string, string>)?.unidade_saude ?? ''}`);

  const [loading, setLoading] = useState(!initFamilias);
  const [error, setError] = useState('');
  const [familias, setFamilias] = useState<ResidenciaComDetalhes[]>(initFamilias?.data ?? []);
  const [search, setSearch] = useState('');
  const [totalFamilias, setTotalFamilias] = useState(initFamilias?.total ?? 0);
  const [familiasAtraso, setFamiliasAtraso] = useState(initAtrasos?.length ?? 0);

  const fetchData = useCallback(async () => {
    if (familias.length === 0) setLoading(true);
    setError('');
    try {
      // Atrasos loads independently
      withTimeout(getFamiliasEmAtraso(30, filters), [])
        .then((r) => setFamiliasAtraso(r.length)).catch(() => {});

      const familiasResult = await withTimeout(
        getFamilias(filters, { page, per_page: perPage }),
        { data: [], total: 0, page, per_page: perPage, total_pages: 0 }
      );
      setFamilias(familiasResult.data);
      setTotalFamilias(familiasResult.total);
      setTotalPages(familiasResult.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar famílias');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredFamilias = search
    ? familias.filter(
        (f) =>
          f.moradores?.some((m: { nome?: string }) =>
            m.nome?.toLowerCase().includes(search.toLowerCase())
          ) ||
          f.logradouro?.toLowerCase().includes(search.toLowerCase()) ||
          f.bairro?.toLowerCase().includes(search.toLowerCase())
      )
    : familias;

  const familiasComVisita = totalFamilias - familiasAtraso;

  const statCards = [
    { label: 'Total Famílias', value: totalFamilias, icon: Users, color: 'text-gray-700' },
    { label: 'Com Visita Recente', value: familiasComVisita, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Em Atraso', value: familiasAtraso, icon: AlertTriangle, color: 'text-red-600' },
  ];

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Famílias</h1>
        <p className="page-subtitle">Cadastro e acompanhamento das famílias atendidas</p>
      </div>

      <FilterBar variant="familias" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou endereço..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
        />
      </div>

      {/* Table */}
      {loading && familias.length === 0 ? (
        <SkeletonRows />
      ) : filteredFamilias.length === 0 ? (
        <EmptyState
          title="Nenhuma família encontrada"
          description="Não foram encontradas famílias com os filtros selecionados."
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Responsável</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Endereço</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Bairro</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Agente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden xl:table-cell">Última Visita</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Dias s/ Visita</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFamilias.map((familia) => {
                  const responsavel = familia.moradores?.[0]?.nome ?? 'Não informado';
                  const ultimaVisita = familia.ultima_visita;
                  const diasSemVisita = ultimaVisita
                    ? calcularDiasSemVisita(ultimaVisita)
                    : (familia.dias_sem_visita ?? 999);
                  const criticidade = getNivelCriticidade(diasSemVisita);
                  const criticidadeColor = getCriticidadeColor(criticidade);

                  return (
                    <tr key={familia.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{responsavel}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {familia.logradouro}, {familia.numero}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">{familia.bairro}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{familia.agente?.nome ?? '-'}</td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {ultimaVisita ? formatDate(ultimaVisita) : 'Nunca'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{diasSemVisita > 900 ? '-' : diasSemVisita}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${criticidadeColor}`}>
                          {criticidade === 'normal'
                            ? 'Normal'
                            : criticidade === 'atencao'
                            ? 'Atenção'
                            : criticidade === 'alerta'
                            ? 'Alerta'
                            : 'Crítico'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/familias/${familia.id}`}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-sm text-gray-500">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
