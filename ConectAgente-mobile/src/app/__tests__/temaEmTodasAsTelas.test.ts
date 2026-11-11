/**
 * Guarda do tema escuro.
 *
 * O modo escuro existia e só funcionava na tela "Mais", nas abas e em três
 * componentes. As outras 22 telas liam a paleta clara fixa (`COLORS`), então
 * continuavam brancas com o escuro ligado. Em uso, era pior que não ter: a
 * pessoa escolhia escuro, via uma tela escura e todas as seguintes claras.
 *
 * O que estes testes travam:
 *
 * 1. Nenhuma tela ou componente volta a importar a paleta fixa. Quem precisa
 *    de cor lê `useTheme()`.
 * 2. Nenhuma cor nova escrita à mão no código das telas, tirando as exceções
 *    registradas abaixo, que são decisão de desenho e não descuido.
 *
 * A regra 2 é a que pega o caso difícil. A paleta fixa some fácil num
 * `COLORS.x` para `colors.x`, mas `'#EFF6FF'` escrito direto no estilo
 * continua claro em qualquer tema e não dá erro em lugar nenhum.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const PASTA_APP = join(__dirname, '..');
const PASTA_COMPONENTES = join(PASTA_APP, '..', 'components');
const PASTA_FUNCIONALIDADES = join(PASTA_APP, '..', 'features');

function todosOsArquivos(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    if (entrada.name === '__tests__') continue;
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...todosOsArquivos(caminho));
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho);
  }
  return achados;
}

// As telas foram divididas: estilo e componente de cada uma moram em features/.
const ARQUIVOS = [
  ...todosOsArquivos(PASTA_APP),
  ...todosOsArquivos(PASTA_COMPONENTES),
  ...todosOsArquivos(PASTA_FUNCIONALIDADES),
];

function semComentario(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Cores que podem continuar escritas à mão, e por quê.
 *
 * As três primeiras são as medalhas do ranking de agentes: ouro, prata e
 * bronze são as cores das coisas, não do tema, e invertê-las no escuro faria
 * a prata virar outra coisa.
 *
 * O roxo é a identidade do painel administrativo, escolhida para o gerente
 * saber num relance que não está na tela do agente. Funciona nos dois temas
 * porque é um tom médio.
 *
 * Preto é cor de sombra, e `#fff` aparece sobre fundo colorido saturado, onde
 * o branco é o contraste certo nos dois temas.
 */
const PERMITIDAS = [
  '#FFD700', // ouro
  '#C0C0C0', // prata
  '#CD7F32', // bronze
  '#7B1FA2', // roxo do administrativo
  '#4A148C', // roxo escuro do cabeçalho do administrativo
  '#AB47BC', // roxo claro do gradiente do administrativo
  '#000',
  '#fff',
  '#ffffff',
];

describe('nenhuma tela usa a paleta fixa', () => {
  it.each(ARQUIVOS.map((c) => [c.replace(PASTA_APP, ''), c]))('%s', (_nome, caminho) => {
    const fonte = semComentario(readFileSync(caminho, 'utf-8'));

    expect(fonte).not.toMatch(/\bCOLORS\./);
    expect(fonte).not.toMatch(/import \{[^}]*\bCOLORS\b[^}]*\} from/);
  });
});

describe('nenhuma cor nova escrita à mão', () => {
  it.each(ARQUIVOS.map((c) => [c.replace(PASTA_APP, ''), c]))('%s', (_nome, caminho) => {
    const fonte = semComentario(readFileSync(caminho, 'utf-8'));

    const encontradas = [...fonte.matchAll(/['"](#[0-9a-fA-F]{3,8})['"]/g)].map((m) => m[1]);
    const inesperadas = encontradas.filter(
      (c) => !PERMITIDAS.some((p) => p.toLowerCase() === c.toLowerCase())
    );

    expect(inesperadas).toEqual([]);
  });
});

describe('a paleta cobre os dois temas por igual', () => {
  it('claro e escuro declaram exatamente as mesmas chaves', () => {
    // Chave que existe só num dos lados vira `undefined` em tempo de execução,
    // e cor `undefined` no React Native é transparente: o elemento some sem
    // erro nenhum.
    const fonte = readFileSync(join(PASTA_APP, '..', 'contexts', 'ThemeContext.tsx'), 'utf-8');

    function chavesDe(nome: string): string[] {
      const inicio = fonte.indexOf(`const ${nome} = {`);
      const fim = fonte.indexOf('\n};', inicio);
      const corpo = semComentario(fonte.slice(inicio, fim));
      return [...corpo.matchAll(/(\w+):/g)].map((m) => m[1]).sort();
    }

    const claro = chavesDe('LIGHT');
    const escuro = chavesDe('DARK');

    expect(claro.length).toBeGreaterThan(30);
    expect(escuro).toEqual(claro);
  });
});
