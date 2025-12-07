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
        itemNumber: '130877-T2R', // Actual part from seed data
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
        workCenterId: testMachineId,
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
      order: { orderNumber: string; status: string; workCenterId: number | null };
    }>;
    const order = orders.find((o) => o.order.orderNumber === testOrderNumber);

    expect(order).toBeDefined();
    expect(order?.order.status).toBe('assigned');
    expect(order?.order.workCenterId).toBe(testMachineId);
  });

  it('Step 4: Configure the machine with the order', async () => {
    const res = await app.request(`/api/work-centers/${testMachineId}/assign-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        orderNumber: testOrderNumber,
      }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { success: boolean; data: { orderNumber: string } };
    expect(json.success).toBe(true);
    expect(json.data.orderNumber).toBe(testOrderNumber);
  });

  it('Step 5: Verify machine is configured', async () => {
    const res = await app.request(`/api/work-centers/${testMachineId}`);
    expect(res.status).toBe(200);

    const workCenter = (await res.json()) as { currentOrder: { orderNumber: string } | null };
    expect(workCenter.currentOrder?.orderNumber).toBe(testOrderNumber);
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
    const res = await app.request(`/api/work-centers/${testMachineId}/assign-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ orderNumber: null }),
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
