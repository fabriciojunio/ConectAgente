/**
 * Conexão com banco de dados SQLite local (expo-sqlite v15).
 * Singleton pattern — uma única conexão por app.
 */
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';
import { DB_NAME } from '../utils/constants';

let _db: SQLite.SQLiteDatabase | null = null;
let _initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  // Lock: evita múltiplas inicializações simultâneas
  if (!_initPromise) {
    _initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync(CREATE_TABLES_SQL);
      // Migrações: adicionar colunas novas sem quebrar banco existente
      const migracoes = [
        `ALTER TABLE visitas ADD COLUMN motivo_visita TEXT`,
        `ALTER TABLE visitas ADD COLUMN pa_visita TEXT`,
        `ALTER TABLE visitas ADD COLUMN glicemia_visita TEXT`,
        `ALTER TABLE visitas ADD COLUMN peso_visita TEXT`,
        `ALTER TABLE visitas ADD COLUMN medicamentos_em_dia INTEGER`,
        `ALTER TABLE visitas ADD COLUMN cartao_vacinas_em_dia INTEGER`,
        `ALTER TABLE visitas ADD COLUMN encaminhamentos TEXT`,
        `ALTER TABLE agentes ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`,
      ];
      for (const sql of migracoes) {
        try {
          await db.execAsync(sql);
        } catch (err) {
          // Ignora apenas "duplicate column" / "already exists" — outros erros são relançados
          const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
          if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
            throw err;
          }
        }
      }
      _db = db;
      return db;
    })().catch((err) => {
      _initPromise = null; // permite retry em caso de falha
      throw err;
    });
  }

  return _initPromise;
}

export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
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
