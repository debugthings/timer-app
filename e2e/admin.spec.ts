import { test, expect } from '@playwright/test';

test.describe('Admin Panel', () => {
  test.beforeEach(async ({ page, request }) => {
    // Set up admin PIN via API
    await request.post('http://localhost:3001/api/admin/set-pin', {
      data: { newPin: '1234' }
    });
    
    await page.goto('/');
  });

  test('should require PIN to access admin panel', async ({ page }) => {
    // Click admin button/link
    const adminLink = page.locator('[href="/admin"]').first();
    
    if (await adminLink.isVisible()) {
      await adminLink.click();
      
      // Should show PIN modal
      const pinModal = page.locator('text=Enter Admin PIN');
      await expect(pinModal).toBeVisible();
    }
  });

  test('should allow access with correct PIN', async ({ page }) => {
    // Navigate to admin
    const adminLink = page.locator('[href="/admin"]');
    
    if (await adminLink.isVisible()) {
      await adminLink.click();
      
      // Enter PIN
      const pinInput = page.locator('input[type="password"]').first();
      await pinInput.fill('1234');
      
      // Submit
      await page.locator('button[type="submit"]').click();
      
      // Should be on admin page
      await expect(page).toHaveURL(/\/admin/);
    }
  });

  test('should reject incorrect PIN', async ({ page }) => {
    // Navigate to admin
    const adminLink = page.locator('[href="/admin"]');
    
    if (await adminLink.isVisible()) {
      await adminLink.click();
      
      // Enter wrong PIN
      const pinInput = page.locator('input[type="password"]').first();
      await pinInput.fill('wrong');
      
      // Submit
      await page.locator('button[type="submit"]').click();
      
      // Should show error
      const error = page.locator('text=Invalid');
      await expect(error).toBeVisible();
    }
  });
});
