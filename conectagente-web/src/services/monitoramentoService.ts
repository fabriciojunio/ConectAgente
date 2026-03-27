'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import type {
  CoberturaMicroarea,
  VisitaPorBairro,
  GlobalFilters,
} from '@/types';

export async function getCoberturaPorMicroarea(
  filters?: GlobalFilters
): Promise<CoberturaMicroarea[]> {
  const key = `cobertura_${filters?.unidade_saude ?? ''}`;
  const cached = cacheGet<CoberturaMicroarea[]>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const params: Record<string, unknown> = {};
    if (filters?.unidade_saude) params.p_unidade = filters.unidade_saude;

    const { data, error } = await supabase.rpc('fn_cobertura_por_microarea', params);
    if (error) throw new Error(`Erro ao buscar cobertura por microárea: ${error.message}`);

    const result = (data as CoberturaMicroarea[]) ?? [];
    cacheSet(key, result);
    return result;
  });
}

export async function getRankingAtrasos(
  filters?: GlobalFilters
): Promise<{
  microareas: Array<{ microarea: string; total_atraso: number }>;
  agentes: Array<{ agente_nome: string; total_atraso: number }>;
}> {
  const key = `ranking_atrasos_${filters?.unidade_saude ?? ''}`;
  const cached = cacheGet<ReturnType<typeof getRankingAtrasos> extends Promise<infer T> ? T : never>(key);
  if (cached) return cached;

  try {
    // Reutiliza as mesmas funções que já fazem cache individualmente,
    // evitando RPCs duplicadas quando a página de monitoramento
    // também chama getCoberturaPorMicroarea e getFamiliasEmAtraso
    const [familias, cobertura] = await Promise.all([
      import('@/services/familiaService').then((m) => m.getFamiliasEmAtraso(30, filters)),
      getCoberturaPorMicroarea(filters),
    ]);

    const agentesMap = new Map<string, number>();
    for (const f of familias) {
      const nome = f.agente_nome ?? 'Sem agente';
      agentesMap.set(nome, (agentesMap.get(nome) ?? 0) + 1);
    }
    const agentes = Array.from(agentesMap.entries())
      .map(([agente_nome, total_atraso]) => ({ agente_nome, total_atraso }))
      .sort((a, b) => b.total_atraso - a.total_atraso);

    const microareas = cobertura
      .map((c) => ({ microarea: c.microarea, total_atraso: c.total_familias - c.familias_visitadas_30d }))
      .sort((a, b) => b.total_atraso - a.total_atraso);

    const result = { microareas, agentes };
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar ranking de atrasos');
  }
}

export async function getMapaCobertura(inicio: string, fim: string): Promise<VisitaPorBairro[]> {
  const key = `mapa_cobertura_${inicio}_${fim}`;
  const cached = cacheGet<VisitaPorBairro[]>(key);
  if (cached) return cached;

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('fn_visitas_por_bairro', { p_inicio: inicio, p_fim: fim });
    if (error) throw new Error(`Erro ao buscar mapa de cobertura: ${error.message}`);

    const result = (data as VisitaPorBairro[]) ?? [];
    cacheSet(key, result);
    return result;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar mapa de cobertura');
  }
}
