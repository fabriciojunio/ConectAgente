/**
 * Testes para componente Badge
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renderiza com label correto', () => {
    const { getByText } = render(<Badge label="Hipertenso" variant="warning" />);
    expect(getByText('Hipertenso')).toBeTruthy();
  });

  it('renderiza variante error', () => {
    const { getByText } = render(<Badge label="Doenças" variant="error" />);
    expect(getByText('Doenças')).toBeTruthy();
  });

  it('renderiza variante success', () => {
    const { getByText } = render(<Badge label="Bolsa Família" variant="success" />);
    expect(getByText('Bolsa Família')).toBeTruthy();
  });

  it('renderiza variante info', () => {
    const { getByText } = render(<Badge label="Gestante" variant="info" />);
    expect(getByText('Gestante')).toBeTruthy();
  });

  it('renderiza variante warning', () => {
    const { getByText } = render(<Badge label="Diabético" variant="warning" />);
    expect(getByText('Diabético')).toBeTruthy();
  });
});
