/**
 * Montagem das planilhas exportadas pelo painel.
 *
 * Separado do download para dar para testar o arquivo de verdade: o teste
 * gera o livro com o `xlsx` real e lê de volta.
 *
 * O que a planilha antiga fazia de errado:
 * - toda célula virava texto, inclusive número e data. "Total Visitas" não
 *   somava e a coluna Data ordenava "02/11" depois de "13/10";
 * - o apóstrofo contra injeção de fórmula aparecia na célula, e todo campo
 *   vazio saía como `'-`;
 * - sem filtro no cabeçalho e com coluna de observação larga sem limite.
 */
import type { CellObject, WorkBook, WorkSheet } from 'xlsx';

type ModuloXlsx = typeof import('xlsx');

export interface ColunaPlanilha {
  header: string;
  key: string;
}

/** Linhas da aba "Informações": rótulo e valor. */
export type InformacaoPlanilha = [string, string | number];

const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const FORMATO_DATA = 'dd/mm/yyyy';
const DIAS_ATE_1970 = 25569; // 30/12/1899 (dia zero do Excel) até 01/01/1970
const MS_POR_DIA = 86_400_000;
const LARGURA_MINIMA = 10;
const LARGURA_MAXIMA = 60;
const LIMITE_NOME_ABA = 31; // limite do Excel

/**
 * Converte um valor do relatório em célula tipada.
 *
 * Texto entra como texto declarado (`t: 's'`), e o Excel não interpreta texto
 * declarado como fórmula, então `=HYPERLINK(...)` digitado numa observação
 * aparece como foi digitado, sem executar e sem apóstrofo. A neutralização
 * com apóstrofo continua valendo no CSV, onde não existe tipo de célula.
 */
export function celulaDaPlanilha(valor: unknown): CellObject | null {
  if (valor == null || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? { t: 'n', v: valor } : null;
  if (typeof valor === 'boolean') return { t: 's', v: valor ? 'Sim' : 'Não' };

  const texto = String(valor);
  const data = DATA_BR.exec(texto);
  if (data) {
    // Montada pelos campos, sem `new Date`, para não cair no dia anterior.
    const serial = Date.UTC(Number(data[3]), Number(data[2]) - 1, Number(data[1])) / MS_POR_DIA;
    return { t: 'n', v: serial + DIAS_ATE_1970, z: FORMATO_DATA };
  }
  return { t: 's', v: texto };
}

/** Letra da coluna do Excel (0 → A, 26 → AA). */
function letraDaColuna(indice: number): string {
  let letras = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letras = String.fromCharCode(65 + ((n - 1) % 26)) + letras;
  }
  return letras;
}

function larguraDe(coluna: ColunaPlanilha, linhas: Record<string, unknown>[]): number {
  const maior = Math.max(
    coluna.header.length,
    ...linhas.map((l) => (l[coluna.key] == null ? 0 : String(l[coluna.key]).length))
  );
  return Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, maior + 2));
}

function abaDeDados(
  XLSX: ModuloXlsx,
  linhas: Record<string, unknown>[],
  colunas: ColunaPlanilha[]
): WorkSheet {
  const aba = XLSX.utils.aoa_to_sheet([
    colunas.map((c) => c.header),
    ...linhas.map((l) => colunas.map((c) => celulaDaPlanilha(l[c.key]))),
  ]);
  aba['!cols'] = colunas.map((c) => ({ wch: larguraDe(c, linhas) }));
  aba['!autofilter'] = {
    ref: `A1:${letraDaColuna(colunas.length - 1)}${Math.max(linhas.length, 1) + 1}`,
  };
  return aba;
}

function abaDeInformacoes(
  XLSX: ModuloXlsx,
  titulo: string,
  totalDeLinhas: number,
  informacoes: InformacaoPlanilha[],
  geradoEm: string
): WorkSheet {
  const aba = XLSX.utils.aoa_to_sheet([
    [titulo],
    [],
    ['Gerado em', geradoEm],
    ...informacoes,
    ['Total de registros', totalDeLinhas],
  ]);
  aba['!cols'] = [{ wch: 24 }, { wch: 40 }];
  return aba;
}

/**
 * Livro com a aba de dados e a aba "Informações" (filtros e totais).
 *
 * A aba de dados vem primeiro, porque é ela que a pessoa quer ver ao abrir.
 */
export function montarPlanilha(
  XLSX: ModuloXlsx,
  linhas: Record<string, unknown>[],
  titulo: string,
  colunas: ColunaPlanilha[],
  informacoes: InformacaoPlanilha[],
  geradoEm: string
): WorkBook {
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    livro,
    abaDeDados(XLSX, linhas, colunas),
    titulo.substring(0, LIMITE_NOME_ABA)
  );
  XLSX.utils.book_append_sheet(
    livro,
    abaDeInformacoes(XLSX, titulo, linhas.length, informacoes, geradoEm),
    'Informações'
  );
  return livro;
}
