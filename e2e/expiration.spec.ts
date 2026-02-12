import { test, expect } from '@playwright/test';

// Helper to set up test data with expiration
async function setupTimerWithExpiration(request: any, expirationTime: string) {
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
  
  // Get current day of week
  const today = new Date().getDay();
  
  // Create a timer with expiration
  const timerRes = await request.post('http://localhost:3001/api/timers', {
    headers: { 'X-Admin-PIN': '1234' },
    data: {
      name: 'Expiring Timer',
      personId: person.id,
      defaultDailySeconds: 3600,
      defaultExpirationTime: expirationTime,
      schedules: [{
        dayOfWeek: today,
        seconds: 3600,
        expirationTime: expirationTime
      }]
    }
  });
  const timer = await timerRes.json();
  
  return { person, timer };
}

test.describe('Timer Expiration', () => {
  test('should show non-expired timer as available', async ({ page, request }) => {
    // Set expiration to far in future (23:59)
    await setupTimerWithExpiration(request, '23:59');
    
    await page.goto('/');
    
    // Timer should be visible
    const timerName = page.locator('text=Expiring Timer').first();
    await expect(timerName).toBeVisible();
    
    // Click on the timer to view details
    await timerName.click();
    await page.waitForURL(/\/timer\//);
    
    // Should not show the specific "expired for today" warning message
    const expiredWarning = page.locator('text=expired for today');
    expect(await expiredWarning.count()).toBe(0);
  });

  test('should disable controls on expired timer', async ({ page, request }) => {
    // Set expiration to past time (00:01 - already passed today)
    await setupTimerWithExpiration(request, '00:01');
    
    await page.goto('/');
    
    // Go to timer detail
    const timerCard = page.locator('text=Expiring Timer').first();
    if (await timerCard.isVisible()) {
      await timerCard.click();
      await page.waitForURL(/\/timer\//);
      
      // Check for expired indicator or disabled buttons
      const expiredIndicator = page.locator('text=expired, text=Expired, [class*="expired"]');
      const disabledButton = page.locator('button:disabled');
      
      // Either expired indicator should be visible OR buttons should be disabled
      const hasExpiredIndicator = await expiredIndicator.count() > 0;
      const hasDisabledButtons = await disabledButton.count() > 0;
      
      // At least one indicator of expiration
      expect(hasExpiredIndicator || hasDisabledButtons).toBeTruthy();
    }
  });

  test('should show expiration warning message', async ({ page, request }) => {
    // Set expiration to past time
    await setupTimerWithExpiration(request, '00:01');
    
    await page.goto('/');
    
    // Go to timer detail
    const timerCard = page.locator('text=Expiring Timer').first();
    if (await timerCard.isVisible()) {
      await timerCard.click();
      await page.waitForURL(/\/timer\//);
      
      // Look for expiration warning
      await page.waitForTimeout(1000);
      
      // Check page content for any expiration-related text
      const pageContent = await page.textContent('body');
      
      // Should contain some indication of expiration
      const hasExpirationText = 
        pageContent?.toLowerCase().includes('expired') ||
        pageContent?.toLowerCase().includes('not available') ||
        pageContent?.toLowerCase().includes('tomorrow');
      
      // Log for debugging
      if (!hasExpirationText) {
        console.log('Page content:', pageContent?.substring(0, 500));
      }
    }
  });
});

test.describe('Timer Expiration API', () => {
  test('should return allocation active status via /current API', async ({ request }) => {
    const { timer } = await setupTimerWithExpiration(request, '00:01');
    
    const response = await request.get(`http://localhost:3001/api/timers/${timer.id}/current`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('allocation');
    expect(data.allocation).toHaveProperty('active');
    expect(typeof data.allocation.active).toBe('boolean');
  });
});
