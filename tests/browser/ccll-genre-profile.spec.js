import { expect, test } from '@playwright/test';

function observePageHealth(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} (${request.failure()?.errorText ?? 'unknown failure'})`);
  });
  return () => {
    expect(consoleErrors, 'browser console errors').toEqual([]);
    expect(pageErrors, 'uncaught page errors').toEqual([]);
    expect(failedRequests, 'failed browser requests').toEqual([]);
  };
}

test('looks up one CCLL wordform by named genre without loading the corpus', async ({ page }) => {
  const assertHealthy = observePageHealth(page);
  const profileRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/analysis/ccll-wordform-genre-profile/')) profileRequests.push(request.url());
  });

  await page.goto('zanru-profilis');
  await expect(page.getByRole('heading', { name: 'CCLL žanrų profilis pagal žodžio formą' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ieškoti žanruose' })).toBeVisible();
  expect(profileRequests.filter((url) => url.endsWith('/manifest.json'))).toHaveLength(1);
  expect(profileRequests.some((url) => url.includes('/buckets/'))).toBe(false);

  await page.getByLabel('Tiksli žodžio forma').fill('ir');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'ir' })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.getByRole('row', { name: /Grožinė literatūra/ })).toContainText(/600.?403/);
  await expect(table.getByRole('row', { name: /Sakytinė kalba/ })).toContainText(/16.?321/);
  expect(profileRequests.filter((url) => url.includes('/buckets/'))).toHaveLength(1);
  expect(profileRequests.some((url) => url.includes('/views/'))).toBe(false);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Atsisiųsti šio atsakymo JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ccll-zanru-profilis-ir\.json$/);

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  assertHealthy();
});

test('does not turn a missing exact wordform into zero', async ({ page }) => {
  await page.goto('zanru-profilis');
  await expect(page.getByRole('button', { name: 'Ieškoti žanruose' })).toBeVisible();
  await page.getByLabel('Tiksli žodžio forma').fill('visiškai-nerasta-forma');
  await page.getByRole('button', { name: 'Ieškoti žanruose' }).click();
  await expect(page.getByRole('heading', { name: 'Forma nerasta' })).toBeVisible();
  await expect(page.getByText(/nereiškia, kad jos nėra lietuvių kalboje/i)).toBeVisible();
});
