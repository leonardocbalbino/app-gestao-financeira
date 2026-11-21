import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';
import type { SyncTable } from '@/data/schema';
import { useDb } from '@/data/DatabaseProvider';
import { useFeature } from '@/entitlements';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { syncOnce, type CursorStore } from './engine';
import { createSupabaseRemote } from './supabaseRemote';

export interface SyncStatus {
  syncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  rejectedCount: number;
}

export const useSyncStatus = create<SyncStatus>(() => ({
  syncing: false,
  lastSyncAt: storage.getString('sync.lastSyncAt') ?? null,
  error: null,
  rejectedCount: 0,
}));

// ---- Disparo após edições locais (debounce) ----
type Listener = () => void;
const listeners = new Set<Listener>();
/** Chamado pelas mutações locais; o SyncManager agrupa em uma rodada (2 s). */
export function requestSync(): void {
  listeners.forEach((l) => l());
}

/** Cursores por usuário (trocar de conta não reaproveita cursores). */
function cursorStore(userId: string): CursorStore {
  const key = (t: SyncTable) => `sync.cursor.${userId}.${t}`;
  return {
    get: (t) => storage.getString(key(t)) ?? null,
    set: (t, c) => storage.set(key(t), c),
  };
}

const INTERVAL_MS = 60_000;
const DEBOUNCE_MS = 2_000;

/** Sincroniza quando o plano tem sync.cloud e há sessão. Sem UI. */
export function SyncManager() {
  const db = useDb();
  const qc = useQueryClient();
  const enabled = useFeature('sync.cloud');
  const { user } = useAuth();
  const running = useRef(false);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!enabled || !userId || !supabase) return;
    const remote = createSupabaseRemote(supabase);
    const cursors = cursorStore(userId);
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (running.current) return;
      running.current = true;
      useSyncStatus.setState({ syncing: true });
      try {
        const report = await syncOnce(db, remote, cursors);
        const now = new Date().toISOString();
        storage.set('sync.lastSyncAt', now);
        useSyncStatus.setState({
          lastSyncAt: now,
          error: null,
          rejectedCount: report.rejected.length,
        });
        if (report.pulled > 0) void qc.invalidateQueries({ queryKey: ['db'] });
      } catch (e) {
        useSyncStatus.setState({ error: (e as Error).message ?? 'Falha ao sincronizar' });
      } finally {
        running.current = false;
        useSyncStatus.setState({ syncing: false });
      }
    };

    const schedule = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void run(), DEBOUNCE_MS);
    };

    void run();
    listeners.add(schedule);
    const interval = setInterval(() => void run(), INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void run());
    return () => {
      listeners.delete(schedule);
      clearInterval(interval);
      sub.remove();
      if (debounce) clearTimeout(debounce);
    };
  }, [enabled, userId, db, qc]);

  return null;
}
