import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../db/migrations');

/**
 * Aplica db/migrations/*.sql em ordem (uma transação por arquivo) e registra em schema_migrations.
 * Depois define as senhas dos papéis de conexão (app_api / app_service) a partir do ambiente.
 */
export async function migrate(
  url = process.env.MIGRATION_DATABASE_URL,
  log = console.log,
): Promise<string[]> {
  if (!url) throw new Error('MIGRATION_DATABASE_URL não definido');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(`create table if not exists public.schema_migrations (
      version text primary key, applied_at timestamptz not null default now())`);
    const done = new Set(
      (
        await client.query<{ version: string }>('select version from public.schema_migrations')
      ).rows.map((r) => r.version),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (version) values ($1)', [file]);
        await client.query('commit');
        applied.push(file);
        log(`✓ ${file}`);
      } catch (e) {
        await client.query('rollback');
        throw new Error(`Falha em ${file}: ${(e as Error).message}`, { cause: e });
      }
    }
    for (const [role, env] of [
      ['app_api', 'APP_API_PASSWORD'],
      ['app_service', 'APP_SERVICE_PASSWORD'],
    ] as const) {
      const pw = process.env[env];
      if (pw) await client.query(`alter role ${role} password ${client.escapeLiteral(pw)}`);
    }
    if (!applied.length) log('Banco já está atualizado.');
    return applied;
  } finally {
    await client.end();
  }
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('migrate.ts')
) {
  migrate().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
