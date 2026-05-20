'use client';

import { createClient } from '@/lib/supabase/client';
import { cacheGet, cacheSet } from '@/lib/cache';
import { enqueue } from '@/lib/requestQueue';
import type {
  Agente,
  UserRole,
  AuditLog,
  PaginationParams,
  PaginatedResult,
} from '@/types';

/**
 * Lista todos os usuários (agentes) do sistema com paginação.
 * Requer permissão de administrador (controlado por RLS).
 */
export async function getUsuarios(
  pagination?: PaginationParams
): Promise<PaginatedResult<Agente>> {
  const page = pagination?.page ?? 1;
  const perPage = pagination?.per_page ?? 20;
  const key = `usuarios_${page}_${perPage}`;
  const cached = cacheGet<PaginatedResult<Agente>>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await supabase
      .from('agentes')
      .select('*', { count: 'exact', head: false })
      .order('nome', { ascending: true })
      .range(from, to);

    if (error) throw new Error(`Erro ao buscar usuários: ${error.message}`);

    const result = {
      data: (data as Agente[]) ?? [],
      total: count ?? 0,
      page,
      per_page: perPage,
      total_pages: Math.ceil((count ?? 0) / perPage),
    };
    cacheSet(key, result);
    return result;
  });
}

/**
 * Retorna um usuário (agente) específico pelo ID.
 */
export async function getUsuarioById(id: string): Promise<Agente | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('agentes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }

    return (data as Agente) ?? null;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao buscar usuário');
  }
}

/**
 * Atualiza o role de um usuário.
 * Requer permissão de administrador (controlado por RLS).
 */
export async function atualizarRole(
  id: string,
  role: UserRole
): Promise<void> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('agentes')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao atualizar role do usuário: ${error.message}`);
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao atualizar role do usuário');
  }
}

/**
 * Ativa ou desativa um usuário.
 * Requer permissão de administrador (controlado por RLS).
 */
export async function toggleAtivoUsuario(
  id: string,
  ativo: boolean
): Promise<void> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('agentes')
      .update({ ativo, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw new Error(`Erro ao alterar status do usuário: ${error.message}`);
    }
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao alterar status do usuário');
  }
}

/**
 * Retorna os logs de auditoria com filtros e paginação.
 * Requer permissão de administrador (controlado por RLS).
 */
export async function getAuditLogs(
  filters?: {
    agente_id?: string;
    tabela?: string;
    inicio?: string;
    fim?: string;
  },
  pagination?: PaginationParams
): Promise<PaginatedResult<AuditLog>> {
  try {
    const page = pagination?.page ?? 1;
    const perPage = pagination?.per_page ?? 20;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const cacheKey = `audit_logs_${JSON.stringify(filters ?? {})}_${page}_${perPage}`;
    const cached = cacheGet<PaginatedResult<AuditLog>>(cacheKey);
    if (cached) return cached;

    return enqueue(async () => {
      const supabase = createClient();
      let query = supabase
        .from('audit_log')
        .select('*', { count: 'exact', head: false });

      if (filters?.agente_id) {
        query = query.eq('agente_id', filters.agente_id);
      }
      if (filters?.tabela) {
        query = query.eq('tabela', filters.tabela);
      }
      if (filters?.inicio) {
        query = query.gte('created_at', filters.inicio);
      }
      if (filters?.fim) {
        query = query.lte('created_at', filters.fim);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.warn(`getAuditLogs: ${error.message}`);
        return { data: [], total: 0, page, per_page: perPage, total_pages: 0 };
      }

      const result = {
        data: (data as AuditLog[]) ?? [],
        total: count ?? 0,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count ?? 0) / perPage),
      };
      cacheSet(cacheKey, result);
      return result;
    });
  } catch (err) {
    console.warn('getAuditLogs error:', err instanceof Error ? err.message : err);
    return { data: [], total: 0, page: pagination?.page ?? 1, per_page: pagination?.per_page ?? 20, total_pages: 0 };
  }
}

/**
 * Retorna estatísticas gerais do sistema.
 * Requer permissão de administrador.
 */
export async function getEstatisticasSistema(): Promise<{
  total_agentes: number;
  total_familias: number;
  total_moradores: number;
  total_visitas: number;
  agentes_ativos: number;
  ultimo_sync: string;
}> {
  const key = 'estatisticas_sistema';
  const cached = cacheGet<Awaited<ReturnType<typeof getEstatisticasSistema>>>(key);
  if (cached) return cached;

  return enqueue(async () => {
    const supabase = createClient();

    const [agentesRes, familiasRes, moradoresRes, visitasRes, ativosRes, syncRes] =
      await Promise.all([
        supabase
          .from('agentes')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('residencias')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('moradores')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('visitas')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('agentes')
          .select('id', { count: 'exact', head: true })
          .eq('ativo', true),
        supabase
          .from('sync_log')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

    const result = {
      total_agentes: agentesRes.count ?? 0,
      total_familias: familiasRes.count ?? 0,
      total_moradores: moradoresRes.count ?? 0,
      total_visitas: visitasRes.count ?? 0,
      agentes_ativos: ativosRes.count ?? 0,
      ultimo_sync: syncRes.data?.created_at ?? '',
    };
    cacheSet(key, result);
    return result;
  });
}
