import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, differenceInCalendarDays, differenceInYears, parseISO } from 'date-fns';
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

const DATA_DO_FILTRO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Limite exclusivo para filtrar `data_visita` até o fim do dia escolhido.
 *
 * `data_visita` é TIMESTAMPTZ e o filtro manda só a data. Com `lte` o banco
 * compara com a meia-noite e deixa de fora as visitas do último dia inteiro.
 * As funções do painel usam `data_visita::date BETWEEN`, que inclui o dia, e
 * lista e relatório precisam bater com o painel: daí o `< dia seguinte`.
 */
export function fimExclusivo(data: string): string {
  if (!DATA_DO_FILTRO.test(data)) {
    throw new Error('Data final do período inválida');
  }
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10);
}

/**
 * Dia da visita como o agente registrou, em AAAA-MM-DD.
 *
 * O aplicativo envia só a data (`2026-10-13`) e a coluna é TIMESTAMPTZ, então
 * o banco grava meia-noite em UTC e o PostgREST devolve
 * `2026-10-13T00:00:00+00:00`. Convertido para o fuso do navegador, isso é dia
 * 12 às 21h: toda visita aparecia um dia antes. O dia certo é a data em UTC,
 * os dez primeiros caracteres.
 */
export function dataDaVisita(valor: string): string {
  return valor.slice(0, 10);
}

/** `dataDaVisita` em DD/MM/AAAA, para tela e relatório. */
export function formatDataDaVisita(valor: string | null | undefined): string {
  if (!valor) return '-';
  const dia = dataDaVisita(valor);
  if (!DATA_DO_FILTRO.test(dia)) return '--/--/----';
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

/** Hoje (ou outra data) no fuso de quem usa o painel, em AAAA-MM-DD. */
export function diaLocal(data: Date = new Date()): string {
  return format(data, 'yyyy-MM-dd');
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
 * CPF mascarado no padrão do governo federal: ***.456.789-**.
 *
 * Para listas, onde o CPF só serve para diferenciar homônimos. Mostrar os
 * onze dígitos de toda a equipe a cada abertura da tela é exposição sem
 * finalidade (LGPD, art. 6º, III, necessidade).
 */
export function mascararCPF(cpf?: string | null): string {
  const digits = (cpf ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return '-';
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
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
    // Dias de calendário sobre o dia registrado: contar períodos de 24 h a
    // partir da meia-noite UTC somava um dia de atraso depois das 21 h.
    const dias = differenceInCalendarDays(new Date(), parseISO(dataDaVisita(ultimaVisita)));
    return Number.isNaN(dias) ? Infinity : dias;
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
      return 'text-green-700 bg-green-50 border-green-200';
    case NivelCriticidade.ATENCAO:
      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case NivelCriticidade.ALERTA:
      return 'text-orange-700 bg-orange-50 border-orange-200';
    case NivelCriticidade.CRITICO:
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-[var(--texto-medio)] bg-[var(--superficie-alt)] border-[var(--borda)]';
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
      return 'text-[var(--texto-medio)] bg-[var(--superficie-alt)] border-[var(--borda)]';
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
export const MENSAGEM_DE_PRAZO = 'O servidor demorou para responder. Confira a conexão e tente de novo.';

/**
 * Espera a consulta até o prazo e, se estourar, falha com mensagem clara.
 *
 * Antes devolvia um valor vazio no estouro: a tela mostrava 0 agentes, 0
 * visitas, como se fosse o número real, e ninguém sabia que a consulta
 * tinha travado. Achado no painel de produção. Agora o erro chega à faixa
 * de aviso que cada tela já tem.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error(MENSAGEM_DE_PRAZO)), ms);
  });
  return Promise.race([promise, prazo]).finally(() => clearTimeout(relogio));
}
