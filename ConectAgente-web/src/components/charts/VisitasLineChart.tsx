'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { VisitaPorPeriodo } from '@/types';

export interface VisitasLineChartProps {
  data: VisitaPorPeriodo[];
  loading: boolean;
}

export default function VisitasLineChart({ data, loading }: VisitasLineChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitas por Periodo</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            Nenhum dado disponivel para o periodo selecionado.
          </p>
        ) : (
          <div className="h-72 w-full" role="img" aria-label="Grafico de visitas por periodo">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis
                  dataKey="data"
                  tick={{ fontSize: 12, fill: '#757575' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#757575' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E0E0E0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="realizadas"
                  name="Realizadas"
                  stroke="#4CAF50"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="canceladas"
                  name="Canceladas"
                  stroke="#F44336"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="nao_encontrado"
                  name="Nao encontrado"
                  stroke="#FF9800"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
