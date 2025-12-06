// packages/api/src/routes/downtime.test.ts

import { describe, expect, it } from 'bun:test';
import { app } from '../index';

describe('Downtime API', () => {
  it('GET /api/downtime should return array', async () => {
    const res = await app.request('/api/downtime');
    expect(res.status).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('GET /api/downtime with machineId filter should work', async () => {
    const res = await app.request('/api/downtime?machineId=1');
    expect(res.status).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('GET /api/downtime/summary should return array', async () => {
    const res = await app.request('/api/downtime/summary');
    expect(res.status).toBe(200);

    const summary = await res.json();
    expect(Array.isArray(summary)).toBe(true);
  });

  it('POST /api/downtime should require machineId and reasonCode', async () => {
    const res = await app.request('/api/downtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('required');
  });

  it('PATCH /api/downtime/:id should return 404 for unknown id', async () => {
    const res = await app.request('/api/downtime/99999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/downtime/:id should return 404 for unknown id', async () => {
    const res = await app.request('/api/downtime/99999', {
      method: 'DELETE',
    });
    expect(res.status).toBe(404);
  });
});
