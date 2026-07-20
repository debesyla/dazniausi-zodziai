import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { analyseFrequency } from '../../src/lib/analysis';
import { validateCatalog, validateDataset } from '../../src/lib/data';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const datasetsDirectory = path.join(repositoryRoot, 'static', 'datasets');

async function readJson(filename) {
  return JSON.parse(await readFile(path.join(datasetsDirectory, filename), 'utf8'));
}

describe('curated dataset catalog', () => {
  it('publishes the licensed Utka lemmatized totals as the default dataset', async () => {
    const catalog = validateCatalog(await readJson('catalog.json'));
    expect(catalog.defaultDatasetId).toBe('utka-2018-lemmatized-totals');
    const entry = catalog.datasets.find((dataset) => dataset.id === catalog.defaultDatasetId);
    expect(entry).toBeDefined();
    const dataset = validateDataset(await readJson(entry.file));

    expect(entry).toMatchObject({
      id: 'utka-2018-lemmatized-totals',
      author: 'Andrius Utka',
      entryKind: 'lemma',
      records: 41977,
      totalFrequency: 922949,
      licence: 'CC BY 4.0'
    });
    expect(dataset.summary).toEqual({
      sourceRows: 41977,
      entryCount: 41977,
      totalFrequency: 922949,
      duplicateEntries: 2
    });
    expect(dataset.provenance).toMatchObject({
      licence: 'CC BY 4.0',
      sourceUrl: 'https://clarin-repo.lt/items/2bf241af-42ab-4a68-8dd6-c119c2dd0e1e',
      sourceSnapshot: {
        path: 'utka-2018-01-18-Lithuanian-wordlist/modified/lemmatized_totals.csv',
        encoding: 'utf-8',
        sha256: 'd509af774a736534b3d638d3e46dd5e66f299ec83d11749eecbb7eb575af9c52'
      }
    });
    expect(analyseFrequency(dataset.words)).toMatchObject({
      entryCount: 41977,
      totalFrequency: 922949
    });
  });

  it('publishes the reviewed JCL lemma list with matching catalog provenance', async () => {
    const catalog = validateCatalog(await readJson('catalog.json'));
    const entry = catalog.datasets.find((dataset) => dataset.id === 'dadurkevicius-2020-jcl-lemmas');
    expect(entry).toMatchObject({
      author: 'Virginijus Dadurkevičius',
      entryKind: 'lemma',
      records: 169787,
      totalFrequency: 1266854554,
      licence: 'CC BY 4.0'
    });

    const dataset = validateDataset(await readJson(entry.file));
    expect(dataset.summary).toEqual({
      sourceRows: 169787,
      entryCount: 169787,
      totalFrequency: 1266854554,
      duplicateEntries: 0
    });
    expect(dataset.provenance).toMatchObject({
      licence: entry.licence,
      citation: entry.citation,
      sourceUrl: 'https://clarin-repo.lt/items/e61bfe1a-03a9-486a-bd5b-7d31d7102723',
      sourceSnapshot: {
        path: 'dadurkevicius-2020-10-27-JCL_Wordlist/original/JCL_lemmas.txt',
        encoding: 'utf-8',
        sha256: '895d9eeb8ed3d2fc8869ee8ba337d9dd5f782af992999d5b6505267d08693679'
      }
    });
    expect(dataset.words.slice(0, 3)).toEqual([
      { word: 'ir', type: 'C', frequency: 34605049 },
      { word: 'būti', type: 'V', frequency: 20816394 },
      { word: 'jis', type: 'P', frequency: 19365091 }
    ]);
  });

  it('keeps every catalog record aligned with its validated public dataset', async () => {
    const catalog = validateCatalog(await readJson('catalog.json'));

    for (const entry of catalog.datasets) {
      const dataset = validateDataset(await readJson(entry.file));
      expect(entry.records).toBe(dataset.summary.entryCount);
      expect(entry.totalFrequency).toBe(dataset.summary.totalFrequency);
      expect(entry.licence).toBe(dataset.provenance.licence);
      expect(entry.citation).toBe(dataset.provenance.citation);
    }
  });
});
