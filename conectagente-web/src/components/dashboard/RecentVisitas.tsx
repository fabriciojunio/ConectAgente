'use client';

import React from 'react';
import Link from 'next/link';
import { cn, formatDate, getStatusColor } from '@/lib/utils';
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
import { StatusVisita } from '@/types';
import type { VisitaComDetalhes } from '@/types';

export interface RecentVisitasProps {
  visitas: VisitaComDetalhes[];
  loading: boolean;
}

const statusLabelMap: Record<StatusVisita, string> = {
  [StatusVisita.REALIZADA]: 'Realizada',
  [StatusVisita.AGENDADA]: 'Agendada',
  [StatusVisita.CANCELADA]: 'Cancelada',
  [StatusVisita.NAO_ENCONTRADO]: 'Nao encontrado',
};

function getStatusBadgeVariant(
  status: StatusVisita
): 'success' | 'default' | 'danger' | 'warning' {
  switch (status) {
    case StatusVisita.REALIZADA:
      return 'success';
    case StatusVisita.AGENDADA:
      return 'default';
    case StatusVisita.CANCELADA:
      return 'danger';
    case StatusVisita.NAO_ENCONTRADO:
      return 'warning';
    default:
      return 'default';
  }
}

export default function RecentVisitas({ visitas, loading }: RecentVisitasProps) {
  const recentVisitas = visitas.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Visitas Recentes</CardTitle>
          <Link
            href="/visitas"
            className="text-sm font-medium text-primary-500 hover:text-primary-700 hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <SkeletonTable rows={5} columns={5} />
        ) : recentVisitas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            Nenhuma visita recente encontrada.
          </p>
        ) : (
          <Table striped>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Endereco</TableHead>
                <TableHead>Bairro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentVisitas.map((visita) => (
                <TableRow key={visita.id}>
                  <TableCell>{formatDate(visita.data_visita)}</TableCell>
                  <TableCell>{visita.agente?.nome || '-'}</TableCell>
                  <TableCell>
                    {visita.residencia
                      ? `${visita.residencia.logradouro}, ${visita.residencia.numero}`
                      : '-'}
                  </TableCell>
                  <TableCell>{visita.residencia?.bairro || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(visita.status)}>
                      {statusLabelMap[visita.status] || visita.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/visitas/${visita.id}`}
                      className="text-sm font-medium text-primary-500 hover:text-primary-700 hover:underline"
                      aria-label={`Ver detalhes da visita de ${formatDate(visita.data_visita)}`}
                    >
                      Detalhes
                    </Link>
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
