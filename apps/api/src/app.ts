import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import { ApiError, mapDbError, type AppEnv, type Deps } from './context.ts';
import { authRoutes } from './routes/auth.ts';
import { userRoutes } from './routes/user.ts';
import { reminderRoutes } from './routes/reminders.ts';
import { webhookRoutes } from './routes/webhooks.ts';
import { adminRoutes } from './routes/admin.ts';

export function createApp(d: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin) => (d.cfg.corsOrigins.includes(origin) ? origin : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );

  // Sessão: Bearer JWT (access token curto). Sem token = requisição anônima.
  app.use('*', async (c, next) => {
    const h = c.req.header('authorization');
    c.set('userId', null);
    c.set('anon', false);
    if (h?.startsWith('Bearer ') && !c.req.path.startsWith('/v1/webhooks')) {
      const claims = await d.tokens.verifyAccess(h.slice(7));
      if (claims) {
        c.set('userId', claims.sub);
        c.set('anon', claims.anon);
      }
    }
    await next();
  });

  app.get('/health', async (c) => {
    await d.db.api.query('select 1');
    return c.json({ ok: true });
  });

  app.route('/v1/auth', authRoutes(d));
  app.route('/v1', userRoutes(d));
  app.route('/v1/reminders', reminderRoutes(d));
  app.route('/v1/webhooks', webhookRoutes(d));
  app.route('/v1/admin', adminRoutes(d));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    const mapped = err instanceof HTTPException ? err : mapDbError(err);
    if (mapped) {
      const code =
        mapped instanceof ApiError ? String(mapped.cause ?? mapped.message) : mapped.message;
      return c.json({ error: code, message: mapped.message }, mapped.status);
    }
    console.error(err);
    return c.json({ error: 'internal_error', message: 'Erro inesperado.' }, 500);
  });

  return app;
}
