/**
 * Utilitários de formatação, CPF, CEP, datas, telefone, etc.
 */

// ============================================================
// CPF
// ============================================================

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function stripCPF(value: string): string {
  return value.replace(/\D/g, '');
}

// ============================================================
// CEP
// ============================================================

export function formatCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function stripCEP(value: string): string {
  return value.replace(/\D/g, '');
}

// ============================================================
// TELEFONE
// ============================================================

export function formatTelefone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ============================================================
// CARTÃO SUS
// ============================================================

export function formatCartaoSUS(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 11)
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)} ${digits.slice(11)}`;
}

// ============================================================
// DATAS
// ============================================================

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `data_visita`, `data_agendada` e `data_nascimento` são gravadas só com a
 * data, `2026-10-13`. `new Date` lê esse formato como meia-noite em UTC, e no
 * fuso do Brasil isso ainda é o dia 12 às 21h: toda visita aparecia um dia
 * antes na lista, na ficha e na planilha exportada. Data sem hora não passa
 * por `Date`, só troca a ordem dos campos.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  if (SO_DATA.test(dateStr)) return toDateBR(dateStr);
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
  } catch {
    return dateStr;
  }
}

export function formatDateInput(value: string): string {
  // Formata enquanto digita: DD/MM/AAAA
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseDateBR(value: string): string {
  // DD/MM/AAAA → AAAA-MM-DD (ISO)
  const parts = value.split('/');
  if (parts.length !== 3) return value;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function toDateBR(isoDate: string): string {
  // AAAA-MM-DD → DD/MM/AAAA
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * A data de nascimento é gravada sem hora. Lida por `new Date`, ela vira a
 * véspera às 21h no fuso do Brasil, e a pessoa ganhava um ano de idade um dia
 * antes do aniversário. Por isso os campos saem do texto, e não do `Date`.
 */
export function calcularIdade(dataNascimento: string, hoje: Date = new Date()): number {
  if (!dataNascimento) return 0;
  const [ano, mes, dia] = dataNascimento.slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia) return 0;
  let idade = hoje.getFullYear() - ano;
  const m = hoje.getMonth() + 1 - mes;
  if (m < 0 || (m === 0 && hoje.getDate() < dia)) {
    idade--;
  }
  return idade;
}

export function isoNow(): string {
  return new Date().toISOString();
}

// ============================================================
// UUID
// ============================================================

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// NÚMERO
// ============================================================

// ============================================================
// TEXTO
// ============================================================

export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => capitalize(word))
    .join(' ');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

// ============================================================
// MASCARA GENÉRICA
// ============================================================

export function applyMask(value: string, mask: string): string {
  const digits = value.replace(/\D/g, '');
  let result = '';
  let digitIndex = 0;
  for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
    if (mask[i] === '9') {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += mask[i];
    }
  }
  return result;
}

/**
 * A data local no formato que o banco guarda: AAAA-MM-DD.
 *
 * Existe porque `toISOString()` nao serve aqui. Ele converte para UTC, entao
 * a meia-noite local de 13/10 no Brasil vira `2026-10-13T03:00:00.000Z`, com
 * hora e fuso grudados. Comparar isso com o que esta gravado, que e so
 * `2026-10-13`, da falso em comparacao de texto, porque a string mais curta e
 * considerada menor. Era o que zerava o contador de visitas do dia.
 *
 * Num fuso a leste de Greenwich o estrago seria maior: a meia-noite local cai
 * no dia anterior em UTC, e a data em si sairia errada.
 */
export function apenasData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}
