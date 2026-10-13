/**
 * Testes da contagem de visitas do dia.
 *
 * O defeito apareceu em uso real, no emulador, com uma visita só: a tela
 * inicial mostrava "Hoje 0" ao lado de "Semana 1", minutos depois de a visita
 * ter sido registrada e de ela aparecer na lista com a data de hoje.
 *
 * A causa. `visitas.data_visita` guarda só a data, `2026-10-13`, porque é o
 * que `parseDateBR` produz a partir do campo da tela. A consulta comparava
 * contra `new Date(ano, mes, dia).toISOString()`, que monta a meia-noite
 * local e devolve em UTC: no fuso do Brasil, `2026-10-13T03:00:00.000Z`.
 *
 * SQLite compara texto caractere a caractere. Os dez primeiros são iguais, aí
 * a string da esquerda acaba, e a mais curta é considerada menor. Então
 * `'2026-10-13' >= '2026-10-13T03:00:00.000Z'` é falso.
 *
 * O contador da semana escondia tudo: contra `'2026-10-11T03:00...'` a
 * comparação resolve no dígito do dia e dá verdadeiro, então aquele número
 * aparecia certo e ninguém suspeitava do outro.
 *
 * É uma armadilha de leitura de dado no estado puro: nenhuma exceção em lugar
 * nenhum, nenhum log, só um número menor que continua plausível.
 */
import { apenasData } from '../../utils/formatters';

/** A comparação de texto que o SQLite faz num `>=` entre colunas TEXT. */
function sqliteMaiorOuIgual(esquerda: string, direita: string): boolean {
  return esquerda >= direita;
}

/** O jeito antigo, que causava o defeito. Fica aqui como documento. */
function inicioDoDiaEmUTC(data: Date): string {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).toISOString();
}

const DATA_GRAVADA = '2026-10-13';
const HOJE = new Date(2026, 9, 13, 14, 30);

describe('apenasData', () => {
  it('devolve a data local em AAAA-MM-DD', () => {
    expect(apenasData(HOJE)).toBe('2026-10-13');
  });

  it.each([
    [new Date(2026, 0, 1), '2026-01-01'],
    [new Date(2026, 11, 31), '2026-12-31'],
    [new Date(2026, 8, 5), '2026-09-05'],
  ])('preenche mês e dia com zero à esquerda: %s', (data, esperado) => {
    expect(apenasData(data)).toBe(esperado);
  });

  it('não muda de dia por causa do fuso, que é o que o toISOString faz', () => {
    // Meia-noite e meia da manhã: o `toISOString` do jeito antigo soma o fuso
    // e, a leste de Greenwich, joga para o dia anterior.
    const madrugada = new Date(2026, 9, 13, 0, 30);
    expect(apenasData(madrugada)).toBe('2026-10-13');
  });

  it('não leva hora nem fuso grudados', () => {
    expect(apenasData(HOJE)).not.toContain('T');
    expect(apenasData(HOJE)).not.toContain('Z');
    expect(apenasData(HOJE)).toHaveLength(10);
  });
});

describe('a comparação que o banco faz', () => {
  it('o jeito antigo deixa a visita de hoje de fora', () => {
    // O valor literal que o `toISOString()` produzia na máquina de quem
    // desenvolve, no fuso do Brasil. Escrito à mão de propósito: a primeira
    // versão deste teste chamava `inicioDoDiaEmUTC(HOJE)` e comparava com esta
    // string, e aí passava aqui e quebrava no CI, que roda em UTC e devolve
    // `T00:00:00.000Z`. Um teste que só vale no fuso de quem escreveu não
    // prova nada sobre o defeito.
    const limiteAntigo = '2026-10-13T03:00:00.000Z';

    expect(sqliteMaiorOuIgual(DATA_GRAVADA, limiteAntigo)).toBe(false);
  });

  it('o jeito antigo gruda hora e fuso numa coluna que só tem data', () => {
    // Esta parte vale em qualquer fuso: seja qual for o deslocamento, o que
    // sai do `toISOString()` tem 24 caracteres e a coluna guarda 10. É a
    // diferença de formato que causa o defeito, e é ela que o teste trava.
    const limiteAntigo = inicioDoDiaEmUTC(HOJE);

    expect(limiteAntigo).toContain('T');
    expect(limiteAntigo).toContain('Z');
    expect(limiteAntigo.length).toBeGreaterThan(DATA_GRAVADA.length);
  });

  it('o jeito novo conta a visita de hoje', () => {
    expect(sqliteMaiorOuIgual(DATA_GRAVADA, apenasData(HOJE))).toBe(true);
  });

  it('a semana contava certo, e era isso que escondia o defeito', () => {
    // Domingo da semana do dia 13 é o dia 11.
    const inicioSemanaAntigo = inicioDoDiaEmUTC(new Date(2026, 9, 11));

    expect(sqliteMaiorOuIgual(DATA_GRAVADA, inicioSemanaAntigo)).toBe(true);
    expect(sqliteMaiorOuIgual(DATA_GRAVADA, apenasData(new Date(2026, 9, 11)))).toBe(true);
  });

  it('o fim do mês continua incluindo o último dia', () => {
    // `new Date(ano, mes + 1, 0)` é o último dia do mês corrente.
    const ultimoDia = apenasData(new Date(2026, 10, 0));

    expect(ultimoDia).toBe('2026-10-31');
    expect(sqliteMaiorOuIgual('2026-10-31', ultimoDia)).toBe(true);
    expect(sqliteMaiorOuIgual('2026-11-01', ultimoDia)).toBe(true);
  });

  it('visita de ontem não entra na contagem de hoje', () => {
    expect(sqliteMaiorOuIgual('2026-10-12', apenasData(HOJE))).toBe(false);
  });
});

describe('a consulta de estatísticas', () => {
  it('não usa toISOString para comparar com coluna de data', () => {
    const fonte = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'repositories', 'visitaRepository.ts'),
      'utf-8'
    ) as string;

    const semComentario = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    const estatisticas = semComentario.slice(semComentario.indexOf('async estatisticas'));
    const ateOFim = estatisticas.slice(0, estatisticas.indexOf('\n  },'));

    expect(ateOFim).not.toContain('toISOString');
    expect(ateOFim).toContain('apenasData');
  });
});
