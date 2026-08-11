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

async function downloadText(download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('The browser did not provide a download stream.');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

test('looks up one privacy-safe BLKT word profile with a bounded browser request', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const assertHealthy = observePageHealth(page);
  const profileRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/data-products/vssa-2026-blkt-wordform-profile/')) {
      profileRequests.push(request.url());
    }
  });

  await page.goto('blkt-profilis');
  await expect(page.getByRole('heading', { name: 'BLKT žodžio profilis' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ieškoti BLKT' })).toBeVisible();
  await expect(page.getByText(/BLKT nėra reprezentatyvus visos lietuvių kalbos portretas/)).toBeVisible();
  await expect(page.getByText(/ne patvirtinti lietuviški ar taisyklingi žodžiai/)).toBeVisible();
  await expect(page.getByText(/Potipiai, tekstai, pavadinimai, autoriai/)).toBeVisible();
  expect(profileRequests.filter((url) => url.endsWith('/manifest.json'))).toHaveLength(1);
  expect(profileRequests.some((url) => url.includes('/chunks/'))).toBe(false);

  const input = page.getByLabel('Viena žodžio forma');
  await input.fill('IR');
  await expect(input).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'ir', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visas tekstynas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pagal teksto tipą' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pagal laikotarpį' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(3);
  expect(profileRequests.filter((url) => url.includes('/chunks/'))).toHaveLength(1);
  expect(profileRequests.filter((url) => url.includes('/routing/'))).toHaveLength(1);

  const typeTableRegion = page.getByRole('region', { name: 'Rezultatai pagal teksto tipą' });
  await typeTableRegion.focus();
  await expect(typeTableRegion).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => typeTableRegion.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Atsisiųsti šį atsakymą JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('blkt-ir.json');
  const downloadedProfile = JSON.parse(await downloadText(download));
  expect(downloadedProfile).toMatchObject({
    schemaVersion: 1,
    productId: 'vssa-2026-blkt-wordform-profile',
    word: 'ir',
    sourceScopeCaveat: expect.stringMatching(/not representative/),
    sourceLicences: {
      inventory: expect.arrayContaining([expect.objectContaining({ sourceLabel: 'CC BY-SA 4.0' })])
    },
    source: {
      rights: {
        licences: expect.arrayContaining([
          expect.objectContaining({ id: 'newgenltu-openrail-d-v1.0', fullText: expect.stringContaining('Attachment A') }),
          expect.objectContaining({ id: 'cc-by-sa-4.0', fullText: expect.stringContaining('Section 3 -- License Conditions.') })
        ])
      }
    }
  });
  for (const prohibitedKey of ['rawText', 'documentId', 'sourceId', 'title', 'author', 'excerpt', 'context']) {
    expect(JSON.stringify(downloadedProfile)).not.toContain(`\"${prohibitedKey}\"`);
  }

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  assertHealthy();
});

test('uses the same privacy-safe message when an exact BLKT word is not published', async ({ page }) => {
  await page.goto('blkt-profilis');
  await expect(page.getByRole('button', { name: 'Ieškoti BLKT' })).toBeVisible();

  await page.getByLabel('Viena žodžio forma').fill('ž'.repeat(64));
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Žodis paskelbtame profilyje nerastas' })).toBeVisible();
  await expect(page.getByText(/galėjo būti neaptiktas arba nepraeiti saugos slenksčio/i)).toBeVisible();
  await expect(page.getByText(/nereiškia, kad tokios raidžių sekos nėra BLKT/i)).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});
