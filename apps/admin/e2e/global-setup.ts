import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';
import { ADMIN, CUSTOMER } from './fixtures';

/** Mesmo formato do hashPassword da API: scrypt$salt$hash. */
function hash(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 64).toString('base64')}`;
}

/** Cria (ou recria) o admin owner e um cliente de teste no Postgres LOCAL. */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:56432/gestao';
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('E2E só roda contra banco local.');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  await db.query('delete from public.users where email = any($1)', [[ADMIN.email, CUSTOMER.email]]);
  const { rows } = await db.query<{ id: string }>(
    'insert into public.users (email, email_verified_at, password_hash) values ($1, now(), $2) returning id',
    [ADMIN.email, hash(ADMIN.password)],
  );
  await db.query("insert into public.admins (user_id, role) values ($1, 'owner')", [rows[0]!.id]);
  await db.query(
    'insert into public.users (email, email_verified_at, password_hash) values ($1, now(), $2)',
    [CUSTOMER.email, hash(CUSTOMER.password)],
  );
  // matriz limpa para o teste
  await db.query('delete from public.plan_features_draft');
  await db.query(
    'insert into public.plan_features_draft (plan_id, feature_key, value) select plan_id, feature_key, value from public.plan_features',
  );
  await db.end();
}
