import pg from 'pg';
import { migrate } from '../src/db/migrate.ts';

export const TEST_DB = 'gestao_test';
const ADMIN_URL =
  process.env.MIGRATION_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:56432/gestao';

/** Recria o banco de teste do zero e aplica as migrations (Postgres do docker compose). */
export default async function setup() {
  const url = new URL(ADMIN_URL);
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${TEST_DB}'`,
  );
  await admin.query(`drop database if exists ${TEST_DB}`);
  await admin.query(`create database ${TEST_DB}`);
  await admin.end();

  url.pathname = `/${TEST_DB}`;
  process.env.APP_API_PASSWORD ??= 'dev_app_api';
  process.env.APP_SERVICE_PASSWORD ??= 'dev_app_service';
  await migrate(url.toString(), () => undefined);
}
