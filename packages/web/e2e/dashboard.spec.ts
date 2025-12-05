// packages/web/e2e/dashboard.spec.ts

import { expect, test } from '@playwright/test';

test.describe('Dashboard', () => {
  test('should show login page when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should see login form
    await expect(page.locator('h1')).toContainText('Machine Status Dashboard');
    await expect(page.getByPlaceholder('Enter username')).toBeVisible();
    await expect(page.getByPlaceholder('Enter password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('Enter username').fill('nonexistent');
    await page.getByPlaceholder('Enter password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should show error message
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Login with seeded admin user (first login sets password)
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.getByPlaceholder('Enter password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Should see dashboard after login
    await expect(page.locator('h1')).toContainText('Injection Molding');

    // Should see machine grid or summary
    await expect(page.getByText('machines connected')).toBeVisible();
  });
});

test.describe('Dashboard Features', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.getByPlaceholder('Enter username').fill('admin');
    await page.getByPlaceholder('Enter password').fill('admin123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.locator('h1')).toContainText('Injection Molding');
  });

  test('should toggle between grid and table view', async ({ page }) => {
    // Click Manage button for table view
    await page.getByRole('button', { name: 'Manage' }).click();

    // Should see table headers
    await expect(page.getByRole('cell', { name: 'Machine' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Status' })).toBeVisible();

    // Click Grid button to go back
    await page.getByRole('button', { name: 'Grid' }).click();

    // Should see machine cards
    await expect(page.getByTestId('machine-card').first()).toBeVisible();
  });

  test('should display summary counts', async ({ page }) => {
    // Should see summary bar with status counts
    await expect(page.getByText(/Running/)).toBeVisible();
    await expect(page.getByText(/Idle/)).toBeVisible();
    await expect(page.getByText(/Fault/)).toBeVisible();
    await expect(page.getByText(/Offline/)).toBeVisible();
  });
});
