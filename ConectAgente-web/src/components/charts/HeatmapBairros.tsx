'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { VisitaPorBairro } from '@/types';

export interface HeatmapBairrosProps {
  data: VisitaPorBairro[];
  loading: boolean;
}

function getCoverageClasses(pct: number): string {
  if (pct >= 80) return 'bg-success-50 border-success-500 text-success-700';
  if (pct >= 60) return 'bg-green-50 border-green-400 text-green-700';
  if (pct >= 40) return 'bg-warning-50 border-warning-500 text-warning-700';
  if (pct >= 20) return 'bg-orange-50 border-orange-400 text-orange-700';
  return 'bg-danger-50 border-danger-500 text-danger-700';
}

export default function HeatmapBairros({ data, loading }: HeatmapBairrosProps) {
  const sorted = [...data].sort((a, b) => a.cobertura_pct - b.cobertura_pct);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa de Calor por Bairro</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            Nenhum dado disponivel.
          </p>
        ) : (
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
            role="list"
            aria-label="Cobertura por bairro"
          >
            {sorted.map((bairro) => (
              <div
                key={bairro.bairro}
                className={cn(
                  'rounded-lg border-2 p-3 transition-shadow hover:shadow-md',
                  getCoverageClasses(bairro.cobertura_pct)
                )}
                role="listitem"
              >
                <p className="truncate text-sm font-semibold">{bairro.bairro}</p>
                <p className="mt-1 text-2xl font-bold">{bairro.cobertura_pct.toFixed(0)}%</p>
                <p className="text-xs opacity-75">
                  {bairro.total_visitas} visita{bairro.total_visitas !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
