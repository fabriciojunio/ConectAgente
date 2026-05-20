import { useState, useCallback, useEffect } from 'react';
import { Residencia, ResidenciaFormData } from '../types';
import { residenciaRepository } from '../database/repositories/residenciaRepository';
import { useAuth } from '../contexts/AuthContext';

interface UseResidenciasReturn {
  residencias: Residencia[];
  isLoading: boolean;
  erro: string | null;
  carregar: () => Promise<void>;
  criar: (data: ResidenciaFormData) => Promise<Residencia>;
  atualizar: (id: string, data: Partial<ResidenciaFormData>) => Promise<void>;
  excluir: (id: string) => Promise<void>;
  definirResponsavel: (residenciaId: string, moradorId: string) => Promise<void>;
}

export function useResidencias(): UseResidenciasReturn {
  const { agente } = useAuth();
  const [residencias, setResidencias] = useState<Residencia[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!agente) return;
    setIsLoading(true);
    setErro(null);
    try {
      const data = await residenciaRepository.listar(agente.id);
      setResidencias(data);
    } catch (e) {
      setErro('Erro ao carregar residências');
    } finally {
      setIsLoading(false);
    }
  }, [agente]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criar = useCallback(async (data: ResidenciaFormData): Promise<Residencia> => {
    if (!agente) throw new Error('Não autenticado');
    const residencia = await residenciaRepository.criar(data, agente.id);
    setResidencias((prev) => [residencia, ...prev]);
    return residencia;
  }, [agente]);

  const atualizar = useCallback(async (id: string, data: Partial<ResidenciaFormData>) => {
    if (!agente) return;
    await residenciaRepository.atualizar(id, data, agente.id);
    await carregar();
  }, [agente, carregar]);

  const excluir = useCallback(async (id: string) => {
    await residenciaRepository.excluir(id);
    setResidencias((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const definirResponsavel = useCallback(async (residenciaId: string, moradorId: string) => {
    await residenciaRepository.definirResponsavel(residenciaId, moradorId);
    await carregar();
  }, [carregar]);

  return { residencias, isLoading, erro, carregar, criar, atualizar, excluir, definirResponsavel };
}
