/**
 * Serviço de exportação de relatórios (CSV e Excel).
 *
 * Escreve com a API de arquivos do Expo SDK 54 (`File` e `Paths`). A API
 * anterior foi removida: `documentDirectory` e `EncodingType` não existem
 * mais, e `writeAsStringAsync` permanece apenas como stub que lança erro em
 * tempo de execução. Quem abrisse a tela de relatórios e tocasse em exportar
 * recebia TypeError antes de qualquer byte ser gravado.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { utils, write } from 'xlsx';
import type { CellObject, WorkSheet } from 'xlsx';
import { VisitaListada } from '../types';
import { formatDate, formatDateTime } from '../utils/formatters';

export type PeriodoRelatorio = 'dia' | 'semana' | 'mes';
export type FormatoRelatorio = 'csv' | 'xlsx';

export interface DadosRelatorio {
  visitas: VisitaListada[];
  periodo: PeriodoRelatorio;
  data_referencia: string;
}

/**
 * Uma coluna do relatório.
 *
 * `tipo` decide como a célula vai para a planilha: data entra como data de
 * verdade, para o Excel ordenar e filtrar pelo calendário. Gravada como
 * texto, "02/11" vinha depois de "13/10" na ordenação.
 */
interface Coluna {
  titulo: string;
  tipo: 'dia' | 'instante' | 'texto';
  largura?: number;
  valor: (v: VisitaListada) => string | undefined;
}

const COLUNAS: Coluna[] = [
  { titulo: 'Data', tipo: 'dia', largura: 12, valor: (v) => v.data_visita },
  // A visita guarda só o dia. Hora que existe de fato é a do registro no
  // aparelho; a coluna "Horário" antiga mostrava 21:00 inventado pelo fuso.
  { titulo: 'Registrado em', tipo: 'instante', largura: 17, valor: (v) => v.created_at },
  { titulo: 'Endereço', tipo: 'texto', valor: enderecoDa },
  { titulo: 'Bairro', tipo: 'texto', valor: (v) => v.bairro },
  { titulo: 'Paciente', tipo: 'texto', valor: (v) => v.morador_nome },
  { titulo: 'Status', tipo: 'texto', valor: (v) => traduzirStatus(v.status) },
  { titulo: 'Motivo', tipo: 'texto', valor: (v) => v.motivo_visita },
  { titulo: 'Queixas', tipo: 'texto', valor: (v) => v.queixas },
  { titulo: 'Observações', tipo: 'texto', valor: (v) => v.observacoes },
  { titulo: 'Agendamento', tipo: 'texto', valor: (v) => (v.precisa_agendamento ? 'Sim' : 'Não') },
  { titulo: 'Especialidade', tipo: 'texto', valor: (v) => v.especialidade_agendamento },
];

const LARGURA_MINIMA = 10;
const LARGURA_MAXIMA = 60;
const FORMATO_DIA = 'dd/mm/yyyy';
const FORMATO_INSTANTE = 'dd/mm/yyyy hh:mm';

export const exportService = {
  /**
   * Exporta visitas como CSV ou Excel e abre o compartilhamento nativo.
   */
  async exportarVisitas(
    dados: DadosRelatorio,
    formato: FormatoRelatorio = 'xlsx'
  ): Promise<void> {
    if (dados.visitas.length === 0) throw new Error('Sem dados para exportar');

    const visitas = ordenarCronologicamente(dados.visitas);
    const nome = `visitas_${dados.periodo}_${dados.data_referencia}`;
    if (formato === 'csv') {
      await exportarCSV(visitas, nome);
    } else {
      await exportarExcel(visitas, dados, nome);
    }
  },
};

// ============================================================
// HELPERS INTERNOS
// ============================================================

/**
 * O endereço vem do JOIN com residências, que `visitaRepository.listar` faz.
 *
 * Antes o repositório descartava essas colunas no mapeamento e a planilha
 * recebia o id da residência, um UUID, no lugar do endereço.
 */
function enderecoDa(v: VisitaListada): string | undefined {
  if (!v.logradouro) return undefined;
  return v.numero ? `${v.logradouro}, ${v.numero}` : v.logradouro;
}

