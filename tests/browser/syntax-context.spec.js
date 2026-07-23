import { expect, test } from '@playwright/test';

test('loads ALKSNIS sentence contexts only after a visitor selects a source lemma', async ({ page }) => {
  const contextChunkRequests = [];
  const consoleErrors = [];
  page.on('request', (request) => {
    if (request.url().includes('/sentence-contexts-by-lemma/chunks/')) contextChunkRequests.push(request.url());
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('sintakse');
  await expect(page.getByRole('heading', { name: 'ALKSNIS sintaksės kontekstai' })).toBeVisible();
  await expect(page.getByText('Pristatyti sakinių ID')).toBeVisible();
  await expect(page.getByText(/3643 sakinius/)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(contextChunkRequests).toEqual([]);

  await page.getByLabel('Lemos pradžia').fill('kalba');
  await page.getByRole('button', { name: 'Ieškoti' }).click();
  const lemmaButton = page.getByRole('button', { name: /^kalba/ });
  await expect(lemmaButton).toBeVisible();
  expect(contextChunkRequests).toEqual([]);

  await lemmaButton.click();
  await expect(lemmaButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Sakinių kontekstai: kalba' })).toBeVisible();
  await expect(page.locator('blockquote').first()).toBeVisible();
  expect(contextChunkRequests).not.toEqual([]);
  expect(consoleErrors, 'browser console errors').toEqual([]);
});
