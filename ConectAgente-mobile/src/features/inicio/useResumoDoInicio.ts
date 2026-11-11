import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { EstatisticasVisitas, Residencia } from '../../types';
import { visitaRepository } from '../../database/repositories/visitaRepository';
import { moradorRepository } from '../../database/repositories/moradorRepository';
import { residenciaRepository } from '../../database/repositories/residenciaRepository';

const QUANTAS_RESIDENCIAS_RECENTES = 3;

/**
 * Números do Início: visitas, moradores e residências do agente.
 *
 * Recarrega toda vez que a tela volta a ficar visível, porque quem cadastra
 * algo em outra tela volta para cá esperando ver o número novo.
 */
export function useResumoDoInicio(agenteId: string | undefined) {
  const [stats, setStats] = useState<EstatisticasVisitas | null>(null);
  const [totalMoradores, setTotalMoradores] = useState(0);
  const [totalResidencias, setTotalResidencias] = useState(0);
  const [residenciasRecentes, setResidenciasRecentes] = useState<Residencia[]>([]);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async () => {
    if (!agenteId) return;
    const [estatisticas, moradores, residencias] = await Promise.all([
      visitaRepository.estatisticas(agenteId),
      moradorRepository.contar(agenteId),
      residenciaRepository.listar(agenteId),
    ]);
    setStats(estatisticas);
    setTotalMoradores(moradores);
    setTotalResidencias(residencias.length);
    setResidenciasRecentes(residencias.slice(0, QUANTAS_RESIDENCIAS_RECENTES));
  }, [agenteId]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try {
      await carregar();
    } finally {
      setAtualizando(false);
    }
  }, [carregar]);

  return { stats, totalMoradores, totalResidencias, residenciasRecentes, atualizando, atualizar };
}
