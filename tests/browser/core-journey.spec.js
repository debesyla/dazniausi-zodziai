import { expect, test } from '@playwright/test';

const words = Array.from({ length: 60 }, (_, index) => {
  const position = index + 1;
  return {
    word: `bandomas-${String(position).padStart(3, '0')}`,
    type: position % 2 === 0 ? 'dkt' : 'vksm',
    frequency: 1_000 - position
  };
});

const fixtureCatalog = {
  schemaVersion: 1,
  defaultDatasetId: 'browser-journey-fixture',
  datasets: [
    {
      id: 'browser-journey-fixture',
      title: 'Naršyklės kelionės bandomasis rinkinys',
      author: 'Test author',
      year: 2026,
      entryKind: 'lemma',
      file: 'browser-journey-fixture.json',
      records: words.length,
      totalFrequency: words.reduce((total, word) => total + word.frequency, 0),
      hasPartOfSpeech: true,
      licence: 'CC BY 4.0',
      citation: 'Test citation'
    }
  ]
};

const fixtureDataset = {
  schemaVersion: 1,
  id: 'browser-journey-fixture',
  title: fixtureCatalog.datasets[0].title,
  author: 'Test author',
  year: 2026,
  entryKind: 'lemma',
  duplicatePolicy: 'keep',
  provenance: {
    licence: 'CC BY 4.0',
    citation: 'Test citation',
    sourceUrl: 'https://example.test/source',
    sourceSnapshot: {
      repositoryUrl: 'https://example.test/sources',
      revision: 'test-revision',
      path: 'source.tsv',
      encoding: 'utf-8',
      sha256: 'b'.repeat(64)
    },
    partOfSpeech: {
      name: 'Test POS',
      labels: { dkt: 'Daiktavardis', vksm: 'Veiksmažodis' }
    }
  },
  summary: {
    sourceRows: words.length,
    entryCount: words.length,
    totalFrequency: fixtureCatalog.datasets[0].totalFrequency,
    duplicateEntries: 0
  },
  words
};

async function installFixtures(page) {
  await page.route('**/datasets/catalog.json', (route) => route.fulfill({ json: fixtureCatalog }));
  await page.route('**/datasets/browser-journey-fixture.json', (route) => route.fulfill({ json: fixtureDataset }));
}

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

async function assertResponsiveViewport(page, testInfo) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (!testInfo.project.name.endsWith('-mobile')) return;

  const undersizedControls = await page.locator('button, select, input:not([type="checkbox"])').evaluateAll((elements) => elements
    .filter((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && (bounds.width < 44 || bounds.height < 44);
    })
    .map((element) => ({
      label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? element.tagName,
      width: Math.round(element.getBoundingClientRect().width),
      height: Math.round(element.getBoundingClientRect().height)
    })));
  const undersizedTypeLabels = await page.locator('.type-filter label').evaluateAll((elements) => elements
    .filter((element) => element.getBoundingClientRect().height < 44)
    .map((element) => ({ label: element.textContent?.trim(), height: Math.round(element.getBoundingClientRect().height) })));
  expect(undersizedControls, 'visible mobile controls must meet the 44 px target').toEqual([]);
  expect(undersizedTypeLabels, 'POS labels must provide 44 px touch targets').toEqual([]);
}

test('completes the production visitor journey without browser-health or responsive regressions', async ({ page }, testInfo) => {
  const assertHealthy = observePageHealth(page);
  await installFixtures(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: fixtureDataset.title })).toBeVisible();
  await expect(page.getByText('Rodomi 1–50 iš 60')).toBeVisible();

  await page.getByRole('button', { name: 'Kitas' }).click();
  await expect(page.getByText('2 puslapis iš 2')).toBeVisible();
  await expect(page.getByText('Rodomi 51–60 iš 60')).toBeVisible();
  await page.getByRole('button', { name: 'Ankstesnis' }).click();
  await expect(page.getByText('1 puslapis iš 2')).toBeVisible();

  const wordSort = page.getByRole('button', { name: 'Rikiuoti pagal Žodis: nerikiuota' });
  await wordSort.focus();
  await expect(wordSort).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('columnheader', { name: /Žodis/ })).toHaveAttribute('aria-sort', 'ascending');

  await page.getByLabel('Ieškoti žodžių').fill('bandomas-01');
  await expect(page.getByRole('heading', { name: 'Žodžiai (10)' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Daiktavardis (dkt)' }).check();
  await expect(page.getByRole('heading', { name: 'Žodžiai (5)' })).toBeVisible();
  await page.getByRole('button', { name: 'Išvalyti filtrus' }).click();
  await expect(page.getByRole('heading', { name: 'Žodžiai (60)' })).toBeVisible();
  await expect(page.getByLabel('Ieškoti žodžių')).toHaveValue('');
  await expect(page.getByRole('checkbox', { name: 'Daiktavardis (dkt)' })).not.toBeChecked();

  await page.getByLabel('Rodyti pirmus').selectOption('20');
  await expect(page.getByRole('img', { name: /Dažniausi žodžiai:/ })).toHaveAttribute('aria-label', expect.stringContaining('bandomas-020'));
  const tableEquivalent = page.locator('details').filter({ has: page.getByText('Duomenys lentelėje') }).first();
  await tableEquivalent.locator('summary').click();
  await expect(tableEquivalent.locator('table')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Atsisiųsti duomenis .csv formatu' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^browser-journey-fixture-\d{4}-\d{2}-\d{2}\.csv$/);

  await assertResponsiveViewport(page, testInfo);
  assertHealthy();
});
