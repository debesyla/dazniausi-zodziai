import { afterEach, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearWarContrastLookupCache,
  loadWarContrastProfile,
  logRatioForPair,
  lookupWarContrastWord,
  validateWarContrastProfile
} from '../../src/lib/war-contrast';

const fields = [
  { id: 'word', label: 'Word form', type: 'string', sourceColumn: 0 },
  { id: 'ccll2TokenCount', label: 'CCLL2 normalized token count', type: 'normalized-token-count', unit: 'tokens per 100 million source words', sourceColumn: 1, nullable: true, normalization: { sourceTokens: 162000000, targetTokens: 100000000 } },
  { id: 'ccll2DocumentCount', label: 'CCLL2 normalized document count', type: 'normalized-document-count', unit: 'documents per 100 million source words', sourceColumn: 2, nullable: true, normalization: { sourceTokens: 162000000, targetTokens: 100000000 } },
  { id: 'mediaTokenCount', label: 'Wartime media normalized token count', type: 'normalized-token-count', unit: 'tokens per 100 million source words', sourceColumn: 3, nullable: true, normalization: { sourceTokens: 36000000, targetTokens: 100000000 } },
  { id: 'mediaDocumentCount', label: 'Wartime media normalized document count', type: 'normalized-document-count', unit: 'documents per 100 million source words', sourceColumn: 4, nullable: true, normalization: { sourceTokens: 36000000, targetTokens: 100000000 } },
  { id: 'socialTokenCount', label: 'Wartime social normalized token count', type: 'normalized-token-count', unit: 'tokens per 100 million source words', sourceColumn: 5, nullable: true, normalization: { sourceTokens: 2000000, targetTokens: 100000000 } },
  { id: 'socialDocumentCount', label: 'Wartime social normalized document count', type: 'normalized-document-count', unit: 'documents per 100 million source words', sourceColumn: 6, nullable: true, normalization: { sourceTokens: 2000000, targetTokens: 100000000 } }
];

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const sourceSummary = {
  sourceRows: 4,
  recordCount: 4,
  numericTotals: {
    ccll2TokenCount: 794,
    ccll2DocumentCount: 467,
    mediaTokenCount: 2438,
    mediaDocumentCount: 1293,
    socialTokenCount: 1070,
    socialDocumentCount: 770
  },
  nullCounts: {
    ccll2TokenCount: 1,
    ccll2DocumentCount: 1,
    mediaTokenCount: 1,
    mediaDocumentCount: 1,
    socialTokenCount: 2,
    socialDocumentCount: 2
  }
};

const profile = {
  schemaVersion: 1,
  productId: 'utka-ccll2-war-ukraine-comparison',
  profileId: 'ccll2-wartime-normalized-contrast',
  profileType: 'normalized-contrast-lookup',
  title: 'Fixture contrast',
  description: 'Bounded fixture lookup',
  sourceView: {
    id: 'ccll2-war-ukraine-normalized-metrics',
    sourceRole: 'normalized-comparison',
    index: 'views/ccll2-war-ukraine-normalized-metrics/index.json',
    fields,
    wordField: { id: 'word', label: 'Word form' },
    summary: sourceSummary
  },
  sources: [
    {
      id: 'ccll2', label: 'CCLL2',
      tokenField: { id: 'ccll2TokenCount', label: 'CCLL2 normalized token count', type: 'normalized-token-count', unit: 'tokens per 100 million source words', nullable: true, normalization: { sourceTokens: 162000000, targetTokens: 100000000 } },
      documentField: { id: 'ccll2DocumentCount', label: 'CCLL2 normalized document count', type: 'normalized-document-count', unit: 'documents per 100 million source words', nullable: true, normalization: { sourceTokens: 162000000, targetTokens: 100000000 } }
    },
    {
      id: 'media', label: 'Media',
      tokenField: { id: 'mediaTokenCount', label: 'Wartime media normalized token count', type: 'normalized-token-count', unit: 'tokens per 100 million source words', nullable: true, normalization: { sourceTokens: 36000000, targetTokens: 100000000 } },
      documentField: { id: 'mediaDocumentCount', label: 'Wartime media normalized document count', type: 'normalized-document-count', unit: 'documents per 100 million source words', nullable: true, normalization: { sourceTokens: 36000000, targetTokens: 100000000 } }
    },
    {
      id: 'social', label: 'Social',
      tokenField: { id: 'socialTokenCount', label: 'Wartime social normalized token count', type: 'normalized-token-count', unit: 'tokens per 100 million source words', nullable: true, normalization: { sourceTokens: 2000000, targetTokens: 100000000 } },
      documentField: { id: 'socialDocumentCount', label: 'Wartime social normalized document count', type: 'normalized-document-count', unit: 'documents per 100 million source words', nullable: true, normalization: { sourceTokens: 2000000, targetTokens: 100000000 } }
    }
  ],
  contrast: {
    minimumRate: 100,
    unit: 'tokens per 100 million source words',
    targetTokens: 100000000,
    formula: 'log2(numeratorRate / denominatorRate)',
    pairs: [
      { id: 'media-vs-ccll2', label: 'Media / CCLL2', numeratorSource: 'media', denominatorSource: 'ccll2' },
      { id: 'social-vs-ccll2', label: 'Social / CCLL2', numeratorSource: 'social', denominatorSource: 'ccll2' }
    ]
  },
  provenance: {
    sourceUrl: 'https://example.test/source',
    licence: 'CC BY 4.0',
    citation: 'Fixture citation',
    sourceFile: { path: 'comparison.tsv', rows: 4, sha256: 'a'.repeat(64) }
  },
  delivery: { summaryMaxBytes: 4096, lookupBucketMaxBytes: 4096, maxSourceRowsPerWord: 2 },
  lookup: {
    normalization: 'trim-nfc-uppercase-lt',
    recordEncoding: 'array',
    fields: [
      { id: 'normalizedWord', label: 'Normalized lookup word form', type: 'string' },
      { id: 'sourceRow', label: 'Zero-based source row', type: 'source-row' }
    ],
    routing: {
      root: 0,
      nodes: [{ terminalBucket: null, children: [['K', 0], ['R', 0], ['I', 0]] }],
      buckets: [{ id: 0, file: 'buckets/000001.json', records: 4, bytes: 100, sha256: 'b'.repeat(64) }]
    }
  },
  summary: {
    lookupRecords: 4,
    uniqueNormalizedWordForms: 3,
    duplicateNormalizedWordForms: 1,
    extraDuplicateRows: 1,
    maxSourceRowsPerWord: 2,
    sourceRows: 4
  }
};

