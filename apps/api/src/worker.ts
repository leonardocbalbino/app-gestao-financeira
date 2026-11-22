import type { Deps } from './context.ts';

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 15_000);

/** Loop do despachante de lembretes. Seguro com várias instâncias (SKIP LOCKED). */
export function startWorker(deps: Deps): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await deps.dispatcher.tick();
      if (r.processed || r.advanced) {
        console.info(
          `[lembretes] processados=${r.processed} enviados=${r.sent} falhas=${r.failed} ignorados=${r.skipped} recorrências=${r.advanced}`,
        );
      }
    } catch (e) {
      console.error('[lembretes] erro no ciclo:', (e as Error).message);
    } finally {
      running = false;
    }
  };
  void tick();
  const handle = setInterval(() => void tick(), INTERVAL_MS);
  console.info(`[lembretes] worker ativo (a cada ${INTERVAL_MS / 1000}s)`);
  return () => clearInterval(handle);
}

// Execução isolada: pnpm worker
if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/worker.ts')) {
  const { buildDeps } = await import('./deps.ts');
  startWorker(buildDeps());
}
