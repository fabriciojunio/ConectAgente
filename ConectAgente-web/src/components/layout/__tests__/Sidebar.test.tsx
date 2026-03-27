jest.mock('next/link', () => {
  return jest.fn(({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ));
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';

describe('Sidebar', () => {
  const defaultProps = {
    currentPath: '/',
    userRole: 'admin' as const,
    userName: 'Maria Silva',
    onLogout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders logo and app name', () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText('ConectAgente')).toBeInTheDocument();
  });

  it('renders navigation items for admin', () => {
    render(<Sidebar {...defaultProps} userRole="admin" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Visitas')).toBeInTheDocument();
    expect(screen.getByText('Agentes')).toBeInTheDocument();
    expect(screen.getByText('Monitoramento')).toBeInTheDocument();
  });

  it('renders admin-only items for admin', () => {
    render(<Sidebar {...defaultProps} userRole="admin" />);
    // Usuários is admin-only
    expect(screen.getByText('Usuários')).toBeInTheDocument();
    expect(screen.getByText('Solicitações')).toBeInTheDocument();
  });

  it('renders supervisor items but not admin-only items', () => {
    render(<Sidebar {...defaultProps} userRole="supervisor" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Visitas')).toBeInTheDocument();
    expect(screen.getByText('Administração')).toBeInTheDocument();
    // Usuários is admin-only
    expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
    expect(screen.queryByText('Solicitações')).not.toBeInTheDocument();
  });

  it('hides all role-restricted items for agente', () => {
    render(<Sidebar {...defaultProps} userRole="agente" />);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Agentes')).not.toBeInTheDocument();
    expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
  });

  it('highlights active item based on currentPath', () => {
    render(<Sidebar {...defaultProps} currentPath="/visitas" />);
    const visitasLink = screen.getByText('Visitas').closest('a');
    expect(visitasLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not highlight non-active items', () => {
    render(<Sidebar {...defaultProps} currentPath="/" />);
    const visitasLink = screen.getByText('Visitas').closest('a');
    expect(visitasLink).not.toHaveAttribute('aria-current');
  });

  it('calls onLogout when clicking logout button', () => {
    const onLogout = jest.fn();
    render(<Sidebar {...defaultProps} onLogout={onLogout} />);
    const logoutButton = screen.getByLabelText('Sair do sistema');
    fireEvent.click(logoutButton);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('renders unidade name when provided', () => {
    render(<Sidebar {...defaultProps} userUnidade="UBS Centro" />);
    expect(screen.getByText('UBS Centro')).toBeInTheDocument();
  });
});
