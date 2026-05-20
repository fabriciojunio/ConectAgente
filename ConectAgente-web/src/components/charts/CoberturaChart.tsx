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

export interface CoberturaChartProps {
  data: CoberturaMicroarea[];
  loading: boolean;
}

function getCoverageColor(pct: number): string {
  if (pct >= 80) return '#4CAF50';
  if (pct >= 50) return '#FF9800';
  return '#F44336';
}

export default function CoberturaChart({ data, loading }: CoberturaChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobertura por Microarea</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            Nenhum dado disponivel.
          </p>
        ) : (
          <div className="h-72 w-full" role="img" aria-label="Grafico de cobertura por microarea">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis
                  dataKey="microarea"
                  tick={{ fontSize: 12, fill: '#757575' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#757575' }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Cobertura']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E0E0E0',
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
