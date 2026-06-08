'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type {
  AgenteComEstatisticas,
  ResidenciaComDetalhes,
  VisitaPorAgente,
  GlobalFilters,
  PaginationParams,
  PaginatedResult,
} from '@/types';

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
      .select('*', { count: 'exact', head: false })
      .eq('ativo', true);

    if (filters?.unidade_saude) query = query.eq('unidade_saude', filters.unidade_saude);

    query = query.order('nome', { ascending: true }).range(from, to);

    const { data: agentes, error, count } = await query;
    if (error) throw new Error(`Erro ao buscar agentes: ${error.message}`);

    if (!agentes || agentes.length === 0) {
      return { data: [], total: 0, page, per_page: perPage, total_pages: 0 };
    }

    // Usa count queries com head:true (sem baixar dados) — muito mais rápido
    // que buscar todas as visitas e contar em memória
    const agenteIds = agentes.map((a) => a.id);
    const [totalRes, realizadasRes] = await Promise.all([
      supabase
        .from('visitas')
        .select('agente_id', { count: 'exact', head: false })
        .in('agente_id', agenteIds),
      supabase
        .from('visitas')
        .select('agente_id', { count: 'exact', head: false })
        .in('agente_id', agenteIds)
        .eq('status', 'realizada'),
    ]);

    // Conta por agente sem baixar todos os campos
    const totalPorAgente = new Map<string, number>();
    const realizadasPorAgente = new Map<string, number>();
    for (const v of totalRes.data ?? []) {
      totalPorAgente.set(v.agente_id, (totalPorAgente.get(v.agente_id) ?? 0) + 1);
    }
    for (const v of realizadasRes.data ?? []) {
      realizadasPorAgente.set(v.agente_id, (realizadasPorAgente.get(v.agente_id) ?? 0) + 1);
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
    const { data: agente, error } = await supabase.from('agentes').select('*').eq('id', id).single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar agente: ${error.message}`);
    }
    if (!agente) return null;

    const { data: visitas, error: visitasError } = await supabase
      .from('visitas').select('id, status').eq('agente_id', id);
    if (visitasError) throw new Error(`Erro ao buscar estatísticas do agente: ${visitasError.message}`);

    const total = visitas?.length ?? 0;
    const realizadas = visitas?.filter((v) => v.status === 'realizada').length ?? 0;
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
    const { data: visitas, error } = await supabase
      .from('visitas').select('data_visita, status')
      .eq('agente_id', id).gte('data_visita', inicio).lte('data_visita', fim)
      .order('data_visita', { ascending: true });

    if (error) throw new Error(`Erro ao buscar desempenho do agente: ${error.message}`);

    const registros = visitas ?? [];
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
      .select(`*, agente:agentes(id, nome, area_atuacao), moradores(*)`)
      .eq('agente_id', id).is('deleted_at', null).order('logradouro', { ascending: true });

    if (error) throw new Error(`Erro ao buscar famílias do agente: ${error.message}`);

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
    if (error) throw new Error(`Erro ao buscar ranking de agentes: ${error.message}`);

    const result = (data as VisitaPorAgente[]) ?? [];
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar ranking de agentes');
  }
}
