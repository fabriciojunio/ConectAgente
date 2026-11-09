/**
 * Datas gravadas sem hora, no fuso de quem usa o aplicativo.
 *
 * `new Date('2026-10-13')` é meia-noite em UTC, que no Brasil ainda é dia 12
 * às 21h. Os testes antigos rodavam no fuso da máquina e não pegavam isso.
 */
import { calcularIdade, formatDate } from '../formatters';
import { compararComHoje } from '../validators';

describe('datas sem hora no fuso do Brasil', () => {
  it('confere o fuso do teste', () => {
    expect(new Date('2026-10-13').getDate()).toBe(12);
  });

  it('formatDate mostra o mesmo dia que foi gravado', () => {
    expect(formatDate('2026-10-13')).toBe('13/10/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });

  it('formatDate segue convertendo data com hora para o fuso local', () => {
    expect(formatDate('2026-10-14T02:00:00.000Z')).toBe('13/10/2026');
  });

  it('calcularIdade não adianta o aniversário em um dia', () => {
    const vespera = new Date(2026, 10, 8, 12);
    const aniversario = new Date(2026, 10, 9, 12);
    expect(calcularIdade('2000-11-09', vespera)).toBe(25);
    expect(calcularIdade('2000-11-09', aniversario)).toBe(26);
  });

  it('calcularIdade acerta quem nasceu no primeiro dia do mês', () => {
    // Lida em UTC, 2024-12-01 vira 30/11 e a criança faria 2 anos um dia antes.
    expect(calcularIdade('2024-12-01', new Date(2026, 10, 30, 12))).toBe(1);
    expect(calcularIdade('2024-12-01', new Date(2026, 11, 1, 12))).toBe(2);
  });

  it('calcularIdade aceita data com hora e recusa texto inválido', () => {
    expect(calcularIdade('2000-11-09T00:00:00', new Date(2026, 10, 9, 12))).toBe(26);
    expect(calcularIdade('nao-e-data', new Date(2026, 10, 9, 12))).toBe(0);
  });
});

describe('compararComHoje', () => {
  const hoje = new Date(2026, 10, 9, 23, 30);

  it('reconhece hoje mesmo perto da meia-noite', () => {
    expect(compararComHoje('09/11/2026', hoje)).toBe(0);
  });

  it('separa passado e futuro pelo dia civil', () => {
    expect(compararComHoje('08/11/2026', hoje)).toBe(-1);
    expect(compararComHoje('10/11/2026', hoje)).toBe(1);
    expect(compararComHoje('09/11/2062', hoje)).toBe(1);
    expect(compararComHoje('31/12/2025', hoje)).toBe(-1);
  });
});
