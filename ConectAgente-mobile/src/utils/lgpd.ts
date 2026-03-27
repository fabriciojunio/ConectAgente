/**
 * Utilitários de conformidade LGPD (Lei 13.709/2018).
 * - Base legal: saúde pública (Art. 7°, II e Art. 11, II, a)
 * - Log de auditoria de todos os acessos
 * - Anonimização de dados
 * - Controle de consentimento
 */
import { generateUUID, isoNow } from './formatters';
import { AuditLog, Consentimento } from '../types';
import { LGPD } from './constants';

// ============================================================
// LOG DE AUDITORIA
// ============================================================

export function criarAuditLog(params: {
  agente_id: string;
  acao: string;
  tabela: string;
  registro_id: string;
  dados_anteriores?: unknown;
  dados_novos?: unknown;
}): AuditLog {
  return {
    id: generateUUID(),
    agente_id: params.agente_id,
    acao: params.acao,
    tabela: params.tabela,
    registro_id: params.registro_id,
    dados_anteriores: params.dados_anteriores
      ? JSON.stringify(sanitizarParaAuditoria(params.dados_anteriores as Record<string, unknown>))
      : undefined,
    dados_novos: params.dados_novos
      ? JSON.stringify(sanitizarParaAuditoria(params.dados_novos as Record<string, unknown>))
      : undefined,
    created_at: isoNow(),
  };
}

// Remove campos ultra-sensíveis dos logs (ex: senha)
function sanitizarParaAuditoria(obj: Record<string, unknown>): Record<string, unknown> {
  const CAMPOS_OMITIDOS = ['senha', 'senha_hash', 'assinatura_base64'];
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (CAMPOS_OMITIDOS.includes(key)) {
      result[key] = '[OMITIDO]';
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================
// CONSENTIMENTO
// ============================================================

export function criarConsentimento(params: {
  morador_id: string;
  tipo: string;
  aceito: boolean;
  dados_coletados: string[];
}): Consentimento {
  return {
    id: generateUUID(),
    morador_id: params.morador_id,
    tipo: params.tipo,
    aceito: params.aceito,
    versao_politica: LGPD.VERSAO_POLITICA,
    data_aceite: isoNow(),
    dados_coletados: params.dados_coletados.join(','),
  };
}

// ============================================================
// ANONIMIZAÇÃO (direito ao esquecimento — Art. 18, IV)
// ============================================================

export function anonimizarMorador(morador: Record<string, unknown>): Record<string, unknown> {
  return {
    ...morador,
    nome: 'ANONIMIZADO',
    cpf: '00000000000',
    cartao_sus: '000000000000000',
    telefone: null,
    nome_pai: null,
    nome_mae: null,
    data_nascimento: '1900-01-01',
    cidade_nascimento: null,
    profissao: null,
    deleted_at: isoNow(),
  };
}

// ============================================================
// MINIMIZAÇÃO DE DADOS (apenas o necessário)
// ============================================================

/**
 * Para exibição em lista pública, retorna apenas campos não-sensíveis.
 */
export function minimizarParaLista(morador: Record<string, unknown>): Record<string, unknown> {
  return {
    id: morador.id,
    nome: morador.nome,
    sexo: morador.sexo,
    data_nascimento: morador.data_nascimento,
    is_hipertenso: morador.is_hipertenso,
    is_diabetico: morador.is_diabetico,
    residencia_id: morador.residencia_id,
  };
}

// ============================================================
// RETENÇÃO DE DADOS
// Dados de saúde: reter por 20 anos (CFM / ANVISA)
// ============================================================

export function calcularDataExpiracao(tipo: 'saude' | 'geral'): string {
  const anos = tipo === 'saude' ? 20 : 5;
  const data = new Date();
  data.setFullYear(data.getFullYear() + anos);
  return data.toISOString();
}

// ============================================================
// FINALIDADE
// Base legal LGPD para este sistema:
// Art. 7°, II — execução de políticas públicas pela administração pública
// Art. 11, II, a — tutela da saúde nos dados sensíveis
// ============================================================

export const BASE_LEGAL_LGPD = {
  ARTIGO: 'Art. 7°, II e Art. 11, II, a da Lei 13.709/2018 (LGPD)',
  FINALIDADE: 'Atenção básica à saúde - Acompanhamento de Agentes Comunitários de Saúde',
  CONTROLADOR: 'Secretaria Municipal de Saúde',
  DPO_CONTATO: 'dpo@secretaria.saude.gov.br',
} as const;
