import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText('Default');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-primary-50');
    expect(badge.className).toContain('text-primary-700');
  });

  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('bg-success-50');
    expect(badge.className).toContain('text-success-700');
  });

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('bg-warning-50');
    expect(badge.className).toContain('text-warning-700');
  });

  it('renders with danger variant', () => {
    render(<Badge variant="danger">Danger</Badge>);
    const badge = screen.getByText('Danger');
    expect(badge.className).toContain('bg-danger-50');
    expect(badge.className).toContain('text-danger-700');
  });

  it('renders with info variant', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-info-50');
    expect(badge.className).toContain('text-info-700');
  });

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText('Outline');
    expect(badge.className).toContain('border');
    expect(badge.className).toContain('bg-transparent');
  });

  it('applies custom className', () => {
    render(<Badge className="extra-class">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('extra-class');
  });

  it('renders children correctly', () => {
    render(<Badge><span data-testid="inner">Child</span></Badge>);
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    render(<Badge>Tag</Badge>);
    const badge = screen.getByText('Tag');
    expect(badge.tagName).toBe('SPAN');
  });
});
