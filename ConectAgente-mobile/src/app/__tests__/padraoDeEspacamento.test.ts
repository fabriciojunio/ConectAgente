/**
 * Guarda do espaçamento das telas.
 *
 * Nasceu de um print: na tela de login havia um vão grande entre o subtítulo
 * e o campo de CPF. A causa não era o valor do espaçamento, e sim
 * `justifyContent: 'space-between'` num container vertical com `flex: 1`. O
 * espaço que sobrava era dividido entre título, subtítulo, formulário e
 * rodapé, então o vão crescia junto com a altura do aparelho: a mesma tela
 * ficava apertada no aparelho pequeno e esparramada no grande.
 *
 * Era o único `space-between` vertical do aplicativo. Os outros dezenove são
 * em linha, onde distribuir é justamente o que se quer (rótulo à esquerda,
 * valor à direita).
 *
 * O segundo achado foi o espaçamento do formulário: login usava `SPACING.sm`
 * e as telas irmãs, cadastro e recuperar-senha, usavam `SPACING.md`. Telas do
 * mesmo fluxo com espaçamento diferente parecem telas de sistemas diferentes.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PASTA_APP = join(__dirname, '..');
const PASTA_AUTH = join(PASTA_APP, '(auth)');

/**
 * Lê o arquivo sem comentário.
 *
 * Sem isto a varredura acusa o comentário que explica a correção, porque ele
 * cita o próprio trecho que não pode existir no código.
 */
function fonteSemComentario(caminho: string): string {
  return readFileSync(caminho, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function telasDe(pasta: string): string[] {
  return readdirSync(pasta)
    .filter((n) => n.endsWith('.tsx') && n !== '_layout.tsx')
    .map((n) => join(pasta, n));
}

/** Lista todos os arquivos .tsx abaixo de uma pasta. */
function todasAsTelas(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === '__tests__') continue;
      achados.push(...todasAsTelas(caminho));
    } else if (entrada.name.endsWith('.tsx')) {
      achados.push(caminho);
    }
  }
  return achados;
}

describe('space-between só em container horizontal', () => {
  it.each(todasAsTelas(PASTA_APP).map((c) => [c.replace(PASTA_APP, ''), c]))(
    '%s',
    (_nome, caminho) => {
      const fonte = fonteSemComentario(caminho);

      // Separa os blocos de estilo e confere, em cada um que distribui, se
      // ele também declara direção de linha. Sem `flexDirection: 'row'`, o
      // container é vertical e o espaço sobrando vira vão entre os elementos.
      const blocos = fonte.split(/\n\s*\},?\n/);
      const verticaisQueDistribuem = blocos.filter(
        (b) =>
          b.includes("justifyContent: 'space-between'") &&
          !b.includes("flexDirection: 'row'")
      );

      expect(verticaisQueDistribuem).toEqual([]);
    }
  );
});

describe('as telas de autenticação usam o mesmo espaçamento de formulário', () => {
  const telas = telasDe(PASTA_AUTH);

  it('existem as três telas esperadas', () => {
    // Se alguém adicionar uma quarta tela ao fluxo, ela entra na conferência
    // abaixo automaticamente, e este teste avisa que a contagem mudou.
    expect(telas.length).toBeGreaterThanOrEqual(3);
  });

  it('todas declaram o mesmo gap no estilo `form`', () => {
    const gaps = new Map<string, string>();

    for (const caminho of telas) {
      const fonte = readFileSync(caminho, 'utf-8');
      const achado = fonte.match(/form:\s*\{[^}]*gap:\s*(SPACING\.\w+)/s);
      if (achado) gaps.set(caminho.split(/[\\/]/).pop() ?? caminho, achado[1]);
    }

    expect(gaps.size).toBeGreaterThanOrEqual(3);

    const distintos = new Set(gaps.values());
    // A mensagem do erro mostra tela por tela qual valor cada uma usa.
    expect({ porTela: Object.fromEntries(gaps), distintos: [...distintos] }).toEqual({
      porTela: Object.fromEntries(gaps),
      distintos: ['SPACING.md'],
    });
  });
});

describe('o rodapé da LGPD fica no fundo sem esticar o conteúdo', () => {
  it('login empurra o rodapé com marginTop auto', () => {
    const fonte = readFileSync(join(PASTA_AUTH, 'login.tsx'), 'utf-8');
    const bloco = fonte.slice(fonte.indexOf('lgpd: {'));
    const ateFechar = bloco.slice(0, bloco.indexOf('}'));

    expect(ateFechar).toContain("marginTop: 'auto'");
  });
});
