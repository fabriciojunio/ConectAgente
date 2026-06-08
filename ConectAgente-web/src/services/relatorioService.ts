'use client';

import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type {
  RelatorioFiltros,
  VisitaComDetalhes,
  AgenteComEstatisticas,
  ResidenciaComDetalhes,
  CoberturaMicroarea,
  GlobalFilters,
} from '@/types';

/**
 * Gera dados de relatório de visitas com base nos filtros informados.
 */
export async function gerarRelatorioVisitas(
  filtros: RelatorioFiltros
): Promise<VisitaComDetalhes[]> {
  try {
    const supabase = createClient();

    let query = supabase
      .from('visitas')
      .select(
        `*, agente:agentes(id, nome, area_atuacao), residencia:residencias(id, logradouro, numero, bairro, cidade), morador:moradores(id, nome, cpf)`
      );

    if (filtros.periodo_inicio) {
      query = query.gte('data_visita', filtros.periodo_inicio);
    }
    if (filtros.periodo_fim) {
      query = query.lte('data_visita', filtros.periodo_fim);
    }
    if (filtros.agente_id) {
      query = query.eq('agente_id', filtros.agente_id);
    }
    if (filtros.bairro) {
      query = query.eq('residencia.bairro', filtros.bairro);
    }

    query = query.order('data_visita', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao gerar relatório de visitas: ${error.message}`);
    }

    return (data as unknown as VisitaComDetalhes[]) ?? [];
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao gerar relatório de visitas');
  }
}

/**
 * Gera dados de relatório de agentes com base nos filtros informados.
 */
export async function gerarRelatorioAgentes(
  filtros: RelatorioFiltros
): Promise<AgenteComEstatisticas[]> {
  try {
    const supabase = createClient();

    let query = supabase
      .from('agentes')
      .select('*')
      .eq('ativo', true);

    if (filtros.unidade_saude) {
      query = query.eq('unidade_saude', filtros.unidade_saude);
    }

    query = query.order('nome', { ascending: true });

    const { data: agentes, error } = await query;

    if (error) {
      throw new Error(`Erro ao gerar relatório de agentes: ${error.message}`);
    }

    if (!agentes || agentes.length === 0) return [];

    const agenteIds = agentes.map((a) => a.id);

    let visitasQuery = supabase
      .from('visitas')
      .select('agente_id, status')
      .in('agente_id', agenteIds);

    if (filtros.periodo_inicio) {
      visitasQuery = visitasQuery.gte('data_visita', filtros.periodo_inicio);
    }
    if (filtros.periodo_fim) {
      visitasQuery = visitasQuery.lte('data_visita', filtros.periodo_fim);
    }

    const { data: visitas, error: visitasError } = await visitasQuery;

    if (visitasError) {
      throw new Error(`Erro ao buscar visitas dos agentes: ${visitasError.message}`);
    }

    const statsMap = new Map<string, { total: number; realizadas: number }>();

    for (const v of visitas ?? []) {
      const s = statsMap.get(v.agente_id) ?? { total: 0, realizadas: 0 };
      s.total++;
      if (v.status === 'realizada') s.realizadas++;
      statsMap.set(v.agente_id, s);
    }

    return agentes.map((agente) => {
      const s = statsMap.get(agente.id) ?? { total: 0, realizadas: 0 };
      return {
        ...agente,
        total_visitas: s.total,
        visitas_realizadas: s.realizadas,
        taxa_conclusao:
          s.total > 0
            ? Math.round((s.realizadas / s.total) * 10000) / 100
            : 0,
      } as AgenteComEstatisticas;
    });
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao gerar relatório de agentes');
  }
}

/**
 * Gera dados de relatório de famílias com base nos filtros informados.
 */
export async function gerarRelatorioFamilias(
  filtros: RelatorioFiltros
): Promise<ResidenciaComDetalhes[]> {
  try {
    const supabase = createClient();

    let query = supabase
      .from('residencias')
      .select(`*, agente:agentes(id, nome, area_atuacao), moradores(*)`)
      .is('deleted_at', null);

    if (filtros.bairro) {
      query = query.eq('bairro', filtros.bairro);
    }
    if (filtros.agente_id) {
      query = query.eq('agente_id', filtros.agente_id);
    }
    if (filtros.unidade_saude) {
      query = query.eq('unidade_saude', filtros.unidade_saude);
    }

    query = query.order('logradouro', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao gerar relatório de famílias: ${error.message}`);
    }

    return (data as unknown as ResidenciaComDetalhes[]) ?? [];
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao gerar relatório de famílias');
  }
}

