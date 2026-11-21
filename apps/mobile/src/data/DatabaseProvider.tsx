import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { AppDB } from './db';
import { migrate } from './migrations';
import { schema } from './schema';
import { seedDefaults } from './seed';

const DatabaseContext = createContext<AppDB | null>(null);

let singleton: AppDB | null = null;

/** Abre o SQLite local, aplica migrations e semeia dados padrão (uma vez por processo). */
export function openAppDatabase(): AppDB {
  if (singleton) return singleton;
  const sqlite = openDatabaseSync('finance.db', { enableChangeListener: false });
  sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const db = drizzle(sqlite, { schema }) as unknown as AppDB;
  migrate(db);
  seedDefaults(db);
  singleton = db;
  return db;
}

interface Props {
  children: ReactNode;
  /** Injeção para testes. */
  db?: AppDB;
}

export function DatabaseProvider({ children, db }: Props) {
  const value = useMemo(() => db ?? openAppDatabase(), [db]);
  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDb(): AppDB {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDb deve ser usado dentro de <DatabaseProvider>');
  return db;
}
