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
    expect(trendEl.className).toContain('text-success-500');
  });

  it('shows negative trend with danger color', () => {
    render(<StatCard title="Test" value={10} trend={{ value: 5, positive: false }} />);
    const trendEl = screen.getByText('5%');
    expect(trendEl.className).toContain('text-danger-500');
  });

  it('renders subtitle', () => {
    render(<StatCard title="Test" value={10} subtitle="detalhes aqui" />);
    expect(screen.getByText('detalhes aqui')).toBeInTheDocument();
  });

  it('applies correct color classes for success', () => {
    const { container } = render(<StatCard title="Test" value={10} icon={Activity} color="success" />);
    const iconBg = container.querySelector('.bg-success-50');
    expect(iconBg).toBeInTheDocument();
  });

  it('applies correct color classes for warning', () => {
    const { container } = render(<StatCard title="Test" value={10} icon={Activity} color="warning" />);
    const iconBg = container.querySelector('.bg-warning-50');
    expect(iconBg).toBeInTheDocument();
  });

  it('applies correct color classes for danger', () => {
    const { container } = render(<StatCard title="Test" value={10} icon={Activity} color="danger" />);
    const iconBg = container.querySelector('.bg-danger-50');
    expect(iconBg).toBeInTheDocument();
  });

  it('defaults to primary color', () => {
    const { container } = render(<StatCard title="Test" value={10} icon={Activity} />);
    const iconBg = container.querySelector('.bg-primary-50');
    expect(iconBg).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatCard title="Test" value={10} className="my-custom" />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('my-custom');
  });
});
