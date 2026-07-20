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
    const entry = catalog.datasets[0];
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
      sourceUrl: 'https://clarin-repo.lt/items/2bf241af-42ab-4a68-8dd6-c119c2dd0e1e'
    });
    expect(analyseFrequency(dataset.words)).toMatchObject({
      entryCount: 41977,
      totalFrequency: 922949
    });
  });
});
