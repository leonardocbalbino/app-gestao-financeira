import { sql } from 'drizzle-orm';
import type { AppDB } from './db';
import { SYNC_TABLES } from './schema';
import { seedDefaults } from './seed';

/** Apaga todos os dados financeiros do aparelho e recria os padrões (exclusão de conta). */
export function resetLocalData(db: AppDB): void {
  db.transaction((tx) => {
    for (const table of SYNC_TABLES) tx.run(sql.raw(`DELETE FROM ${table}`));
  });
  seedDefaults(db);
}
