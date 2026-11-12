'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CoberturaMicroarea } from '@/types';
import { formatPercent } from '@/lib/utils';

export interface CoberturaChartProps {
  data: CoberturaMicroarea[];
  loading: boolean;
}

function getCoverageColor(pct: number): string {
  if (pct >= 80) return 'var(--sucesso)';
  if (pct >= 50) return 'var(--alerta)';
  return 'var(--erro)';
}

export default function CoberturaChart({ data, loading }: CoberturaChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobertura por microárea</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--texto-claro)]">
            Nenhuma microárea com família cadastrada.
          </p>
        ) : (
          <div className="h-72 w-full" role="img" aria-label="Gráfico de cobertura por microárea">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
                <XAxis
                  dataKey="microarea"
                  tick={{ fontSize: 12, fill: 'var(--texto-claro)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--texto-claro)' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number) => [formatPercent(value), 'Cobertura']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid var(--borda)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="cobertura_pct" name="Cobertura" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getCoverageColor(entry.cobertura_pct)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
