'use client';

import React from 'react';
import {
  CalendarCheck,
  CalendarDays,
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  Home,
  Activity,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard } from '@/components/ui/skeleton';
import type { DashboardStats } from '@/types';

export interface DashboardCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export default function DashboardCards({ stats, loading }: DashboardCardsProps) {
  if (loading || !stats) {
    return (
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Carregando estatísticas"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </section>
    );
  }

  const cards = [
    {
      title: 'Visitas Hoje',
      value: stats.visitas_hoje,
      icon: CalendarCheck,
      color: 'primary' as const,
      subtitle: 'realizadas hoje',
    },
    {
      title: 'Visitas no Mês',
      value: stats.visitas_mes,
      icon: CalendarDays,
      color: 'info' as const,
      subtitle: 'neste mês',
    },
    {
      title: 'Total Famílias',
      value: stats.total_familias,
      icon: Home,
      color: 'success' as const,
      subtitle: 'cadastradas',
    },
    {
      title: 'Agentes Ativos',
      value: stats.agentes_ativos,
      icon: UserCheck,
      color: 'primary' as const,
      subtitle: 'em atividade',
    },
    {
      title: 'Taxa de Conclusão',
      value: `${stats.taxa_conclusao.toFixed(1)}%`,
      icon: TrendingUp,
      color: stats.taxa_conclusao >= 80 ? ('success' as const) : ('warning' as const),
      subtitle: 'das visitas planejadas',
    },
    {
      title: 'Visitas Pendentes',
      value: stats.visitas_pendentes,
      icon: Clock,
      color: 'warning' as const,
      subtitle: 'aguardando realização',
    },
    {
      title: 'Visitas Realizadas',
      value: stats.visitas_realizadas,
      icon: Activity,
      color: 'success' as const,
      subtitle: 'concluídas',
    },
    {
      title: 'Total Moradores',
      value: stats.total_moradores,
      icon: Users,
      color: 'info' as const,
      subtitle: 'cadastrados',
    },
  ];

  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Estatísticas do dashboard"
    >
      {cards.map((card) => (
        <StatCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
          color={card.color}
          subtitle={card.subtitle}
        />
      ))}
    </section>
  );
}
