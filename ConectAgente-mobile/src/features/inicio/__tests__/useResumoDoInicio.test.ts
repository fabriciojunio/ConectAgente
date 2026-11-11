import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useResumoDoInicio } from '../useResumoDoInicio';
import { visitaRepository } from '../../../database/repositories/visitaRepository';
import { moradorRepository } from '../../../database/repositories/moradorRepository';
import { residenciaRepository } from '../../../database/repositories/residenciaRepository';

jest.mock('expo-router', () => ({
  // Na tela real, o efeito roda quando ela volta a ficar visível; aqui, na montagem.
  useFocusEffect: (efeito: () => void) => {
    const { useEffect } = jest.requireActual<typeof React>('react');
    useEffect(efeito, [efeito]);
  },
}));
jest.mock('../../../database/repositories/visitaRepository', () => ({ visitaRepository: { estatisticas: jest.fn() } }));
jest.mock('../../../database/repositories/moradorRepository', () => ({ moradorRepository: { contar: jest.fn() } }));
jest.mock('../../../database/repositories/residenciaRepository', () => ({ residenciaRepository: { listar: jest.fn() } }));

const residencias = Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` }));

beforeEach(() => {
  jest.clearAllMocks();
  (visitaRepository.estatisticas as jest.Mock).mockResolvedValue({ realizadas_mes: 4, meta_mensal: 0 });
  (moradorRepository.contar as jest.Mock).mockResolvedValue(12);
  (residenciaRepository.listar as jest.Mock).mockResolvedValue(residencias);
});

describe('useResumoDoInicio', () => {
  it('carrega os números do agente e as três residências mais recentes', async () => {
    const { result } = renderHook(() => useResumoDoInicio('agente-1'));
    await waitFor(() => expect(result.current.stats).not.toBeNull());
    expect(visitaRepository.estatisticas).toHaveBeenCalledWith('agente-1');
    expect(result.current.totalMoradores).toBe(12);
    expect(result.current.totalResidencias).toBe(5);
    expect(result.current.residenciasRecentes.map((r) => r.id)).toEqual(['r0', 'r1', 'r2']);
  });

  it('sem agente logado, não consulta nada', async () => {
    const { result } = renderHook(() => useResumoDoInicio(undefined));
    await act(async () => {});
    expect(visitaRepository.estatisticas).not.toHaveBeenCalled();
    expect(result.current.stats).toBeNull();
  });

  it('atualizar recarrega e desliga o indicador mesmo se a consulta falhar', async () => {
    const { result } = renderHook(() => useResumoDoInicio('agente-1'));
    await waitFor(() => expect(result.current.stats).not.toBeNull());

    (moradorRepository.contar as jest.Mock).mockRejectedValueOnce(new Error('banco ocupado'));
    await act(async () => {
      await expect(result.current.atualizar()).rejects.toThrow('banco ocupado');
    });
    expect(result.current.atualizando).toBe(false);
  });
});
