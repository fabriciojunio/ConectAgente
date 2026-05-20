/**
 * Serviço de exportação de relatórios (CSV e Excel).
 * Usa biblioteca xlsx + expo-file-system + expo-sharing.
 */
import * as FileSystem from 'expo-file-system';
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
      'Horário': formatDateTime(v.data_visita),
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

    if (formato === 'csv') {
      await exportarCSV(linhas, `visitas_${dados.periodo}_${dados.data_referencia}`);
    } else {
      await exportarExcel(linhas, `Visitas - ${traduzirPeriodo(dados.periodo)}`, `visitas_${dados.periodo}_${dados.data_referencia}`);
    }
  },

  /**
   * Exporta moradores/pacientes como Excel.
   */
  async exportarPacientes(moradores: Record<string, unknown>[]): Promise<void> {
    const linhas = moradores.map((m) => ({
      'Nome': m.nome,
      'CPF': m.cpf ?? '-',
      'Cartão SUS': m.cartao_sus ?? '-',
      'Data Nasc.': m.data_nascimento ? formatDate(m.data_nascimento as string) : '-',
      'Sexo': m.sexo,
      'Telefone': m.telefone ?? '-',
      'Hipertenso': '-',
      'Diabético': '-',
      'Bolsa Família': m.beneficio_bolsa_familia ? 'Sim' : 'Não',
    }));

    await exportarExcel(linhas, 'Pacientes', `pacientes_${new Date().toISOString().split('T')[0]}`);
  },
};

// ============================================================
// HELPERS INTERNOS
// ============================================================

async function exportarCSV(
  dados: Record<string, unknown>[],
  nomeArquivo: string
): Promise<void> {
  if (dados.length === 0) throw new Error('Sem dados para exportar');

  const headers = Object.keys(dados[0]).join(';');
  const rows = dados.map((row) =>
    Object.values(row)
      .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
      .join(';')
  );
  const csv = [headers, ...rows].join('\n');
  const bom = '\uFEFF'; // BOM para Excel reconhecer UTF-8

  const path = `${FileSystem.documentDirectory}${nomeArquivo}.csv`;
  await FileSystem.writeAsStringAsync(path, bom + csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await compartilharArquivo(path, 'text/csv');
}

async function exportarExcel(
  dados: Record<string, unknown>[],
  nomeAba: string,
  nomeArquivo: string
): Promise<void> {
  if (dados.length === 0) throw new Error('Sem dados para exportar');

  const ws = utils.json_to_sheet(dados);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, nomeAba);

  const wbout = write(wb, { type: 'base64', bookType: 'xlsx' });

  const path = `${FileSystem.documentDirectory}${nomeArquivo}.xlsx`;
  await FileSystem.writeAsStringAsync(path, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await compartilharArquivo(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

async function compartilharArquivo(path: string, mimeType: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Compartilhamento não disponível neste dispositivo');
  await Sharing.shareAsync(path, { mimeType, UTI: mimeType });
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
