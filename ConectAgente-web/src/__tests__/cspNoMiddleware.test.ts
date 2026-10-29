/**
 * Guarda das saídas do middleware.
 *
 * Por que é teste de código-fonte e não de comportamento. O middleware roda no
 * runtime edge do Next, que não sobe dentro do Jest, e o defeito que este
 * arquivo existe para impedir não aparece em teste de unidade nem em navegação
 * normal:
 *
 * O `setAll` do cliente Supabase recria a resposta para gravar o cookie de
 * sessão renovado. A versão anterior recriava com `request.headers`, que não
 * carrega o `x-nonce`. Resultado medido: nas respostas comuns a política saía
 * certa, e na renovação de token ela desaparecia junto com o nonce dos
 * scripts. Sumia exatamente no caminho de quem está logado, que é o caminho
 * que importa num sistema de prontuário.
 *
 * Havia mais três saídas sem política: o 403 do CSRF, que tem corpo, e os dois
 * redirecionamentos de sessão.
 *
 * Medido com o servidor de produção em pé, antes e depois: 7 caminhos de saída,
 * 3 sem `Content-Security-Policy` antes, 0 depois.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const FONTE = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf-8');

/**
 * O fonte sem comentário e com espaço colapsado.
 *
 * Busca linha por linha não serve aqui: as chamadas verdadeiras estão
 * quebradas em três linhas pelo formatador, e a busca acusaria justamente o
 * caso certo. Já errei assim neste projeto, com um regex de ALTER TABLE que só
 * casava declaração de uma linha.
 */
function fonteColapsada(): string {
  return FONTE.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ');
}

describe('toda resposta do middleware leva a política de segurança', () => {
  it('toda criação de resposta passa por comCsp', () => {
    const colapsado = fonteColapsada();
    const criacoes = [
      ...colapsado.matchAll(/NextResponse\.(?:next|redirect)\(|new NextResponse\(/g),
    ];

    // Se alguém reescrever o middleware e isto zerar, o teste vira decoração.
    expect(criacoes.length).toBeGreaterThanOrEqual(4);

    // Cada criação precisa estar envolvida por comCsp. Olha os 12 caracteres
    // anteriores, que é onde `comCsp( ` cabe.
    const semCsp = criacoes
      .map((m) => colapsado.slice(Math.max(0, (m.index ?? 0) - 12), (m.index ?? 0) + 30))
      .filter((janela) => !janela.includes('comCsp('));

    expect(semCsp).toEqual([]);
  });

  it('o refresh de token reusa os cabeçalhos que têm o nonce', () => {
    // O defeito era literalmente `request.headers` neste ponto.
    const depoisDoSetAll = FONTE.slice(FONTE.indexOf('setAll('));
    const corpoDoSetAll = depoisDoSetAll.slice(0, depoisDoSetAll.indexOf('},\n      },'));

    expect(corpoDoSetAll).toContain('cabecalhosDaRequisicao');
    expect(corpoDoSetAll).not.toMatch(/headers:\s*request\.headers/);
  });

  it('o nonce entra nos cabeçalhos da requisição, que é como o Next o recebe', () => {
    // Sem isto o Next não carimba os próprios scripts, a política bloqueia
    // tudo e a tela fica em branco sem erro visível.
    expect(FONTE).toContain("set('x-nonce', nonce)");
  });
});

describe('a política em si', () => {
  it('produção não aceita script embutido', () => {
    // `'unsafe-inline'` em script-src é o que transforma um XSS achado em XSS
    // explorável. Em desenvolvimento ele fica, porque o recarregamento do Next
    // precisa, e por isso a política recebe a bandeira de ambiente.
    const trecho = FONTE.slice(
      FONTE.indexOf('function montarCsp'),
      FONTE.indexOf('export async function')
    );
    const linhaProducao = trecho
      .split('\n')
      .find((l) => l.includes('script-src') && !l.includes('unsafe-eval'));

    expect(linhaProducao).toBeDefined();
    expect(linhaProducao).not.toContain('unsafe-inline');
    expect(linhaProducao).toContain('nonce-');
    expect(linhaProducao).toContain('strict-dynamic');
  });

  it('produção não aceita elemento <style> sem o nonce', () => {
    // `<style>` injetado permite seletor de atributo, que vaza valor de campo
    // da tela. Atributo `style=""` fica liberado à parte, em style-src-attr.
    const trecho = FONTE.slice(
      FONTE.indexOf('function montarCsp'),
      FONTE.indexOf('export async function')
    );
    const linhaEstilo = trecho.split('\n').find((l) => l.includes('style-src') && l.includes('?'));

    expect(linhaEstilo).toBeDefined();
    const producao = linhaEstilo!.slice(linhaEstilo!.indexOf(':'));
    expect(producao).toContain('nonce-');
    expect(producao).not.toContain('unsafe-inline');
    expect(trecho).toContain("\"style-src-attr 'unsafe-inline'\"");
  });

  it('a página fica isolada de outras origens', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'next.config.ts'), 'utf-8');
    expect(config).toContain("key: 'Cross-Origin-Embedder-Policy', value: 'credentialless'");
    expect(config).toContain("key: 'Cross-Origin-Opener-Policy', value: 'same-origin'");
    expect(config).toContain("key: 'Cross-Origin-Resource-Policy', value: 'same-origin'");
  });

  it('o nonce é sorteado por requisição, e não constante', () => {
    expect(FONTE).toMatch(/crypto\.randomUUID\(\)/);
  });

  it('a política não fica declarada em dois lugares', () => {
    // Já aconteceu com os outros cabeçalhos: declarados no middleware e no
    // next.config com valores diferentes, e valia o mais fraco.
    const config = readFileSync(join(__dirname, '..', '..', 'next.config.ts'), 'utf-8');
    expect(config).not.toContain('Content-Security-Policy');
  });
});
