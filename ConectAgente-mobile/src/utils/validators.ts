import { z } from 'zod';
import { stripCPF, stripCEP } from './formatters';
import { VALIDATION } from './constants';

// ============================================================
// VALIDAÇÕES PURAS
// ============================================================

export function validarCPF(cpf: string): boolean {
  const digits = stripCPF(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(digits[10]);
}

export function validarCartaoSUS(cartao: string): boolean {
  const digits = cartao.replace(/\D/g, '');
  return digits.length === VALIDATION.CARTAO_SUS_LENGTH;
}

export function validarCEP(cep: string): boolean {
  return stripCEP(cep).length === VALIDATION.CEP_LENGTH;
}

export function validarEmail(email: string): boolean {
  // RFC 5322 simplificado: local@domain.tld — TLD mínimo 2 chars
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

/**
 * Escapa metacaracteres do operador SQL LIKE (%, _, \).
 * Use junto com ESCAPE '\\' na query para buscas seguras.
 * Exemplo: `WHERE nome LIKE ? ESCAPE '\\'`  com valor `escapeForLike(input) + '%'`
 */
export function escapeForLike(query: string): string {
  return query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function validarTelefone(tel: string): boolean {
  const digits = tel.replace(/\D/g, '');
  return digits.length === 10 || digits.length === 11;
}

export function validarData(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

export function validarDataBR(dataBR: string): boolean {
  if (!dataBR || dataBR.length !== 10) return false;
  const parts = dataBR.split('/');
  if (parts.length !== 3) return false;
  const [dayStr, monthStr, yearStr] = parts;
  if (dayStr.length !== 2 || monthStr.length !== 2 || yearStr.length !== 4) return false;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  if (year < 1900 || year > 2100) return false;
  // Verifica se o dia é válido para o mês (inclui anos bissextos)
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function validarDataNascimento(dataBR: string): boolean {
  if (!validarDataBR(dataBR)) return false;
  const [dayStr, monthStr, yearStr] = dataBR.split('/');
  const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
  return date <= new Date(); // não pode ser no futuro
}

// ============================================================
// SCHEMAS ZOD — FORMULÁRIOS
// ============================================================

export const loginSchema = z.object({
  cpf: z
    .string()
    .min(1, 'CPF é obrigatório')
    .refine((v) => validarCPF(v), 'CPF inválido'),
  senha: z
    .string()
    .min(VALIDATION.SENHA_MIN_LENGTH, `Senha mínima de ${VALIDATION.SENHA_MIN_LENGTH} caracteres`),
});

export const residenciaSchema = z.object({
  cep: z
    .string()
    .min(1, 'CEP é obrigatório')
    .refine((v) => validarCEP(v), 'CEP inválido'),
  logradouro: z.string().min(3, 'Logradouro obrigatório'),
  numero: z.string().min(1, 'Número obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Bairro obrigatório'),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  estado: z.string().length(2, 'Estado inválido'),
  tipo_imovel: z.enum(['proprio', 'alugado', 'cedido', 'outros']),
  num_comodos: z.coerce.number({ invalid_type_error: 'Número de cômodos inválido' }).min(1, 'Mínimo 1 cômodo').max(50, 'Máximo 50 cômodos'),
  tem_animais: z.boolean(),
  animais_info: z.string().optional(),
});

export const moradorSchema = z.object({
  residencia_id: z.string().uuid('Residência inválida'),
  nome: z
    .string()
    .min(VALIDATION.NOME_MIN_LENGTH, `Nome mínimo de ${VALIDATION.NOME_MIN_LENGTH} caracteres`),
  cpf: z
    .string()
    .optional()
    .refine((v) => !v || validarCPF(v), 'CPF inválido'),
  cartao_sus: z
    .string()
    .optional()
    .refine((v) => !v || validarCartaoSUS(v), 'Cartão SUS inválido'),
  telefone: z
    .string()
    .optional()
    .refine((v) => !v || validarTelefone(v), 'Telefone inválido'),
  data_nascimento: z
    .string()
    .min(1, 'Data de nascimento obrigatória')
    .refine(validarDataNascimento, 'Data inválida (use DD/MM/AAAA e não pode ser futura'),
  cidade_nascimento: z.string().optional(),
  nome_pai: z.string().optional(),
  nome_mae: z.string().optional(),
  sexo: z.enum(['masculino', 'feminino', 'outro']),
  escolaridade: z
    .enum([
      'sem_escolaridade',
      'fundamental_incompleto',
      'fundamental_completo',
      'medio_incompleto',
      'medio_completo',
      'superior_incompleto',
      'superior_completo',
      'pos_graduacao',
    ])
    .optional(),
  profissao: z.string().optional(),
  tem_doenca: z.boolean(),
  doencas: z.string().optional(),
  beneficio_bolsa_familia: z.boolean(),
  tem_convenio: z.boolean(),
  convenio_nome: z.string().optional(),
  toma_medicamento: z.boolean(),
  medicamentos_lista: z.string().optional(),
  is_responsavel: z.boolean(),
});

export const visitaSchema = z.object({
  residencia_id: z.string().uuid('Residência inválida'),
  morador_id: z.string().uuid().optional(),
  data_visita: z
    .string()
    .min(1, 'Data da visita obrigatória')
    .refine(validarDataBR, 'Data inválida (use DD/MM/AAAA)'),
  status: z.enum(['agendada', 'realizada', 'cancelada', 'nao_encontrado']),
  motivo_visita: z.enum(['rotina', 'busca_ativa', 'urgencia', 'retorno', 'solicitacao']).optional(),
  queixas: z.string().optional(),
  observacoes: z.string().optional(),
  pa_visita: z.string().optional(),
  glicemia_visita: z.string().optional(),
  peso_visita: z.string().optional(),
  medicamentos_em_dia: z.boolean().optional(),
  cartao_vacinas_em_dia: z.boolean().optional(),
  encaminhamentos: z.string().optional(),
  precisa_agendamento: z.boolean(),
  especialidade_agendamento: z.string().optional(),
});

export const agendamentoSchema = z.object({
  residencia_id: z.string().uuid('Residência inválida'),
  morador_id: z.string().uuid().optional(),
  data_agendada: z
    .string()
    .min(1, 'Data obrigatória')
    .refine(validarDataBR, 'Data inválida (use DD/MM/AAAA)'),
  motivo: z.string().min(3, 'Motivo obrigatório'),
  observacoes: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type ResidenciaFormDataValidated = z.infer<typeof residenciaSchema>;
export type MoradorFormDataValidated = z.infer<typeof moradorSchema>;
export type VisitaFormDataValidated = z.infer<typeof visitaSchema>;
export type AgendamentoFormDataValidated = z.infer<typeof agendamentoSchema>;
