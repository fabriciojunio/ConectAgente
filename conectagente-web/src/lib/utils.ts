import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, differenceInDays, differenceInYears, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NivelCriticidade, StatusVisita } from '@/types';

// ---------------------------------------------------------------------------
// Tailwind Class Merge
// ---------------------------------------------------------------------------

/**
 * Merges Tailwind CSS classes using clsx and tailwind-merge.
 * Handles conditional classes and resolves conflicts.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Date Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a date string or Date object using date-fns with pt-BR locale.
 * @param date - ISO string or Date object
 * @param formatStr - date-fns format string (default: 'dd/MM/yyyy')
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  formatStr: string = 'dd/MM/yyyy',
): string {
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return format(dateObj, formatStr, { locale: ptBR });
  } catch {
    return '--/--/----';
  }
}

// ---------------------------------------------------------------------------
// Brazilian Document / Phone Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a CPF string as XXX.XXX.XXX-XX.
 * Accepts raw digits or already formatted strings.
 */
export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formats a phone number as (XX) XXXXX-XXXX or (XX) XXXX-XXXX.
 * Accepts raw digits.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Formats a CEP string as XXXXX-XXX.
 */
export function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return cep;
  return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
}

// ---------------------------------------------------------------------------
// Visit / Criticality Helpers
// ---------------------------------------------------------------------------

/**
 * Calculates the number of days since the last visit.
 * @param ultimaVisita - ISO date string of the last visit
 * @returns Number of days since last visit, or Infinity if null/undefined
 */
export function calcularDiasSemVisita(ultimaVisita: string | null | undefined): number {
  if (!ultimaVisita) return Infinity;
  try {
    return differenceInDays(new Date(), parseISO(ultimaVisita));
  } catch {
    return Infinity;
  }
}

/**
 * Returns the criticality level based on number of days without a visit.
 * - 0-7 days: normal
 * - 8-15 days: atencao
 * - 16-30 days: alerta
 * - 30+ days: critico
 */
export function getNivelCriticidade(dias: number): NivelCriticidade {
  if (dias <= 7) return NivelCriticidade.NORMAL;
  if (dias <= 15) return NivelCriticidade.ATENCAO;
  if (dias <= 30) return NivelCriticidade.ALERTA;
  return NivelCriticidade.CRITICO;
}

/**
 * Returns a Tailwind color class for the given criticality level.
 */
export function getCriticidadeColor(nivel: NivelCriticidade): string {
  switch (nivel) {
    case NivelCriticidade.NORMAL:
      return 'text-green-600 bg-green-50 border-green-200';
    case NivelCriticidade.ATENCAO:
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case NivelCriticidade.ALERTA:
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case NivelCriticidade.CRITICO:
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Returns a Tailwind color class for the given visit status.
 */
export function getStatusColor(status: StatusVisita): string {
  switch (status) {
    case StatusVisita.REALIZADA:
      return 'text-green-700 bg-green-100 border-green-300';
    case StatusVisita.AGENDADA:
      return 'text-blue-700 bg-blue-100 border-blue-300';
    case StatusVisita.CANCELADA:
      return 'text-red-700 bg-red-100 border-red-300';
    case StatusVisita.NAO_ENCONTRADO:
      return 'text-amber-700 bg-amber-100 border-amber-300';
    default:
      return 'text-gray-700 bg-gray-100 border-gray-300';
  }
}

// ---------------------------------------------------------------------------
// Text / Input Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitizes user input to prevent basic XSS attacks.
 * Strips HTML tags and encodes dangerous characters.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Truncates text to the specified length, appending an ellipsis if needed.
 */
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length).trimEnd() + '...';
}

// ---------------------------------------------------------------------------
// Age Calculation
// ---------------------------------------------------------------------------

/**
 * Calculates age in years from a birthdate string.
 * @param dataNascimento - ISO date string of the birthdate
 * @returns Age in years
 */
export function calcularIdade(dataNascimento: string): number {
  try {
    return differenceInYears(new Date(), parseISO(dataNascimento));
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Number Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a number as a percentage string (e.g., 85.3%).
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Async Utilities
// ---------------------------------------------------------------------------

/**
 * Races a promise against a timeout. If the promise does not resolve within
 * `ms` milliseconds, resolves with `fallback` instead of hanging forever.
 */
export function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
