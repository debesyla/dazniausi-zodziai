import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const productRoot = path.join(repositoryRoot, 'static', 'data-products');
const productId = 'kapociute-dzikiene-2017-parliament-frequency-aggregates';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(productRoot, relativePath), 'utf8'));
}

describe('Parliament corpus aggregate product', () => {
  it('publishes only corpus-wide wordform and lemma frequency views', async () => {
    const catalog = await readJson('catalog.json');
    const catalogEntry = catalog.products.find((product) => product.id === productId);
    expect(catalogEntry).toMatchObject({
      productType: 'chunked-frequency-list',
      publicationStatus: 'published',
      viewCount: 2,
      recordCount: null,
      licence: 'CC BY 4.0'
    });

    const manifest = await readJson(`${productId}/manifest.json`);
    expect(manifest.publication.scope).toContain('Corpus-wide');
    expect(manifest.publication.scope).toContain('excludes every document, speaker, author');
    expect(manifest.provenance.files.map((file) => file.artifactId)).toEqual([
      'kapociute-dzikiene-2017-parliament-wordforms-aggregate',
      'kapociute-dzikiene-2017-parliament-lemmas-aggregate'
    ]);
    expect(manifest.views.map((view) => view.id)).toEqual(['wordforms-by-frequency', 'lemmas-by-frequency']);
  });

  it.each([
    ['wordforms-by-frequency', 'word', 274349, 23326508],
    ['lemmas-by-frequency', 'lemma', 84640, 23332097]
  ])('keeps %s as a two-field aggregate-only view', async (viewId, keyField, recordCount, totalFrequency) => {
    const index = await readJson(`${productId}/views/${viewId}/index.json`);
    expect(index.fields.map((field) => field.id)).toEqual([keyField, 'count']);
    expect(index.sourceFile).toMatchObject({
      artifactId: expect.stringMatching(/^kapociute-dzikiene-2017-parliament-/),
      rows: recordCount
    });
    expect(index).not.toHaveProperty('document');
    expect(index).not.toHaveProperty('speaker');
    expect(index).not.toHaveProperty('author');
    expect(index).not.toHaveProperty('date');
    expect(index.summary).toEqual({
      sourceRows: recordCount,
      recordCount,
      numericTotals: { count: totalFrequency },
      nullCounts: {}
    });

    const firstChunk = await readJson(`${productId}/views/${viewId}/${index.chunks[0].file}`);
    expect(firstChunk.records[0]).toHaveLength(2);
  });
});
