import { NivelVulnerabilidade } from '../../types';

/** Gestação humana passa pouco de 42 semanas; acima de 45 é erro de digitação. */
const SEMANAS_MAXIMAS = 45;

/**
 * Converte o campo "Semanas de gestação" do formulário para o banco.
 *
 * O campo é texto, e a coluna é número no aparelho e no servidor. Gravado
 * como estava, o campo vazio virava '' na coluna de número: o SQLite aceita,
 * mas a sincronização para o PostgreSQL falha com "invalid input syntax for
 * type integer". Vazio, não numérico ou fora da faixa vira "não informado".
 */
export function semanasDeGestacao(texto: string | undefined): number | undefined {
  const limpo = (texto ?? '').trim();
  if (!limpo) return undefined;
  const semanas = Number(limpo);
  return Number.isInteger(semanas) && semanas >= 0 && semanas <= SEMANAS_MAXIMAS ? semanas : undefined;
}

const NIVEIS: readonly string[] = Object.values(NivelVulnerabilidade);

/** Nível de vulnerabilidade vindo do seletor; valor desconhecido vira "nenhum", nunca texto livre. */
export function nivelDeVulnerabilidade(valor: string | undefined): NivelVulnerabilidade {
  return NIVEIS.includes(valor ?? '') ? (valor as NivelVulnerabilidade) : NivelVulnerabilidade.NENHUM;
}
