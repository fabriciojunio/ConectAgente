/**
 * Guarda do acesso de administrador.
 *
 * Três defeitos de desenho passaram por aqui, e nenhum teste de unidade
 * pegava nenhum deles, porque cada peça funcionava sozinha.
 *
 * 1. Área administrativa inalcançável. A senha sorteada do administrador
 *    só era lida pela tela de configurações, que fica **dentro** da área
 *    administrativa. Numa instalação nova ninguém entrava.
 *
 * 2. A correção do primeiro criou o segundo. Para sair do impasse, a tela de
 *    entrada passou a mostrar CPF e senha do administrador para quem abrisse
 *    o aplicativo. O texto dizia que o aviso sumia quando a senha fosse
 *    trocada, mas nada apagava o aviso na troca. Uma testadora entrou como
 *    administradora lendo a senha da tela de entrada.
 *
 * 3. A recuperação por CPF e e-mail redefinia a senha do administrador sem
 *    segredo nenhum: o CPF estava na tela e o e-mail no código-fonte.
 *
 * As regras que estes testes travam:
 * - nenhuma tela lê ou mostra senha guardada;
 * - o primeiro uso é configurado fora de `(admin)`, pela tela de entrada;
 * - a recuperação de senha pede o código, e não o e-mail.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PASTA_APP = join(__dirname, '..');
const PASTA_SRC = join(PASTA_APP, '..');

function telas(pasta: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    if (entrada.name === '__tests__') continue;
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) achados.push(...telas(caminho));
    else if (/\.tsx?$/.test(entrada.name)) achados.push(caminho);
  }
  return achados;
}

const TODAS = telas(PASTA_APP);
const DENTRO_DO_ADMIN = (c: string) => c.includes('(admin)');

/**
 * O fonte sem comentário.
 *
 * Os comentários deste projeto citam os próprios nomes que a busca procura,
 * porque explicam o defeito que a linha corrige. Buscar no texto cru acha a
 * explicação em vez do código. Já aconteceu três vezes aqui.
 */
function codigo(caminho: string): string {
  return readFileSync(caminho, 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const tela = (...partes: string[]) => codigo(join(PASTA_APP, ...partes));

describe('nenhuma senha à vista', () => {
  it('nenhuma tela lê a senha inicial antiga', () => {
    const leitoras = TODAS.filter((c) => /SENHA_ADMIN_INICIAL|SenhaInicial/.test(codigo(c)));
    expect(leitoras.map((c) => c.replace(PASTA_APP, ''))).toEqual([]);
  });

  it('o repositório não grava mais senha no cofre', () => {
    const repositorio = codigo(join(PASTA_SRC, 'database', 'repositories', 'agenteRepository.ts'));
    expect(repositorio).not.toMatch(/setItemAsync\(\s*SECURE_KEYS\.SENHA_ADMIN_INICIAL/);
    expect(repositorio).not.toContain('sortearSenhaForte');
  });

  it('a tela de entrada não monta texto com senha', () => {
    const login = tela('(auth)', 'login.tsx');
    expect(login).not.toMatch(/senha \{/i);
    expect(login).not.toContain('ADMIN_CPF');
  });
});

describe('o primeiro uso é alcançável sem já estar dentro', () => {
  it('a tela de entrada oferece configurar o administrador', () => {
    const login = tela('(auth)', 'login.tsx');
    expect(login).toContain('adminPrecisaConfigurar');
    expect(login).toContain("'/(auth)/configurar-admin'");
  });

  it('a configuração fica fora de (admin) e está registrada na pilha', () => {
    const configurar = TODAS.filter(
      (c) => !DENTRO_DO_ADMIN(c) && codigo(c).includes('configurarAdmin(')
    );
    expect(configurar.map((c) => c.replace(PASTA_APP, ''))).not.toEqual([]);
    expect(tela('(auth)', '_layout.tsx')).toContain('name="configurar-admin"');
  });

  it('o botão depende do estado da conta, e não de um aviso que alguém precisa tirar', () => {
    const login = tela('(auth)', 'login.tsx');
    expect(login).toMatch(/\{adminSemSenha && \(/);
    // Reconfere ao voltar para a tela, senão o botão ficaria depois de configurar.
    expect(login).toContain('useFocusEffect');
  });

  it('a leitura do estado não derruba a tela de login', () => {
    const login = tela('(auth)', 'login.tsx');
    const trecho = login.slice(login.indexOf('adminPrecisaConfigurar'));
    expect(trecho.slice(0, 300)).toContain('.catch(');
  });
});

describe('recuperação de senha', () => {
  it('pede o código de recuperação, e não o e-mail', () => {
    const recuperar = tela('(auth)', 'recuperar-senha.tsx');
    expect(recuperar).toContain('authService.recuperarSenha(');
    expect(recuperar).not.toContain('verificarIdentidade');
    expect(recuperar).not.toMatch(/name="email"/);
  });

  it('nenhuma tela usa o caminho antigo de CPF e e-mail', () => {
    const usam = TODAS.filter((c) => /verificarIdentidade|resetarSenha\(/.test(codigo(c)));
    expect(usam.map((c) => c.replace(PASTA_APP, ''))).toEqual([]);
  });

  it('o administrador consegue gerar código para um agente que perdeu o dele', () => {
    expect(tela('(admin)', 'agentes.tsx')).toContain('gerarCodigoRecuperacao(');
  });

  it('administrador sem senha e sem código reinicia o aparelho, sem reinstalar', () => {
    const login = tela('(auth)', 'login.tsx');
    expect(login).toContain("'/(auth)/reiniciar-aparelho'");
    expect(tela('(auth)', '_layout.tsx')).toContain('name="reiniciar-aparelho"');

    const reiniciar = tela('(auth)', 'reiniciar-aparelho.tsx');
    // Mostra o que ainda não subiu e exige confirmação digitada.
    expect(reiniciar).toContain('contarNaoSincronizados');
    expect(reiniciar).toMatch(/disabled=\{!liberado\}/);
  });
});

describe('a porta da área administrativa continua sendo o login', () => {
  it('só se chega em (admin) com is_admin', () => {
    expect(tela('(auth)', 'login.tsx')).toMatch(/is_admin \? '\/\(admin\)'/);
    expect(tela('index.tsx')).toMatch(/isAdmin \? '\/\(admin\)'/);
  });

  it('nenhuma tela comum empurra para (admin) sem conferir o papel', () => {
    const suspeitas = TODAS.filter((c) => !DENTRO_DO_ADMIN(c)).filter((c) => {
      const s = codigo(c);
      if (!s.includes("'/(admin)'")) return false;
      return !/is_admin|isAdmin/.test(s);
    });

    expect(suspeitas.map((c) => c.replace(PASTA_APP, ''))).toEqual([]);
  });
});
