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

/**
 * Nome no eixo cabe numa linha: sem o complemento entre parênteses e com
 * reticências depois de 18 letras. O nome inteiro aparece ao passar o mouse.
 */
export function nomeCurto(nome: string): string {
  const semComplemento = nome.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  return semComplemento.length > 18 ? `${semComplemento.slice(0, 17)}…` : semComplemento;
}

export default function AgentesBarChart({ data, loading }: AgentesBarChartProps) {
  const top10 = [...data]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitas por agente</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full" />
        ) : top10.length === 0 ? (
          <p className="py-12 text-center text-sm text-[var(--texto-claro)]">
            Nenhum dado no período.
          </p>
        ) : (
          <div className="h-72 w-full" role="img" aria-label="Gráfico de desempenho por agente">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 8, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--borda)" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--texto-claro)' }} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={{ fontSize: 12, fill: 'var(--texto-claro)' }}
                  width={130}
                  interval={0}
                  tickFormatter={nomeCurto}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid var(--borda)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="realizadas"
                  name="Realizadas"
                  stackId="visits"
                  fill="var(--sucesso)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pendentes"
                  name="Pendentes"
                  stackId="visits"
                  fill="var(--alerta)"
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