/**
 * Gera dados de relatório de cobertura por microárea.
 */
export async function gerarRelatorioCobertura(
  filtros: RelatorioFiltros
): Promise<CoberturaMicroarea[]> {
  try {
    const supabase = createClient();

    const params: Record<string, unknown> = {};
    if (filtros.unidade_saude) params.p_unidade = filtros.unidade_saude;

    const { data, error } = await supabase.rpc(
      'fn_cobertura_por_microarea',
      params
    );

    if (error) {
      throw new Error(`Erro ao gerar relatório de cobertura: ${error.message}`);
    }

    return (data as CoberturaMicroarea[]) ?? [];
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao gerar relatório de cobertura');
  }
}

/**
 * Exporta dados em formato PDF e dispara o download.
 * @param dados Array de objetos com os dados
 * @param titulo Título do relatório
 * @param colunas Definição das colunas (header e key)
 */
export function exportarPDF(
  dados: unknown[],
  titulo: string,
  colunas: { header: string; key: string }[]
): void {
  try {
    const doc = new jsPDF();

    // Cabeçalho
    doc.setFontSize(16);
    doc.text(titulo, 14, 20);

    doc.setFontSize(10);
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      14,
      28
    );

    // Tabela
    const headers = colunas.map((c) => c.header);
    const rows = dados.map((item) => {
      const row = item as Record<string, unknown>;
      return colunas.map((c) => {
        const value = row[c.key];
        return value != null ? String(value) : '';
      });
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    const nomeArquivo = `${titulo.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    doc.save(nomeArquivo);
  } catch (err) {
    throw new Error(
      `Erro ao exportar PDF: ${err instanceof Error ? err.message : 'erro desconhecido'}`
    );
  }
}

/**
 * Exporta dados em formato Excel (.xlsx) e dispara o download.
 * @param dados Array de objetos com os dados
 * @param titulo Título do relatório (usado como nome da aba e do arquivo)
 * @param colunas Definição das colunas (header e key)
 */
export function exportarExcel(
  dados: unknown[],
  titulo: string,
  colunas: { header: string; key: string }[]
): void {
  try {
    const headers = colunas.map((c) => c.header);
    const rows = dados.map((item) => {
      const row = item as Record<string, unknown>;
      return colunas.map((c) => {
        const value = row[c.key];
        return value != null ? value : '';
      });
    });

    const worksheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Ajusta largura das colunas
    const colWidths = colunas.map((c) => ({
      wch: Math.max(
        c.header.length,
        ...rows.map((r) => String(r[colunas.indexOf(c)] ?? '').length)
      ) + 2,
    }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    const sheetName = titulo.substring(0, 31); // Excel limita a 31 caracteres
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const nomeArquivo = `${titulo.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, nomeArquivo);
  } catch (err) {
    throw new Error(
      `Erro ao exportar Excel: ${err instanceof Error ? err.message : 'erro desconhecido'}`
    );
  }
}

/**
 * Exporta dados em formato CSV e dispara o download.
 * @param dados Array de objetos com os dados
 * @param titulo Título do relatório (usado como nome do arquivo)
 * @param colunas Definição das colunas (header e key)
 */
export function exportarCSV(
  dados: unknown[],
  titulo: string,
  colunas: { header: string; key: string }[]
): void {
  try {
    const headers = colunas.map((c) => c.header);

    const rows = dados.map((item) => {
      const row = item as Record<string, unknown>;
      return colunas
        .map((c) => {
          const value = row[c.key];
          if (value == null) return '';
          const str = String(value);
          // Escapa valores que contêm vírgula, aspas ou quebra de linha
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Adiciona BOM para UTF-8 (garante acentos no Excel)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const nomeArquivo = `${titulo.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    throw new Error(
      `Erro ao exportar CSV: ${err instanceof Error ? err.message : 'erro desconhecido'}`
    );
  }
}

type ReportType = 'visitas' | 'agentes' | 'familias' | 'cobertura' | 'atrasos';
type ExportFormat = 'pdf' | 'excel' | 'csv';

/**
 * Unified report generator. Fetches data, triggers file download, and returns preview rows.
 */
export async function gerarRelatorio(
  tipo: ReportType,
  formato: ExportFormat,
  filters?: GlobalFilters,
): Promise<{
  preview: { data: Array<Record<string, unknown>>; columns: string[] };
  downloadUrl?: string;
}> {
  const filtros: RelatorioFiltros = {
    tipo,
    formato,
    periodo_inicio: filters?.periodo_inicio ?? '',
    periodo_fim: filters?.periodo_fim ?? '',
    unidade_saude: filters?.unidade_saude,
    agente_id: filters?.agente_id,
    bairro: filters?.bairro,
  };

  let data: Array<Record<string, unknown>> = [];
  let columns: string[] = [];
  let titulo = '';

  if (tipo === 'visitas') {
    titulo = 'Relatório de Visitas';
    columns = ['Data', 'Agente', 'Status', 'Logradouro', 'Bairro', 'Observações'];
    const rows = await gerarRelatorioVisitas(filtros);
    data = rows.map((r) => {
      const res = r.residencia as Record<string, unknown> | null | undefined;
      const ag = r.agente as Record<string, unknown> | null | undefined;
      return {
        'Data': r.data_visita
          ? format(new Date(r.data_visita + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })
          : '-',
        'Agente': ag?.nome ?? '-',
        'Status': r.status,
        'Logradouro': res ? `${res.logradouro}, ${res.numero}` : '-',
        'Bairro': res?.bairro ?? '-',
        'Observações': r.observacoes ?? '-',
      };
    });
  } else if (tipo === 'agentes') {
    titulo = 'Relatório de Agentes';
    columns = ['Nome', 'Unidade', 'Microárea', 'Total Visitas', 'Realizadas', 'Taxa (%)'];
    const rows = await gerarRelatorioAgentes(filtros);
    data = rows.map((r) => {
      const ag = r as unknown as Record<string, unknown>;
      return {
        'Nome': r.nome,
        'Unidade': ag.unidade_saude ?? '-',
        'Microárea': ag.microarea ?? '-',
        'Total Visitas': r.total_visitas ?? 0,
        'Realizadas': r.visitas_realizadas ?? 0,
        'Taxa (%)': r.taxa_conclusao ?? 0,
      };
    });
  } else if (tipo === 'familias') {
    titulo = 'Relatório de Famílias';
    columns = ['Logradouro', 'Número', 'Bairro', 'Agente', 'Moradores'];
    const rows = await gerarRelatorioFamilias(filtros);
    data = rows.map((r) => {
      const res = r as unknown as Record<string, unknown>;
      const ag = r.agente as Record<string, unknown> | null | undefined;
      const moradores = Array.isArray(res.moradores) ? (res.moradores as unknown[]).length : 0;
      return {
        'Logradouro': res.logradouro ?? '-',
        'Número': res.numero ?? '-',
        'Bairro': res.bairro ?? '-',
        'Agente': ag?.nome ?? '-',
        'Moradores': moradores,
      };
    });
  } else if (tipo === 'cobertura') {
    titulo = 'Relatório de Cobertura';
    columns = ['Microárea', 'Total Famílias', 'Visitadas (30d)', 'Cobertura (%)'];
    const rows = await gerarRelatorioCobertura(filtros);
    data = rows.map((r) => ({
      'Microárea': r.microarea,
      'Total Famílias': r.total_familias,
      'Visitadas (30d)': r.familias_visitadas_30d,
      'Cobertura (%)': r.cobertura_pct,
    }));
  } else {
    // atrasos
    titulo = 'Relatório de Famílias em Atraso';
    columns = ['Família', 'Bairro', 'Agente', 'Dias s/ Visita', 'Criticidade'];
    const { getFamiliasEmAtraso } = await import('./familiaService');
    const rows = await getFamiliasEmAtraso(0, filters);
    data = rows.map((r) => ({
      'Família': r.endereco,
      'Bairro': r.bairro ?? '-',
      'Agente': r.agente_nome ?? '-',
      'Dias s/ Visita': r.dias_sem_visita,
      'Criticidade': r.nivel_criticidade,
    }));
  }

  const colDefs = columns.map((c) => ({ header: c, key: c }));

  if (formato === 'pdf') {
    exportarPDF(data, titulo, colDefs);
  } else if (formato === 'excel') {
    exportarExcel(data, titulo, colDefs);
  } else {
    exportarCSV(data, titulo, colDefs);
  }

  return { preview: { data, columns } };
}
