/**
 * Guarda do primeiro acesso do administrador.
 *
 * O defeito que isto impede não é de código e sim de desenho, e por isso
 * nenhum teste de unidade pegava: cada peça funcionava sozinha.
 *
 * A conta de administrador é criada na primeira execução com senha sorteada,
 * guardada no cofre do sistema. Quem lia essa senha era a tela de
 * configurações, que fica **dentro** da área administrativa. E para entrar na
 * área administrativa é preciso fazer login como administrador.
 *
 * Resultado: numa instalação nova, ninguém entrava. Para ver a senha era
 * preciso já estar dentro, e para entrar era preciso a senha. A área inteira
 * de gestão (agentes, residências, visitas, configurações) ficava inalcançável
 * e nada no aplicativo avisava.
 *
 * A regra que estes testes travam: a senha inicial precisa ser legível de
 * algum lugar **fora** de `(admin)`.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PASTA_APP = join(__dirname, '..');

function telas(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    if (entrada.name === '__tests__') continue;
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...telas(caminho));
    else if (entrada.name.endsWith('.tsx')) achados.push(caminho);
  }
  return achados;
}

const TODAS = telas(PASTA_APP);
const DENTRO_DO_ADMIN = (c: string) => c.includes('(admin)');

function fonte(caminho: string): string {
  return readFileSync(caminho, 'utf-8');
}

/**
 * O fonte sem comentário.
 *
 * Os comentários deste projeto citam os próprios nomes que a busca procura,
 * porque explicam o defeito que a linha corrige. Buscar no texto cru acha a
 * explicação em vez do código. Já aconteceu três vezes aqui.
 */
function codigo(caminho: string): string {
  return fonte(caminho)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

describe('a senha inicial do administrador é alcançável', () => {
  it('alguma tela fora de (admin) lê a senha inicial', () => {
    const leitoras = TODAS.filter((c) => codigo(c).includes('obterSenhaInicialDoAdmin'));
    const fora = leitoras.filter((c) => !DENTRO_DO_ADMIN(c));

    expect(leitoras.length).toBeGreaterThan(0);
    expect(fora.map((c) => c.replace(PASTA_APP, ''))).not.toEqual([]);
  });

  it('a tela de login é uma delas', () => {
    // É a única tela que a pessoa vê antes de ter conta nenhuma.
    const login = codigo(join(PASTA_APP, '(auth)', 'login.tsx'));
    expect(login).toContain('obterSenhaInicialDoAdmin');
    expect(login).toContain('ADMIN_CPF');
  });

  it('o aviso só aparece enquanto a senha existe', () => {
    // `esquecerSenhaInicialDoAdmin` apaga a chave quando a senha é trocada, e
    // aí `obterSenhaInicialDoAdmin` devolve nulo. O aviso precisa depender
    // desse valor, e não de uma bandeira própria que alguém esqueça de baixar.
    const login = codigo(join(PASTA_APP, '(auth)', 'login.tsx'));
    expect(login).toMatch(/\{senhaInicialAdmin && \(/);
  });

  it('a leitura do cofre não derruba a tela de login', () => {
    // Cofre indisponível acontece: aparelho com Keystore em estado ruim,
    // emulador sem bloqueio de tela. A tela de login não pode cair por isso.
    const login = codigo(join(PASTA_APP, '(auth)', 'login.tsx'));
    const trecho = login.slice(login.indexOf('obterSenhaInicialDoAdmin'));
    expect(trecho.slice(0, 400)).toContain('.catch(');
  });
});

describe('a porta da área administrativa continua sendo o login', () => {
  it('só se chega em (admin) com is_admin', () => {
    const login = codigo(join(PASTA_APP, '(auth)', 'login.tsx'));
    const indice = codigo(join(PASTA_APP, 'index.tsx'));

    expect(login).toMatch(/is_admin \? '\/\(admin\)'/);
    expect(indice).toMatch(/isAdmin \? '\/\(admin\)'/);
  });

  it('nenhuma tela comum empurra para (admin) sem conferir o papel', () => {
    const suspeitas = TODAS.filter((c) => !DENTRO_DO_ADMIN(c)).filter((c) => {
      const s = fonte(c)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      if (!s.includes("'/(admin)'")) return false;
      return !/is_admin|isAdmin/.test(s);
    });

    expect(suspeitas.map((c) => c.replace(PASTA_APP, ''))).toEqual([]);
  });
});
