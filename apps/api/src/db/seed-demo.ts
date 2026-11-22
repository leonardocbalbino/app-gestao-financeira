import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { DEFAULT_CATEGORIES, addMonths, monthKey } from '@app/shared';
import { hashPassword } from '../auth/crypto.ts';

/**
 * Usuários de teste/demonstração (NUNCA rode em produção com dados reais).
 *  - admin@gestao.local  → painel admin (owner), senha em DEMO_ADMIN_PASSWORD (padrão Admin@123456)
 *  - free@gestao.local   → app, plano Free (código fixo via FIXED_OTP_ACCOUNTS)
 *  - pro@gestao.local    → app, plano Pro (concessão manual), com dados e lembretes de exemplo
 */
async function main() {
  const url = process.env.SERVICE_DATABASE_URL ?? process.env.MIGRATION_DATABASE_URL;
  if (!url) throw new Error('SERVICE_DATABASE_URL não definido');
  if (process.env.NODE_ENV === 'production')
    throw new Error('seed de demonstração bloqueado em produção');
  const db = new pg.Client({ connectionString: url });
  await db.connect();

  const upsertUser = async (email: string, extra: Record<string, unknown> = {}) => {
    const cols = ['email', 'email_verified_at', 'is_anonymous', ...Object.keys(extra)];
    const vals = [email, new Date(), false, ...Object.values(extra)];
    const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
    const set = Object.keys(extra)
      .map((k) => `${k} = excluded.${k}`)
      .join(', ');
    const { rows } = await db.query<{ id: string }>(
      `insert into public.users (${cols.join(', ')}) values (${ph})
       on conflict (email) do update set email_verified_at = excluded.email_verified_at${set ? `, ${set}` : ''}
       returning id`,
      vals,
    );
    return rows[0]!.id;
  };

  const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@123456';
  const adminId = await upsertUser('admin@gestao.local', {
    password_hash: await hashPassword(adminPassword),
    display_name: 'Administrador',
  });
  await db.query(
    "insert into public.admins (user_id, role) values ($1, 'owner') on conflict (user_id) do update set role = 'owner'",
    [adminId],
  );

  await upsertUser('free@gestao.local', { display_name: 'Usuário Free' });

  const proId = await upsertUser('pro@gestao.local', {
    display_name: 'Ana Pro',
    phone: '+5511999990000',
    sms_opt_in: true,
    whatsapp_opt_in: true,
  });
  const hasGrant = await db.query(
    'select 1 from public.manual_grants where user_id = $1 and revoked_at is null',
    [proId],
  );
  if (!hasGrant.rowCount) {
    await db.query(
      "insert into public.manual_grants (user_id, plan_id, reason, granted_by) values ($1, 'pro', 'Usuário de demonstração', $2)",
      [proId, adminId],
    );
  }

  // Dados de exemplo na nuvem do Pro (aparecem no app após o primeiro sync)
  const already = await db.query('select 1 from public.accounts where user_id = $1 limit 1', [
    proId,
  ]);
  if (!already.rowCount) {
    const now = new Date().toISOString();
    const meta = { created_at: now, updated_at: now };
    const nubank = randomUUID();
    await db.query(
      `insert into public.accounts (id, user_id, name, type, initial_balance_cents, color, icon, sort_order, created_at, updated_at)
       values ($1, $2, 'Nubank', 'checking', 350000, '#0B6E4F', 'wallet', 0, $3, $4)`,
      [nubank, proId, meta.created_at, meta.updated_at],
    );
    const catIds = new Map<string, string>();
    for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
      const id = randomUUID();
      catIds.set(c.slug, id);
      await db.query(
        `insert into public.categories (id, user_id, slug, name, kind, icon, color, is_default, sort_order, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$10)`,
        [id, proId, c.slug, c.name, c.kind, c.icon, c.color, i, meta.created_at, meta.updated_at],
      );
    }
    const month = monthKey(new Date());
    const prev = addMonths(month, -1);
    const tx: [string, string, number, string, 'expense' | 'income'][] = [
      ['Salário', 'receita', 650000, `${month}-05`, 'income'],
      ['Aluguel', 'moradia', 180000, `${month}-06`, 'expense'],
      ['Mercado', 'alimentacao', 54390, `${month}-08`, 'expense'],
      ['Uber', 'transporte', 3250, `${month}-10`, 'expense'],
      ['Streaming', 'assinaturas', 3990, `${month}-12`, 'expense'],
      ['Restaurante', 'lazer', 12800, `${month}-14`, 'expense'],
      ['Salário', 'receita', 650000, `${prev}-05`, 'income'],
      ['Aluguel', 'moradia', 180000, `${prev}-06`, 'expense'],
      ['Mercado', 'alimentacao', 61200, `${prev}-09`, 'expense'],
    ];
    const today = new Date().toISOString().slice(0, 10);
    for (const [desc, slug, cents, date, kind] of tx) {
      if (date > today) continue;
      await db.query(
        `insert into public.transactions (id, user_id, kind, amount_cents, description, category_id, account_id, date, created_at, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          randomUUID(),
          proId,
          kind,
          cents,
          desc,
          catIds.get(slug),
          nubank,
          date,
          meta.created_at,
          meta.updated_at,
        ],
      );
    }
    await db.query(
      `insert into public.budgets (id, user_id, category_id, limit_cents, start_month, created_at, updated_at)
       values ($1,$2,$3,80000,$4,$5,$6)`,
      [randomUUID(), proId, catIds.get('alimentacao'), month, meta.created_at, meta.updated_at],
    );
  }

  // Lembretes de exemplo (o worker agenda os envios ao subir a API)
  const hasReminders = await db.query('select 1 from public.reminders where user_id = $1 limit 1', [
    proId,
  ]);
  if (!hasReminders.rowCount) {
    const at = (days: number, hour: number) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + days);
      d.setUTCHours(hour + 3, 0, 0, 0); // hora de Brasília
      return d;
    };
    await db.query(
      `insert into public.reminders (user_id, kind, title, amount_cents, due_at, anchor_day, recurrence, offsets_min, channels)
       values ($1, 'payment', 'Conta de luz', 18990, $2::timestamptz, extract(day from $2::timestamptz - interval '3 hours'), 'monthly', '{1440,0}', '{push,email,whatsapp}')`,
      [proId, at(3, 9)],
    );
    await db.query(
      `insert into public.reminders (user_id, kind, title, amount_cents, due_at, anchor_day, recurrence, offsets_min, channels,
          counterparty_name, counterparty_phone, counterparty_email, notify_counterparty, counterparty_channels, note)
       values ($1, 'charge', 'Empréstimo para o João', 50000, $2::timestamptz, extract(day from $2::timestamptz - interval '3 hours'), 'none', '{1440}',
          '{push,sms}', 'João', '+5521988887777', 'joao@exemplo.com', true, '{whatsapp,email}', 'Combinado em 2 parcelas')`,
      [proId, at(5, 10)],
    );
  }

  await db.end();
  console.info('Usuários de teste prontos:');
  console.info(`  Admin  → admin@gestao.local / ${adminPassword}`);
  console.info(
    '  App    → free@gestao.local e pro@gestao.local (código: veja FIXED_OTP_ACCOUNTS no .env)',
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
