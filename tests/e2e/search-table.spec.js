import { test, expect } from '@playwright/test';

test('search and table integration', async ({ page }) => {
  await page.goto('/');

  // Wait for dataset to load
  await page.waitForSelector('h2:has-text("Dataset Information")');

  // Check initial word count
  const initialCountText = await page.textContent('h3');
  expect(initialCountText).toContain('Words (');

  // Enter search query
  await page.fill('input[placeholder="Search words..."]', 'labas');

  // Wait for filtering
  await page.waitForTimeout(100); // Allow time for reactivity

  // Check filtered results
  const filteredCountText = await page.textContent('h3');
  expect(filteredCountText).toContain('Words (');

  // Check table has rows
  const rows = await page.locator('tbody tr').count();
  expect(rows).toBeGreaterThan(0);

  // Check that all visible words contain the search query
  const wordCells = await page.locator('tbody td:first-child').allTextContents();
  wordCells.forEach(word => {
    expect(word.toLowerCase()).toContain('labas');
  });

  // Test sorting by frequency
  await page.click('th:has-text("Frequency")');
  await page.waitForTimeout(100);

  // Check sort indicator
  const sortIndicator = await page.textContent('th:has-text("Frequency")');
  expect(sortIndicator).toContain('↑');

  // Click again for descending
  await page.click('th:has-text("Frequency")');
  await page.waitForTimeout(100);
  const sortIndicatorDesc = await page.textContent('th:has-text("Frequency")');
  expect(sortIndicatorDesc).toContain('↓');
});