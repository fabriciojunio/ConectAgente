'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const colorMap = {
  primary: {
    bg: 'bg-primary-50',
    text: 'text-primary-500',
  },
  success: {
    bg: 'bg-success-50',
    text: 'text-success-500',
  },
  warning: {
    bg: 'bg-warning-50',
    text: 'text-warning-500',
  },
  danger: {
    bg: 'bg-danger-50',
    text: 'text-danger-500',
  },
  info: {
    bg: 'bg-info-50',
    text: 'text-info-500',
  },
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'primary',
  className,
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-6 shadow-card transition-shadow hover:shadow-card-hover',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {(subtitle || trend) && (
            <div className="mt-2 flex items-center gap-2">
              {trend && (
                <span
                  className={cn(
                    'inline-flex items-center text-xs font-medium',
                    trend.positive ? 'text-success-500' : 'text-danger-500'
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
              {subtitle && (
                <span className="text-xs text-gray-500">{subtitle}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn('flex h-12 w-12 items-center justify-center rounded-full', colors.bg)}
            aria-hidden="true"
          >
            <Icon className={cn('h-6 w-6', colors.text)} />
          </div>
        )}
      </div>
    </div>
  );
}
