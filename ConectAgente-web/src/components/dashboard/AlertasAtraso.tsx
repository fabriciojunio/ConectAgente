'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SkeletonTable } from '@/components/ui/skeleton';
import { NivelCriticidade } from '@/types';
import type { FamiliaEmAtraso } from '@/types';

export interface AlertasAtrasoProps {
  alertas: FamiliaEmAtraso[];
  loading: boolean;
}

const criticidadeLabelMap: Record<NivelCriticidade, string> = {
  [NivelCriticidade.NORMAL]: 'Normal',
  [NivelCriticidade.ATENCAO]: 'Atenção',
  [NivelCriticidade.ALERTA]: 'Alerta',
  [NivelCriticidade.CRITICO]: 'Crítico',
};

function getCriticidadeBadgeVariant(
  nivel: NivelCriticidade
): 'default' | 'warning' | 'danger' | 'info' {
  switch (nivel) {
    case NivelCriticidade.NORMAL:
      return 'default';
    case NivelCriticidade.ATENCAO:
      return 'warning';
    case NivelCriticidade.ALERTA:
      return 'warning';
    case NivelCriticidade.CRITICO:
      return 'danger';
    default:
      return 'default';
  }
}

export default function AlertasAtraso({ alertas, loading }: AlertasAtrasoProps) {
  const sorted = [...alertas]
    .sort((a, b) => b.dias_sem_visita - a.dias_sem_visita)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning-500" aria-hidden="true" />
          <CardTitle>Famílias sem visita</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SkeletonTable rows={5} columns={5} />
        ) : sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--texto-claro)]">
            Nenhum alerta de atraso encontrado.
          </p>
        ) : (
          <Table striped>
            <TableHeader>
              <TableRow>
                <TableHead>Endereço</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Sem visita</TableHead>
                <TableHead>Criticidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((alerta) => (
                <TableRow key={alerta.residencia_id}>
                  {/* Bairro embaixo do endereço: com cinco colunas a tabela
                      transbordava e cortava a criticidade. */}
                  <TableCell className="max-w-[220px]">
                    <span className="block truncate" title={alerta.endereco}>{alerta.endereco}</span>
                    <span className="block truncate text-xs text-[var(--texto-claro)]">{alerta.bairro}</span>
                  </TableCell>
                  <TableCell>{alerta.agente_nome}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'font-semibold whitespace-nowrap tabular',
                        alerta.dias_sem_visita > 30 && 'text-danger-700',
                        alerta.dias_sem_visita > 15 &&
                          alerta.dias_sem_visita <= 30 &&
                          'text-warning-700'
                      )}
                    >
                      {alerta.dias_sem_visita} dias
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getCriticidadeBadgeVariant(alerta.nivel_criticidade)}>
                      {criticidadeLabelMap[alerta.nivel_criticidade] ||
                        alerta.nivel_criticidade}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
