'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import type {
  Morador,
  GlobalFilters,
  PaginationParams,
  PaginatedResult,
} from '@/types';

interface MoradorComDetalhes extends Morador {
  residencia?: {
    id: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
  };
  agente?: {
    id: string;
    nome: string;
  };
}

export type { MoradorComDetalhes };

const MORADOR_SELECT = `*, residencia:residencias(id, logradouro, numero, bairro, cidade), agente:agentes(id, nome)`;

export async function getMoradores(
  filters?: GlobalFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<MoradorComDetalhes>> {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.per_page ?? 20;
  const key = `moradores_${JSON.stringify(filters ?? {})}_${page}_${perPage}`;
  const cached = cacheGet<PaginatedResult<MoradorComDetalhes>>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    let query = supabase
      .from('moradores')
      .select(MORADOR_SELECT, { count: 'exact', head: false })
      .is('deleted_at', null);

    if (filters?.agente_id) query = query.eq('agente_id', filters.agente_id);
    if (filters?.bairro) query = query.eq('residencia.bairro', filters.bairro);

    query = query.order('nome', { ascending: true }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(`Erro ao buscar moradores: ${error.message}`);

    const result = {
      data: (data as unknown as MoradorComDetalhes[]) ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    };
    cacheSet(key, result);
    return result;
  });
}

export async function getEstatisticasMoradores(): Promise<{
  total: number;
  hipertensos: number;
  diabeticos: number;
  gestantes: number;
  domiciliados: number;
  com_doenca: number;
}> {
  const key = 'moradores_stats';
  const cached = cacheGet<ReturnType<typeof getEstatisticasMoradores> extends Promise<infer T> ? T : never>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();

    // Usa count queries com head:true, muito mais rápido que baixar todas as linhas
    const base = () => supabase.from('moradores').select('id', { count: 'exact', head: true }).is('deleted_at', null);

    const [totalRes, hipRes, diabRes, gestRes, domRes, doencaRes] = await Promise.all([
      base(),
      base().eq('is_hipertenso', true),
      base().eq('is_diabetico', true),
      base().eq('is_gestante', true),
      base().eq('is_domiciliado', true),
      base().eq('tem_doenca', true),
    ]);

    const result = {
      total: totalRes.count ?? 0,
      hipertensos: hipRes.count ?? 0,
      diabeticos: diabRes.count ?? 0,
      gestantes: gestRes.count ?? 0,
      domiciliados: domRes.count ?? 0,
      com_doenca: doencaRes.count ?? 0,
    };
    cacheSet(key, result);
    return result;
  });
}

/**
 * Lê o cadastro de um morador pela função do banco, que registra a leitura.
 *
 * Por que não é um `select` direto. O art. 37 da Lei 13.709/2018 obriga a
 * manter registro das operações de tratamento, e aqui o navegador fala direto
 * com o PostgREST: não há servidor nosso no meio onde gravar. Gravar pelo
 * cliente seria teatro, porque bastaria não chamar.
 *
 * `fn_ler_morador` grava o registro na mesma transação da leitura, repete a
 * regra da policy `moradores_select` por dentro, e devolve `null` quando quem
 * chama não pode ver aquele morador, gravando a tentativa negada. Varredura de
 * id passa a deixar marca.
 *
 * Não entra no cache: cada abertura de ficha é um acesso, e acesso que vem do
 * cache é acesso que não foi registrado.
 */
export async function getMoradorAuditado(
  moradorId: string
): Promise<MoradorComDetalhes | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_ler_morador', {
    p_morador_id: moradorId,
  });

  if (error) {
    throw new Error(`Erro ao abrir a ficha do paciente: ${error.message}`);
  }
  return (data as MoradorComDetalhes | null) ?? null;
}
