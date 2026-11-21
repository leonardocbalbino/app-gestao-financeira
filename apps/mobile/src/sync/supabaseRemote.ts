import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncTable } from '@/data/schema';
import type { PushResult, SyncRemote } from './engine';
import type { RemoteRow } from './mapping';

export function createSupabaseRemote(sb: SupabaseClient): SyncRemote {
  return {
    async push(table: SyncTable, rows: RemoteRow[]): Promise<PushResult> {
      if (rows.length === 0) return { rejected: [] };
      const { data, error } = await sb.rpc('sync_push', { p_table: table, p_rows: rows });
      if (error) throw error;
      const res = data as { rejected?: { id: string; reason: string }[] };
      return { rejected: res.rejected ?? [] };
    },
    async pull(table: SyncTable, since: string | null, limit: number): Promise<RemoteRow[]> {
      let q = sb
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .limit(limit);
      if (since) q = q.gt('server_updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RemoteRow[];
    },
  };
}
