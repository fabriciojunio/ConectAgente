'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export interface StatusPieChartData {
  name: string;
  value: number;
  color: string;
}

export interface StatusPieChartProps {
  data: StatusPieChartData[];
  loading: boolean;
}

export default function StatusPieChart({ data, loading }: StatusPieChartProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuicao por Status</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="mx-auto h-64 w-64 rounded-full" />
        ) : data.length === 0 || total === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            Nenhum dado disponivel.
          </p>
        ) : (
          <div className="h-72 w-full" role="img" aria-label="Grafico de distribuicao por status">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value, 'Visitas']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E0E0E0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
