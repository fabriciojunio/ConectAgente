/**
 * Confere que todo SQL dos repositórios só menciona colunas que existem.
 *
 * Por que isto existe. Os testes de repositório simulam o banco: `runAsync`
 * é uma função falsa que aceita qualquer string e não valida nada. Isso é
 * bom para testar lógica, e cego para erro de nome de coluna.
 *
 * Foi assim que passou um defeito que trancava a pessoa fora da conta.
 * `resetarSenha` gravava na coluna `detalhes` da tabela `audit_log`, que não
 * existe em nenhum schema. Rodando o schema real num SQLite de verdade, o
 * banco responde:
 *
 *   table audit_log has no column named detalhes
 *
 * E o pior era a ordem: a senha era trocada antes da linha que falhava.
 * A tela recebia a exceção e dizia que não deu, a pessoa tentava de novo com
 * a senha antiga, e a senha antiga já não valia mais.
 *
 * Este teste lê o schema e os repositórios do disco e compara. Não precisa
 * de banco, não depende de qual caminho de código um teste exercita, e pega
 * coluna errada em INSERT e em UPDATE de qualquer tabela.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR_DATABASE = join(__dirname, '..');
const DIR_REPOS = join(DIR_DATABASE, 'repositories');

const schema = readFileSync(join(DIR_DATABASE, 'schema.ts'), 'utf8');

/**
 * O schema real é o CREATE TABLE mais as migrações que o `database.ts`
 * aplica na abertura do banco. Ignorar as migrações faria este teste acusar
 * coluna que existe de verdade em aparelho já instalado.
 */
const migracoes = readFileSync(join(DIR_DATABASE, 'database.ts'), 'utf8');

/** Palavras que abrem cláusula de tabela e não nome de coluna. */
const CLAUSULAS = ['constraint', 'primary', 'foreign', 'unique', 'check'];

/** Mapa tabela -> colunas, lido do CREATE TABLE do schema local. */
function colunasPorTabela(): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  const marcador = 'CREATE TABLE IF NOT EXISTS ';

  let pos = schema.indexOf(marcador);
  while (pos >= 0) {
    const depoisDoMarcador = pos + marcador.length;
    const abreParen = schema.indexOf('(', depoisDoMarcador);
    const tabela = schema.slice(depoisDoMarcador, abreParen).trim();

    const colunas = new Set<string>();
    for (const bruta of schema.slice(abreParen + 1).split('\n')) {
      const linha = bruta.trim();
      if (linha === ');') break;
      if (linha === '' || linha.startsWith('--')) continue;

      const espaco = linha.indexOf(' ');
      if (espaco <= 0) continue;
      const nome = linha.slice(0, espaco).toLowerCase();
      if (CLAUSULAS.includes(nome)) continue;
      if (!/^[a-z_][a-z_0-9]*$/.test(nome)) continue;
      colunas.add(nome);
    }

    mapa.set(tabela, colunas);
    pos = schema.indexOf(marcador, abreParen);
  }

  // Soma as colunas que o database.ts acrescenta na abertura do banco.
  const alter = /ALTER\s+TABLE\s+([a-z_][a-z_0-9]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z_0-9]*)/gi;
  for (const achado of migracoes.matchAll(alter)) {
    const tabela = achado[1].toLowerCase();
    const coluna = achado[2].toLowerCase();
    if (!mapa.has(tabela)) mapa.set(tabela, new Set());
    mapa.get(tabela)!.add(coluna);
  }

  return mapa;
}

const TABELAS = colunasPorTabela();

interface Uso {
  arquivo: string;
  tabela: string;
  coluna: string;
  tipo: 'INSERT' | 'UPDATE';
}

/** Colunas mencionadas em INSERT INTO tabela (...). */
function usosDeInsert(arquivo: string, texto: string): Uso[] {
  const usos: Uso[] = [];
  // Aceita tanto `INSERT INTO` quanto `INSERT OR REPLACE INTO`.
  const padrao = /INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+([a-z_][a-z_0-9]*)\s*\(([^)]*)\)/gi;

  for (const achado of texto.matchAll(padrao)) {
    const tabela = achado[1].toLowerCase();
    for (const bruta of achado[2].split(',')) {
      const coluna = bruta.trim().toLowerCase();
      if (coluna === '') continue;
      if (!/^[a-z_][a-z_0-9]*$/.test(coluna)) continue;
      usos.push({ arquivo, tabela, coluna, tipo: 'INSERT' });
    }
  }
  return usos;
}

/** Colunas atribuídas em UPDATE tabela SET col = ..., col = ... */
function usosDeUpdate(arquivo: string, texto: string): Uso[] {
  const usos: Uso[] = [];
  const padrao = /UPDATE\s+([a-z_][a-z_0-9]*)\s+SET\s/gi;

  for (const achado of texto.matchAll(padrao)) {
    const tabela = achado[1].toLowerCase();
    const inicio = achado.index! + achado[0].length;

    // O SET termina no WHERE, no fim do template literal, ou no fim do SQL.
    const resto = texto.slice(inicio);
    const fimRelativo = (() => {
      const candidatos = [
        resto.search(/\bWHERE\b/i),
        resto.indexOf('`'),
      ].filter((n) => n >= 0);
      return candidatos.length > 0 ? Math.min(...candidatos) : resto.length;
    })();

    const corpo = resto.slice(0, fimRelativo);

    // Cada atribuição é `coluna = algo`. Pega o nome antes do primeiro `=`
    // de cada parte separada por vírgula no nível de cima. COALESCE(?, col)
    // menciona a coluna de novo do lado direito, e isso não faz mal: se ela
    // existe do lado esquerdo, existe do direito.
    for (const parte of corpo.split(',')) {
      const igual = parte.indexOf('=');
      if (igual < 0) continue;
      const coluna = parte.slice(0, igual).trim().toLowerCase();
      if (!/^[a-z_][a-z_0-9]*$/.test(coluna)) continue;
      usos.push({ arquivo, tabela, coluna, tipo: 'UPDATE' });
    }
  }
  return usos;
}

function todosOsUsos(): Uso[] {
  const arquivos = readdirSync(DIR_REPOS).filter((f) => f.endsWith('.ts'));
  const usos: Uso[] = [];
  for (const nome of arquivos) {
    const texto = readFileSync(join(DIR_REPOS, nome), 'utf8');
    usos.push(...usosDeInsert(nome, texto), ...usosDeUpdate(nome, texto));
  }
  return usos;
}

describe('SQL dos repositorios contra o schema local', () => {
  const usos = todosOsUsos();

  it('encontra SQL para analisar, senao o teste nao prova nada', () => {
    // Guarda contra o parser deixar de casar e o teste passar vazio, que é
    // a forma mais comum de um teste assim virar enfeite.
    expect(usos.length).toBeGreaterThan(50);
    expect(TABELAS.size).toBeGreaterThan(10);
  });

  it('toda tabela citada em INSERT ou UPDATE existe no schema', () => {
    const inexistentes = [
      ...new Set(usos.filter((u) => !TABELAS.has(u.tabela)).map((u) => `${u.arquivo}: ${u.tabela}`)),
    ];
    expect(inexistentes).toEqual([]);
  });

  it('toda coluna gravada existe na tabela', () => {
    const erradas = usos
      .filter((u) => TABELAS.has(u.tabela))
      .filter((u) => !TABELAS.get(u.tabela)!.has(u.coluna))
      .map((u) => `${u.arquivo} | ${u.tipo} ${u.tabela}.${u.coluna}`);

    expect([...new Set(erradas)]).toEqual([]);
  });
});
