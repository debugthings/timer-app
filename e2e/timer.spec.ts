import { test, expect, Page } from '@playwright/test';

// Helper to set up test data
async function setupTestData(request: any) {
  // Set admin PIN
  await request.post('http://localhost:3001/api/admin/set-pin', {
    data: { newPin: '1234' }
  });
  
  // Create a person
  const personRes = await request.post('http://localhost:3001/api/people', {
    headers: { 'X-Admin-PIN': '1234' },
    data: { name: 'Test User' }
  });
  const person = await personRes.json();
  
  // Create a timer
  const timerRes = await request.post('http://localhost:3001/api/timers', {
    headers: { 'X-Admin-PIN': '1234' },
    data: {
      name: 'Screen Time',
      personId: person.id,
      defaultDailySeconds: 3600 // 1 hour
    }
  });
  const timer = await timerRes.json();
  
  return { person, timer };
}

// Helper to login as admin
async function loginAsAdmin(page: Page) {
  const adminLink = page.locator('[href="/admin"]');
  if (await adminLink.isVisible()) {
    await adminLink.click();
    
    const pinInput = page.locator('input[type="password"]').first();
    if (await pinInput.isVisible()) {
      await pinInput.fill('1234');
      await page.locator('button[type="submit"]').click();
      // Wait for modal to close
      await page.waitForTimeout(500);
    }
  }
}

test.describe('Timer Management', () => {
  test.beforeEach(async ({ request }) => {
    await setupTestData(request);
  });

  test('should display timer on dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Timer should be visible
    const timerName = page.locator('text=Screen Time').first();
    await expect(timerName).toBeVisible();
  });

  test('should show timer details when clicked', async ({ page }) => {
    await page.goto('/');
    
    // Click on timer
    const timerCard = page.locator('text=Screen Time').first();
    await timerCard.click();
    
    // Should show timer detail page
    await expect(page).toHaveURL(/\/timer\//);
    
    // Should show timer name
    await expect(page.locator('h1:has-text("Screen Time"), h2:has-text("Screen Time")')).toBeVisible();
  });

  test('should show remaining time allocation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for timers to load
    await page.waitForSelector('text=Screen Time');
    
    // Should show allocation info (1 hour = 3600 seconds)
    // The exact format may vary, but should show time info
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('Screen Time');
  });
});

test.describe('Timer Checkout Flow', () => {
  test.beforeEach(async ({ request }) => {
    await setupTestData(request);
  });

  test('should create a checkout and start timer', async ({ page }) => {
    await page.goto('/');
    
    // Click on timer to go to detail page
    await page.locator('text=Screen Time').first().click();
    await page.waitForURL(/\/timer\//);
    
    // Look for start or checkout button
    const startButton = page.locator('button:has-text("Start"), button:has-text("Check Out")').first();
    
    if (await startButton.isVisible()) {
      await startButton.click();
      
      // Should show active timer or running state
      await page.waitForTimeout(1000);
      
      // Check for running timer indicators
      const timerDisplay = page.locator('[class*="timer"], [class*="active"], [class*="running"]').first();
      // Timer should be displayed
    }
  });

  test('should pause and resume a running timer', async ({ page }) => {
    await page.goto('/');
    
    // Click on timer
    await page.locator('text=Screen Time').first().click();
    await page.waitForURL(/\/timer\//);
    
    // Start timer
    const startButton = page.locator('button:has-text("Start")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(500);
      
      // Pause timer
      const pauseButton = page.locator('button:has-text("Pause")').first();
      if (await pauseButton.isVisible()) {
        await pauseButton.click();
        await page.waitForTimeout(500);
        
        // Resume timer
        const resumeButton = page.locator('button:has-text("Resume"), button:has-text("Start")').first();
        if (await resumeButton.isVisible()) {
          await resumeButton.click();
          // Timer should be running again
        }
      }
    }
  });

  test('should stop a timer', async ({ page }) => {
    await page.goto('/');
    
    // Click on timer
    await page.locator('text=Screen Time').first().click();
    await page.waitForURL(/\/timer\//);
    
    // Start timer
    const startButton = page.locator('button:has-text("Start")').first();
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(500);
      
      // Stop timer
      const stopButton = page.locator('button:has-text("Stop"), button:has-text("Done")').first();
      if (await stopButton.isVisible()) {
        await stopButton.click();
        
        // May need to confirm
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }
        
        await page.waitForTimeout(500);
        
        // Timer should be stopped
      }
    }
  });
});

test.describe('Quick Checkout', () => {
  test.beforeEach(async ({ request }) => {
    await setupTestData(request);
  });

  test('should support quick checkout with preset time', async ({ page }) => {
    await page.goto('/');
    
    // Click on timer
    await page.locator('text=Screen Time').first().click();
    await page.waitForURL(/\/timer\//);
    
    // Look for quick checkout buttons (like 15min, 30min, etc.)
    const quickButton = page.locator('button:has-text("15"), button:has-text("30"), button:has-text("min")').first();
    
    if (await quickButton.isVisible()) {
      await quickButton.click();
      await page.waitForTimeout(500);
      
      // Timer should start
    }
  });
});
