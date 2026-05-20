import { useState, useEffect } from 'react';
import { visitaRepository } from '../database/repositories/visitaRepository';
import { residenciaRepository } from '../database/repositories/residenciaRepository';

export interface MetasMensais {
  visitasMeta: number;
  visitasRealizadas: number;
  residenciasCadastradas: number;
  coberturaPct: number;
}

const META_VISITAS_MENSAL = 100;

export function useMetas(agenteId: string) {
  const [metas, setMetas] = useState<MetasMensais | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function calcular() {
      setLoading(true);
      try {
        const agora = new Date();
        const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
        const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString();

        const [visitas, residencias] = await Promise.all([
          visitaRepository.countByAgenteAndPeriodo(agenteId, inicioMes, fimMes),
          residenciaRepository.countByAgente(agenteId),
        ]);

        setMetas({
          visitasMeta: META_VISITAS_MENSAL,
          visitasRealizadas: visitas,
          residenciasCadastradas: residencias,
          coberturaPct: Math.min(100, (visitas / META_VISITAS_MENSAL) * 100),
        });
      } finally {
        setLoading(false);
      }
    }
    calcular();
  }, [agenteId]);

  return { metas, loading };
}
