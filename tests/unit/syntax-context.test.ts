import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSyntaxContexts, loadSyntaxOverview, searchSyntaxLemmas } from '../../src/lib/syntax-context';

const productRoot = '/data-products/rimkute-2019-alksnis-syntactic-context/';

const manifest = {
  id: 'rimkute-2019-alksnis-syntactic-context',
  title: 'ALKSNIS fixture',
  productType: 'chunked-syntactic-context',
  provenance: {
    sourceUrl: 'https://example.test/alksnis',
    licence: 'CC BY 4.0',
    citation: 'Fixture citation'
  },
  syntaxContext: {
    overview: {
      repositorySentenceClaim: 4,
      deliveredSentenceIds: 3,
      documents: 2,
      integerTokenRows: 30,
      nonPunctuationRows: 24,
      allRelationLabels: 4,
      nonPunctuationRelationLabels: 3,
      rootRows: 3,
      nonPunctuationRootRows: 2,
      nonRootDependencyRows: 22
    },
    exclusions: ['Punctuation is excluded.'],
    exampleSelection: { maxExamplesPerLemma: 2, order: 'Source order.', omittedRows: 1 },
    lookup: {
      lemmaIndexView: 'lemmas-by-source-order',
      lemmaIndexPrefixCodePoints: 1,
      contextView: 'sentence-contexts-by-lemma',
      contextPrefixCodePoints: 3,
      directions: ['dependent', 'head', 'root']
    }
  },
  views: [
    { id: 'relations-by-frequency', index: 'views/relations/index.json' },
    { id: 'genres-by-source-order', index: 'views/genres/index.json' },
    { id: 'lemmas-by-source-order', index: 'views/lemmas/index.json' },
    { id: 'sentence-contexts-by-lemma', index: 'views/contexts/index.json' }
  ]
};

const responses: Record<string, unknown> = {
  'manifest.json': manifest,
  'views/relations/index.json': {
    recordEncoding: 'array',
    fields: [{ id: 'relation', type: 'string' }, { id: 'count', type: 'raw-token-count' }],
    chunks: [{ file: 'chunks/one.json', records: 1 }]
  },
  'views/relations/chunks/one.json': { records: [['Atr', 8]] },
  'views/genres/index.json': {
    recordEncoding: 'array',
    fields: [
      { id: 'genreId', type: 'string' }, { id: 'genre', type: 'string' },
      { id: 'documents', type: 'raw-token-count' }, { id: 'sentences', type: 'raw-token-count' },
      { id: 'integerTokenRows', type: 'raw-token-count' }, { id: 'nonPunctuationRows', type: 'raw-token-count' },
      { id: 'relationshipRows', type: 'raw-token-count' }
    ],
    chunks: [{ file: 'chunks/one.json', records: 1 }]
  },
  'views/genres/chunks/one.json': { records: [['periodika', 'Periodika', 2, 3, 30, 24, 24]] },
  'views/lemmas/index.json': {
    recordEncoding: 'array',
    fields: [
      { id: 'lemma', type: 'string' }, { id: 'tokenCount', type: 'raw-token-count' },
      { id: 'headEdgeCount', type: 'raw-token-count' }, { id: 'dependentEdgeCount', type: 'raw-token-count' },
      { id: 'rootEdgeCount', type: 'raw-token-count' }
    ],
    selection: { type: 'lemma-prefix', field: 'lemma', codePoints: 1 },
    chunks: [
      { file: 'chunks/k.json', records: 2, selectionPrefixes: ['k'] },
      { file: 'chunks/m.json', records: 1, selectionPrefixes: ['m'] }
    ]
  },
  'views/lemmas/chunks/k.json': { records: [['kalba', 5, 2, 5, 0], ['kalbėti', 4, 3, 4, 1]] },
  'views/lemmas/chunks/m.json': { records: [['mokslas', 3, 1, 3, 0]] },
  'views/contexts/index.json': {
    recordEncoding: 'array',
    fields: [
      { id: 'lemma', type: 'string' }, { id: 'direction', type: 'string' }, { id: 'relation', type: 'string' },
      { id: 'dependentLemma', type: 'string' }, { id: 'dependentForm', type: 'string' },
      { id: 'headLemma', type: 'string' }, { id: 'headForm', type: 'string' },
      { id: 'genreId', type: 'string' }, { id: 'genre', type: 'string' }, { id: 'document', type: 'string' },
      { id: 'sourceSentenceId', type: 'string' }, { id: 'sentenceText', type: 'string' }
    ],
    selection: { type: 'lemma-prefix', field: 'lemma', codePoints: 3 },
    chunks: [
      { file: 'chunks/ka.json', records: 2, selectionPrefixes: ['kal'] },
      { file: 'chunks/mo.json', records: 1, selectionPrefixes: ['mok'] }
    ]
  },
  'views/contexts/chunks/ka.json': {
    records: [
      ['kalba', 'dependent', 'Atr', 'kalba', 'kalba', 'mokslas', 'mokslas', 'periodika', 'Periodika', 'periodika/a.conllu', 's1', 'Kalba ir mokslas.'],
      ['kalbėti', 'head', 'Pred', 'mokytis', 'mokosi', 'kalbėti', 'kalba', 'periodika', 'Periodika', 'periodika/a.conllu', 's2', 'Jie kalba.']
    ]
  },
  'views/contexts/chunks/mo.json': {
    records: [['mokslas', 'root', 'Pred', 'mokslas', 'Mokslas', 'ROOT', 'ROOT', 'periodika', 'Periodika', 'periodika/a.conllu', 's3', 'Mokslas.']]
  }
};

