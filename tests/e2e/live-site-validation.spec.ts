import { test, expect } from '@playwright/test';

// This test can be run against the live site by setting LIVE_URL env variable
// Example: LIVE_URL=https://debesyla.github.io/dazniausi-zodziai npx playwright test live-site-validation

const BASE_URL = process.env.LIVE_URL || 'http://localhost:4173';

test.describe('Live Site Validation', () => {
	test('homepage loads successfully', async ({ page }) => {
		await page.goto(BASE_URL);
		
		// Check page loads
		await expect(page).toHaveTitle(/Dažniausi Žodžiai/);
		
		// Check main content is visible
		const heading = page.locator('h1');
		await expect(heading).toBeVisible();
	});

	test('analytics tracking is initialized', async ({ page }) => {
		await page.goto(BASE_URL);
		
		// Wait for page load event
		await page.waitForLoadState('load');
		
		// Check if analytics script runs (look for console log or localStorage)
		const hasPageViews = await page.evaluate(() => {
			return localStorage.getItem('pageViews') !== null;
		});
		
		expect(hasPageViews).toBe(true);
	});

	test('data loads and displays correctly', async ({ page }) => {
		await page.goto(BASE_URL);
		
		// Wait for data to load - look for actual word from dataset
		await page.waitForSelector('text=ir', { timeout: 10000 });
		
		// Check if content is displayed
		const content = await page.textContent('body');
		expect(content).toBeTruthy();
		expect(content!.length).toBeGreaterThan(100);
	});

	test('no console errors on load', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', msg => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
			}
		});
		
		await page.goto(BASE_URL);
		await page.waitForLoadState('networkidle');
		
		// Filter out known non-critical errors
		const criticalErrors = errors.filter(err => 
			!err.includes('favicon') && 
			!err.includes('404')
		);
		
		expect(criticalErrors).toHaveLength(0);
	});

	test('all static assets load successfully', async ({ page }) => {
		const failedResources: string[] = [];
		
		page.on('response', response => {
			if (response.status() >= 400 && !response.url().includes('favicon')) {
				failedResources.push(`${response.url()} - ${response.status()}`);
			}
		});
		
		await page.goto(BASE_URL);
		await page.waitForLoadState('networkidle');
		
		expect(failedResources).toHaveLength(0);
	});

	test('responsive design works', async ({ page }) => {
		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto(BASE_URL);
		await expect(page.locator('body')).toBeVisible();
		
		// Test tablet viewport
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.reload();
		await expect(page.locator('body')).toBeVisible();
		
		// Test desktop viewport
		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.reload();
		await expect(page.locator('body')).toBeVisible();
	});
});
