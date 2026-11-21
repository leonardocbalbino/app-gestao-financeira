import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AppDB } from '@/data/db';
import { SYNC_TABLES, schema, type SyncTable } from '@/data/schema';
import { fromRemote, isNewer, toRemote, type LocalRow, type RemoteRow } from './mapping';

export interface PushResult {
  rejected: { id: string; reason: string }[];
}

/** Transporte do sync (Supabase no app; fake em memória nos testes). */
export interface SyncRemote {
  push(table: SyncTable, rows: RemoteRow[]): Promise<PushResult>;
  /** Linhas com server_updated_at > since, em ordem crescente. */
  pull(table: SyncTable, since: string | null, limit: number): Promise<RemoteRow[]>;
}

export interface CursorStore {
  get(table: SyncTable): string | null;
  set(table: SyncTable, cursor: string): void;
}

export interface SyncReport {
  pulled: number;
  pushed: number;
  rejected: { table: SyncTable; id: string; reason: string }[];
}

const PAGE = 500;
const BATCH = 200;

/* eslint-disable @typescript-eslint/no-explicit-any -- tabelas genéricas do Drizzle */
const tableOf = (t: SyncTable): any => schema[t];
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Uma rodada completa: para cada tabela (ordem de dependência), PULL e depois PUSH.
 * Pull primeiro garante que categorias padrão sejam unificadas pelo slug antes de subir.
 */
export async function syncOnce(
  db: AppDB,
  remote: SyncRemote,
  cursors: CursorStore,
): Promise<SyncReport> {
  const report: SyncReport = { pulled: 0, pushed: 0, rejected: [] };
  for (const table of SYNC_TABLES) {
    report.pulled += await pullTable(db, remote, cursors, table);
    const res = await pushTable(db, remote, table);
    report.pushed += res.pushed;
    report.rejected.push(...res.rejected.map((r) => ({ table, ...r })));
  }
  return report;
}

async function pullTable(db: AppDB, remote: SyncRemote, cursors: CursorStore, table: SyncTable) {
  const firstSync = cursors.get(table) === null;
  let since = cursors.get(table);
  let total = 0;
  for (;;) {
    const page = await remote.pull(table, since, PAGE);
    if (page.length === 0) break;
    db.transaction((tx) => {
      for (const r of page) applyRemoteRow(tx as unknown as AppDB, table, r);
    });
    total += page.length;
    since = page[page.length - 1]!.server_updated_at ?? since;
    if (since) cursors.set(table, since);
    if (page.length < PAGE) break;
  }
  if (firstSync && table === 'accounts' && total > 0) dropUntouchedSeedWallet(db);
  return total;
}

/** Aplica uma linha do servidor com LWW; une categorias padrão duplicadas (mesmo slug). */
export function applyRemoteRow(db: AppDB, table: SyncTable, remoteRow: RemoteRow): void {
  const t = tableOf(table);
  const incoming = fromRemote(table, remoteRow);

  if (table === 'categories' && typeof incoming.slug === 'string' && !incoming.deletedAt) {
    mergeCategoryBySlug(db, incoming.slug, incoming.id);
  }

  const local = db.select().from(t).where(eq(t.id, incoming.id)).get() as LocalRow | undefined;
  if (!local) {
    db.insert(t).values(incoming).run();
    return;
  }
  // Empate ou local mais novo: mantém o local (ele sobe no push se estiver dirty).
  if (!isNewer(incoming.updatedAt, local.updatedAt)) return;
  const { id: _id, ...rest } = incoming;
  db.update(t).set(rest).where(eq(t.id, incoming.id)).run();
}

/** Mesma categoria padrão criada em dois aparelhos: adota o id remoto e remapeia referências. */
function mergeCategoryBySlug(db: AppDB, slug: string, remoteId: string) {
  const c = schema.categories;
  const dup = db
    .select({ id: c.id })
    .from(c)
    .where(and(eq(c.slug, slug), isNull(c.deletedAt), sql`${c.id} <> ${remoteId}`))
    .get();
  if (!dup) return;
  const { transactions, budgets, bills } = schema;
  db.update(transactions)
    .set({ categoryId: remoteId, dirty: true })
    .where(eq(transactions.categoryId, dup.id))
    .run();
  db.update(budgets)
    .set({ categoryId: remoteId, dirty: true })
    .where(eq(budgets.categoryId, dup.id))
    .run();
  db.update(bills)
    .set({ categoryId: remoteId, dirty: true })
    .where(eq(bills.categoryId, dup.id))
    .run();
  // A duplicata local nunca deve subir: remoção física (não é dado do usuário).
  db.delete(c).where(eq(c.id, dup.id)).run();
}

/** Primeiro sync num aparelho novo: remove a "Carteira" semeada se ela nunca foi usada. */
function dropUntouchedSeedWallet(db: AppDB) {
  const a = schema.accounts;
  const tx = schema.transactions;
  const seeds = db
    .select({ id: a.id })
    .from(a)
    .where(
      and(
        eq(a.name, 'Carteira'),
        eq(a.type, 'cash'),
        eq(a.initialBalanceCents, 0),
        eq(a.dirty, true),
        sql`${a.createdAt} = ${a.updatedAt}`,
        sql`not exists (select 1 from ${tx} where ${tx.accountId} = ${a.id} or ${tx.toAccountId} = ${a.id})`,
      ),
    )
    .all();
  const remaining =
    db
      .select({ n: sql<number>`count(*)` })
      .from(a)
      .where(isNull(a.deletedAt))
      .get()?.n ?? 0;
  if (seeds.length && remaining > seeds.length) {
    db.delete(a)
      .where(
        inArray(
          a.id,
          seeds.map((s) => s.id),
        ),
      )
      .run();
  }
}

async function pushTable(db: AppDB, remote: SyncRemote, table: SyncTable) {
  const t = tableOf(table);
  const dirty = db.select().from(t).where(eq(t.dirty, true)).all() as LocalRow[];
  let pushed = 0;
  const rejected: PushResult['rejected'] = [];
  for (let i = 0; i < dirty.length; i += BATCH) {
    const batch = dirty.slice(i, i + BATCH);
    const res = await remote.push(
      table,
      batch.map((r) => toRemote(table, r)),
    );
    const rejectedIds = new Set(res.rejected.map((r) => r.id));
    rejected.push(...res.rejected);
    for (const row of batch) {
      if (rejectedIds.has(row.id)) continue;
      // Só limpa se a linha não mudou enquanto o push estava em andamento.
      db.update(t)
        .set({ dirty: false })
        .where(and(eq(t.id, row.id), eq(t.updatedAt, row.updatedAt)))
        .run();
      pushed++;
    }
  }
  return { pushed, rejected };
}
