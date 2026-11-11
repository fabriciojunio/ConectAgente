import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PALETAS } from '../../../contexts/ThemeContext';
import { criarEstilosDoInicio } from '../estilos';
import { CabecalhoDoInicio, LinhaDoResumo, ResidenciaRecente } from '../componentes';
import type { Residencia } from '../../../types';

// O indicador de sincronização depende dos contextos de rede e de fila; aqui só interessa o cabeçalho.
jest.mock('../../../components/ui/SyncIndicator', () => ({ SyncIndicator: () => null }));

const styles = criarEstilosDoInicio(PALETAS.claro);

describe('CabecalhoDoInicio', () => {
  const base = {
    styles,
    nome: 'Fabrício Júnio Almeida Dias',
    unidade: 'UBS Centro',
    fotoUri: null,
    meta: { temMeta: false, percentual: 0, texto: '0 visitas realizadas neste mês' },
    onFoto: jest.fn(),
    onSair: jest.fn(),
  };

  it('mostra o primeiro nome, as iniciais, a unidade e a meta sem "de 0"', () => {
    const { getByText } = render(<CabecalhoDoInicio {...base} />);
    expect(getByText('Fabrício')).toBeTruthy();
    expect(getByText('FD')).toBeTruthy();
    expect(getByText('UBS Centro')).toBeTruthy();
    expect(getByText('sem meta')).toBeTruthy();
    expect(getByText('0 visitas realizadas neste mês')).toBeTruthy();
  });

  it('com meta, mostra o percentual', () => {
    const { getByText } = render(
      <CabecalhoDoInicio {...base} meta={{ temMeta: true, percentual: 25, texto: '30 de 120 visitas realizadas' }} />
    );
    expect(getByText('25%')).toBeTruthy();
  });

  it('o avatar abre a foto e o botão de sair encerra a sessão', () => {
    const onFoto = jest.fn();
    const onSair = jest.fn();
    const { getByLabelText } = render(<CabecalhoDoInicio {...base} onFoto={onFoto} onSair={onSair} />);
    fireEvent.press(getByLabelText('Foto de perfil'));
    fireEvent.press(getByLabelText('Sair'));
    expect(onFoto).toHaveBeenCalledTimes(1);
    expect(onSair).toHaveBeenCalledTimes(1);
  });

  it('sem unidade, não mostra o selo', () => {
    const { queryByText } = render(<CabecalhoDoInicio {...base} unidade={null} />);
    expect(queryByText('UBS Centro')).toBeNull();
  });
});

describe('LinhaDoResumo', () => {
  it('mostra rótulo e número', () => {
    const { getByText } = render(
      <LinhaDoResumo styles={styles} icon="people-outline" iconColor="#2E7D32" label="Moradores cadastrados" value={12} />
    );
    expect(getByText('Moradores cadastrados')).toBeTruthy();
    expect(getByText('12')).toBeTruthy();
  });
});

describe('ResidenciaRecente', () => {
  it('mostra o endereço e abre a residência', () => {
    const onPress = jest.fn();
    const residencia = {
      id: 'r1', logradouro: 'Rua das Flores', numero: '10', bairro: 'Centro', cidade: 'Bauru', estado: 'SP',
    } as Residencia;
    const { getByText } = render(<ResidenciaRecente styles={styles} residencia={residencia} onPress={onPress} />);
    expect(getByText('Centro • Bauru/SP')).toBeTruthy();
    fireEvent.press(getByText('Centro • Bauru/SP'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
