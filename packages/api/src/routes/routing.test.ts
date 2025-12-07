import { describe, expect, it } from 'bun:test';
import { app } from '../index';

describe('Routing API', () => {
  it('GET /api/routing should return array', async () => {
    const res = await app.request('/api/routing');
    expect(res.status).toBe(200);

    const routes = await res.json();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('GET /api/routing/:id should return 404 for unknown id', async () => {
    const res = await app.request('/api/routing/999999');
    expect(res.status).toBe(404);
  });

  it('GET /api/routing/work-center/:workCenterId should return array', async () => {
    const res = await app.request('/api/routing/work-center/1');
    expect(res.status).toBe(200);

    const routes = await res.json();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('GET /api/routing/item/:itemNumber should return array', async () => {
    const res = await app.request('/api/routing/item/TEST-ITEM');
    expect(res.status).toBe(200);

    const routes = await res.json();
    expect(Array.isArray(routes)).toBe(true);
  });

  it('POST /api/routing should require auth', async () => {
    const res = await app.request('/api/routing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workCenterId: 1,
        itemNumber: 'TEST-ITEM',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/routing/:id should require auth', async () => {
    const res = await app.request('/api/routing/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycleTime: 30,
      }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/routing/:id should require auth', async () => {
    const res = await app.request('/api/routing/1', {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});
