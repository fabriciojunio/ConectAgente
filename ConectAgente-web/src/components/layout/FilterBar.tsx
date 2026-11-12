'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useFilters } from '@/hooks/useFilters';
import { useAuth } from '@/hooks/useAuth';
import { listarUnidades, type UnidadeSaude } from '@/services/unidadeService';

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
  // Famílias e monitoramento trabalham com janela fixa de 30 dias nas funções
  // do banco; um campo de período ali mudava a URL e não mudava nenhum número.
  familias:     ['unidade_saude'],
  agentes:      ['unidade_saude'],
  monitoramento:['unidade_saude'],
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
  const { user } = useAuth();
  const [unidades, setUnidades] = useState<UnidadeSaude[]>([]);
  const gestao = user?.role === 'gerente' || user?.role === 'admin';
  // Coordenação e agente só enxergam a própria unidade (RLS): um seletor de
  // unidade para eles prometeria um dado que o banco não entrega.
  const fields = VARIANT_FIELDS[variant].filter((f) => f !== 'unidade_saude' || gestao);

  useEffect(() => {
    if (!gestao) return;
    let ativo = true;
    listarUnidades()
      .then((l) => { if (ativo) setUnidades(l); })
      .catch(() => { if (ativo) setUnidades([]); });
    return () => { ativo = false; };
  }, [gestao]);

  // Sem campo para mostrar (coordenação numa tela que só filtra unidade), a
  // barra some em vez de exibir "Filtros" sem nada.
  if (fields.length === 0) return null;

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== '',
  );

  return (
    <div
      className={`bg-[var(--superficie)] border-b border-[var(--borda-clara)] px-6 py-3 flex flex-wrap items-end gap-3 ${className ?? ''}`}
    >
      <div className="flex h-9 items-center gap-2 self-end text-[var(--texto-claro)] mr-1">
        <SlidersHorizontal size={15} />
        <span className="text-xs font-medium">Filtros</span>
      </div>

      {fields.includes('periodo_inicio') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-de" className="text-[11px] font-medium text-[var(--texto-claro)]">De</label>
          <input
            id="filtro-de"
            type="date"
            value={filters.periodo_inicio ?? ''}
            onChange={(e) => setFilter('periodo_inicio', e.target.value || undefined)}
            className="h-9 py-1 px-2 text-sm border border-[var(--borda)] rounded-md text-[var(--texto-medio)] focus:outline-none focus:border-[var(--primaria)]"
          />
        </div>
      )}

      {fields.includes('periodo_fim') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-ate" className="text-[11px] font-medium text-[var(--texto-claro)]">Até</label>
          <input
            id="filtro-ate"
            type="date"
            value={filters.periodo_fim ?? ''}
            onChange={(e) => setFilter('periodo_fim', e.target.value || undefined)}
            className="h-9 py-1 px-2 text-sm border border-[var(--borda)] rounded-md text-[var(--texto-medio)] focus:outline-none focus:border-[var(--primaria)]"
          />
        </div>
      )}

      {fields.includes('unidade_saude') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-unidade" className="text-[11px] font-medium text-[var(--texto-claro)]">Unidade</label>
          <select
            id="filtro-unidade"
            value={filters.unidade_saude ?? ''}
            onChange={(e) => setFilter('unidade_saude', e.target.value || undefined)}
            className="h-9 py-1 pl-2 pr-8 text-sm border border-[var(--borda)] rounded-md text-[var(--texto-medio)] focus:outline-none focus:border-[var(--primaria)] bg-[var(--superficie)] min-w-[11rem]"
          >
            <option value="">Todas as unidades</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.nome}>{u.nome}</option>
            ))}
          </select>
        </div>
      )}

      {fields.includes('status') && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-status" className="text-[11px] font-medium text-[var(--texto-claro)]">Situação</label>
          <select
            id="filtro-status"
            value={filters.status ?? ''}
            onChange={(e) => setFilter('status', (e.target.value as never) || undefined)}
            className="h-9 py-1 pl-2 pr-8 text-sm border border-[var(--borda)] rounded-md text-[var(--texto-medio)] focus:outline-none focus:border-[var(--primaria)] bg-[var(--superficie)]"
          >
            <option value="">Todas</option>
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
          className="h-9 flex items-center gap-1.5 px-3 text-xs font-medium text-[var(--texto-claro)] hover:text-[var(--texto-medio)] border border-[var(--borda)] rounded-md hover:bg-[var(--fundo)] transition-colors mt-auto"
        >
          <RotateCcw size={12} />
          Limpar
        </button>
      )}
    </div>
  );
}
