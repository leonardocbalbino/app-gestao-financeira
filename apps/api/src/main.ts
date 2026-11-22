import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { buildDeps } from './deps.ts';
import { startWorker } from './worker.ts';

const deps = buildDeps();
const app = createApp(deps);

serve({ fetch: app.fetch, port: deps.cfg.PORT, hostname: '0.0.0.0' }, (info) => {
  console.info(`API em http://localhost:${info.port}`);
  const ch = deps.providers.status();
  console.info(
    `Canais: ${Object.entries(ch)
      .map(([k, v]) => `${k}=${v}`)
      .join(' · ')}`,
  );
});

// Em um único processo por padrão; em produção pode rodar separado (pnpm worker) com RUN_WORKER=false.
if (process.env.RUN_WORKER !== 'false') startWorker(deps);
