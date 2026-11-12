import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type TomIndicador =
  | 'primary'
  | 'success'
  | 'warning'
  | 'attention'
  | 'danger'
  | 'info'
  | 'pink'
  | 'neutral';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  color?: TomIndicador;
  /** Mostra o esqueleto no lugar do número enquanto o dado chega. */
  loading?: boolean;
  className?: string;
}

/*
 * Mesmo desenho do StatCard do aplicativo: filete de 3px no topo na cor do
 * indicador, ícone e número na mesma cor, rótulo neutro. A cor diz o tipo de
 * informação (alerta, sucesso...) sem pintar o cartão inteiro.
 */
const tons: Record<TomIndicador, { filete: string; destaque: string }> = {
  primary: { filete: 'border-t-primary-500', destaque: 'text-primary-600' },
  success: { filete: 'border-t-success-500', destaque: 'text-success-600' },
  warning: { filete: 'border-t-warning-500', destaque: 'text-warning-600' },
  attention: { filete: 'border-t-amber-500', destaque: 'text-amber-600' },
  danger: { filete: 'border-t-danger-500', destaque: 'text-danger-600' },
  info: { filete: 'border-t-info-500', destaque: 'text-info-600' },
  pink: { filete: 'border-t-pink-500', destaque: 'text-pink-600' },
  neutral: { filete: 'border-t-[var(--marcador)]', destaque: 'text-[var(--texto-medio)]' },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'primary',
  loading = false,
  className,
}: StatCardProps) {
  const tom = tons[color];
  const valor = typeof value === 'number' ? value.toLocaleString('pt-BR') : value;

  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-[var(--borda-clara)] border-t-[3px] bg-[var(--superficie)] px-4 py-3.5 shadow-card',
        tom.filete,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--texto-claro)] leading-tight">{title}</p>
        {Icon && <Icon className={cn('h-[18px] w-[18px] flex-shrink-0', tom.destaque)} aria-hidden="true" />}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[var(--superficie-alt)]" aria-label="Carregando" />
      ) : (
        <p className={cn('mt-1.5 text-[28px] font-bold leading-none tabular', tom.destaque)}>{valor}</p>
      )}
      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center text-xs font-medium',
                trend.positive ? 'text-success-700' : 'text-danger-700'
              )}
            >
              {trend.positive ? (
                <TrendingUp className="mr-0.5 h-3 w-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="mr-0.5 h-3 w-3" aria-hidden="true" />
              )}
              {trend.value}%
            </span>
          )}
          {subtitle && <span className="text-xs text-[var(--texto-claro)]">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
