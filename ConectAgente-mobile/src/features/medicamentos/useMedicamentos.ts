import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { medicamentoRepository, type Medicamento } from '../../database/repositories/medicamentoRepository';
import type { MedicamentoForm, RespostaForm } from './regras';

/** Lista os medicamentos do morador e expõe as ações da tela. */
export function useMedicamentos(moradorId: string | undefined, agenteId: string | undefined) {
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!moradorId) return;
    try {
      setMedicamentos(await medicamentoRepository.listarPorMorador(moradorId));
    } finally {
      setCarregando(false);
    }
  }, [moradorId]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const adicionar = useCallback(
    async (dados: MedicamentoForm, problemas: readonly string[]) => {
      if (!moradorId || !agenteId) throw new Error('Sessão sem agente. Entre novamente.');
      await medicamentoRepository.criar(moradorId, agenteId, dados, problemas);
      await carregar();
    },
    [moradorId, agenteId, carregar]
  );

  const responder = useCallback(
    async (id: string, resposta: RespostaForm) => {
      if (!agenteId) throw new Error('Sessão sem agente. Entre novamente.');
      await medicamentoRepository.registrarResposta(id, agenteId, resposta);
      await carregar();
    },
    [agenteId, carregar]
  );

  const remover = useCallback(
    async (id: string) => {
      if (!agenteId) throw new Error('Sessão sem agente. Entre novamente.');
      await medicamentoRepository.remover(id, agenteId);
      await carregar();
    },
    [agenteId, carregar]
  );

  return { medicamentos, carregando, adicionar, responder, remover };
}
