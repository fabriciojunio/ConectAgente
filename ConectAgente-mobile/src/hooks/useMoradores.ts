import { useState, useCallback } from 'react';
import { Morador, MoradorFormData } from '../types';
import { moradorRepository } from '../database/repositories/moradorRepository';
import { useAuth } from '../contexts/AuthContext';

export function useMoradores(residenciaId?: string) {
  const { agente } = useAuth();
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (rid?: string) => {
    const id = rid ?? residenciaId;
    if (!id) return;
    setIsLoading(true);
    setErro(null);
    try {
      const data = await moradorRepository.listarPorResidencia(id);
      setMoradores(data);
    } catch {
      setErro('Erro ao carregar moradores');
    } finally {
      setIsLoading(false);
    }
  }, [residenciaId]);

  const criar = useCallback(async (data: MoradorFormData): Promise<Morador> => {
    if (!agente) throw new Error('Não autenticado');
    const morador = await moradorRepository.criar(data, agente.id);
    setMoradores((prev) => [morador, ...prev]);
    return morador;
  }, [agente]);

  const atualizar = useCallback(async (id: string, data: Partial<MoradorFormData>) => {
    await moradorRepository.atualizar(id, data);
    await carregar();
  }, [carregar]);

  const excluir = useCallback(async (id: string) => {
    await moradorRepository.excluir(id);
    setMoradores((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const buscarPorCpf = useCallback(async (cpf: string): Promise<Morador | null> => {
    if (!agente) return null;
    return moradorRepository.buscarPorCpf(cpf, agente.id);
  }, [agente]);

  const buscarPorCartaoSUS = useCallback(async (cartao: string): Promise<Morador | null> => {
    if (!agente) return null;
    return moradorRepository.buscarPorCartaoSUS(cartao, agente.id);
  }, [agente]);

  return { moradores, isLoading, erro, carregar, criar, atualizar, excluir, buscarPorCpf, buscarPorCartaoSUS };
}
