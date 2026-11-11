import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SectionHeader } from '../SectionHeader';
import { StatCard } from '../StatCard';
import { QuickAction } from '../QuickAction';

describe('SectionHeader', () => {
  it('mostra o título e só mostra a ação quando ela existe', () => {
    const { getByText, queryByText, rerender } = render(<SectionHeader title="Visitas" />);
    expect(getByText('Visitas')).toBeTruthy();
    expect(queryByText('Ver todas')).toBeNull();

    const onPress = jest.fn();
    rerender(<SectionHeader title="Visitas" action={{ label: 'Ver todas', onPress }} actionColor="#7B1FA2" />);
    fireEvent.press(getByText('Ver todas'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('StatCard', () => {
  it('mostra o número e o rótulo e responde ao toque', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <StatCard icon="today-outline" label="Hoje" value={7} accent="#1565C0" onPress={onPress} />
    );
    expect(getByText('7')).toBeTruthy();
    fireEvent.press(getByText('Hoje'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sem ação, não finge ser botão', () => {
    const { getByText } = render(<StatCard icon="people-outline" label="Agentes" value={3} accent="#7B1FA2" />);
    expect(getByText('Agentes')).toBeTruthy();
    expect(() => fireEvent.press(getByText('Agentes'))).not.toThrow();
  });
});

describe('QuickAction', () => {
  it('mostra o rótulo e chama a ação', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <QuickAction icon="add-circle-outline" label="Nova visita" color="#1565C0" onPress={onPress} iconBoxSize={56} />
    );
    fireEvent.press(getByText('Nova visita'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
