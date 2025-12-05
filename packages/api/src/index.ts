// packages/api/src/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { db } from './db';
import { machines } from './db/schema';
import { errorHandler } from './middleware/error-handler';
import { authRoutes } from './routes/auth';
import { machineRoutes } from './routes/machines';
import { orderRoutes } from './routes/orders';
import { statusRoutes } from './routes/status';

const app = new Hono();

// ============== GLOBAL MIDDLEWARE ==============

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Global error handler
app.onError(errorHandler);

// ============== HEALTH CHECK ==============

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
);

// ============== ROUTES ==============

app.route('/api/auth', authRoutes);
app.route('/api/machines', machineRoutes);
app.route('/api/status', statusRoutes);
app.route('/api/orders', orderRoutes);

// ============== SUMMARY ENDPOINT ==============

const OFFLINE_THRESHOLD_SEC = 30;

app.get('/api/summary', async (c) => {
  const allMachines = await db.select().from(machines);

  const now = Date.now();
  const statuses = allMachines.map((m) => {
    const lastSeenMs = m.lastSeen ? new Date(m.lastSeen).getTime() : null;
    const secondsSinceSeen = lastSeenMs ? Math.floor((now - lastSeenMs) / 1000) : null;
    return secondsSinceSeen && secondsSinceSeen > OFFLINE_THRESHOLD_SEC ? 'offline' : m.status;
  });

  return c.json({
    total: allMachines.length,
    running: statuses.filter((s) => s === 'running').length,
    idle: statuses.filter((s) => s === 'idle').length,
    fault: statuses.filter((s) => s === 'fault').length,
    offline: statuses.filter((s) => s === 'offline').length,
    totalCycles: allMachines.reduce((sum, m) => sum + (m.cycleCount ?? 0), 0),
  });
});

// ============== SSE ENDPOINT (with proper cleanup) ==============

app.get('/api/events', async (c) => {
  const abortController = new AbortController();

  // Cleanup when client disconnects
  c.req.raw.signal.addEventListener('abort', () => {
    abortController.abort();
    console.log('[SSE] Client disconnected');
  });

  return c.streamSSE(async (stream) => {
    try {
      while (!abortController.signal.aborted) {
        const allMachines = await db.select().from(machines);

        if (abortController.signal.aborted) break;

        await stream.writeSSE({
          event: 'machines',
          data: JSON.stringify(allMachines),
        });

        // AbortSignal-aware sleep
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2000);
          abortController.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
        });
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        console.error('[SSE] Error:', err);
      }
    } finally {
      console.log('[SSE] Stream closed');
    }
  });
});

// ============== SERVER EXPORT ==============

const port = Number.parseInt(process.env.API_PORT || '3000');

console.log(`🚀 API server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

// For testing
export { app };
