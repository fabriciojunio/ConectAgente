import { useState, useCallback, useEffect } from 'react';
import { Visita, Agendamento, EstatisticasVisitas, StatusVisita } from '../types';
import { visitaRepository } from '../database/repositories/visitaRepository';
import { useAuth } from '../contexts/AuthContext';

export function useVisitas() {
  const { agente } = useAuth();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasVisitas | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (filtros?: {
    data_inicio?: string;
    data_fim?: string;
    status?: StatusVisita;
  }) => {
    if (!agente) return;
    setIsLoading(true);
    try {
      const [v, a, e] = await Promise.all([
        visitaRepository.listar(agente.id, filtros),
        visitaRepository.listarAgendamentos(agente.id),
        visitaRepository.estatisticas(agente.id),
      ]);
      setVisitas(v);
      setAgendamentos(a);
      setEstatisticas(e);
    } catch {
      setErro('Erro ao carregar visitas');
    } finally {
      setIsLoading(false);
    }
  }, [agente]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const registrarVisita = useCallback(async (data: {
    residencia_id: string;
    morador_id?: string;
    data_visita: string;
    status: StatusVisita;
    motivo_visita?: string;
    queixas?: string;
    observacoes?: string;
    pa_visita?: string;
    glicemia_visita?: string;
    peso_visita?: string;
    medicamentos_em_dia?: boolean;
    cartao_vacinas_em_dia?: boolean;
    encaminhamentos?: string;
    precisa_agendamento: boolean;
    especialidade_agendamento?: string;
    assinatura_base64?: string;
  }): Promise<Visita> => {
    if (!agente) throw new Error('Não autenticado');
    const visita = await visitaRepository.criar({ ...data, agente_id: agente.id });
    await carregar();
    return visita;
  }, [agente, carregar]);

  const agendarVisita = useCallback(async (data: {
    residencia_id: string;
    morador_id?: string;
    data_agendada: string;
    motivo: string;
    observacoes?: string;
  }): Promise<Agendamento> => {
    if (!agente) throw new Error('Não autenticado');
    const agendamento = await visitaRepository.criarAgendamento({ ...data, agente_id: agente.id });
    await carregar();
    return agendamento;
  }, [agente, carregar]);

  const cancelarAgendamento = useCallback(async (id: string) => {
    await visitaRepository.cancelarAgendamento(id);
    await carregar();
  }, [carregar]);

  const definirMeta = useCallback(async (mes: number, ano: number, meta: number) => {
    if (!agente) return;
    await visitaRepository.definirMeta(agente.id, mes, ano, meta);
    await carregar();
  }, [agente, carregar]);

  const datasComAgendamento = useCallback(async (): Promise<string[]> => {
    if (!agente) return [];
    return visitaRepository.datasComAgendamento(agente.id);
  }, [agente]);

  const agendamentosPorData = useCallback(async (data: string): Promise<Agendamento[]> => {
    if (!agente) return [];
    return visitaRepository.agendamentosPorData(agente.id, data);
  }, [agente]);

  return {
    visitas, agendamentos, estatisticas, isLoading, erro,
    carregar, registrarVisita, agendarVisita, cancelarAgendamento,
    definirMeta, datasComAgendamento, agendamentosPorData,
  };
}
