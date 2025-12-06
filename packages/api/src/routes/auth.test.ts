import { describe, expect, it } from 'bun:test';
import { app } from '../index';
let authToken: string;

describe('Auth API - Login Flow', () => {
  it('should reject login with invalid credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nonexistent', password: 'wrong' }),
    });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe('Invalid credentials');
  });

  it('should login successfully with valid credentials', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { token: string; user: { username: string; role: string } };
    expect(json.token).toBeDefined();
    expect(json.user.username).toBe('admin');
    expect(json.user.role).toBe('admin');

    // Store token for subsequent tests
    authToken = json.token;
  });

  it('should access /api/auth/me with valid token', async () => {
    const res = await app.request('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);

    const json = (await res.json()) as { username: string; role: string };
    expect(json.username).toBe('admin');
    expect(json.role).toBe('admin');
  });

  it('should reject /api/auth/me without token', async () => {
    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('should reject /api/auth/me with invalid token', async () => {
    const res = await app.request('/api/auth/me', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
  });
});
