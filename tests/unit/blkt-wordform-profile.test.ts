import { afterEach, expect, it, vi } from 'vitest';
import ccBySaText from '../../data/licenses/cc-by-sa-4.0-legalcode.txt?raw';
import newGenText from '../../data/licenses/newgenltu-openrail-d-v1.0.txt?raw';
import {
  clearBlktWordformProfileCache,
  loadBlktLicenceTexts,
  loadBlktWordformProfile,
  lookupBlktWordform,
  normalizeBlktWordformQuery
} from '../../src/lib/blkt-wordform-profile';

const sourceScopeCaveat = 'BLKT is not representative of all Lithuanian language use: media and document texts dominate its document and token composition.';
const sourceLicences = {
  inventory: [
    {
      sourceLabel: 'NewGenLTU OpenRAIL-D', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', documents: 8267437, sourceAlphaWords: 3906734476
    },
    {
      sourceLabel: 'CC BY-SA 4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/', attribution: 'Wikipedia contributors (BLKT source_name: Vikipedija).',
      documents: 170718, sourceAlphaWords: 34741743
    }
  ],
  application: 'The combined aggregate retains the notices and conditions of both source licence groups.'
};
const rights = {
  licences: [
    {
      id: 'newgenltu-openrail-d-v1.0', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', file: 'LICENSE-NewGenLTU-OpenRAIL-D-1.0.txt',
      sha256: 'abf61fc83225e088c1ed91aae517f0d5c606c2c9b441f3fc245ce821c1c79ab9'
    },
    {
      id: 'cc-by-sa-4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/', file: 'LICENSE-CC-BY-SA-4.0.txt',
      sha256: '23ee78c8bae49cf08ea2f0c84945c66b987ebe4520881fb51b3dad4fb43d07c2'
    }
  ],
  modificationNotice: 'MODIFIED FILE: Privacy-thresholded aggregate-only BLKT derivative produced by dazniausi-zodziai; no original text or document-level metadata is distributed.',
  attributionNotices: [
    'Valstybės skaitmeninių sprendimų agentūra. 2026. Bendrasis lietuvių kalbos tekstynas. Hugging Face. https://huggingface.co/datasets/VSSA-SDSA/LT_AI_BLKT.',
    'Wikipedia contributors. The BLKT source rows labelled “Vikipedija” are derived from Lithuanian Wikipedia material licensed under CC BY-SA 4.0. https://lt.wikipedia.org/'
  ],
  downstreamRequirements: [
    'Retain both applicable licence copies, this modification notice, the BLKT attribution, and the Wikipedia-contributor attribution with any redistribution.',
    'Use this derivative only for model training, other language-technology development, or production of datasets for model training.',
    'Do not use this derivative to extract, obtain, reconstruct, or publish personal data.',
    'For material derived from the BLKT rows labelled “Vikipedija”, comply with CC BY-SA 4.0 attribution and ShareAlike requirements.'
  ]
};
const notice = {
  modificationNotice: rights.modificationNotice,
  attribution: 'BLKT: Valstybės skaitmeninių sprendimų agentūra (2026); Vikipedija subset: Wikipedia contributors.',
  licenceLocation: 'product-root',
  licences: rights.licences.map(({ name, file }) => ({ name, file }))
};

const types = [
  ['fiction', 'gro', 'Grožinė literatūra', 'fiction'],
  ['non-fiction', 'neg', 'Negrožinė literatūra', 'nonFiction'],
  ['media', 'zin', 'Žiniasklaida', 'media'],
  ['speech', 'sak', 'Sakytinė kalba', 'speech'],
  ['documents', 'dok', 'Dokumentai', 'documents']
].map(([id, sourceCode, label, field]) => ({
  id,
  sourceCode,
  label,
  tokenField: `${field}TokenCount`,
  documentField: `${field}DocumentCount`,
  documents: 200,
  sourceAlphaWords: 2_000,
  derivedTokens: 1_800
}));

const periods = [
  ['1922-1940', '1', '1922–1940', 'period1922To1940'],
  ['1941-1990', '2', '1941–1990', 'period1941To1990'],
  ['1990-2004', '3', '1990–2004', 'period1990To2004'],
  ['2008-2026', '4', '2008–2026', 'period2008To2026']
].map(([id, sourceCode, label, field]) => ({
  id,
  sourceCode,
  label,
  tokenField: `${field}TokenCount`,
  documentField: `${field}DocumentCount`,
  documents: 250,
  sourceAlphaWords: 2_500,
  derivedTokens: 2_250
}));

