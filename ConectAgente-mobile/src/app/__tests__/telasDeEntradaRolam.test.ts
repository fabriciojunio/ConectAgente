import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * As telas de entrada não têm barra de abas embaixo. Num celular com tela
 * menor, ou com o aviso de primeiro uso do administrador, o conteúdo passa da
 * altura da tela; sem rolagem, o último botão fica embaixo dos botões do
 * Android e não há como tocar nele. Aconteceu no login, achado no aparelho.
 */
describe('telas de entrada', () => {
  const pasta = join(__dirname, '..', '(auth)');
  const telas = readdirSync(pasta).filter((f) => f.endsWith('.tsx') && !f.startsWith('_'));

  it('existem telas para conferir', () => {
    expect(telas.length).toBeGreaterThanOrEqual(5);
  });

  it.each(telas)('%s rola quando o conteúdo passa da tela', (tela) => {
    const fonte = readFileSync(join(pasta, tela), 'utf8');
    expect(fonte).toMatch(/<ScrollView\b/);
  });
});
