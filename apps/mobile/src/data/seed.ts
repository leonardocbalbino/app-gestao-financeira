import { isNull, sql } from 'drizzle-orm';
import { DEFAULT_CATEGORIES } from '@app/shared';
import { newId, nowISO } from '@/lib/id';
import type { AppDB } from './db';
import { accounts, categories } from './schema';

/** Semeia categorias padrão e uma conta inicial no primeiro uso. Idempotente. */
export function seedDefaults(db: AppDB): void {
  const now = nowISO();
  const catCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .get()?.n ?? 0;
  if (catCount === 0) {
    db.insert(categories)
      .values(
        DEFAULT_CATEGORIES.map((c, i) => ({
          id: newId(),
          slug: c.slug,
          name: c.name,
          kind: c.kind,
          icon: c.icon,
          color: c.color,
          isDefault: true,
          sortOrder: i,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();
  }
  const accCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(accounts)
      .where(isNull(accounts.deletedAt))
      .get()?.n ?? 0;
  if (accCount === 0) {
    db.insert(accounts)
      .values({
        id: newId(),
        name: 'Carteira',
        type: 'cash',
        initialBalanceCents: 0,
        color: '#0B6E4F',
        icon: 'wallet',
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}
