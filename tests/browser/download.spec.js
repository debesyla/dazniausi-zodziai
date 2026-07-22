import { expect, test } from '@playwright/test';

const fixtureCatalog = {
  schemaVersion: 1,
  defaultDatasetId: 'browser-download-fixture',
  datasets: [
    {
      id: 'browser-download-fixture',
      title: 'Naršyklės atsisiuntimo bandomasis rinkinys',
      author: 'Test author',
      year: 2026,
      entryKind: 'lemma',
      file: 'browser-download-fixture.json',
      records: 3,
      totalFrequency: 60,
      hasPartOfSpeech: true,
      licence: 'CC BY 4.0',
      citation: 'Test citation'
    }
  ]
};

const fixtureDataset = {
  schemaVersion: 1,
  id: 'browser-download-fixture',
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
      sha256: 'a'.repeat(64)
    },
    partOfSpeech: {
      name: 'Test POS',
      labels: { dkt: 'Daiktavardis' }
    }
  },
  summary: {
    sourceRows: 3,
    entryCount: 3,
    totalFrequency: 60,
    duplicateEntries: 0
  },
  words: [
    { word: 'ąžuolas, paprastasis', type: 'dkt', frequency: 42 },
    { word: 'ąžuolas', type: 'dkt', frequency: 11 },
    { word: 'žemė', type: 'dkt', frequency: 7 }
  ]
};

async function downloadText(download) {
  const stream = await download.createReadStream();
  if (!stream) throw new Error('The browser did not provide a download stream.');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

test('downloads the filtered, sorted CSV in a real browser', async ({ page }) => {
  await page.route('**/datasets/catalog.json', (route) => route.fulfill({ json: fixtureCatalog }));
  await page.route('**/datasets/browser-download-fixture.json', (route) => route.fulfill({ json: fixtureDataset }));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: fixtureDataset.title })).toBeVisible();

  await page.getByLabel('Ieškoti žodžių').fill('ąžuolas');
  await expect(page.getByRole('heading', { name: 'Žodžiai (2)' })).toBeVisible();

  const expectedDate = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Atsisiųsti duomenis .csv formatu' }).click();
  const download = await downloadPromise;
  const csv = await downloadText(download);

  expect(download.suggestedFilename()).toBe(`browser-download-fixture-${expectedDate}.csv`);
  expect(csv.startsWith('\ufeff')).toBe(true);
  expect(csv).toContain('# Dataset ID: browser-download-fixture');
  expect(csv).toContain('# Paieška: ąžuolas');
  expect(csv).toContain('# Rikiavimas: Dažnumas (mažėjančia tvarka)');
  expect(csv).toContain('"ąžuolas, paprastasis",dkt,42');
  expect(csv).toContain('ąžuolas,dkt,11');
  expect(csv).not.toContain('žemė,dkt,7');
  expect(csv.indexOf('"ąžuolas, paprastasis",dkt,42')).toBeLessThan(csv.indexOf('ąžuolas,dkt,11'));
});
