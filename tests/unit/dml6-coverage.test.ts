import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it, vi } from 'vitest';
import {
  loadDml6CoverageDrilldown,
  loadDml6CoverageProfile,
  validateDml6CoverageProfile
} from '../../src/lib/dml6-coverage';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profilePath = path.join(
  repositoryRoot,
  'static/data-products/dadurkevicius-dml6-vs-jcl-comparison/analysis/dml6-jcl-coverage-by-frequency-band/manifest.json'
);

afterEach(() => {
  vi.unstubAllGlobals();
});

it('validates the checked-in DML6 coverage profile and fetches a selected drill-down only on request', async () => {
  const fixture = JSON.parse(await readFile(profilePath, 'utf8'));
  const selectedBand = fixture.summary.bands.find((band) => band.id === 'one-thousand-plus');
  const selectedCategory = selectedBand.categories.find((category) => category.coverageCode === 1);
  const drilldownPath = path.join(path.dirname(profilePath), selectedCategory.drilldown.file);
  const drilldownFixture = JSON.parse(await readFile(drilldownPath, 'utf8'));
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => url.endsWith('manifest.json') ? fixture : drilldownFixture
  }));
  vi.stubGlobal('fetch', fetchMock);

  const profile = await loadDml6CoverageProfile();

  expect(profile.summary).toMatchObject({
    sourceRows: 4968125,
    totalTypeCount: 4968125,
    totalTokenCount: 1334845080
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const drilldown = await loadDml6CoverageDrilldown(profile, 'one-thousand-plus', 1);

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(drilldown.records).toHaveLength(selectedCategory.drilldown.records);
  expect(drilldown.records[0][1]).toBeGreaterThanOrEqual(drilldown.records.at(-1)?.[1] ?? 0);
});

it('rejects a profile whose drill-down path escapes the profile directory', async () => {
  const fixture = JSON.parse(await readFile(profilePath, 'utf8'));
  fixture.summary.bands[0].categories[0].drilldown.file = '../outside.json';

  expect(() => validateDml6CoverageProfile(fixture)).toThrow(/pavyzdžių failas/);
});

it('rejects a profile whose advertised examples exceed its delivery limit', async () => {
  const fixture = JSON.parse(await readFile(profilePath, 'utf8'));
  fixture.summary.bands[0].categories[0].drilldown.records = fixture.drilldown.limit + 1;

  expect(() => validateDml6CoverageProfile(fixture)).toThrow(/viršija paskelbtą ribą/);
});
