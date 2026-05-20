import React from 'react';
import { render } from '@testing-library/react-native';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renderiza corretamente com valores basicos', () => {
    const { getByText } = render(<ProgressBar valor={30} meta={100} label="Visitas" />);
    expect(getByText('Visitas')).toBeTruthy();
    expect(getByText('30 / 100 (30%)')).toBeTruthy();
  });

  it('limita a 100% quando valor supera a meta', () => {
    const { getByText } = render(<ProgressBar valor={120} meta={100} />);
    expect(getByText('120 / 100 (100%)')).toBeTruthy();
  });

  it('renderiza sem label quando nao fornecido', () => {
    const { queryByText } = render(<ProgressBar valor={50} meta={100} />);
    expect(queryByText('Visitas')).toBeNull();
  });
});
