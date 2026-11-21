import initSqlJs from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import type { AppDB } from '@/data/db';
import { migrate } from '@/data/migrations';
import { schema } from '@/data/schema';
import { seedDefaults } from '@/data/seed';

/** Banco SQLite em memória (sql.js/wasm) com o mesmo schema e migrations do app. */
export async function createTestDb(opts: { seed?: boolean } = {}): Promise<AppDB> {
  const SQL = await initSqlJs();
  const db = drizzle(new SQL.Database(), { schema }) as unknown as AppDB;
  migrate(db);
  if (opts.seed !== false) seedDefaults(db);
  return db;
}