/** Do dia mais antigo para o mais novo; no mesmo dia, pela hora do registro. */
function ordenarCronologicamente(visitas: VisitaListada[]): VisitaListada[] {
  return [...visitas].sort(
    (a, b) =>
      a.data_visita.slice(0, 10).localeCompare(b.data_visita.slice(0, 10)) ||
      a.created_at.localeCompare(b.created_at)
  );
}

/**
 * Grava o arquivo na pasta de documentos e devolve a URI.
 *
 * `write` é síncrono na API nova. Um arquivo que já existe é apagado antes,
 * porque `create` recusa sobrescrever e a pessoa pode exportar o mesmo
 * período duas vezes seguidas.
 */
function gravar(nomeArquivo: string, conteudo: string | Uint8Array): string {
  const arquivo = new File(Paths.document, nomeArquivo);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  arquivo.write(conteudo);
  return arquivo.uri;
}

/**
 * Neutraliza injeção de fórmula no CSV.
 *
 * Excel e LibreOffice executam o conteúdo de uma célula de CSV que começa com
 * `=`, `+`, `-`, `@`, tab ou retorno de carro. Como as queixas e observações
 * são texto livre digitado pelo agente em campo, um valor como
 * `=HYPERLINK("http://...&"&A1)` vazaria a linha inteira para fora no momento
 * em que alguém da secretaria abrisse o relatório. O apóstrofo faz a planilha
 * tratar como texto.
 *
 * No .xlsx isto não é usado: lá cada célula é gravada com o tipo texto
 * declarado, e o Excel não interpreta texto como fórmula. O apóstrofo
 * aplicado no .xlsx aparecia na célula, e todo campo vazio saía como `'-`.
 */
function neutralizarFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

function textoDaCelula(coluna: Coluna, v: VisitaListada): string {
  const bruto = coluna.valor(v);
  if (!bruto) return '';
  if (coluna.tipo === 'dia') return formatDate(bruto.slice(0, 10));
  if (coluna.tipo === 'instante') return formatDateTime(bruto);
  return bruto;
}

async function exportarCSV(visitas: VisitaListada[], nomeArquivo: string): Promise<void> {
  const cabecalho = COLUNAS.map((c) => c.titulo).join(';');
  const linhas = visitas.map((v) =>
    COLUNAS.map((c) => `"${neutralizarFormula(textoDaCelula(c, v)).replace(/"/g, '""')}"`).join(';')
  );
  const csv = [cabecalho, ...linhas].join('\n');
  const bom = '﻿'; // BOM para Excel reconhecer UTF-8

  const uri = gravar(`${nomeArquivo}.csv`, bom + csv);
  await compartilharArquivo(uri, 'text/csv');
}

// ------------------------------------------------------------
// Excel
// ------------------------------------------------------------

const DIAS_ATE_1970 = 25569; // 30/12/1899 (dia zero do Excel) até 01/01/1970
const MS_POR_DIA = 86_400_000;

/**
 * `2026-10-13` como número de série do Excel, sem passar pelo fuso.
 *
 * `new Date('2026-10-13')` é meia-noite UTC, que no Brasil é o dia 12 às 21h.
 * Montar a data pelos campos do texto evita o dia anterior.
 */
function serialDoDia(iso: string): number | null {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return Date.UTC(ano, mes - 1, dia) / MS_POR_DIA + DIAS_ATE_1970;
}

/** Instante gravado em UTC, mostrado na hora local de quem exporta. */
function serialDoInstante(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const local = Date.UTC(
    d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()
  );
  return local / MS_POR_DIA + DIAS_ATE_1970;
}

function celula(coluna: Coluna, v: VisitaListada): CellObject | null {
  const bruto = coluna.valor(v);
  if (!bruto) return null;
  if (coluna.tipo !== 'texto') {
    const serial = coluna.tipo === 'dia' ? serialDoDia(bruto) : serialDoInstante(bruto);
    if (serial !== null) {
      return { t: 'n', v: serial, z: coluna.tipo === 'dia' ? FORMATO_DIA : FORMATO_INSTANTE };
    }
  }
  return { t: 's', v: bruto };
}

