'use client';

import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';

type FilterVariant =
  | 'dashboard'
  | 'visitas'
  | 'familias'
  | 'agentes'
  | 'monitoramento'
  | 'territorial'
  | 'relatorios';

interface FilterBarProps {
  variant?: FilterVariant;
  className?: string;
}

/** Which filter fields each variant shows */
const VARIANT_FIELDS: Record<FilterVariant, string[]> = {
  dashboard:    ['periodo_inicio', 'periodo_fim', 'unidade_saude'],
  visitas:      ['periodo_inicio', 'periodo_fim', 'unidade_saude', 'status'],
  familias:     ['periodo_inicio', 'periodo_fim', 'unidade_saude'],
  agentes:      ['unidade_saude'],
  monitoramento:['periodo_inicio', 'periodo_fim', 'unidade_saude'],
  territorial:  ['unidade_saude'],
  relatorios:   ['periodo_inicio', 'periodo_fim', 'unidade_saude', 'status'],
};

const STATUS_OPTIONS = [
  { value: 'realizada',      label: 'Realizada' },
  { value: 'agendada',       label: 'Agendada' },
  { value: 'cancelada',      label: 'Cancelada' },
  { value: 'nao_encontrado', label: 'Não encontrado' },
];

export function FilterBar({ variant = 'dashboard', className }: FilterBarProps) {
  const { filters, setFilter, resetFilters } = useFilters();
  const fields = VARIANT_FIELDS[variant];

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '',
  );

  return (
    <div
      className={`bg-white border-b border-[#E5EAF2] px-6 py-3 flex flex-wrap items-end gap-3 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 text-[#6B7280] mr-1">
        <SlidersHorizontal size={15} />
        <span className="text-xs font-medium">Filtros</span>
      </div>

      {fields.includes('periodo_inicio') && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-[#6B7280]">De</label>
          <input
            type="date"
            value={filters.periodo_inicio ?? ''}
            onChange={(e) => setFilter('periodo_inicio', e.target.value || undefined)}
            className="h-8 px-2 text-sm border border-[#D1D9E6] rounded-md text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20 focus:border-[#1565C0]"
          />
        </div>
      )}

      {fields.includes('periodo_fim') && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-[#6B7280]">Até</label>
          <input
            type="date"
            value={filters.periodo_fim ?? ''}
            onChange={(e) => setFilter('periodo_fim', e.target.value || undefined)}
            className="h-8 px-2 text-sm border border-[#D1D9E6] rounded-md text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20 focus:border-[#1565C0]"
          />
        </div>
      )}

      {fields.includes('unidade_saude') && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-[#6B7280]">Unidade</label>
          <input
            type="text"
            placeholder="Todas"
            value={filters.unidade_saude ?? ''}
            onChange={(e) => setFilter('unidade_saude', e.target.value || undefined)}
            className="h-8 px-2 text-sm border border-[#D1D9E6] rounded-md text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20 focus:border-[#1565C0] w-40"
          />
        </div>
      )}

      {fields.includes('status') && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-[#6B7280]">Status</label>
          <select
            value={filters.status ?? ''}
            onChange={(e) => setFilter('status', (e.target.value as never) || undefined)}
            className="h-8 px-2 text-sm border border-[#D1D9E6] rounded-md text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1565C0]/20 focus:border-[#1565C0] bg-white"
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="h-8 flex items-center gap-1.5 px-3 text-xs font-medium text-[#6B7280] hover:text-[#374151] border border-[#D1D9E6] rounded-md hover:bg-[#F4F6FA] transition-colors mt-auto"
        >
          <RotateCcw size={12} />
          Limpar
        </button>
      )}
    </div>
  );
}
