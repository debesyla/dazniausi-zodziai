import { test, expect } from '@playwright/test';

test('page load performance', async ({ page }) => {
  const startTime = Date.now();
  
  await page.goto('/');
  
  // Wait for dataset to load and be visible
  await page.waitForSelector('h2:has-text("Dataset Information")');
  
  const loadTime = Date.now() - startTime;
  
  // Assert page loads in under 2 seconds
  expect(loadTime).toBeLessThan(2000);
  
  console.log(`Page loaded in ${loadTime}ms`);
});
