/**
 * Conexão com banco de dados SQLite local, cifrado com SQLCipher.
 * Singleton pattern, uma única conexão por app.
 *
 * O banco inteiro é cifrado em repouso: a chave vem do Keystore (chave.ts) e é
 * aplicada com `PRAGMA key` como a primeira operação, antes de qualquer leitura.
 * Cifrar o banco todo, em vez de campo a campo, preserva a busca local que o
 * agente usa em campo e dá AEAD de verdade. Ver docs/seguranca.md.
 */
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import { DB_NAME } from '../utils/constants';
import { obterChaveDoBanco } from './chave';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** O mínimo de banco que `criarEstrutura` e `apagarBancoLocal` usam. */
type BancoExecutavel = Pick<SQLite.SQLiteDatabase, 'execAsync' | 'getAllAsync'>;

// Migrações: adicionar colunas novas sem quebrar banco existente
const MIGRACOES = [
  `ALTER TABLE visitas ADD COLUMN motivo_visita TEXT`,
  `ALTER TABLE visitas ADD COLUMN pa_visita TEXT`,
  `ALTER TABLE visitas ADD COLUMN glicemia_visita TEXT`,
  `ALTER TABLE visitas ADD COLUMN peso_visita TEXT`,
  `ALTER TABLE visitas ADD COLUMN medicamentos_em_dia INTEGER`,
  `ALTER TABLE visitas ADD COLUMN cartao_vacinas_em_dia INTEGER`,
  `ALTER TABLE visitas ADD COLUMN encaminhamentos TEXT`,
  `ALTER TABLE agentes ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE residencias ADD COLUMN nivel_risco TEXT DEFAULT 'nenhum'`,
  `ALTER TABLE medicamentos ADD COLUMN problemas_uso TEXT`,
  `ALTER TABLE medicamentos ADD COLUMN respondido_por TEXT`,
];

/** Tabelas, índices e migrações. Idempotente. */
async function criarEstrutura(db: BancoExecutavel): Promise<void> {
  await db.execAsync(CREATE_TABLES_SQL);
  for (const sql of MIGRACOES) {
    try {
      await db.execAsync(sql);
    } catch (err) {
      // Ignora apenas "duplicate column" / "already exists", outros erros são relançados
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
        throw err;
      }
    }
  }
}

/**
 * Apaga todo o conteúdo do banco do aparelho e recria a estrutura vazia.
 *
 * Usado pelo reinício do aparelho (services/reinicioService.ts). Derruba as
 * tabelas em vez de apagar o arquivo: o arquivo está aberto pela conexão
 * única do aplicativo, e o `VACUUM` no fim reescreve o arquivo sem as páginas
 * antigas. O arquivo continua cifrado pelo SQLCipher do começo ao fim.
 */
export async function apagarBancoLocal(db?: BancoExecutavel): Promise<void> {
  const banco = db ?? (await getDatabase());
  const tabelas = await banco.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
  );
  await banco.execAsync('PRAGMA foreign_keys = OFF;');
  for (const { name } of tabelas) {
    await banco.execAsync(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}";`);
  }
  await banco.execAsync('PRAGMA foreign_keys = ON;');
  await criarEstrutura(banco);
  await banco.execAsync('VACUUM;');
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  // Lock: evita múltiplas inicializações simultâneas
  if (!_initPromise) {
    _initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      // A chave do SQLCipher tem que ser a primeira operação: antes dela, o
      // arquivo é ilegível, e qualquer outro comando falharia. x'...' passa a
      // chave como 256 bits crus, sem derivação a partir de texto.
      const chave = await obterChaveDoBanco();
      await db.execAsync(`PRAGMA key = "x'${chave}'";`);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await criarEstrutura(db);
      _db = db;
      return db;
    })().catch((err) => {
      _initPromise = null; // permite retry em caso de falha
      throw err;
    });
  }

  return _initPromise;
}

/**
 * Helper para executar transação com rollback automático em caso de erro.
 */
export async function withTransaction<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  await db.execAsync('BEGIN TRANSACTION');
  try {
    const result = await fn(db);
    await db.execAsync('COMMIT');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}
