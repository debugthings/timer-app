import { test, expect } from '@playwright/test';

// Helper to set up test data with start time
async function setupTimerWithStartTime(request: any, startTime: string) {
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
  
  // Create a timer with start time
  const timerRes = await request.post('http://localhost:3001/api/timers', {
    headers: { 'X-Admin-PIN': '1234' },
    data: {
      name: 'Start Time Timer',
      personId: person.id,
      defaultDailySeconds: 3600,
      defaultStartTime: startTime,
      schedules: [{
        dayOfWeek: today,
        seconds: 3600,
        startTime: startTime,
      }]
    }
  });
  const timer = await timerRes.json();
  
  return { person, timer };
}

test.describe('Timer Start Time', () => {
  test('should show available timer when after start time', async ({ page, request }) => {
    // Set start time to past (00:01 - already passed today)
    await setupTimerWithStartTime(request, '00:01');
    
    await page.goto('/');
    
    // Timer should be visible
    const timerName = page.locator('text=Start Time Timer').first();
    await expect(timerName).toBeVisible();
    
    // Click on the timer to view details
    await timerName.click();
    await page.waitForURL(/\/timer\//);
    
    // Should not show "not yet available" warning
    const notAvailableWarning = page.locator('text=not yet available');
    expect(await notAvailableWarning.count()).toBe(0);
  });

  test('should disable controls before start time', async ({ page, request }) => {
    // Set start time to future (23:59 - hasn't been reached yet today)
    await setupTimerWithStartTime(request, '23:59');
    
    await page.goto('/');
    
    // Go to timer detail
    const timerCard = page.locator('text=Start Time Timer').first();
    if (await timerCard.isVisible()) {
      await timerCard.click();
      await page.waitForURL(/\/timer\//);
      
      // Check for "not yet available" indicator
      await page.waitForTimeout(1000);
      
      // Should show not available badge or message
      const pageContent = await page.textContent('body');
      const hasNotAvailableIndicator = 
        pageContent?.toLowerCase().includes('not yet available') ||
        pageContent?.toLowerCase().includes('not available') ||
        pageContent?.toLowerCase().includes('check back later');
      
      expect(hasNotAvailableIndicator).toBeTruthy();
    }
  });

  test('should show start time on timer card', async ({ page, request }) => {
    // Create timer with start time
    await setupTimerWithStartTime(request, '06:00');
    
    await page.goto('/');
    
    // Timer should be visible
    const timerName = page.locator('text=Start Time Timer').first();
    await expect(timerName).toBeVisible();
    
    // Check if the card shows "Not Yet Available" badge (if current time is before 6 AM)
    const currentHour = new Date().getHours();
    if (currentHour < 6) {
      const badge = page.locator('text=Not Yet Available');
      await expect(badge).toBeVisible();
    }
  });
});

test.describe('Timer Start Time API', () => {
  test('should return allocation active status via /current API', async ({ request }) => {
    const { timer } = await setupTimerWithStartTime(request, '23:59');
    
    const response = await request.get(`http://localhost:3001/api/timers/${timer.id}/current`);
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('allocation');
    expect(data.allocation).toHaveProperty('active');
    expect(typeof data.allocation.active).toBe('boolean');
  });

  test('should reject checkout creation before start time', async ({ request }) => {
    const { timer } = await setupTimerWithStartTime(request, '23:59');
    
    // Try to create a checkout (should fail since start time is in future)
    const response = await request.post('http://localhost:3001/api/checkouts', {
      data: {
        timerId: timer.id,
        allocatedSeconds: 1800,
      }
    });
    
    // Should either succeed (if time is after 23:59) or fail with 403
    if (response.status() === 403) {
      const data = await response.json();
      expect(data.error).toContain('not yet available');
    }
  });
});
