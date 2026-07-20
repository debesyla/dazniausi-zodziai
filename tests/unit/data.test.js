import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCatalog, loadDataset, validateCatalog, validateDataset } from '../../src/lib/data';

const validProvenance = {
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
    labels: { noun: 'Noun', verb: 'Verb' }
  }
};

const validDataset = {
  schemaVersion: 1,
  id: 'test-dataset',
  title: 'Test dataset',
  author: 'Test author',
  year: 2023,
  entryKind: 'lemma',
  duplicatePolicy: 'keep',
  provenance: validProvenance,
  summary: { sourceRows: 2, entryCount: 2, totalFrequency: 15, duplicateEntries: 0 },
  words: [
    { word: 'test', type: 'verb', frequency: 10 },
    { word: 'word', type: 'noun', frequency: 5 }
  ]
};

const validCatalog = {
  schemaVersion: 1,
  defaultDatasetId: 'test-dataset',
  datasets: [{
    id: 'test-dataset',
    title: 'Test dataset',
    author: 'Test author',
    year: 2023,
    entryKind: 'lemma',
    file: 'test-dataset.json',
    records: 2,
    totalFrequency: 15,
    hasPartOfSpeech: true,
    licence: null,
    citation: null
  }]
};

function mockFetch(data, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Not found',
    json: vi.fn().mockResolvedValue(data)
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('validateDataset', () => {
  it('accepts a valid generated dataset', () => {
    expect(validateDataset(validDataset)).toEqual(validDataset);
  });

  it.each([
    [{ ...validDataset, id: '' }, '"id"'],
    [{ ...validDataset, entryKind: 'other' }, '"entryKind"'],
    [{ ...validDataset, summary: { ...validDataset.summary, totalFrequency: -1 } }, '"summary"'],
    [{ ...validDataset, words: [{ word: 'test', type: 'noun', frequency: 0 }] }, '"frequency"'],
    [{ ...validDataset, summary: { ...validDataset.summary, entryCount: 3 } }, 'summary does not match'],
    [{ ...validDataset, provenance: { ...validProvenance, partOfSpeech: undefined } }, 'typed word entries require part-of-speech labels']
  ])('rejects invalid generated data', (dataset, message) => {
    expect(() => validateDataset(dataset)).toThrow(message);
  });
});

describe('validateCatalog', () => {
  it('accepts a valid catalog', () => {
    expect(validateCatalog(validCatalog)).toEqual(validCatalog);
  });

  it('rejects unsafe files and malformed metadata', () => {
    const catalog = structuredClone(validCatalog);
    catalog.datasets[0].file = '../private.json';
    expect(() => validateCatalog(catalog)).toThrow('Invalid dataset catalog entry');

    catalog.datasets[0].file = 'test-dataset.json';
    catalog.datasets[0].licence = 42;
    expect(() => validateCatalog(catalog)).toThrow('Invalid dataset catalog entry');
  });

  it('rejects a default dataset that is not in the catalog', () => {
    const catalog = { ...validCatalog, defaultDatasetId: 'missing' };
    expect(() => validateCatalog(catalog)).toThrow('Invalid dataset catalog default dataset');
  });
});

describe('network loaders', () => {
  it('loads the catalog before any dataset rows', async () => {
    const fetch = mockFetch(validCatalog);
    vi.stubGlobal('fetch', fetch);

    await expect(loadCatalog()).resolves.toEqual(validCatalog);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/datasets\/catalog\.json$/));
  });

  it('loads only the requested dataset file', async () => {
    const fetch = mockFetch(validDataset);
    vi.stubGlobal('fetch', fetch);

    await expect(loadDataset('test-dataset.json')).resolves.toEqual(validDataset);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/datasets\/test-dataset\.json$/));
  });

  it('surfaces failed requests and rejects unsafe file paths before fetch', async () => {
    const fetch = mockFetch({}, 404);
    vi.stubGlobal('fetch', fetch);

    await expect(loadCatalog()).rejects.toThrow('404 Not found');
    await expect(loadDataset('../private.json')).rejects.toThrow('Invalid dataset file path');
    await expect(loadDataset('..\\private.json')).rejects.toThrow('Invalid dataset file path');
    await expect(loadDataset('%2e%2e/private.json')).rejects.toThrow('Invalid dataset file path');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
