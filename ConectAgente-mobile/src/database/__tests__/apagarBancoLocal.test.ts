/**
 * `apagarBancoLocal` contra um SQLite de verdade, com o schema real.
 *
 * Com mock, o teste só provaria que a função chama `DROP`. O que importa é o
 * banco que sobra: vazio, com todas as tabelas de volta e com as colunas que
 * as migrações acrescentam. Faltar uma coluna ali derrubaria o aplicativo na
 * primeira visita gravada depois do reinício.
 */
jest.mock('../chave', () => ({ obterChaveDoBanco: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');
import { apagarBancoLocal } from '../database';
import { CREATE_TABLES_SQL } from '../schema';

interface Linha {
  [coluna: string]: unknown;
}

/** O pedaço da API do expo-sqlite que a função usa, sobre o node:sqlite. */
function adaptar(banco: { exec(sql: string): void; prepare(sql: string): { all(): Linha[] } }) {
  return {
    execAsync: async (sql: string) => banco.exec(sql),
    getAllAsync: async <T,>(sql: string) => banco.prepare(sql).all() as T[],
  };
}

function criarBancoComDados() {
  const banco = new DatabaseSync(':memory:');
  banco.exec(CREATE_TABLES_SQL);
  banco.exec(`
    INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, ativo, created_at, updated_at)
    VALUES ('a1', 'Ana', '52998224725', 'ana@ubs.gov.br', 'x', 'Área 1', 'UBS', 1, '2026-11-10', '2026-11-10');
    INSERT INTO sync_queue (id, tabela, operacao, registro_id, payload, status, tentativas, created_at)
    VALUES ('s1', 'visitas', 'insert', 'v1', '{}', 'pendente', 0, '2026-11-10');
  `);
  return banco;
}

const tabelas = (banco: { prepare(sql: string): { all(): Linha[] } }) =>
  banco
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all()
    .map((l) => l.name as string);

describe('apagarBancoLocal', () => {
  it('deixa todas as tabelas de volta, e vazias', async () => {
    const banco = criarBancoComDados();
    const antes = tabelas(banco);

    await apagarBancoLocal(adaptar(banco));

    expect(tabelas(banco)).toEqual(antes);
    for (const nome of antes) {
      const { total } = banco.prepare(`SELECT COUNT(*) AS total FROM "${nome}"`).get() as { total: number };
      expect({ nome, total }).toEqual({ nome, total: 0 });
    }
  });

  it('recria as colunas que vêm das migrações', async () => {
    const banco = criarBancoComDados();

    await apagarBancoLocal(adaptar(banco));

    const colunas = (tabela: string) =>
      banco.prepare(`PRAGMA table_info(${tabela})`).all().map((c: Linha) => c.name);
    expect(colunas('visitas')).toEqual(expect.arrayContaining(['motivo_visita', 'encaminhamentos']));
    expect(colunas('agentes')).toContain('is_admin');
    expect(colunas('residencias')).toContain('nivel_risco');
  });

  it('o banco continua gravável depois', async () => {
    const banco = criarBancoComDados();

    await apagarBancoLocal(adaptar(banco));

    expect(() =>
      banco.exec(`
        INSERT INTO agentes (id, nome, cpf, email, senha_hash, area_atuacao, unidade_saude, ativo, is_admin, created_at, updated_at)
        VALUES ('a2', 'Administrador', '11144477735', 'admin@conectagente.local', 'senha-nao-definida', 'Adm', 'Sistema', 1, 1, 'x', 'x');
      `)
    ).not.toThrow();
  });
});