const metadata = {
  schemaVersion: 1,
  viewId: 'wordform-scope-metrics',
  sourceScopeCaveat,
  sourceLicences,
  tokenizer: {
    id: 'blkt-unicode-letter-lower-v1',
    normalization: 'trim-nfc-lower',
    maximumCodePoints: 64,
    caseMapping: 'duckdb-simple-per-code-point'
  },
  disclosure: {
    minimumTokenCount: 100,
    minimumDocumentSupport: 20,
    familyRule: 'all-positive-siblings-must-pass-or-family-is-null'
  },
  rate: {
    targetTokens: 1_000_000,
    formula: 'tokenCount * 1000000 / derivedTokens',
    unit: 'tokens per million derived tokens'
  },
  corpus: {
    id: 'corpus',
    label: 'Visas BLKT',
    tokenField: 'corpusTokenCount',
    documentField: 'corpusDocumentCount',
    documents: 1_000,
    sourceAlphaWords: 10_000,
    derivedTokens: 9_000
  },
  documentTypes: types,
  periods,
  validatedSubtypes: { count: 11, published: false },
  permission: { status: 'confirmed-by-project-owner', confirmedOn: '2026-08-02' },
  rights,
  exclusions: [
    'raw-text',
    'document-rows',
    'document-subtypes',
    'joint-dimensions',
    'titles',
    'authors',
    'urls',
    'source-identifiers',
    'publication-dates',
    'personal-data'
  ]
};

const manifest = {
  schemaVersion: 1,
  id: 'vssa-2026-blkt-wordform-profile',
  title: 'BLKT žodžių formų profilis',
  productType: 'chunked-comparison',
  publication: {
    status: 'published',
    scope: 'Privatumo slenksčiais apsaugoti žodžių formų rodikliai.',
    access: 'Tiksli paieška riboto dydžio JSON dalimis.'
  },
  provenance: {
    sourceUrl: 'https://example.test/blkt',
    licence: 'Leidimas skelbti išvestinius duomenis',
    citation: 'BLKT bandomoji citata.'
  },
  notice,
  views: [{
    id: 'wordform-scope-metrics',
    title: 'Žodžio rodikliai pagal viešus pjūvius',
    index: 'views/wordform-scope-metrics/index.json'
  }],
  wordformProfile: metadata
};

const fields = [
  { id: 'word', label: 'Žodžio forma', type: 'string' },
  { id: metadata.corpus.tokenField, label: 'Viso pavartojimų', type: 'raw-token-count' },
  { id: metadata.corpus.documentField, label: 'Viso dokumentų', type: 'raw-document-count' },
  ...types.flatMap((dimension) => [
    { id: dimension.tokenField, label: `${dimension.label}: pavartojimai`, type: 'raw-token-count', nullable: true },
    { id: dimension.documentField, label: `${dimension.label}: dokumentai`, type: 'raw-document-count', nullable: true }
  ]),
  ...periods.flatMap((dimension) => [
    { id: dimension.tokenField, label: `${dimension.label}: pavartojimai`, type: 'raw-token-count', nullable: true },
    { id: dimension.documentField, label: `${dimension.label}: dokumentai`, type: 'raw-document-count', nullable: true }
  ])
];

const index = {
  schemaVersion: 1,
  productId: manifest.id,
  viewId: metadata.viewId,
  recordEncoding: 'array',
  notice,
  fields,
  ordering: { field: 'word', direction: 'ascending' },
  maxChunkBytes: 4_096,
  lookup: {
    type: 'exact-string-range',
    field: 'word',
    normalization: 'trim-nfc-lower',
    maxIndexBytes: 65_536
  },
  summary: { sourceRows: 2, recordCount: 2 },
  routing: {
    type: 'range-pages',
    maxPageBytes: 65_536,
    pages: [{
      file: 'routing/000001.json',
      chunks: 2,
      records: 2,
      bytes: 500,
      sha256: 'c'.repeat(64),
      range: ['a', 'žodis']
    }]
  }
};

const routingPage = {
  schemaVersion: 1,
  productId: manifest.id,
  viewId: metadata.viewId,
  page: 0,
  notice,
  chunks: [
    { file: 'chunks/000001.json', records: 1, bytes: 200, sha256: 'a'.repeat(64), range: ['a', 'kalba'] },
    { file: 'chunks/000002.json', records: 1, bytes: 200, sha256: 'b'.repeat(64), range: ['žodis', 'žodis'] }
  ]
};

const wordRecord = [
  'žodis',
  1_000, 200,
  200, 40,
  200, 40,
  200, 40,
  200, 40,
  200, 40,
  250, 50,
  250, 50,
  250, 50,
  250, 50
];

function chunk(records: unknown[][] = [wordRecord]) {
  return {
    schemaVersion: 1,
    productId: manifest.id,
    viewId: metadata.viewId,
    chunk: 1,
    notice,
    records
  };
}

