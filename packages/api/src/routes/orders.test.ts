// packages/api/src/routes/orders.test.ts

import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../index';
import { getAdminToken } from '../test-helpers';

let authToken: string;
const testOrderNumber = `TEST-ORDER-${Date.now()}`;

beforeAll(async () => {
  authToken = await getAdminToken();
});

describe('Orders API - Public Endpoints', () => {
  it('GET /api/orders should return array', async () => {
    const res = await app.request('/api/orders');
    expect(res.status).toBe(200);

    const orders = await res.json();
    expect(Array.isArray(orders)).toBe(true);
  });

  it('GET /api/orders/available should return orders and compatibility', async () => {
    const res = await app.request('/api/orders/available');
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      orders: unknown[];
      byPart: unknown[];
      compatibility: object;
    };
    expect(Array.isArray(json.orders)).toBe(true);
    expect(Array.isArray(json.byPart)).toBe(true);
    expect(typeof json.compatibility).toBe('object');
  });
});

describe('Orders API - Auth Required', () => {
  it('POST /api/orders should require auth', async () => {
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: 'TEST-001',
        partNumber: 'TEST-PART',
        quantityRequired: 100,
      }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/orders should create order with auth', async () => {
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        orderNumber: testOrderNumber,
        partNumber: '130877-T2R', // Actual part from seed data
        quantityRequired: 100,
      }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; orderNumber: string };
    expect(json.success).toBe(true);
    expect(json.orderNumber).toBe(testOrderNumber);
  });

  it('POST /api/orders should reject duplicate order number', async () => {
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        orderNumber: testOrderNumber, // Same as before
        partNumber: '130877-T2R',
        quantityRequired: 50,
      }),
    });
    expect(res.status).toBe(409);

    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('already exists');
  });

  it('PATCH /api/orders/:orderNumber should update order', async () => {
    const res = await app.request(`/api/orders/${testOrderNumber}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        status: 'assigned',
        notes: 'Updated by test',
      }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('POST /api/orders/:orderNumber/assign should assign machine', async () => {
    const res = await app.request(`/api/orders/${testOrderNumber}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        machineId: 1, // Assumes machine 1 exists
      }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('DELETE /api/orders/:orderNumber should delete order', async () => {
    const res = await app.request(`/api/orders/${testOrderNumber}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });
});

describe('Orders API - Bulk Import', () => {
  it('POST /api/orders/bulk-import should require auth', async () => {
    const res = await app.request('/api/orders/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/orders/bulk-import should reject empty import', async () => {
    const res = await app.request('/api/orders/bulk-import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify([]),
    });
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('No valid orders');
  });
});
