'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import type { SolicitacaoRegistro, PaginationParams, PaginatedResult } from '@/types';

/**
 * Lista solicitações de registro (para admins/gerentes).
 */
export async function getSolicitacoes(
  status?: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<SolicitacaoRegistro>> {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.per_page ?? 20;
  const key = `solicitacoes_${status ?? 'all'}_${page}_${perPage}`;
  const cached = cacheGet<PaginatedResult<SolicitacaoRegistro>>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('solicitacoes_registro')
      .select('*', { count: 'exact', head: false });

    if (status) query = query.eq('status', status);

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(`Erro ao buscar solicitações: ${error.message}`);

    const result = {
      data: (data as SolicitacaoRegistro[]) ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    };
    cacheSet(key, result);
    return result;
  });
}
