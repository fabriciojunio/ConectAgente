import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Folha que sobe de baixo (Modal com animação "slide") abre por cima de tudo e
 * vai até a borda da tela. No Android de borda a borda, a faixa dos botões do
 * sistema fica por cima do fim dela: no seletor de risco, "Risco Crítico"
 * aparecia cortado ao meio. Achado no aparelho.
 */
function arquivosTsx(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === '__tests__' ? [] : arquivosTsx(caminho);
    return nome.endsWith('.tsx') ? [caminho] : [];
  });
}

describe('folhas que sobem de baixo', () => {
  const raiz = join(__dirname, '..', '..');
  const comFolha = arquivosTsx(raiz).filter((f) => /animationType="slide"/.test(readFileSync(f, 'utf8')));

  it('a varredura encontra as folhas do app', () => {
    expect(comFolha.length).toBeGreaterThanOrEqual(4);
  });

  it.each(comFolha.map((f) => [f.slice(raiz.length + 1)]))('%s desconta a faixa dos botões do sistema', (relativo) => {
    const fonte = readFileSync(join(raiz, relativo), 'utf8');
    expect(fonte).toMatch(/useSafeAreaInsets\(\)/);
    expect(fonte).toMatch(/paddingBottom: [^}]*faixaInferior/);
  });
});
