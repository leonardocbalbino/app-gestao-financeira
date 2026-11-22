import type { SyncTable } from '@/data/schema';
import { api } from '@/lib/api';
import type { PushResult, SyncRemote } from './engine';
import type { RemoteRow } from './mapping';

/** Transporte do sync pela API própria (Postgres). */
export function createApiRemote(): SyncRemote {
  return {
    async push(table: SyncTable, rows: RemoteRow[]): Promise<PushResult> {
      if (rows.length === 0) return { rejected: [] };
      const res = await api<{ rejected?: { id: string; reason: string }[] }>(
        'POST',
        `/sync/${table}/push`,
        {
          body: { rows },
        },
      );
      return { rejected: res.rejected ?? [] };
    },
    async pull(table: SyncTable, since: string | null, limit: number): Promise<RemoteRow[]> {
      const qs = new URLSearchParams({ limit: String(limit), ...(since ? { since } : {}) });
      return api<RemoteRow[]>('GET', `/sync/${table}?${qs.toString()}`);
    },
  };
}
