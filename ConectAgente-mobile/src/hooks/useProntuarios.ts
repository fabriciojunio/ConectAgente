import { useState, useCallback } from 'react';
import { prontuarioRepository } from '../database/repositories/prontuarioRepository';

export interface Prontuario {
  id: string;
  moradorId: string;
  condicoesCronicas: string[];
  medicamentos: string[];
  alergias: string[];
  observacoes?: string;
  updatedAt: string;
  syncedAt?: string;
}

export function useProntuarios(moradorId: string) {
  const [prontuario, setProntuario] = useState<Prontuario | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await prontuarioRepository.findByMoradorId(moradorId);
      setProntuario(data ?? null);
    } catch (err) {
      setError('Erro ao carregar prontuário');
    } finally {
      setLoading(false);
    }
  }, [moradorId]);

  const salvar = useCallback(async (dados: Partial<Prontuario>) => {
    setLoading(true);
    setError(null);
    try {
      await prontuarioRepository.upsert({ ...dados, moradorId });
      await carregar();
    } catch (err) {
      setError('Erro ao salvar prontuário');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [moradorId, carregar]);

  return { prontuario, loading, error, carregar, salvar };
}
