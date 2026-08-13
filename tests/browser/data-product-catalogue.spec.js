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

test('makes every public data product discoverable with scope, limits, and a safe access path', async ({ page }) => {
  const assertHealthy = observePageHealth(page);

  await page.goto('duomenu-katalogas');
  await expect(page.getByRole('heading', { name: 'Viešų duomenų katalogas' })).toBeVisible();
  await expect(page.getByText('Kataloge: 15 produktų.')).toBeVisible();
  await expect(page.locator('article.product-card')).toHaveCount(15);

  for (const heading of ['Dažnumo sąrašai', 'Palyginimai', 'Leksiniai rinkiniai', 'Sintaksės kontekstai']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Metaduomenys be eilučių' })).toHaveCount(0);

  const parliament = page.getByRole('article', { name: 'Lithuanian Parliament Corpus corpus-wide frequency aggregates' });
  await expect(parliament.getByText('Šaltinio apimtis')).toBeVisible();
  await expect(parliament.getByText('CC BY 4.0')).toBeVisible();
  await expect(parliament.getByText(/tai nėra autorystės nustatymo, politikų reitingavimo, citatų ar kalendorinės analizės priemonė/i)).toBeVisible();
  await expect(parliament.getByRole('link', { name: 'Atverti JSON aprašą ir prieigą' })).toHaveAttribute(
    'href',
    /data-products\/kapociute-dzikiene-2017-parliament-frequency-aggregates\/manifest\.json$/
  );

  const morphemicDictionary = page.getByRole('article', { name: 'Dažninis lietuvių kalbos morfemikos žodynas' });
  await expect(morphemicDictionary.getByText('Viešas JSON duomenų produktas')).toBeVisible();
  await expect(morphemicDictionary.getByText('Rightsholder permission')).toBeVisible();
  await expect(morphemicDictionary.getByText(/72 325 įrašai.*310 012/i)).toBeVisible();
  await expect(morphemicDictionary.getByText(/61 eilute daugiau.*tik kontekstui.*ne kaip išgavimo tikslas/i)).toBeVisible();
  await expect(morphemicDictionary.getByRole('link', { name: 'Atverti JSON aprašą ir prieigą' })).toHaveAttribute(
    'href',
    /data-products\/rimkute-morphemic-dictionary\/manifest\.json$/
  );
  await expect(morphemicDictionary.getByRole('link', { name: 'Peržiūrėti viešą sprendimo aprašą' })).toHaveCount(0);

  const tableDetails = page.locator('details.table-equivalent');
  await tableDetails.locator('summary').click();
  await expect(tableDetails.getByRole('table')).toBeVisible();
  await expect(tableDetails.locator('tbody tr')).toHaveCount(15);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  assertHealthy();
});
