import { codigoValido, decidirSegundoFator } from '../segundoFator';

describe('decidirSegundoFator', () => {
  it('sessão que já confirmou o código passa', () => {
    expect(decidirSegundoFator({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe('liberado');
  });

  it('senha certa com autenticador cadastrado ainda pede o código', () => {
    expect(decidirSegundoFator({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('verificar');
  });

  it('conta sem autenticador é levada a cadastrar, não liberada', () => {
    expect(decidirSegundoFator({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe('cadastrar');
  });

  it('sem informação de nível, falha fechado', () => {
    expect(decidirSegundoFator(null)).toBe('cadastrar');
    expect(decidirSegundoFator(undefined)).toBe('cadastrar');
    expect(decidirSegundoFator({ currentLevel: null, nextLevel: null })).toBe('cadastrar');
  });
});

describe('codigoValido', () => {
  it.each(['123456', '000000'])('aceita %s', (c) => expect(codigoValido(c)).toBe(true));
  it.each(['', '12345', '1234567', '12 456', 'abcdef', '12345a'])('recusa "%s"', (c) =>
    expect(codigoValido(c)).toBe(false)
  );
});
