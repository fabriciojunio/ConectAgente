import { z } from 'zod';

/**
 * Medicamentos e dúvidas do morador.
 *
 * Como o trabalho acontece de verdade (PNAB 2017, atribuições do ACS): o agente
 * orienta sobre o uso correto do medicamento, mas não prescreve nem responde
 * dúvida clínica. Ele anota a dúvida na visita, leva para a equipe da UBS
 * (enfermeiro, médico ou farmacêutico) e devolve a resposta na visita seguinte.
 * Os problemas de uso abaixo são os que a literatura sobre o ACS mais cita.
 */

export const PROBLEMAS_DE_USO = [
  { value: 'esquece', label: 'Esquece de tomar' },
  { value: 'horario_ou_dose', label: 'Horário ou quantidade errados' },
  { value: 'armazenamento', label: 'Guarda em local inadequado' },
  { value: 'automedicacao', label: 'Automedicação' },
  { value: 'efeito_colateral', label: 'Relata efeito colateral' },
  { value: 'falta_remedio', label: 'Faltou o remédio' },
] as const;

export type ProblemaDeUso = (typeof PROBLEMAS_DE_USO)[number]['value'];

export const PROFISSIONAIS = [
  { value: 'enfermeiro', label: 'Enfermeiro(a)' },
  { value: 'medico', label: 'Médico(a)' },
  { value: 'farmaceutico', label: 'Farmacêutico(a)' },
] as const;

export type Profissional = (typeof PROFISSIONAIS)[number]['value'];

const VALORES_DE_PROBLEMA = PROBLEMAS_DE_USO.map((p) => p.value) as string[];

/** Grava a lista como texto separado por vírgula, só com valores conhecidos. */
export function serializarProblemas(problemas: readonly string[]): string | null {
  const validos = [...new Set(problemas)].filter((p) => VALORES_DE_PROBLEMA.includes(p));
  return validos.length > 0 ? validos.join(',') : null;
}

/** Lê o texto gravado de volta, descartando o que não for reconhecido. */
export function lerProblemas(texto: string | null | undefined): ProblemaDeUso[] {
  if (!texto) return [];
  return texto
    .split(',')
    .map((p) => p.trim())
    .filter((p): p is ProblemaDeUso => VALORES_DE_PROBLEMA.includes(p));
}

export function rotuloDoProblema(valor: string): string {
  return PROBLEMAS_DE_USO.find((p) => p.value === valor)?.label ?? valor;
}

export function rotuloDoProfissional(valor: string | null | undefined): string {
  return PROFISSIONAIS.find((p) => p.value === valor)?.label ?? 'equipe';
}

export type SituacaoDaDuvida = 'sem_duvida' | 'aguardando' | 'respondida';

export function situacaoDaDuvida(m: { duvida?: string | null; duvida_respondida?: boolean }): SituacaoDaDuvida {
  if (!m.duvida?.trim()) return 'sem_duvida';
  return m.duvida_respondida ? 'respondida' : 'aguardando';
}

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const medicamentoSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do medicamento').max(120, 'Use no máximo 120 caracteres'),
  dosagem: textoOpcional(80),
  frequencia: textoOpcional(80),
  duvida: textoOpcional(1000),
});

export type MedicamentoFormInput = z.input<typeof medicamentoSchema>;
export type MedicamentoForm = z.output<typeof medicamentoSchema>;

export const respostaSchema = z.object({
  respondido_por: z.enum(['enfermeiro', 'medico', 'farmaceutico'], {
    message: 'Escolha quem respondeu',
  }),
  resposta: z.string().trim().min(3, 'Escreva a resposta da equipe').max(2000, 'Use no máximo 2000 caracteres'),
});

export type RespostaForm = z.infer<typeof respostaSchema>;
