// packages/api/src/test-helpers.ts
// Shared test utilities

import { app } from './index';

let authToken: string | null = null;

/**
 * Get a valid admin JWT token for testing authenticated endpoints.
 */
export async function getAdminToken(): Promise<string> {
  if (authToken) return authToken;

  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });

  const json = (await res.json()) as { token: string };
  authToken = json.token;
  return authToken;
}
