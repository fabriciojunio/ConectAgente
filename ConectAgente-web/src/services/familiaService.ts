'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import type {
  ResidenciaComDetalhes,
  FamiliaEmAtraso,
  Morador,
  Visita,
  GlobalFilters,
  PaginationParams,
  PaginatedResult,
} from '@/types';
import { MORADOR_COLUNAS_LISTA } from './moradorColunas';
import { falhaDeConsulta } from '@/lib/utils';

/**
 * Unidade e microárea são do agente, não da residência. Para o filtro cortar
 * as famílias, o agente entra com `!inner`; sem ele o PostgREST só esvaziaria
 * o objeto embutido e devolveria todas as residências.
 */
export function selectResidencias(filters?: GlobalFilters): string {
  const agente = filters?.unidade_saude || filters?.microarea ? 'agentes!inner' : 'agentes';
  return `*, agente:${agente}(id, nome, area_atuacao), moradores(${MORADOR_COLUNAS_LISTA})`;
}

export async function getFamilias(
  filters?: GlobalFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<ResidenciaComDetalhes>> {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.per_page ?? 20;
  const key = `familias_${JSON.stringify(filters ?? {})}_${page}_${perPage}`;
  const cached = cacheGet<PaginatedResult<ResidenciaComDetalhes>>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('residencias')
      .select(selectResidencias(filters), { count: 'exact', head: false })
      .is('deleted_at', null);

    if (filters?.bairro) query = query.eq('bairro', filters.bairro);
    if (filters?.agente_id) query = query.eq('agente_id', filters.agente_id);
    if (filters?.unidade_saude) query = query.eq('agente.unidade_saude', filters.unidade_saude);
    if (filters?.microarea) query = query.eq('agente.microarea', filters.microarea);

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw falhaDeConsulta('buscar famílias', error);

    const result = {
      data: (data as unknown as ResidenciaComDetalhes[]) ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    };
    cacheSet(key, result);
    return result;
  });
}

export async function getFamiliaById(id: string): Promise<ResidenciaComDetalhes | null> {
  const key = `familia_${id}`;
  const cached = cacheGet<ResidenciaComDetalhes>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('residencias')
      .select(`*, agente:agentes(id, nome, area_atuacao), moradores(${MORADOR_COLUNAS_LISTA}), visitas(*, agente:agentes(id, nome))`)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw falhaDeConsulta('buscar família', error);
    }

    const result = (data as unknown as ResidenciaComDetalhes) ?? null;
    if (result) cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar família');
  }
}

export async function getFamiliasEmAtraso(
  dias: number = 30,
  filters?: GlobalFilters
): Promise<FamiliaEmAtraso[]> {
  const key = `familias_atraso_${dias}_${filters?.unidade_saude ?? ''}`;
  const cached = cacheGet<FamiliaEmAtraso[]>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const params: Record<string, unknown> = { p_dias: dias };
    if (filters?.unidade_saude) params.p_unidade = filters.unidade_saude;

    const { data, error } = await supabase.rpc('fn_familias_em_atraso', params);
    if (error) throw falhaDeConsulta('buscar famílias em atraso', error);

    const result = (data as FamiliaEmAtraso[]) ?? [];
    cacheSet(key, result);
    return result;
  });
}

export async function getMoradoresByFamilia(residenciaId: string): Promise<Morador[]> {
  const key = `moradores_${residenciaId}`;
  const cached = cacheGet<Morador[]>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('moradores')
      .select(MORADOR_COLUNAS_LISTA)
      .eq('residencia_id', residenciaId)
      .is('deleted_at', null)
      .order('nome', { ascending: true });

    if (error) throw falhaDeConsulta('buscar moradores', error);

    const result = (data as unknown as Morador[]) ?? [];
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar moradores');
  }
}

export async function getHistoricoVisitas(residenciaId: string): Promise<Visita[]> {
  const key = `historico_visitas_${residenciaId}`;
  const cached = cacheGet<Visita[]>(key, 60_000);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('visitas')
      .select('*')
      .eq('residencia_id', residenciaId)
      .order('data_visita', { ascending: false });

    if (error) throw falhaDeConsulta('buscar histórico de visitas', error);

    const result = (data as Visita[]) ?? [];
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar histórico de visitas');
  }
}