function installFetch(resources: { manifest?: unknown; index?: unknown; routing?: unknown; chunk?: unknown } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const body = url.endsWith('/manifest.json') ? (resources.manifest ?? manifest)
      : url.endsWith('/index.json') ? (resources.index ?? index)
        : url.endsWith('/routing/000001.json') ? (resources.routing ?? routingPage)
        : url.endsWith('/chunks/000002.json') ? (resources.chunk ?? chunk())
          : url.endsWith('/LICENSE-NewGenLTU-OpenRAIL-D-1.0.txt') ? newGenText
            : url.endsWith('/LICENSE-CC-BY-SA-4.0.txt') ? ccBySaText
          : null;
    return {
      ok: body !== null,
      status: body === null ? 404 : 200,
      statusText: body === null ? 'Not found' : 'OK',
      json: async () => body,
      text: async () => String(body)
    };
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  clearBlktWordformProfileCache();
  vi.unstubAllGlobals();
});

it('verifies and embeds both complete licence texts only when requested', async () => {
  const fetchMock = installFetch();
  const profile = await loadBlktWordformProfile();

  expect(fetchMock).toHaveBeenCalledTimes(2);
  const licences = await loadBlktLicenceTexts(profile);

  expect(licences).toEqual([
    expect.objectContaining({ id: 'newgenltu-openrail-d-v1.0', fullText: expect.stringContaining('Attachment A') }),
    expect.objectContaining({ id: 'cc-by-sa-4.0', fullText: expect.stringContaining('Section 3 -- License Conditions.') })
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  await loadBlktLicenceTexts(profile);
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('normalizes an exact query and fetches only one bounded routing page and matching chunk', async () => {
  const fetchMock = installFetch();

  expect(normalizeBlktWordformQuery('  Z\u030cODIS  ')).toBe('žodis');
  expect(normalizeBlktWordformQuery('ΟΣ')).toBe('οσ');
  expect(normalizeBlktWordformQuery('İ')).toBe('i');
  const profile = await loadBlktWordformProfile();
  expect(fetchMock).toHaveBeenCalledTimes(2);

  expect(await lookupBlktWordform(profile, 'nerasta')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(3);

  const result = await lookupBlktWordform(profile, '  Z\u030cODIS  ');
  expect(result).toMatchObject({
    word: 'žodis',
    corpus: { tokenCount: 1_000, documentCount: 200 },
    documentTypes: [
      { id: 'fiction', tokenCount: 200, documentCount: 40 },
      { id: 'non-fiction', tokenCount: 200, documentCount: 40 },
      { id: 'media', tokenCount: 200, documentCount: 40 },
      { id: 'speech', tokenCount: 200, documentCount: 40 },
      { id: 'documents', tokenCount: 200, documentCount: 40 }
    ],
    periods: expect.arrayContaining([
      expect.objectContaining({ id: '1922-1940', tokenCount: 250, documentCount: 50 }),
      expect.objectContaining({ id: '2008-2026', tokenCount: 250, documentCount: 50 })
    ])
  });
  expect(result?.corpus.ratePerMillion).toBeCloseTo(111_111.111, 3);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
    expect.stringMatching(/\/manifest\.json$/),
    expect.stringMatching(/\/views\/wordform-scope-metrics\/index\.json$/),
    expect.stringMatching(/\/views\/wordform-scope-metrics\/routing\/000001\.json$/),
    expect.stringMatching(/\/views\/wordform-scope-metrics\/chunks\/000002\.json$/)
  ]);

  await lookupBlktWordform(profile, 'žodis');
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('rejects an escaping routing path before requesting a routing page or chunk', async () => {
  const unsafeIndex = structuredClone(index);
  unsafeIndex.routing.pages[0].file = '../raw/document.json';
  const fetchMock = installFetch({ index: unsafeIndex });

  await expect(loadBlktWordformProfile()).rejects.toThrow(/paieškos maršruto intervalas/);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('rejects a partially disclosed dimension family instead of exposing an ambiguous payload', async () => {
  const partialRecord = structuredClone(wordRecord);
  partialRecord[3] = null;
  partialRecord[4] = null;
  installFetch({ chunk: chunk([partialRecord]) });
  const loaded = await loadBlktWordformProfile();
  await expect(lookupBlktWordform(loaded, 'žodis')).rejects.toThrow(/paskelbtas tik iš dalies/);
});

it.each([
  ['a corpus count below the threshold', (record: unknown[]) => { record[1] = 99; record[2] = 20; }, /saugos slenksčio/],
  ['a marginal count below the threshold', (record: unknown[]) => { record[3] = 99; }, /saugos slenksčio/],
  ['a count above its denominator', (record: unknown[]) => { record[1] = 9_001; }, /viršija savo vardiklius/],
  ['a family that does not reconcile', (record: unknown[]) => { record[3] = 201; }, /nesutampa su viso tekstyno/]
])('rejects %s in a fetched public record', async (_description, mutate, message) => {
  const invalidRecord = structuredClone(wordRecord);
  mutate(invalidRecord);
  installFetch({ chunk: chunk([invalidRecord]) });
  const loaded = await loadBlktWordformProfile();
  await expect(lookupBlktWordform(loaded, 'žodis')).rejects.toThrow(message);
});
