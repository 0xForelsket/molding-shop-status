// packages/api/src/integration.test.ts
// Full workflow integration test: Create order → Assign machine → Log production → Complete

import { beforeAll, describe, expect, it } from 'bun:test';
import { app } from './index';
import { getAdminToken } from './test-helpers';

let authToken: string;
const testOrderNumber = `INTEG-ORDER-${Date.now()}`;
const testMachineId = 1; // Assumes machine 1 exists

beforeAll(async () => {
  authToken = await getAdminToken();
});

describe('Integration: Full Production Workflow', () => {
  it('Step 1: Create a new production order', async () => {
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

  it('Step 2: Assign the order to a machine', async () => {
    const res = await app.request(`/api/orders/${testOrderNumber}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        machineId: testMachineId,
      }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('Step 3: Verify order is now assigned', async () => {
    const res = await app.request('/api/orders');
    expect(res.status).toBe(200);

    const orders = (await res.json()) as Array<{
      production_orders: { orderNumber: string; status: string; machineId: number | null };
    }>;
    const order = orders.find((o) => o.production_orders.orderNumber === testOrderNumber);

    expect(order).toBeDefined();
    expect(order?.production_orders.status).toBe('assigned');
    expect(order?.production_orders.machineId).toBe(testMachineId);
  });

  it('Step 4: Configure the machine with the order', async () => {
    const res = await app.request(`/api/machines/${testMachineId}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        productionOrder: testOrderNumber,
      }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; data: { productionOrder: string } };
    expect(json.success).toBe(true);
    expect(json.data.productionOrder).toBe(testOrderNumber);
  });

  it('Step 5: Verify machine is configured', async () => {
    const res = await app.request(`/api/machines/${testMachineId}`);
    expect(res.status).toBe(200);

    const machine = (await res.json()) as { productionOrder: string | null };
    expect(machine.productionOrder).toBe(testOrderNumber);
  });

  it('Step 6: Complete the order', async () => {
    const res = await app.request(`/api/orders/${testOrderNumber}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        status: 'completed',
        quantityCompleted: 100,
      }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it('Step 7: Clean up - clear machine config', async () => {
    const res = await app.request(`/api/machines/${testMachineId}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ productionOrder: null }),
    });
    expect(res.status).toBe(200);
  });

  it('Step 8: Clean up - delete test order', async () => {
    const res = await app.request(`/api/orders/${testOrderNumber}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    expect(res.status).toBe(200);
  });
});
