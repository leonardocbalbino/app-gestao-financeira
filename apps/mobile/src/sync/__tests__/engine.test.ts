/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import type { AppDB } from '@/data/db';
import { accounts, transactions } from '@/data/schema';
import { createTestDb } from '@/test/testDb';
import { createAccount, listAccounts } from '@/data/repositories/accounts';
import { listCategories } from '@/data/repositories/categories';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '@/data/repositories/transactions';
import { syncOnce } from '../engine';
import { fromRemote, toRemote } from '../mapping';
import { FakeRemote, memoryCursors } from '@/test/fakeRemote';

const tx = (db: AppDB, description: string, date = '2026-11-10', amountCents = 1000) =>
  createTransaction(db, {
    kind: 'expense',
    amountCents,
    description,
    categoryId: listCategories(db).find((c) => c.slug === 'alimentacao')!.id,
    accountId: listAccounts(db)[0]!.id,
    toAccountId: null,
    date,
    notes: null,
    recurrence: 'none',
  });

let remote: FakeRemote;
let a: AppDB;
let b: AppDB;
let ca = memoryCursors();
let cb = memoryCursors();

beforeEach(async () => {
  remote = new FakeRemote();
  a = await createTestDb();
  b = await createTestDb();
  ca = memoryCursors();
  cb = memoryCursors();
});

describe('mapping', () => {
  it('ida e volta preserva campos e descarta locais', () => {
    const row = tx(a, 'Mercado');
    const remoteRow = toRemote('transactions', { ...row, dirty: true });
    expect(remoteRow).toMatchObject({ amount_cents: 1000, account_id: row.accountId });
    expect('dirty' in remoteRow).toBe(false);
    const back = fromRemote('transactions', {
      ...remoteRow,
      date: '2026-11-10',
      user_id: 'u',
      server_updated_at: 'x',
    });
    expect(back).toMatchObject({ amountCents: 1000, date: '2026-11-10', dirty: false });
    expect('userId' in back).toBe(false);
  });
});

describe('syncOnce', () => {
  it('dois aparelhos convergem; categorias padrão são unificadas e a Carteira não duplica', async () => {
    tx(a, 'Mercado A');
    await syncOnce(a, remote, ca);
    tx(b, 'Padaria B'); // B tem suas próprias categorias/carteira semeadas
    await syncOnce(b, remote, cb);
    await syncOnce(a, remote, ca);

    const descA = listTransactions(a)
      .map((t) => t.description)
      .sort();
    const descB = listTransactions(b)
      .map((t) => t.description)
      .sort();
    expect(descA).toEqual(['Mercado A', 'Padaria B']);
    expect(descB).toEqual(descA);
    // categorias: 10 em cada, mesmos ids
    expect(
      listCategories(b)
        .map((c) => c.id)
        .sort(),
    ).toEqual(
      listCategories(a)
        .map((c) => c.id)
        .sort(),
    );
    // a transação de B aponta para a categoria unificada
    expect(listTransactions(a).every((t) => t.categoryName === 'Alimentação')).toBe(true);
    // B usou a própria Carteira (tem transação) → ela permanece; A vê as duas contas
    expect(listAccounts(a)).toHaveLength(2);
  });

  it('Carteira semeada e nunca usada some no primeiro sync de um aparelho novo', async () => {
    createAccount(a, {
      name: 'Banco',
      type: 'checking',
      initialBalanceCents: 0,
      color: '#000000',
      icon: 'wallet',
    });
    await syncOnce(a, remote, ca);
    await syncOnce(b, remote, cb);
    expect(
      listAccounts(b)
        .map((x) => x.name)
        .sort(),
    ).toEqual(['Banco', 'Carteira']);
    expect(
      listAccounts(b)
        .map((x) => x.id)
        .sort(),
    ).toEqual(
      listAccounts(a)
        .map((x) => x.id)
        .sort(),
    );
  });

  it('exclusão (tombstone) propaga', async () => {
    const t = tx(a, 'Apagar');
    await syncOnce(a, remote, ca);
    await syncOnce(b, remote, cb);
    expect(listTransactions(b)).toHaveLength(1);
    deleteTransaction(a, t.id);
    await syncOnce(a, remote, ca);
    await syncOnce(b, remote, cb);
    expect(listTransactions(b)).toHaveLength(0);
  });

  it('conflito: vence a edição mais recente (LWW)', async () => {
    const t = tx(a, 'Original');
    await syncOnce(a, remote, ca);
    await syncOnce(b, remote, cb);
    const form = {
      kind: 'expense' as const,
      amountCents: 1000,
      categoryId: t.categoryId,
      accountId: t.accountId,
      toAccountId: null,
      date: t.date,
      notes: null,
      recurrence: 'none' as const,
    };
    updateTransaction(b, t.id, { ...form, description: 'Edição B' });
    // A edita depois (relógio maior)
    await new Promise((r) => setTimeout(r, 5));
    updateTransaction(a, t.id, { ...form, description: 'Edição A' });
    await syncOnce(b, remote, cb);
    await syncOnce(a, remote, ca);
    await syncOnce(b, remote, cb);
    expect(listTransactions(a)[0]?.description).toBe('Edição A');
    expect(listTransactions(b)[0]?.description).toBe('Edição A');
  });

  it('limpa dirty após push e mantém rejeitadas para nova tentativa', async () => {
    remote.reject = (table) => (table === 'accounts' ? 'limit_reached:accounts.max' : null);
    const t = tx(a, 'X');
    const report = await syncOnce(a, remote, ca);
    expect(report.rejected).toEqual([
      expect.objectContaining({ table: 'accounts', reason: 'limit_reached:accounts.max' }),
    ]);
    expect(a.select().from(transactions).where(eq(transactions.id, t.id)).get()?.dirty).toBe(false);
    expect(a.select().from(accounts).all()[0]?.dirty).toBe(true);
  });

  it('segundo sync sem mudanças não envia nem recebe nada', async () => {
    tx(a, 'Y');
    await syncOnce(a, remote, ca);
    const again = await syncOnce(a, remote, ca);
    expect(again.pushed).toBe(0);
    // pull pode trazer as próprias linhas recém-enviadas uma vez; na terceira, nada
    const third = await syncOnce(a, remote, ca);
    expect(third).toEqual({ pulled: 0, pushed: 0, rejected: [] });
  });
});
