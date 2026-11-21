import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { Schema } from './schema';

/**
 * Tipo do banco usado pelos repositórios. Compatível com expo-sqlite (app) e sql.js (testes),
 * ambos drivers síncronos do Drizzle.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- o tipo do resultado varia por driver
export type AppDB = BaseSQLiteDatabase<'sync', any, Schema>;