const lookupBucket = {
  schemaVersion: 1,
  productId: profile.productId,
  profileId: profile.profileId,
  bucketId: 0,
  recordEncoding: 'array',
  records: [['KARAS', 0], ['RETAS', 1], ['IŠSPRĘSTA', 2], ['IŠSPRĘSTA', 3]]
};

const sourceIndex = {
  schemaVersion: 1,
  productId: profile.productId,
  viewId: profile.sourceView.id,
  recordEncoding: 'array',
  fields,
  summary: sourceSummary,
  chunks: [{ file: 'chunks/000001.json', records: 4, bytes: 100, sha256: 'c'.repeat(64) }]
};

const sourceChunk = {
  schemaVersion: 1,
  productId: profile.productId,
  viewId: profile.sourceView.id,
  chunk: 0,
  records: [
    ['KARAS', 200, 50, 800, 200, 400, 100],
    ['RETAS', 50, 12, 1000, 500, null, null],
    ['IŠSPRĘSTA', 544, 405, null, null, 670, 670],
    ['IŠSPRĘSTA', null, null, 638, 593, null, null]
  ]
};

afterEach(() => {
  clearWarContrastLookupCache();
  vi.unstubAllGlobals();
});

it('keeps lookup bounded, preserves nulls, coalesces compatible duplicate source rows, and applies the threshold', async () => {
  const fetchMock = vi.fn(async (url: string) => {
    const body = url.endsWith('manifest.json') ? profile
      : url.endsWith('buckets/000001.json') ? lookupBucket
        : url.endsWith('index.json') ? sourceIndex
          : sourceChunk;
    return { ok: true, status: 200, statusText: 'OK', json: async () => body };
  });
  vi.stubGlobal('fetch', fetchMock);

  const loaded = await loadWarContrastProfile();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  expect(await lookupWarContrastWord(loaded, 'zodis')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const karas = await lookupWarContrastWord(loaded, 'karas');
  expect(karas?.metrics).toMatchObject({
    ccll2: { tokenCount: 200, documentCount: 50 },
    media: { tokenCount: 800, documentCount: 200 },
    social: { tokenCount: 400, documentCount: 100 }
  });
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(logRatioForPair(loaded, karas!, 'media-vs-ccll2')).toBe(2);

  const retas = await lookupWarContrastWord(loaded, 'retas');
  expect(retas?.metrics.social.tokenCount).toBeNull();
  expect(logRatioForPair(loaded, retas!, 'media-vs-ccll2')).toBeNull();

  const merged = await lookupWarContrastWord(loaded, 'išspręsta');
  expect(merged?.sourceRows).toEqual([2, 3]);
  expect(merged?.metrics).toMatchObject({
    ccll2: { tokenCount: 544, documentCount: 405 },
    media: { tokenCount: 638, documentCount: 593 },
    social: { tokenCount: 670, documentCount: 670 }
  });
});

it('rejects an escaping lookup bucket path before any request is made', () => {
  const invalid = structuredClone(profile);
  invalid.lookup.routing.buckets[0].file = '../outside.json';
  expect(() => validateWarContrastProfile(invalid)).toThrow(/paieškos failas/);
});

it('uses the checked-in profile to retrieve one real word without loading the comparison corpus', async () => {
  const staticRoot = path.join(repositoryRoot, 'static');
  const fetchMock = vi.fn(async (url: string) => {
    const pathname = decodeURIComponent(new URL(url, 'https://example.test').pathname).replace(/^\/+/, '');
    const filename = path.resolve(staticRoot, pathname);
    expect(filename.startsWith(`${staticRoot}${path.sep}`)).toBe(true);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => JSON.parse(await readFile(filename, 'utf8'))
    };
  });
  vi.stubGlobal('fetch', fetchMock);

  const loaded = await loadWarContrastProfile();
  const karas = await lookupWarContrastWord(loaded, 'karas');

  expect(loaded.summary).toMatchObject({ sourceRows: 2264779, uniqueNormalizedWordForms: 2264668 });
  expect(karas?.metrics).toMatchObject({
    ccll2: { tokenCount: 5201, documentCount: 1334 },
    'wartime-media': { tokenCount: 24480, documentCount: 12753 },
    'wartime-social': { tokenCount: 83682, documentCount: 50498 }
  });
  expect(logRatioForPair(loaded, karas!, 'media-vs-ccll2')).toBeCloseTo(Math.log2(24480 / 5201));
  expect(fetchMock).toHaveBeenCalledTimes(4);
});
