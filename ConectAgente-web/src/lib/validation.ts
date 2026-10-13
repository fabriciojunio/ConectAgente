import { z } from 'zod';

/**
 * Reusable Zod schemas for input validation at service boundaries.
 * All user-facing inputs should be validated before reaching Supabase.
 */

/** UUID v4 format */
export const uuidSchema = z.string().uuid('ID invalido');

/** ISO date string (YYYY-MM-DD) */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida (YYYY-MM-DD)');

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});


/** User role */
// Tem que casar com o CHECK de agentes.role no banco.
export const userRoleSchema = z.enum([
  'agente',
  'coordenador',
  'gerente',
  'admin',
]);

/**
 * Validates and sanitizes a UUID parameter.
 * Throws if invalid to prevent injection.
 */
export function validateId(id: string): string {
  const result = uuidSchema.safeParse(id);
  if (!result.success) throw new Error('ID invalido');
  return result.data;
}

/**
 * Validates pagination parameters with safe defaults.
 */
export function validatePagination(params?: { page?: number; per_page?: number }) {
  return paginationSchema.parse(params ?? {});
}

/**
 * Validates a date range, ensuring inicio <= fim.
 */
export function validateDateRange(inicio: string, fim: string): { inicio: string; fim: string } {
  const i = dateSchema.parse(inicio);
  const f = dateSchema.parse(fim);
  if (i > f) throw new Error('Data inicial deve ser anterior a data final');
  return { inicio: i, fim: f };
}
