import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearCcllGenreProfileCache,
  loadCcllGenreProfile,
  lookupCcllGenreWord,
  ratePerMillion,
  validateCcllGenreProfile
} from '../../src/lib/ccll-genre-profile';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sources = [
  { id: 'fiction', label: 'Grožinė literatūra', sourceRole: 'subcorpus-fiction', sourceRows: 2, sourceTokens: 100 },
  { id: 'non-fiction', label: 'Negrožinė literatūra', sourceRole: 'subcorpus-non-fiction', sourceRows: 1, sourceTokens: 200 },
  { id: 'administrative', label: 'Administraciniai tekstai', sourceRole: 'subcorpus-administrative', sourceRows: 1, sourceTokens: 50 },
  { id: 'periodicals', label: 'Periodika', sourceRole: 'subcorpus-periodicals', sourceRows: 1, sourceTokens: 500 },
  { id: 'speech', label: 'Sakytinė kalba', sourceRole: 'subcorpus-speech', sourceRows: 1, sourceTokens: 10 }
].map((source) => ({
  ...source,
  sourceFile: { artifactId: `fixture-${source.id}`, rows: source.sourceRows, sha256: 'a'.repeat(64) },
  view: { id: `${source.id}-by-frequency`, index: `views/${source.id}-by-frequency/index.json` }
}));

const fields = [
  { id: 'word', label: 'Word form', type: 'string' },
  ...sources.map((source) => ({
    id: `${source.id}RawCount`,
    label: `${source.label} raw token count`,
    type: 'raw-token-count',
    unit: 'tokens',
    nullable: true
  })),
  { id: 'observedGenres', label: 'Observed named subcorpora', type: 'observed-genre-count' }
];

const bucket = { id: 0, file: 'buckets/000001.json', records: 2, bytes: 200, sha256: 'b'.repeat(64) };
const profile = {
  schemaVersion: 1,
  productId: 'utka-ccll-wordforms',
  profileId: 'ccll-wordform-genre-profile',
  profileType: 'ccll-genre-wordform-lookup',
  title: 'Fixture genre profile',
  description: 'A bounded fixture lookup.',
  provenance: { sourceUrl: 'https://example.test/ccll', licence: 'CC BY 4.0', citation: 'Fixture citation' },
  sources,
  rate: { targetTokens: 1000000, unit: 'tokens per million source tokens', formula: 'rawCount * 1000000 / sourceTokens' },
  policies: {
    aggregate: 'excluded',
    punctuation: 'preserve-source-wordforms',
    repeatedTerm: 'reject-duplicate-exact-wordforms-per-source',
    missing: 'not-observed-null',
    threshold: { minimumRawCount: 1, appliesTo: 'exact-lookup-only-no-ranking' },
    ordering: { field: 'word', direction: 'ascending', tieBreak: 'unicode-code-point' }
  },
  delivery: { summaryMaxBytes: 4096, routingNodeMaxBytes: 4096, lookupBucketMaxBytes: 4096 },
  lookup: { normalization: 'trim-nfc-preserve-case', recordEncoding: 'array', fields, root: 'routing/nodes/000001.json' },
  summary: {
    joinedWordforms: 2,
    totalSourceRows: 6,
    sourceRows: { fiction: 2, 'non-fiction': 1, administrative: 1, periodicals: 1, speech: 1 },
    sourceTokenTotals: { fiction: 100, 'non-fiction': 200, administrative: 50, periodicals: 500, speech: 10 },
    observedGenreCounts: { 1: 1, 2: 0, 3: 0, 4: 0, 5: 1 },
    routingNodeCount: 1,
    lookupBucketCount: 1
  }
};

const rootNode = {
  schemaVersion: 1,
  productId: profile.productId,
  profileId: profile.profileId,
  nodeId: 0,
  prefix: '',
  terminal: null,
  transitions: [['!', { bucket }], ['K', { bucket }]]
};

const bucketContent = {
  schemaVersion: 1,
  productId: profile.productId,
  profileId: profile.profileId,
  bucketId: 0,
  recordEncoding: 'array',
  records: [
    ['!', 2, null, null, null, null, 1],
    ['Kelios', 4, 5, 6, 7, 8, 5]
  ]
};

afterEach(() => {
  clearCcllGenreProfileCache();
  vi.unstubAllGlobals();
});

it('loads only the profile at first, preserves nulls and case, and calculates rates from each denominator', async () => {
  const fetchMock = vi.fn(async (url: string) => {
    const body = url.endsWith('manifest.json') ? profile
      : url.endsWith('routing/nodes/000001.json') ? rootNode
        : bucketContent;
    return { ok: true, status: 200, statusText: 'OK', json: async () => body, text: async () => JSON.stringify(body) };
  });
  vi.stubGlobal('fetch', fetchMock);

  const loaded = await loadCcllGenreProfile();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  expect(await lookupCcllGenreWord(loaded, 'nerasta')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(await lookupCcllGenreWord(loaded, 'kelios')).toBeNull();

  const result = await lookupCcllGenreWord(loaded, 'Kelios');
  expect(result).toEqual({
    word: 'Kelios',
    rawCounts: { fiction: 4, 'non-fiction': 5, administrative: 6, periodicals: 7, speech: 8 },
    observedGenres: 5
  });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(ratePerMillion(loaded, result!, 'fiction')).toBe(40000);
  expect(ratePerMillion(loaded, result!, 'speech')).toBe(800000);

  const punctuation = await lookupCcllGenreWord(loaded, '!');
  expect(punctuation?.rawCounts['non-fiction']).toBeNull();
  expect(ratePerMillion(loaded, punctuation!, 'non-fiction')).toBeNull();
});

it('rejects an escaping routing path before a request is made', () => {
  const invalid = structuredClone(profile);
  invalid.lookup.root = '../outside.json';
  expect(() => validateCcllGenreProfile(invalid)).toThrow(/pristatymo arba paieškos aprašas/);
});

it('retrieves one real profile record using only routing and one bounded bucket', async () => {
  const staticRoot = path.join(repositoryRoot, 'static');
  const fetchMock = vi.fn(async (url: string) => {
    const pathname = decodeURIComponent(new URL(url, 'https://example.test').pathname).replace(/^\/+/, '');
    const filename = path.resolve(staticRoot, pathname);
    expect(filename.startsWith(`${staticRoot}${path.sep}`)).toBe(true);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => JSON.parse(await readFile(filename, 'utf8')),
      text: async () => readFile(filename, 'utf8')
    };
  });
  vi.stubGlobal('fetch', fetchMock);

  const loaded = await loadCcllGenreProfile();
  const result = await lookupCcllGenreWord(loaded, 'ir');

  expect(loaded.summary).toMatchObject({ joinedWordforms: 1733157, routingNodeCount: expect.any(Number) });
  expect(result).toMatchObject({
    word: 'ir',
    rawCounts: {
      fiction: 600403,
      'non-fiction': 809226,
      administrative: 388801,
      periodicals: 2638014,
      speech: 16321
    },
    observedGenres: 5
  });
  const requestedUrls = fetchMock.mock.calls.map(([url]) => url as string);
  expect(requestedUrls.length).toBeGreaterThanOrEqual(3);
  expect(requestedUrls.some((url) => url.includes('/views/'))).toBe(false);
  expect(requestedUrls.filter((url) => url.includes('/buckets/'))).toHaveLength(1);
});
