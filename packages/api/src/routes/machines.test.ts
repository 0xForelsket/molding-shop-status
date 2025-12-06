// packages/api/src/routes/machines.test.ts

import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../index';
import { getAdminToken } from '../test-helpers';

let authToken: string;

beforeAll(async () => {
  authToken = await getAdminToken();
});

describe('Machines API - Public Endpoints', () => {
  it('GET /api/machines should return array with machine details', async () => {
    const res = await app.request('/api/machines');
    expect(res.status).toBe(200);

    const machines = (await res.json()) as Array<{
      machineId: number;
      machineName: string;
      status: string;
    }>;
    expect(Array.isArray(machines)).toBe(true);

    if (machines.length > 0) {
      expect(machines[0]).toHaveProperty('machineId');
      expect(machines[0]).toHaveProperty('machineName');
      expect(machines[0]).toHaveProperty('status');
    }
  });

  it('GET /api/machines/:id should return machine details', async () => {
    const res = await app.request('/api/machines/1');
    expect(res.status).toBe(200);

    const machine = (await res.json()) as { machineId: number; machineName: string };
    expect(machine.machineId).toBe(1);
    expect(machine.machineName).toBeDefined();
  });

  it('GET /api/machines/:id should return 404 for unknown machine', async () => {
    const res = await app.request('/api/machines/99999');
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

describe('Machines API - Auth Required', () => {
  it('POST /api/machines should require auth', async () => {
    const res = await app.request('/api/machines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machineName: 'TEST-MACHINE',
        machineType: 'injection',
        tonnage: 100,
      }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/machines/:id/config should require auth', async () => {
    const res = await app.request('/api/machines/1/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productionOrder: null }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/machines/:id/config should clear order with auth', async () => {
    const res = await app.request('/api/machines/1/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ productionOrder: null }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('POST /api/machines/:id/manual-status should require auth', async () => {
    const res = await app.request('/api/machines/1/manual-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'idle', updatedBy: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/machines/:id/input-mode should require auth', async () => {
    const res = await app.request('/api/machines/1/input-mode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'manual' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('Machines API - Admin Only', () => {
  it('DELETE /api/machines/:id should require auth', async () => {
    const res = await app.request('/api/machines/99999', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});
