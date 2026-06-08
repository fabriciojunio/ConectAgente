import { z } from 'zod';

/**
 * Reusable Zod schemas for input validation at service boundaries.
 * All user-facing inputs should be validated before reaching Supabase.
 */

/** UUID v4 format */
export const uuidSchema = z.string().uuid('ID invalido');

/** ISO date string (YYYY-MM-DD) */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data invalida (YYYY-MM-DD)');

/** ISO datetime string */
export const datetimeSchema = z.string().datetime({ message: 'Data/hora invalida' });

/** CPF: exactly 11 digits */
export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF deve conter exatamente 11 digitos');

/** Pagination parameters */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

/** Safe text: strips control characters and limits length */
export const safeTextSchema = (maxLength: number = 500) =>
  z
    .string()
    .max(maxLength, `Texto deve ter no maximo ${maxLength} caracteres`)
    .transform((val) => val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''));

/** User role */
export const userRoleSchema = z.enum(['agente', 'supervisor', 'admin']);

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
