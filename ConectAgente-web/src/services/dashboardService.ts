'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import type {
  DashboardStats,
  VisitaPorPeriodo,
  VisitaPorAgente,
  VisitaPorBairro,
  FamiliaEmAtraso,
  VisitaComDetalhes,
  GlobalFilters,
} from '@/types';

export async function getDashboardStats(
  filters?: GlobalFilters
): Promise<DashboardStats> {
  const key = `dash_stats_${JSON.stringify(filters ?? {})}`;
  const cached = cacheGet<DashboardStats>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const params: Record<string, unknown> = {};
    if (filters?.unidade_saude) params.p_unidade = filters.unidade_saude;
    if (filters?.agente_id) params.p_agente_id = filters.agente_id;

    const { data, error } = await supabase.rpc('fn_dashboard_stats', params);
    if (error) console.error('getDashboardStats error:', error.message);

    const result = (data as DashboardStats) ?? {
      visitas_hoje: 0, visitas_semana: 0, visitas_mes: 0,
      total_familias: 0, total_moradores: 0, agentes_ativos: 0,
      visitas_realizadas: 0, visitas_pendentes: 0, taxa_conclusao: 0,
    };
    cacheSet(key, result);
    return result;
  });
}

export async function getVisitasPorPeriodo(
  inicio: string,
  fim: string,
  filters?: GlobalFilters
): Promise<VisitaPorPeriodo[]> {
  const key = `dash_periodo_${inicio}_${fim}_${filters?.unidade_saude ?? ''}`;
  const cached = cacheGet<VisitaPorPeriodo[]>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const params: Record<string, unknown> = { p_inicio: inicio, p_fim: fim };
    if (filters?.unidade_saude) params.p_unidade = filters.unidade_saude;

    const { data, error } = await supabase.rpc('fn_visitas_por_periodo', params);
    if (error) console.error('getVisitasPorPeriodo error:', error.message);

    const result = (data as VisitaPorPeriodo[]) ?? [];
    cacheSet(key, result);
    return result;
  });
}

export async function getVisitasPorAgente(
  inicio: string,
  fim: string,
  filters?: GlobalFilters
): Promise<VisitaPorAgente[]> {
  const key = `dash_agente_${inicio}_${fim}_${filters?.unidade_saude ?? ''}`;
  const cached = cacheGet<VisitaPorAgente[]>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const params: Record<string, unknown> = { p_inicio: inicio, p_fim: fim };
    if (filters?.unidade_saude) params.p_unidade = filters.unidade_saude;

    const { data, error } = await supabase.rpc('fn_visitas_por_agente', params);
    if (error) console.error('getVisitasPorAgente error:', error.message);

    const result = (data as VisitaPorAgente[]) ?? [];
    cacheSet(key, result);
    return result;
  });
}

export async function getVisitasPorBairro(
  inicio: string,
  fim: string
): Promise<VisitaPorBairro[]> {
  const key = `dash_bairro_${inicio}_${fim}`;
  const cached = cacheGet<VisitaPorBairro[]>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fn_visitas_por_bairro', { p_inicio: inicio, p_fim: fim });
    if (error) console.error('getVisitasPorBairro error:', error.message);

    const result = (data as VisitaPorBairro[]) ?? [];
    cacheSet(key, result);
    return result;
  });
}

export async function getVisitasRecentes(
  limit: number = 10
): Promise<VisitaComDetalhes[]> {
  const key = `dash_recentes_${limit}`;
  const cached = cacheGet<VisitaComDetalhes[]>(key, 60_000);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('visitas')
      .select(`*, agente:agentes(id, nome, area_atuacao), residencia:residencias(id, logradouro, numero, bairro, cidade), morador:moradores(id, nome, cpf)`)
      .order('data_visita', { ascending: false })
      .limit(limit);

    if (error) console.error('getVisitasRecentes error:', error.message);

    const result = (data as unknown as VisitaComDetalhes[]) ?? [];
    cacheSet(key, result);
    return result;
  });
}

export async function getAlertasAtraso(
  dias: number = 30
): Promise<FamiliaEmAtraso[]> {
  const key = `dash_alertas_${dias}`;
  const cached = cacheGet<FamiliaEmAtraso[]>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fn_familias_em_atraso', { p_dias: dias });
    if (error) console.error('getAlertasAtraso error:', error.message);

    const result = (data as FamiliaEmAtraso[]) ?? [];
    cacheSet(key, result);
    return result;
  });
}
