// packages/api/src/routes/machines.test.ts

import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../index';
import { getAdminToken } from '../test-helpers';

let authToken: string;

beforeAll(async () => {
  authToken = await getAdminToken();
});

describe('Work Centers API - Public Endpoints', () => {
  it('GET /api/work-centers should return array with work center details', async () => {
    const res = await app.request('/api/work-centers');
    expect(res.status).toBe(200);

    const workCenters = (await res.json()) as Array<{
      id: number;
      name: string;
      status: string;
      type: string;
    }>;
    expect(Array.isArray(workCenters)).toBe(true);

    if (workCenters.length > 0) {
      expect(workCenters[0]).toHaveProperty('id');
      expect(workCenters[0]).toHaveProperty('name');
      expect(workCenters[0]).toHaveProperty('status');
    }
  });

  it('GET /api/work-centers/:id should return work center details', async () => {
    const res = await app.request('/api/work-centers/1');
    expect(res.status).toBe(200);

    const wc = (await res.json()) as { id: number; name: string };
    expect(wc.id).toBe(1);
    expect(wc.name).toBeDefined();
  });

  it('GET /api/work-centers/:id should return 404 for unknown work center', async () => {
    const res = await app.request('/api/work-centers/99999');
    expect(res.status).toBe(404);
  });

  it('GET /api/summary should return status counts', async () => {
    const res = await app.request('/api/summary');
    expect(res.status).toBe(200);

    const summary = (await res.json()) as {
      total: number;
      running: number;
      idle: number;
      fault: number;
      offline: number;
    };
    expect(typeof summary.total).toBe('number');
    expect(typeof summary.running).toBe('number');
    expect(typeof summary.idle).toBe('number');
    expect(typeof summary.fault).toBe('number');
    expect(typeof summary.offline).toBe('number');
  });
});

describe('Work Centers API - Auth Required', () => {
  it('POST /api/work-centers should require auth', async () => {
    const res = await app.request('/api/work-centers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'TEST-MACHINE',
        type: 'injection',
        tonnage: 100,
      }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/work-centers/:id/assign-order should require auth', async () => {
    const res = await app.request('/api/work-centers/1/assign-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: null }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/work-centers/:id/assign-order should clear order with auth', async () => {
    const res = await app.request('/api/work-centers/1/assign-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ orderNumber: null }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('POST /api/work-centers/:id/manual-status should require auth', async () => {
    const res = await app.request('/api/work-centers/1/manual-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'idle', updatedBy: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/work-centers/:id/input-mode should require auth', async () => {
    const res = await app.request('/api/work-centers/1/input-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'manual' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Work Centers API - Admin Only', () => {
  it('DELETE /api/work-centers/:id should require auth', async () => {
    const res = await app.request('/api/work-centers/99999', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});
