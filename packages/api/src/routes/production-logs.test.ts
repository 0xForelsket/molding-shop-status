// packages/api/src/routes/production-logs.test.ts

import { describe, expect, it } from 'bun:test';
import { app } from '../index';

describe('Production Logs API', () => {
  it('GET /api/production-logs should return array', async () => {
    const res = await app.request('/api/production-logs');
    expect(res.status).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('GET /api/production-logs with machineId filter should work', async () => {
    const res = await app.request('/api/production-logs?machineId=1');
    expect(res.status).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('GET /api/production-logs/today-summary should return array', async () => {
    const res = await app.request('/api/production-logs/today-summary');
    expect(res.status).toBe(200);

    const summary = await res.json();
    expect(Array.isArray(summary)).toBe(true);
  });

  it('POST /api/production-logs should require machineId, orderNumber, shiftInstanceId', async () => {
    const res = await app.request('/api/production-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('required');
  });

  it('PATCH /api/production-logs/:id should return 404 for unknown id', async () => {
    const res = await app.request('/api/production-logs/99999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });
});
