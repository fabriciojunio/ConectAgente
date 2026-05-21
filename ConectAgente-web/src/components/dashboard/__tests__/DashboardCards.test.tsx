import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardCards from '../DashboardCards';
import type { DashboardStats } from '@/types';

describe('DashboardCards', () => {
  const mockStats: DashboardStats = {
    visitas_hoje: 12,
    visitas_semana: 60,
    visitas_mes: 240,
    total_familias: 150,
    total_moradores: 500,
    agentes_ativos: 20,
    visitas_realizadas: 200,
    visitas_pendentes: 40,
    taxa_conclusao: 83.3,
  };

  it('renders all stat cards with correct values', () => {
    render(<DashboardCards stats={mockStats} loading={false} />);

    expect(screen.getByText('Visitas Hoje')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Visitas no Mês')).toBeInTheDocument();
    expect(screen.getByText('240')).toBeInTheDocument();
    expect(screen.getByText('Total Famílias')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Agentes Ativos')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Taxa de Conclusão')).toBeInTheDocument();
    expect(screen.getByText('83.3%')).toBeInTheDocument();
    expect(screen.getByText('Visitas Pendentes')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('Visitas Realizadas')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Total Moradores')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('shows skeleton cards when loading', () => {
    render(<DashboardCards stats={mockStats} loading={true} />);

    const section = screen.getByLabelText('Carregando estatisticas');
    expect(section).toBeInTheDocument();
    // Should show 8 skeleton cards (direct children of the grid)
    const skeletonCards = section.querySelectorAll(':scope > div');
    expect(skeletonCards.length).toBe(8);
  });

  it('handles zero values', () => {
    const zeroStats: DashboardStats = {
      visitas_hoje: 0,
      visitas_semana: 0,
      visitas_mes: 0,
      total_familias: 0,
      total_moradores: 0,
      agentes_ativos: 0,
      visitas_realizadas: 0,
      visitas_pendentes: 0,
      taxa_conclusao: 0,
    };

    render(<DashboardCards stats={zeroStats} loading={false} />);

    // All zero values should render
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('displays correct section aria label when loaded', () => {
    render(<DashboardCards stats={mockStats} loading={false} />);
    const section = screen.getByLabelText('Estatisticas do dashboard');
    expect(section).toBeInTheDocument();
  });

  it('displays icons for each card', () => {
    const { container } = render(<DashboardCards stats={mockStats} loading={false} />);
    // Each stat card renders an SVG icon
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(8);
  });
});
