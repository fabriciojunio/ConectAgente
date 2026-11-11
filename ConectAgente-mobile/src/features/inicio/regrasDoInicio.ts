import type { EstatisticasVisitas } from '../../types';

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora do aparelho. */
export function saudacao(hora: number): string {
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Duas letras para o avatar: primeira e última palavra do nome. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** "Quarta-feira, 11 de novembro", com a primeira letra maiúscula. */
export function dataPorExtenso(data: Date): string {
  const texto = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface ResumoDaMeta {
  temMeta: boolean;
  /** De 0 a 100. */
  percentual: number;
  texto: string;
}

/**
 * Como a meta do mês aparece no cartão do Início.
 *
 * Agente sem meta cadastrada é o caso comum, não a exceção: a meta vem da
 * coordenação e pode demorar a chegar. A tela mostrava "1 de 0 visitas
 * realizadas" e uma barra parada em 0%, que lê como se ele estivesse devendo
 * trabalho quando ninguém pediu nada.
 */
export function resumoDaMeta(stats: EstatisticasVisitas | null): ResumoDaMeta {
  if (!stats) return { temMeta: false, percentual: 0, texto: 'Carregando meta...' };

  const temMeta = stats.meta_mensal > 0;
  if (temMeta) {
    return {
      temMeta,
      percentual: Math.min(stats.percentual_meta, 100),
      texto: `${stats.realizadas_mes} de ${stats.meta_mensal} visitas realizadas`,
    };
  }
  const texto =
    stats.realizadas_mes === 1 ? '1 visita realizada neste mês' : `${stats.realizadas_mes} visitas realizadas neste mês`;
  return { temMeta, percentual: 0, texto };
}
