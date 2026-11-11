import type { EstatisticasVisitas } from '../../../types';
import { dataPorExtenso, iniciais, resumoDaMeta, saudacao } from '../regrasDoInicio';

const estatisticas = (parcial: Partial<EstatisticasVisitas>): EstatisticasVisitas =>
  ({
    realizadas_hoje: 0,
    realizadas_semana: 0,
    realizadas_mes: 0,
    total_realizadas: 0,
    total_agendadas: 0,
    meta_mensal: 0,
    percentual_meta: 0,
    ...parcial,
  }) as EstatisticasVisitas;

describe('saudacao', () => {
  it.each([
    [0, 'Bom dia'],
    [11, 'Bom dia'],
    [12, 'Boa tarde'],
    [17, 'Boa tarde'],
    [18, 'Boa noite'],
    [23, 'Boa noite'],
  ])('às %ih diz "%s"', (hora, esperado) => {
    expect(saudacao(hora)).toBe(esperado);
  });
});

describe('iniciais', () => {
  it('usa a primeira e a última palavra', () => {
    expect(iniciais('Fabrício Júnio Almeida Dias')).toBe('FD');
  });
  it('com um nome só, usa as duas primeiras letras', () => {
    expect(iniciais('Camila')).toBe('CA');
  });
  it('ignora espaços repetidos e nas pontas', () => {
    expect(iniciais('  Ana   Souza ')).toBe('AS');
  });
});

describe('dataPorExtenso', () => {
  it('escreve o dia da semana com letra maiúscula', () => {
    expect(dataPorExtenso(new Date(2026, 10, 11, 9))).toBe('Quarta-feira, 11 de novembro');
  });
});

describe('resumoDaMeta', () => {
  it('enquanto carrega, avisa e não mostra barra', () => {
    expect(resumoDaMeta(null)).toEqual({ temMeta: false, percentual: 0, texto: 'Carregando meta...' });
  });

  it('sem meta cadastrada, mostra só o que foi feito, sem "de 0"', () => {
    expect(resumoDaMeta(estatisticas({ realizadas_mes: 1 })).texto).toBe('1 visita realizada neste mês');
    expect(resumoDaMeta(estatisticas({ realizadas_mes: 4 })).texto).toBe('4 visitas realizadas neste mês');
    expect(resumoDaMeta(estatisticas({ realizadas_mes: 4 })).temMeta).toBe(false);
  });

  it('com meta, mostra o andamento e o percentual', () => {
    const resumo = resumoDaMeta(estatisticas({ realizadas_mes: 30, meta_mensal: 120, percentual_meta: 25 }));
    expect(resumo).toEqual({ temMeta: true, percentual: 25, texto: '30 de 120 visitas realizadas' });
  });

  it('a barra não passa de 100% quando a meta é superada', () => {
    expect(resumoDaMeta(estatisticas({ realizadas_mes: 150, meta_mensal: 120, percentual_meta: 125 })).percentual).toBe(100);
  });
});
