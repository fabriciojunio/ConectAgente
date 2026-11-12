import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Achado no aparelho: o prontuário carregava só parte da aba de saúde.
 * Pressão, glicemia, datas e as abas de gestante, criança, mulher e social
 * abriam em branco, e salvar de novo apagava o que estava gravado (a gestante
 * voltava a "não gestante"). A tela também fica montada entre um morador e
 * outro, então campo não carregado mostrava o valor do morador anterior.
 */
describe('prontuário', () => {
  const fonte = readFileSync(join(__dirname, '..', '(app)', 'prontuario', '[moradorId].tsx'), 'utf8');

  it.each(['Saude', 'Gestante', 'Puericultura', 'Mulher', 'Social'])(
    'a aba %s é zerada e preenchida inteira com o que está gravado',
    (aba) => {
      const chave = aba.toLowerCase();
      expect(fonte).toContain(`reset${aba}(preencherFormulario(PADRAO_${aba.toUpperCase()}, p.${chave}))`);
    }
  );

  it('não sobrou preenchimento campo a campo', () => {
    expect(fonte).not.toMatch(/if \(s\.\w+\) setSaudeValue/);
  });
});
