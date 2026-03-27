'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { VisitaPorAgente } from '@/types';

export interface AgentesBarChartProps {
  data: VisitaPorAgente[];
  loading: boolean;
}

export default function AgentesBarChart({ data, loading }: AgentesBarChartProps) {
  const top10 = [...data]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desempenho por Agente</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : top10.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            Nenhum dado disponivel.
          </p>
        ) : (
          <div className="h-72 w-full" role="img" aria-label="Grafico de desempenho por agente">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#757575' }} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 12, fill: '#757575' }}
                  width={75}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E0E0E0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="realizadas"
                  name="Realizadas"
                  stackId="visits"
                  fill="#4CAF50"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pendentes"
                  name="Pendentes"
                  stackId="visits"
                  fill="#FF9800"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
