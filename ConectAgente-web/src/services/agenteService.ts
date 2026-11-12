'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { buscarTudo } from '@/lib/buscarEmLotes';
import { fimExclusivo, falhaDeConsulta } from '@/lib/utils';
import type {
  AgenteComEstatisticas,
  ResidenciaComDetalhes,
  VisitaPorAgente,
  GlobalFilters,
  PaginationParams,
  PaginatedResult,
} from '@/types';
import { MORADOR_COLUNAS_LISTA } from './moradorColunas';
import { AGENTE_COLUNAS_LISTA } from './agenteColunas';

export async function getAgentes(
  filters?: GlobalFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<AgenteComEstatisticas>> {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.per_page ?? 20;
  const key = `agentes_${JSON.stringify(filters ?? {})}_${page}_${perPage}`;
  const cached = cacheGet<PaginatedResult<AgenteComEstatisticas>>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('agentes')
      .select(AGENTE_COLUNAS_LISTA, { count: 'exact', head: false })
      .eq('ativo', true);

    if (filters?.unidade_saude) query = query.eq('unidade_saude', filters.unidade_saude);

    query = query.order('nome', { ascending: true }).range(from, to);

    const { data: agentes, error, count } = await query;
    if (error) throw falhaDeConsulta('buscar agentes', error);

    if (!agentes || agentes.length === 0) {
      const vazio = { data: [], total: count ?? 0, page, per_page: perPage, total_pages: Math.ceil((count ?? 0) / perPage) };
      cacheSet(key, vazio);
      return vazio;
    }

    // Só agente_id e status, em lotes: numa única resposta o PostgREST
    // parava em 1.000 visitas e a página inteira de agentes saía com a
    // contagem cortada.
    const agenteIds = agentes.map((a) => a.id);
    const visitas = await buscarTudo<{ agente_id: string; status: string }>(
      (de, ate) =>
        supabase
          .from('visitas')
          .select('id, agente_id, status')
          .in('agente_id', agenteIds)
          .order('id', { ascending: true })
          .range(de, ate),
      'Erro ao contar visitas dos agentes'
    );

    const totalPorAgente = new Map<string, number>();
    const realizadasPorAgente = new Map<string, number>();
    for (const v of visitas) {
      totalPorAgente.set(v.agente_id, (totalPorAgente.get(v.agente_id) ?? 0) + 1);
      if (v.status === 'realizada') {
        realizadasPorAgente.set(v.agente_id, (realizadasPorAgente.get(v.agente_id) ?? 0) + 1);
      }
    }

    const data = agentes.map((agente) => {
      const t = totalPorAgente.get(agente.id) ?? 0;
      const r = realizadasPorAgente.get(agente.id) ?? 0;
      return {
        ...agente,
        total_visitas: t,
        visitas_realizadas: r,
        taxa_conclusao: t > 0 ? Math.round((r / t) * 10000) / 100 : 0,
      } as AgenteComEstatisticas;
    });

    const result = { data, total: count ?? 0, page, per_page: perPage, total_pages: Math.ceil((count ?? 0) / perPage) };
    cacheSet(key, result);
    return result;
  });
}

export async function getAgenteById(id: string): Promise<AgenteComEstatisticas | null> {
  const key = `agente_${id}`;
  const cached = cacheGet<AgenteComEstatisticas>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data: agente, error } = await supabase.from('agentes').select(AGENTE_COLUNAS_LISTA).eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw falhaDeConsulta('buscar agente', error);
    }
    if (!agente) return null;

    // Contagem no banco: baixar as visitas parava em 1.000 linhas.
    const [totalRes, realizadasRes] = await Promise.all([
      supabase.from('visitas').select('id', { count: 'exact', head: true }).eq('agente_id', id),
      supabase.from('visitas').select('id', { count: 'exact', head: true }).eq('agente_id', id).eq('status', 'realizada'),
    ]);
    const visitasError = totalRes.error ?? realizadasRes.error;
    if (visitasError) throw new Error(`Erro ao buscar estatísticas do agente: ${visitasError.message}`);

    const total = totalRes.count ?? 0;
    const realizadas = realizadasRes.count ?? 0;
    const result = {
      ...agente,
      total_visitas: total,
      visitas_realizadas: realizadas,
      taxa_conclusao: total > 0 ? Math.round((realizadas / total) * 10000) / 100 : 0,
    } as AgenteComEstatisticas;
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar agente');
  }
}

interface AgenteDesempenho {
  visitas_por_dia: Array<{ data: string; total: number }>;
  taxa_conclusao: number;
  media_diaria: number;
  total_visitas: number;
  total_realizadas: number;
}

export async function getAgenteDesempenho(id: string, inicio: string, fim: string): Promise<AgenteDesempenho> {
  const key = `agente_desempenho_${id}_${inicio}_${fim}`;
  const cached = cacheGet<AgenteDesempenho>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const registros = await buscarTudo<{ data_visita: string; status: string }>(
      (de, ate) =>
        supabase
          .from('visitas').select('id, data_visita, status')
          .eq('agente_id', id).gte('data_visita', inicio).lt('data_visita', fimExclusivo(fim))
          .order('data_visita', { ascending: true })
          .order('id', { ascending: true })
          .range(de, ate),
      'Erro ao buscar desempenho do agente'
    );

    const total_visitas = registros.length;
    const total_realizadas = registros.filter((v) => v.status === 'realizada').length;

    const visitasPorDia = new Map<string, number>();
    for (const v of registros) {
      const dia = v.data_visita.substring(0, 10);
      visitasPorDia.set(dia, (visitasPorDia.get(dia) ?? 0) + 1);
    }
    const visitas_por_dia = Array.from(visitasPorDia.entries()).map(([data, total]) => ({ data, total }));
    const diasNoPeriodo = differenceInCalendarDays(parseISO(fim), parseISO(inicio)) + 1;

    const result = {
      visitas_por_dia,
      taxa_conclusao: total_visitas > 0 ? Math.round((total_realizadas / total_visitas) * 10000) / 100 : 0,
      media_diaria: diasNoPeriodo > 0 ? Math.round((total_visitas / diasNoPeriodo) * 100) / 100 : 0,
      total_visitas,
      total_realizadas,
    };
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar desempenho do agente');
  }
}

export async function getAgenteFamilias(id: string): Promise<ResidenciaComDetalhes[]> {
  const key = `agente_familias_${id}`;
  const cached = cacheGet<ResidenciaComDetalhes[]>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('residencias')
      .select(`*, agente:agentes(id, nome, area_atuacao), moradores(${MORADOR_COLUNAS_LISTA})`)
      .eq('agente_id', id).is('deleted_at', null).order('logradouro', { ascending: true });

    if (error) throw falhaDeConsulta('buscar famílias do agente', error);

    const result = (data as unknown as ResidenciaComDetalhes[]) ?? [];
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar famílias do agente');
  }
}

export async function getRankingAgentes(inicio: string, fim: string): Promise<VisitaPorAgente[]> {
  const key = `ranking_agentes_${inicio}_${fim}`;
  const cached = cacheGet<VisitaPorAgente[]>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fn_visitas_por_agente', { p_inicio: inicio, p_fim: fim });
    if (error) throw falhaDeConsulta('buscar ranking de agentes', error);

    const result = (data as VisitaPorAgente[]) ?? [];
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar ranking de agentes');
  }
}
