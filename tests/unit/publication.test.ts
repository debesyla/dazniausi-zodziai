import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPublicDataProducts } from '../../src/lib/publication';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const catalog = {
  schemaVersion: 1,
  title: 'Test products',
  products: [
    {
      id: 'lemmas',
      title: 'Lemma list',
      productType: 'generic-frequency-dataset',
      publicationStatus: 'published',
      manifest: 'lemmas/manifest.json',
      licence: 'CC BY 4.0',
      viewCount: 1,
      recordCount: 2
    },
    {
      id: 'blocked',
      title: 'Blocked source',
      productType: 'metadata-only',
      publicationStatus: 'metadata-only',
      manifest: 'blocked/manifest.json',
      licence: 'unresolved',
      viewCount: 0,
      recordCount: null
    }
  ]
};

function manifest(id: string, productType: string, status: 'published' | 'metadata-only', views: unknown[] = []) {
  return {
    schemaVersion: 1,
    id,
    title: id === 'lemmas' ? 'Lemma list' : 'Blocked source',
    productType,
    publication: { status, scope: 'Fixture scope.', access: 'Fixture access.' },
    provenance: {
      sourceUrl: 'https://example.test/source',
      licence: status === 'published' ? 'CC BY 4.0' : 'unresolved',
      citation: 'Fixture citation.'
    },
    content: id === 'lemmas' ? { entryKind: 'lemma' } : undefined,
    views
  };
}

function response(value: unknown) {
  return { ok: true, status: 200, statusText: 'OK', json: vi.fn().mockResolvedValue(value) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadPublicDataProducts', () => {
  it('loads compact manifest-led provenance without requesting any row data', async () => {
    const lemmaManifest = manifest('lemmas', 'generic-frequency-dataset', 'published');
    delete lemmaManifest.views;
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('data-products/catalog.json')) return Promise.resolve(response(catalog));
      if (url.endsWith('lemmas/manifest.json')) return Promise.resolve(response(lemmaManifest));
      if (url.endsWith('blocked/manifest.json')) return Promise.resolve(response(manifest('blocked', 'metadata-only', 'metadata-only')));
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not found', json: vi.fn() });
    });
    vi.stubGlobal('fetch', fetch);

    await expect(loadPublicDataProducts()).resolves.toEqual([
      expect.objectContaining({ id: 'lemmas', productType: 'generic-frequency-dataset', content: { entryKind: 'lemma' }, views: [], viewCount: 1 }),
      expect.objectContaining({ id: 'blocked', publication: expect.objectContaining({ status: 'metadata-only' }), views: [], viewCount: 0 })
    ]);
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/data-products\/catalog\.json$/),
      expect.stringMatching(/data-products\/lemmas\/manifest\.json$/),
      expect.stringMatching(/data-products\/blocked\/manifest\.json$/)
    ]);
  });

  it('rejects a manifest whose ID does not match its catalog entry', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.endsWith('data-products/catalog.json')) return Promise.resolve(response(catalog));
      return Promise.resolve(response(manifest('other', 'generic-frequency-dataset', 'published')));
    }));

    await expect(loadPublicDataProducts()).rejects.toThrow('manifest for lemmas is malformed');
  });

  it('loads every checked-in public product manifest without loading data chunks', async () => {
    const fetch = vi.fn(async (url: string) => {
      const pathname = new URL(url, 'http://localhost').pathname;
      const body = await readFile(path.join(repositoryRoot, 'static', pathname), 'utf8');
      return { ok: true, status: 200, statusText: 'OK', json: vi.fn().mockResolvedValue(JSON.parse(body)) };
    });
    vi.stubGlobal('fetch', fetch);

    const products = await loadPublicDataProducts();

    expect(products).toHaveLength(13);
    expect(products.map((product) => product.id)).toContain('petkevicius-2025-ccll-lemmas');
    expect(products.find((product) => product.id === 'utka-2018-lemmatized-totals')).toMatchObject({ viewCount: 1, views: [] });
    expect(products.find((product) => product.id === 'rimkute-2024-matas-v3-frequencies')).toMatchObject({ viewCount: 2 });
    expect(products.find((product) => product.id === 'birvinskaite-2026-lithuanian-basketball-slang')).toMatchObject({
      productType: 'chunked-lexical-collection',
      viewCount: 1
    });
    expect(products.find((product) => product.id === 'rimkute-2019-alksnis-syntactic-context')).toMatchObject({
      productType: 'chunked-syntactic-context',
      viewCount: 4
    });
    expect(fetch.mock.calls).toHaveLength(14);
    expect(fetch.mock.calls.map(([url]) => String(url)).every((url) => !url.includes('/chunks/'))).toBe(true);
  });
});
