import { nivelDeVulnerabilidade, semanasDeGestacao } from '../conversoes';

describe('semanasDeGestacao', () => {
  it('converte número digitado', () => {
    expect(semanasDeGestacao('32')).toBe(32);
    expect(semanasDeGestacao(' 8 ')).toBe(8);
    expect(semanasDeGestacao('0')).toBe(0);
  });

  it('campo vazio vira não informado, e não texto vazio na coluna de número', () => {
    expect(semanasDeGestacao('')).toBeUndefined();
    expect(semanasDeGestacao('   ')).toBeUndefined();
    expect(semanasDeGestacao(undefined)).toBeUndefined();
  });

  it('recusa o que não é número inteiro na faixa da gestação', () => {
    expect(semanasDeGestacao('abc')).toBeUndefined();
    expect(semanasDeGestacao('12.5')).toBeUndefined();
    expect(semanasDeGestacao('-3')).toBeUndefined();
    expect(semanasDeGestacao('46')).toBeUndefined();
  });
});

describe('nivelDeVulnerabilidade', () => {
  it('aceita os níveis conhecidos', () => {
    expect(nivelDeVulnerabilidade('baixo')).toBe('baixo');
    expect(nivelDeVulnerabilidade('nenhum')).toBe('nenhum');
  });

  it('valor desconhecido ou vazio vira "nenhum"', () => {
    expect(nivelDeVulnerabilidade('qualquer coisa')).toBe('nenhum');
    expect(nivelDeVulnerabilidade('')).toBe('nenhum');
    expect(nivelDeVulnerabilidade(undefined)).toBe('nenhum');
  });
});
