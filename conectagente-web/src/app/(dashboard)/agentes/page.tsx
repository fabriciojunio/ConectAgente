'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFilters } from '@/hooks/useFilters';
import { usePagination } from '@/hooks/usePagination';
import { FilterBar } from '@/components/layout/FilterBar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { getAgentes } from '@/services/agenteService';
import { cacheGetStale } from '@/lib/cache';
import { formatPercent, withTimeout } from '@/lib/utils';
import type { AgenteComEstatisticas, PaginatedResult } from '@/types';
import {
  Search,
  Users,
  UserCheck,
  TrendingUp,
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

interface AgenteListItem {
  id: string;
  nome: string;
  unidade_saude?: string;
  microarea?: string;
  visitas_mes?: number;
  visitas_realizadas?: number;
  taxa_conclusao?: number;
  ativo?: boolean;
}

export default function AgentesPage() {
  const { filters } = useFilters();
  const { page, perPage, setPage, setTotalPages, totalPages } = usePagination();

  // Initialize from cache for instant render
  const initCache = cacheGetStale<PaginatedResult<AgenteComEstatisticas>>(`agentes_${JSON.stringify(filters ?? {})}_${page}_${perPage}`);

  const [loading, setLoading] = useState(!initCache);
  const [error, setError] = useState('');
  const [agentes, setAgentes] = useState<AgenteListItem[]>(initCache?.data ?? []);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState(() => ({
    total: initCache?.total ?? 0,
    ativos: initCache?.data?.filter((a) => a.ativo !== false).length ?? 0,
    media_visitas_dia: 0,
  }));

  const fetchData = useCallback(async () => {
    if (agentes.length === 0) setLoading(true);
    setError('');
    try {
      const agentesResult = await withTimeout(
        getAgentes(filters, { page, per_page: perPage }),
        { data: [], total: 0, page, per_page: perPage, total_pages: 0 }
      );

      setAgentes(agentesResult.data);
      setTotalPages(agentesResult.total_pages);
      setStats({
        total: agentesResult.total,
        ativos: agentesResult.data.filter((a) => a.ativo !== false).length,
        media_visitas_dia: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAgentes = search
    ? agentes.filter(
        (a) =>
          a.nome?.toLowerCase().includes(search.toLowerCase()) ||
          a.unidade_saude?.toLowerCase().includes(search.toLowerCase())
      )
    : agentes;

  const statCards = [
    { label: 'Total Agentes', value: stats.total, icon: Users, color: 'text-gray-700' },
    { label: 'Ativos', value: stats.ativos, icon: UserCheck, color: 'text-green-600' },
    { label: 'Média Visitas/Dia', value: stats.media_visitas_dia.toFixed(1), icon: TrendingUp, color: 'text-primary-600' },
  ];

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Agentes</h1>
        <p className="page-subtitle">Gerenciamento dos Agentes Comunitários de Saúde</p>
      </div>

      <FilterBar variant="agentes" />

      {/* Stats */}
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
          placeholder="Buscar por nome ou unidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
        />
      </div>

      {/* Table */}
      {loading && agentes.length === 0 ? (
        <SkeletonRows />
      ) : filteredAgentes.length === 0 ? (
        <EmptyState
          title="Nenhum agente encontrado"
          description="Não foram encontrados agentes com os filtros selecionados."
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Unidade</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Microárea</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Visitas Mês</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Realizadas</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Taxa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAgentes.map((agente) => (
                  <tr key={agente.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium">{agente.nome}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{agente.unidade_saude ?? '-'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">{agente.microarea ?? '-'}</td>
                    <td className="px-4 py-3">{agente.visitas_mes ?? 0}</td>
                    <td className="px-4 py-3 hidden md:table-cell">{agente.visitas_realizadas ?? 0}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {agente.taxa_conclusao != null ? formatPercent(agente.taxa_conclusao) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          agente.ativo !== false
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {agente.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/agentes/${agente.id}`}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
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
