/**
 * Testes para componente EmptyState
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('EmptyState', () => {
  it('renderiza título corretamente', () => {
    const { getByText } = render(
      <EmptyState
        icon="search-outline"
        title="Nenhum resultado"
        description="Tente buscar com outros termos"
      />
    );
    expect(getByText('Nenhum resultado')).toBeTruthy();
  });

  it('renderiza descrição corretamente', () => {
    const { getByText } = render(
      <EmptyState
        icon="calendar-outline"
        title="Sem agendamentos"
        description="Nenhuma visita agendada para este dia"
      />
    );
    expect(getByText('Nenhuma visita agendada para este dia')).toBeTruthy();
  });

  it('renderiza sem descrição (opcional)', () => {
    const { getByText } = render(
      <EmptyState icon="search-outline" title="Vazio" />
    );
    expect(getByText('Vazio')).toBeTruthy();
  });
});
