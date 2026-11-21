import type { SyncTable } from '@/data/schema';
import type { PushResult, SyncRemote } from '@/sync/engine';
import type { RemoteRow } from '@/sync/mapping';

/** Servidor fake com a mesma semântica do sync_push (LWW) e cursor monotônico. */
export class FakeRemote implements SyncRemote {
  tables = new Map<SyncTable, Map<string, RemoteRow>>();
  private clock = 0;
  /** Regras para simular rejeições (ex.: limite do plano). */
  reject: (table: SyncTable, row: RemoteRow) => string | null = () => null;

  private tick(): string {
    this.clock += 1;
    return new Date(Date.UTC(2030, 0, 1) + this.clock * 1000).toISOString();
  }

  private store(t: SyncTable) {
    if (!this.tables.has(t)) this.tables.set(t, new Map());
    return this.tables.get(t)!;
  }

  async push(table: SyncTable, rows: RemoteRow[]): Promise<PushResult> {
    const s = this.store(table);
    const rejected: PushResult['rejected'] = [];
    for (const r of rows) {
      const reason = this.reject(table, r);
      if (reason) {
        rejected.push({ id: r.id, reason });
        continue;
      }
      const cur = s.get(r.id);
      if (!cur || new Date(cur.updated_at).getTime() < new Date(r.updated_at).getTime()) {
        s.set(r.id, { ...r, user_id: 'u1', server_updated_at: this.tick() });
      }
    }
    return { rejected };
  }

  async pull(table: SyncTable, since: string | null, limit: number): Promise<RemoteRow[]> {
    return [...this.store(table).values()]
      .filter((r) => !since || (r.server_updated_at ?? '') > since)
      .sort((a, b) => (a.server_updated_at ?? '').localeCompare(b.server_updated_at ?? ''))
      .slice(0, limit);
  }
}

export function memoryCursors() {
  const m = new Map<SyncTable, string>();
  return {
    get: (t: SyncTable) => m.get(t) ?? null,
    set: (t: SyncTable, c: string) => void m.set(t, c),
  };
}