/** Letra da coluna (0 → A). O relatório tem bem menos de 26 colunas. */
function letra(indice: number): string {
  return String.fromCharCode(65 + indice);
}

/** Largura de cada coluna pelo maior texto dela, dentro de um limite. */
function larguras(visitas: VisitaListada[]): { wch: number }[] {
  return COLUNAS.map((c) => {
    if (c.largura) return { wch: c.largura };
    const maior = Math.max(c.titulo.length, ...visitas.map((v) => (c.valor(v) ?? '').length));
    return { wch: Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, maior + 2)) };
  });
}

function abaDeVisitas(visitas: VisitaListada[]): WorkSheet {
  const linhas = [
    COLUNAS.map((c) => c.titulo),
    ...visitas.map((v) => COLUNAS.map((c) => celula(c, v))),
  ];
  const aba = utils.aoa_to_sheet(linhas);
  aba['!cols'] = larguras(visitas);
  aba['!autofilter'] = { ref: `A1:${letra(COLUNAS.length - 1)}${visitas.length + 1}` };
  return aba;
}

function abaDeResumo(visitas: VisitaListada[], dados: DadosRelatorio): WorkSheet {
  const porStatus = new Map<string, number>();
  for (const v of visitas) {
    const status = traduzirStatus(v.status);
    porStatus.set(status, (porStatus.get(status) ?? 0) + 1);
  }
  const agendar = visitas.filter((v) => v.precisa_agendamento).length;
  const primeiro = visitas[0].data_visita;
  const ultimo = visitas[visitas.length - 1].data_visita;

  const linhas: (string | number | CellObject)[][] = [
    ['Relatório de visitas'],
    [],
    ['Período', traduzirPeriodo(dados.periodo)],
    ['Primeira visita', celulaDeDia(primeiro)],
    ['Última visita', celulaDeDia(ultimo)],
    ['Gerado em', { t: 'n', v: serialDoInstante(new Date().toISOString()) ?? 0, z: FORMATO_INSTANTE }],
    [],
    ['Total de visitas', visitas.length],
    ...[...porStatus.entries()].map(([status, total]) => [status, total]),
    ['Precisam de agendamento', agendar],
  ];
  const aba = utils.aoa_to_sheet(linhas);
  aba['!cols'] = [{ wch: 26 }, { wch: 18 }];
  return aba;
}

function celulaDeDia(iso: string): CellObject {
  const serial = serialDoDia(iso);
  return serial === null ? { t: 's', v: iso } : { t: 'n', v: serial, z: FORMATO_DIA };
}

async function exportarExcel(
  visitas: VisitaListada[],
  dados: DadosRelatorio,
  nomeArquivo: string
): Promise<void> {
  const wb = utils.book_new();
  utils.book_append_sheet(wb, abaDeVisitas(visitas), `Visitas - ${traduzirPeriodo(dados.periodo)}`);
  utils.book_append_sheet(wb, abaDeResumo(visitas, dados), 'Resumo');

  // `type: 'array'` devolve ArrayBuffer, que é o que a API nova grava como
  // binário. O caminho antigo passava por base64 e dependia de EncodingType,
  // que não existe mais.
  const buffer = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  const uri = gravar(`${nomeArquivo}.xlsx`, new Uint8Array(buffer));
  await compartilharArquivo(
    uri,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

async function compartilharArquivo(uri: string, mimeType: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Compartilhamento não disponível neste dispositivo');
  await Sharing.shareAsync(uri, { mimeType, UTI: mimeType });
}

function traduzirStatus(status: string): string {
  const map: Record<string, string> = {
    realizada: 'Realizada',
    agendada: 'Agendada',
    cancelada: 'Cancelada',
    nao_encontrado: 'Não encontrado',
  };
  return map[status] ?? status;
}

function traduzirPeriodo(periodo: PeriodoRelatorio): string {
  const map: Record<PeriodoRelatorio, string> = {
    dia: 'Diário',
    semana: 'Semanal',
    mes: 'Mensal',
  };
  return map[periodo];
}