function installFixtureFetch() {
  const fetch = vi.fn(async (input: string | URL) => {
    const url = String(input);
    const relativePath = url.startsWith(productRoot) ? url.slice(productRoot.length) : '';
    const body = responses[relativePath];
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      json: async () => body
    };
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ALKSNIS syntax-context loader', () => {
  it('loads the compact overview and its separate source summaries', async () => {
    const fetch = installFixtureFetch();
    const overview = await loadSyntaxOverview();

    expect(overview.manifest.title).toBe('ALKSNIS fixture');
    expect(overview.relations).toEqual([{ relation: 'Atr', count: 8 }]);
    expect(overview.genres).toEqual([expect.objectContaining({ genre: 'Periodika', documents: 2, sentences: 3 })]);
    expect(fetch).not.toHaveBeenCalledWith(`${productRoot}views/lemmas/index.json`);
  });

  it('fetches only the matching lemma and context prefixes after a visitor asks for them', async () => {
    const fetch = installFixtureFetch();
    const overview = await loadSyntaxOverview();
    fetch.mockClear();

    await expect(searchSyntaxLemmas(overview.manifest, 'kal')).resolves.toEqual({
      total: 2,
      matches: [
        { lemma: 'kalba', tokenCount: 5, headEdgeCount: 2, dependentEdgeCount: 5, rootEdgeCount: 0 },
        { lemma: 'kalbėti', tokenCount: 4, headEdgeCount: 3, dependentEdgeCount: 4, rootEdgeCount: 1 }
      ]
    });
    expect(fetch).toHaveBeenCalledWith(`${productRoot}views/lemmas/chunks/k.json`);
    expect(fetch).not.toHaveBeenCalledWith(`${productRoot}views/lemmas/chunks/m.json`);

    fetch.mockClear();
    const contexts = await loadSyntaxContexts(overview.manifest, 'kalba');
    expect(contexts).toEqual([expect.objectContaining({ lemma: 'kalba', direction: 'dependent', relation: 'Atr' })]);
    expect(fetch).toHaveBeenCalledWith(`${productRoot}views/contexts/chunks/ka.json`);
    expect(fetch).not.toHaveBeenCalledWith(`${productRoot}views/contexts/chunks/mo.json`);
  });
});
