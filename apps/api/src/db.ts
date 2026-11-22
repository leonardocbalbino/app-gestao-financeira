import pg from 'pg';

// bigint (int8) → number: valores em centavos cabem com folga em Number.MAX_SAFE_INTEGER.
pg.types.setTypeParser(20, (v) => Number(v));
// date → string "YYYY-MM-DD" (data civil, sem fuso)
pg.types.setTypeParser(1082, (v) => v);

export type Queryable = pg.PoolClient;

export interface Db {
  /** Pool sujeito a RLS (papel app_api). */
  api: pg.Pool;
  /** Pool confiável, BYPASSRLS (papel app_service). Use só em código que valida tudo. */
  service: pg.Pool;
  close(): Promise<void>;
}

export function createDb(apiUrl: string, serviceUrl: string): Db {
  const api = new pg.Pool({ connectionString: apiUrl, max: 10 });
  const service = new pg.Pool({ connectionString: serviceUrl, max: 5 });
  return {
    api,
    service,
    close: async () => {
      await Promise.all([api.end(), service.end()]);
    },
  };
}

/**
 * Executa `fn` numa transação com `app.user_id` definido (RLS usa app.uid()).
 * userId null = requisição sem sessão (só dados públicos).
 */
export async function asUser<T>(
  pool: pg.Pool,
  userId: string | null,
  fn: (c: Queryable) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('app.user_id', $1, true)", [userId ?? '']);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function inTx<T>(pool: pg.Pool, fn: (c: Queryable) => Promise<T>): Promise<T> {
  return asUser(pool, null, fn);
}
