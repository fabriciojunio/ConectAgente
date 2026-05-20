/**
 * Testes para componente Card
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Card } from '../Card';

describe('Card', () => {
  it('renderiza filhos corretamente', () => {
    const { getByText } = render(
      <Card>
        <Text>Conteúdo do card</Text>
      </Card>
    );
    expect(getByText('Conteúdo do card')).toBeTruthy();
  });

  it('renderiza múltiplos filhos', () => {
    const { getByText } = render(
      <Card>
        <Text>Primeiro</Text>
        <Text>Segundo</Text>
      </Card>
    );
    expect(getByText('Primeiro')).toBeTruthy();
    expect(getByText('Segundo')).toBeTruthy();
  });

  it('aceita prop style adicional', () => {
    const { getByText } = render(
      <Card style={{ padding: 20 }}>
        <Text>Com estilo</Text>
      </Card>
    );
    expect(getByText('Com estilo')).toBeTruthy();
  });
});
