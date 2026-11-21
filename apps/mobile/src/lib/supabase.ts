import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';
import { env, isSupabaseConfigured } from './env';

/** Sessão do Supabase em instância MMKV separada (não misturar com preferências). */
const authStore = createMMKV({ id: 'supabase-auth' });

const storage = {
  getItem: (key: string) => authStore.getString(key) ?? null,
  setItem: (key: string, value: string) => authStore.set(key, value),
  removeItem: (key: string) => {
    authStore.remove(key);
  },
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

// Renovação automática do token só com o app em primeiro plano.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
