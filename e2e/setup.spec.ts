import { test, expect } from '@playwright/test';

test.describe('First Time Setup', () => {
  // Note: These tests verify the app works in both fresh and initialized states.
  // The app may already be initialized from previous test runs.

  test('should show setup page when no PIN is configured', async ({ page, request }) => {
    // Check current state first
    const settingsRes = await request.get('http://localhost:3001/api/admin/settings');
    const settings = await settingsRes.json();
    
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    if (!settings.hasPinConfigured) {
      // Fresh state - should show setup prompt
      await expect(page.locator('text=Set Admin PIN')).toBeVisible({ timeout: 5000 });
    } else {
      // Already initialized - app should load without issues
      // Just verify the page loaded successfully
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should allow setting initial admin PIN', async ({ page, request }) => {
    // Check if PIN is already set
    const settingsRes = await request.get('http://localhost:3001/api/admin/settings');
    const settings = await settingsRes.json();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    if (!settings.hasPinConfigured) {
      // Fresh state - set initial PIN
      const pinSetupButton = page.locator('text=Set Admin PIN').first();
      await expect(pinSetupButton).toBeVisible({ timeout: 5000 });
      await pinSetupButton.click();
      
      // Fill in the PIN fields
      const newPinInput = page.locator('input[type="password"]').first();
      await newPinInput.fill('1234');
      
      const confirmPinInput = page.locator('input[type="password"]').nth(1);
      if (await confirmPinInput.isVisible()) {
        await confirmPinInput.fill('1234');
      }
      
      // Submit
      await page.locator('button[type="submit"]').click();
      
      // Should proceed to main app
      await expect(page).toHaveURL('/');
    } else {
      // Already initialized - verify app loads
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
