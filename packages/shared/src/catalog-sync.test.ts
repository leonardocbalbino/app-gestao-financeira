import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURE_CATALOG } from './features';

const migrationsDir = join(__dirname, '../../../supabase/migrations');
const lines = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .flatMap((f) => readFileSync(join(migrationsDir, f), 'utf8').split(/\r?\n/));

describe('catálogo × seed do Supabase', () => {
  it.each(FEATURE_CATALOG.map((f) => [f.key, f] as const))(
    '%s está semeada com o mesmo tipo e default',
    (key, f) => {
      const def = f.defaultValue === null ? 'null' : String(f.defaultValue);
      const row = lines.find((l) => l.trimStart().startsWith(`('${key}', '${f.type}'`));
      expect(row).toBeDefined();
      expect(row).toContain(`, '${def}', `);
    },
  );
});
