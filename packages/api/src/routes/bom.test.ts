// packages/api/src/routes/bom.test.ts
import { describe, expect, test } from 'bun:test';
import { app } from '../index';

describe('BOM Routes', () => {
  describe('GET /api/bom', () => {
    test('returns list of BOM entries', async () => {
      const res = await app.request('/api/bom');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/bom/parent/:parentItem', () => {
    test('returns 404 for non-existent parent item', async () => {
      const res = await app.request('/api/bom/parent/NON-EXISTENT-ITEM');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/bom/:id', () => {
    test('returns 404 for non-existent BOM entry', async () => {
      const res = await app.request('/api/bom/999999');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/bom', () => {
    test('requires authentication', async () => {
      const res = await app.request('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentItem: 'PARENT-001',
          childItem: 'CHILD-001',
          quantity: 2,
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/bom/:id', () => {
    test('requires authentication', async () => {
      const res = await app.request('/api/bom/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 5 }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/bom/:id', () => {
    test('requires authentication', async () => {
      const res = await app.request('/api/bom/1', {
        method: 'DELETE',
      });
      expect(res.status).toBe(401);
    });
  });
});
