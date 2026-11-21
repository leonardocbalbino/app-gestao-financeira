import type { SyncTable } from '@/data/schema';

/** Linha no formato do servidor (snake_case). */
export type RemoteRow = Record<string, unknown> & {
  id: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at?: string;
};

/** Linha local (camelCase, como o Drizzle devolve). */
export type LocalRow = Record<string, unknown> & {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  dirty?: boolean;
};

/** Campos que existem só no aparelho e nunca sobem. */
const LOCAL_ONLY = new Set(['dirty', 'notificationId']);
/** Campos que existem só no servidor e nunca descem para o SQLite. */
const REMOTE_ONLY = new Set(['user_id', 'household_id', 'server_updated_at']);

const toSnake = (k: string) => k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** Colunas de data civil (YYYY-MM-DD) no servidor. */
const DATE_COLUMNS: Partial<Record<SyncTable, string[]>> = {
  transactions: ['date'],
  goals: ['deadline'],
  bills: ['due_date'],
};

export function toRemote(_table: SyncTable, row: LocalRow): RemoteRow {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (LOCAL_ONLY.has(k)) continue;
    out[toSnake(k)] = v;
  }
  return out as RemoteRow;
}

export function fromRemote(table: SyncTable, row: RemoteRow): LocalRow {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (REMOTE_ONLY.has(k)) continue;
    let value = v;
    if (DATE_COLUMNS[table]?.includes(k) && typeof v === 'string') value = v.slice(0, 10);
    out[toCamel(k)] = value;
  }
  return { ...(out as LocalRow), dirty: false };
}

/** LWW: true se `a` é estritamente mais novo que `b` (compara instantes, não strings). */
export function isNewer(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}
