import {
  cn,
  formatDate,
  formatCPF,
  falhaDeConsulta,
  mascararCPF,
  formatPhone,
  formatCEP,
  calcularDiasSemVisita,
  getNivelCriticidade,
  getCriticidadeColor,
  getStatusColor,
  sanitizeInput,
  truncateText,
  calcularIdade,
  formatPercent,
  formatDecimal,
  fimExclusivo,
  formatDataDaVisita,
  dataDaVisita,
  diaLocal,
} from '../utils';
import { NivelCriticidade, StatusVisita } from '@/types';

describe('cn', () => {
  it('merges multiple class strings', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('resolves conflicting tailwind classes', () => {
    const result = cn('px-4', 'px-6');
    expect(result).toBe('px-6');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toContain('active');
  });

  it('filters out falsy values', () => {
    expect(cn('base', false, null, undefined, 'extra')).toBe('base extra');
  });
});

describe('formatDate', () => {
  it('formats ISO date string as dd/MM/yyyy by default', () => {
    expect(formatDate('2024-03-15')).toBe('15/03/2024');
  });

  it('formats Date object', () => {
    const date = new Date(2024, 2, 15); // March 15, 2024
    expect(formatDate(date)).toBe('15/03/2024');
  });

  it('accepts custom format string', () => {
    expect(formatDate('2024-03-15', 'yyyy-MM-dd')).toBe('2024-03-15');
  });

  it('returns fallback for invalid date', () => {
    expect(formatDate('invalid-date')).toBe('--/--/----');
  });
});

describe('formatCPF', () => {
  it('formats 11-digit CPF correctly', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  it('returns original string for short input', () => {
    expect(formatCPF('12345')).toBe('12345');
  });

  it('strips non-digit characters before formatting', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
  });

  it('returns original for empty string', () => {
    expect(formatCPF('')).toBe('');
  });
});

describe('formatPhone', () => {
  it('formats 11-digit phone as (XX) XXXXX-XXXX', () => {
    expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
  });

  it('formats 10-digit phone as (XX) XXXX-XXXX', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('returns original for invalid length', () => {
    expect(formatPhone('123')).toBe('123');
  });
});

describe('formatCEP', () => {
  it('formats 8-digit CEP as XXXXX-XXX', () => {
    expect(formatCEP('01001000')).toBe('01001-000');
  });

  it('returns original for invalid length', () => {
    expect(formatCEP('0100')).toBe('0100');
  });

  it('strips non-digit characters before formatting', () => {
    expect(formatCEP('01001-000')).toBe('01001-000');
  });
});

describe('calcularDiasSemVisita', () => {
  it('returns Infinity for null', () => {
    expect(calcularDiasSemVisita(null)).toBe(Infinity);
  });

  it('returns Infinity for undefined', () => {
    expect(calcularDiasSemVisita(undefined)).toBe(Infinity);
  });

  it('returns correct number of days for a past date', () => {
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(today.getDate() - 5);
    const iso = fiveDaysAgo.toISOString().substring(0, 10);
    // differenceInDays compares timestamps, so depending on time-of-day it may be 4 or 5
    const result = calcularDiasSemVisita(iso);
    expect(result).toBeGreaterThanOrEqual(4);
    expect(result).toBeLessThanOrEqual(5);
  });

  it('returns 0 for today', () => {
    const today = new Date().toISOString().substring(0, 10);
    expect(calcularDiasSemVisita(today)).toBe(0);
  });
});

describe('getNivelCriticidade', () => {
  it('returns NORMAL for 5 days', () => {
    expect(getNivelCriticidade(5)).toBe(NivelCriticidade.NORMAL);
  });

  it('returns NORMAL for 7 days (boundary)', () => {
    expect(getNivelCriticidade(7)).toBe(NivelCriticidade.NORMAL);
  });

  it('returns ATENCAO for 10 days', () => {
    expect(getNivelCriticidade(10)).toBe(NivelCriticidade.ATENCAO);
  });

  it('returns ALERTA for 20 days', () => {
    expect(getNivelCriticidade(20)).toBe(NivelCriticidade.ALERTA);
  });

  it('returns CRITICO for 35 days', () => {
    expect(getNivelCriticidade(35)).toBe(NivelCriticidade.CRITICO);
  });
});

describe('getCriticidadeColor', () => {
  it('returns green classes for NORMAL', () => {
    const result = getCriticidadeColor(NivelCriticidade.NORMAL);
    expect(result).toContain('text-green-700');
    expect(result).toContain('bg-green-50');
  });

  it('returns yellow classes for ATENCAO', () => {
    const result = getCriticidadeColor(NivelCriticidade.ATENCAO);
    expect(result).toContain('text-yellow-700');
  });

  it('returns orange classes for ALERTA', () => {
    const result = getCriticidadeColor(NivelCriticidade.ALERTA);
    expect(result).toContain('text-orange-700');
  });

  it('returns red classes for CRITICO', () => {
    const result = getCriticidadeColor(NivelCriticidade.CRITICO);
    expect(result).toContain('text-red-700');
  });
});

describe('getStatusColor', () => {
  it('returns green classes for REALIZADA', () => {
    const result = getStatusColor(StatusVisita.REALIZADA);
    expect(result).toContain('text-green-700');
    expect(result).toContain('bg-green-100');
  });

  it('returns blue classes for AGENDADA', () => {
    const result = getStatusColor(StatusVisita.AGENDADA);
    expect(result).toContain('text-blue-700');
  });

  it('returns red classes for CANCELADA', () => {
    const result = getStatusColor(StatusVisita.CANCELADA);
    expect(result).toContain('text-red-700');
  });

  it('returns amber classes for NAO_ENCONTRADO', () => {
    const result = getStatusColor(StatusVisita.NAO_ENCONTRADO);
    expect(result).toContain('text-amber-700');
  });
});

describe('sanitizeInput', () => {
  it('encodes HTML angle brackets', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain('<');
    expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain('>');
  });

  it('encodes ampersands', () => {
    expect(sanitizeInput('foo & bar')).toBe('foo &amp; bar');
  });

  it('encodes double quotes', () => {
    expect(sanitizeInput('say "hello"')).toContain('&quot;');
  });

  it('encodes single quotes', () => {
    expect(sanitizeInput("it's")).toContain('&#x27;');
  });

  it('encodes forward slashes', () => {
    expect(sanitizeInput('a/b')).toContain('&#x2F;');
  });
});

describe('truncateText', () => {
  it('truncates long text and adds ellipsis', () => {
    expect(truncateText('Hello World, this is a long text', 11)).toBe('Hello World...');
  });

  it('returns original text when shorter than limit', () => {
    expect(truncateText('Short', 10)).toBe('Short');
  });

  it('returns original text when equal to limit', () => {
    expect(truncateText('12345', 5)).toBe('12345');
  });
});

describe('calcularIdade', () => {
  it('calculates correct age from birth date', () => {
    const today = new Date();
    const birthYear = today.getFullYear() - 30;
    const birthDate = `${birthYear}-01-01`;
    const age = calcularIdade(birthDate);
    // Age should be 30 or close depending on current date
    expect(age).toBeGreaterThanOrEqual(29);
    expect(age).toBeLessThanOrEqual(31);
  });

  it('returns NaN for invalid date', () => {
    // parseISO('invalid') returns Invalid Date; differenceInYears returns NaN
    expect(calcularIdade('invalid')).toBeNaN();
  });
});

describe('formatPercent', () => {
  it('usa vírgula decimal, como no Brasil', () => {
    expect(formatPercent(85.5)).toBe('85,5%');
    expect(formatPercent(0)).toBe('0,0%');
    expect(formatPercent(100)).toBe('100,0%');
  });

  it('arredonda para uma casa', () => {
    expect(formatPercent(33.333)).toBe('33,3%');
  });

  it('aceita outro número de casas', () => {
    expect(formatPercent(66.6, 0)).toBe('67%');
  });
});

describe('formatDecimal', () => {
  it('média com vírgula', () => {
    expect(formatDecimal(2.25)).toBe('2,3');
    expect(formatDecimal(1234.5, 1)).toBe('1.234,5');
  });
});

describe('fimExclusivo', () => {
  it.each([
    ['2026-11-30', '2026-12-01'],
    ['2026-12-31', '2027-01-01'],
    ['2028-02-28', '2028-02-29'],
    ['2026-02-28', '2026-03-01'],
    ['2026-11-05', '2026-11-06'],
  ])('%s termina antes de %s', (data, esperado) => {
    expect(fimExclusivo(data)).toBe(esperado);
  });

  it.each(['', '05/11/2026', '2026-11-5', '2026-11-05T00:00:00', "2026-11-05'"])(
    'recusa %j',
    (data) => {
      expect(() => fimExclusivo(data)).toThrow('Data final do período inválida');
    }
  );
});

// O aplicativo envia só a data, a coluna é TIMESTAMPTZ e o banco grava
// meia-noite em UTC. No fuso de São Paulo (jest.fuso.js) isso é o dia
// anterior às 21h, e era o dia que o painel mostrava.
describe('data da visita no fuso do Brasil', () => {
  it('confere o fuso da suíte', () => {
    expect(new Date('2026-10-13T00:00:00+00:00').getDate()).toBe(12);
  });

  it('formatDataDaVisita mostra o dia registrado', () => {
    expect(formatDataDaVisita('2026-10-13T00:00:00+00:00')).toBe('13/10/2026');
    expect(formatDataDaVisita('2026-01-01T00:00:00+00:00')).toBe('01/01/2026');
    expect(formatDataDaVisita('2026-10-13')).toBe('13/10/2026');
  });

  it('formatDataDaVisita trata vazio e lixo', () => {
    expect(formatDataDaVisita(null)).toBe('-');
    expect(formatDataDaVisita('')).toBe('-');
    expect(formatDataDaVisita('ontem')).toBe('--/--/----');
  });

  it('dataDaVisita devolve a data em UTC, sem conversão', () => {
    expect(dataDaVisita('2026-11-07T00:00:00+00:00')).toBe('2026-11-07');
  });

  it('diaLocal usa o fuso de quem usa o painel, não UTC', () => {
    // 22h de 9/11 em São Paulo já é 10/11 em UTC.
    expect(diaLocal(new Date('2026-11-10T01:00:00Z'))).toBe('2026-11-09');
  });

  it('calcularDiasSemVisita conta dias de calendário sobre o dia registrado', () => {
    const anteontem = new Date();
    anteontem.setDate(anteontem.getDate() - 2);
    expect(calcularDiasSemVisita(`${diaLocal(anteontem)}T00:00:00+00:00`)).toBe(2);
    expect(calcularDiasSemVisita(`${diaLocal()}T00:00:00+00:00`)).toBe(0);
  });
});

describe('withTimeout sem valor falso', () => {
  it('consulta que responde a tempo devolve o resultado', async () => {
    const { withTimeout } = await import('../utils');
    await expect(withTimeout(Promise.resolve(8), 50)).resolves.toBe(8);
  });

  it('consulta travada vira erro claro, e não zero como se fosse dado', async () => {
    const { withTimeout, MENSAGEM_DE_PRAZO } = await import('../utils');
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow(MENSAGEM_DE_PRAZO);
  });

  it('erro da consulta passa adiante', async () => {
    const { withTimeout } = await import('../utils');
    await expect(withTimeout(Promise.reject(new Error('recusado')), 50)).rejects.toThrow('recusado');
  });
});

describe('mascararCPF', () => {
  it('mostra só os seis dígitos do meio', () => {
    expect(mascararCPF('12345678901')).toBe('***.456.789-**');
    expect(mascararCPF('123.456.789-01')).toBe('***.456.789-**');
  });

  it('CPF incompleto ou ausente não vaza parcial', () => {
    expect(mascararCPF('1234')).toBe('-');
    expect(mascararCPF(undefined)).toBe('-');
  });
});

describe('falhaDeConsulta', () => {
  it('diz o que falhou sem repassar o texto do banco', () => {
    const espiao = jest.spyOn(console, 'error').mockImplementation(() => {});
    const erro = falhaDeConsulta('buscar agentes', { code: '42501', message: 'permission denied for table agentes' });
    expect(erro.message).toBe('Não foi possível buscar agentes. Confira a conexão e tente de novo.');
    expect(erro.message).not.toMatch(/permission|table|agentes_/);
    expect(espiao).toHaveBeenCalled();
    espiao.mockRestore();
  });
});
