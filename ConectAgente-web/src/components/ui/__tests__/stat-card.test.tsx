import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../stat-card';
import { Activity } from 'lucide-react';

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Visitas Hoje" value={42} />);
    expect(screen.getByText('Visitas Hoje')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<StatCard title="Taxa" value="85.5%" />);
    expect(screen.getByText('85.5%')).toBeInTheDocument();
  });

  it('renders icon', () => {
    const { container } = render(<StatCard title="Test" value={10} icon={Activity} />);
    const iconContainer = container.querySelector('[aria-hidden="true"]');
    expect(iconContainer).toBeInTheDocument();
  });

  it('shows positive trend with success color', () => {
    render(<StatCard title="Test" value={10} trend={{ value: 15, positive: true }} />);
    const trendEl = screen.getByText('15%');
    expect(trendEl.className).toContain('text-success-700');
  });

  it('shows negative trend with danger color', () => {
    render(<StatCard title="Test" value={10} trend={{ value: 5, positive: false }} />);
    const trendEl = screen.getByText('5%');
    expect(trendEl.className).toContain('text-danger-700');
  });

  it('renders subtitle', () => {
    render(<StatCard title="Test" value={10} subtitle="detalhes aqui" />);
    expect(screen.getByText('detalhes aqui')).toBeInTheDocument();
  });

  it.each([
    ['success', 'border-t-success-500'],
    ['warning', 'border-t-warning-500'],
    ['danger', 'border-t-danger-500'],
    ['info', 'border-t-info-500'],
  ] as const)('tom %s pinta o filete do topo, e não um fundo pastel', (color, filete) => {
    const { container } = render(<StatCard title="Test" value={10} icon={Activity} color={color} />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain(filete);
    expect(container.querySelector('.rounded-full')).toBeNull();
  });

  it('defaults to primary color', () => {
    const { container } = render(<StatCard title="Test" value={10} icon={Activity} />);
    expect((container.firstChild as HTMLElement).className).toContain('border-t-primary-500');
  });

  it('formata número grande no padrão brasileiro', () => {
    render(<StatCard title="Moradores" value={12345} />);
    expect(screen.getByText('12.345')).toBeInTheDocument();
  });

  it('mostra o esqueleto, e não um zero, enquanto carrega', () => {
    render(<StatCard title="Visitas" value={0} loading />);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getByLabelText('Carregando')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatCard title="Test" value={10} className="my-custom" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('my-custom');
  });
});
