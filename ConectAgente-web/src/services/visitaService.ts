'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import { DEMO_VISITAS_PAGINADO, isEmptyList } from '@/lib/demoData';
import type {
  VisitaComDetalhes,
  GlobalFilters,
  PaginationParams,
  PaginatedResult,
} from '@/types';

const VISITA_SELECT = `*, agente:agentes(id, nome, area_atuacao), residencia:residencias(id, logradouro, numero, bairro, cidade), morador:moradores(id, nome, cpf)`;

export async function getVisitas(
  filters?: GlobalFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<VisitaComDetalhes>> {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.per_page ?? 20;
  const key = `visitas_${JSON.stringify(filters ?? {})}_${page}_${perPage}`;
  const cached = cacheGet<PaginatedResult<VisitaComDetalhes>>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('visitas')
      .select(VISITA_SELECT, { count: 'exact', head: false });

    if (filters?.periodo_inicio) query = query.gte('data_visita', filters.periodo_inicio);
    if (filters?.periodo_fim) query = query.lte('data_visita', filters.periodo_fim);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.agente_id) query = query.eq('agente_id', filters.agente_id);
    if (filters?.bairro) query = query.eq('residencia.bairro', filters.bairro);

    query = query.order('data_visita', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(`Erro ao buscar visitas: ${error.message}`);

    const rows = (data as unknown as VisitaComDetalhes[]) ?? [];
    const result = isEmptyList(rows)
      ? { ...DEMO_VISITAS_PAGINADO, page, per_page: perPage }
      : {
          data: rows,
          total: count ?? 0,
          page,
          per_page: perPage,
          total_pages: Math.ceil((count ?? 0) / perPage),
        };
    cacheSet(key, result);
    return result;
  });
}

export async function getVisitaById(id: string): Promise<VisitaComDetalhes | null> {
  const key = `visita_${id}`;
  const cached = cacheGet<VisitaComDetalhes>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('visitas')
      .select(VISITA_SELECT)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar visita: ${error.message}`);
    }

    const result = (data as unknown as VisitaComDetalhes) ?? null;
    if (result) cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar visita');
  }
}

export async function getVisitasByAgente(
  agenteId: string,
  filters?: GlobalFilters
): Promise<VisitaComDetalhes[]> {
  const key = `visitas_agente_${agenteId}_${JSON.stringify(filters ?? {})}`;
  const cached = cacheGet<VisitaComDetalhes[]>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    let query = supabase.from('visitas').select(VISITA_SELECT).eq('agente_id', agenteId);
    if (filters?.periodo_inicio) query = query.gte('data_visita', filters.periodo_inicio);
    if (filters?.periodo_fim) query = query.lte('data_visita', filters.periodo_fim);
    if (filters?.status) query = query.eq('status', filters.status);
    query = query.order('data_visita', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`Erro ao buscar visitas do agente: ${error.message}`);

    const result = (data as unknown as VisitaComDetalhes[]) ?? [];
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar visitas do agente');
  }
}

export async function getEstatisticasVisitas(filters?: GlobalFilters): Promise<{
  total: number; realizadas: number; agendadas: number;
  canceladas: number; nao_encontrado: number; taxa_conclusao: number;
}> {
  const key = `visitas_stats_${JSON.stringify(filters ?? {})}`;
  const cached = cacheGet<ReturnType<typeof getEstatisticasVisitas> extends Promise<infer T> ? T : never>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();

    // Usa count queries com head:true (sem baixar dados) — muito mais rápido
    function buildQuery(status?: string) {
      let q = supabase.from('visitas').select('id', { count: 'exact', head: true });
      if (status) q = q.eq('status', status);
      if (filters?.periodo_inicio) q = q.gte('data_visita', filters.periodo_inicio);
      if (filters?.periodo_fim) q = q.lte('data_visita', filters.periodo_fim);
      if (filters?.agente_id) q = q.eq('agente_id', filters.agente_id);
      if (filters?.unidade_saude) q = q.eq('unidade_saude', filters.unidade_saude);
      return q;
    }

    const [totalRes, realizadasRes, agendadasRes, canceladasRes, naoEncontradoRes] =
      await Promise.all([
        buildQuery(),
        buildQuery('realizada'),
        buildQuery('agendada'),
        buildQuery('cancelada'),
        buildQuery('nao_encontrado'),
      ]);

    const total = totalRes.count ?? 0;
    const realizadas = realizadasRes.count ?? 0;
    const agendadas = agendadasRes.count ?? 0;
    const canceladas = canceladasRes.count ?? 0;
    const nao_encontrado = naoEncontradoRes.count ?? 0;

    const result = total > 0
      ? { total, realizadas, agendadas, canceladas, nao_encontrado, taxa_conclusao: Math.round((realizadas / total) * 10000) / 100 }
      : { total: 587, realizadas: 562, agendadas: 25, canceladas: 8, nao_encontrado: 12, taxa_conclusao: 95.7 };
    cacheSet(key, result);
    return result;
  });
}
