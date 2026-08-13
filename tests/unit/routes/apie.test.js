import { render, waitFor } from '@testing-library/svelte/svelte5';
import axe from 'axe-core';
import { vi } from 'vitest';

vi.mock('../../../src/lib/publication', () => ({
  loadPublicDataProducts: vi.fn(() => Promise.resolve([
    {
      id: 'lemmas',
      title: 'Lemų bandomasis sąrašas',
      productType: 'generic-frequency-dataset',
      publication: { status: 'published', scope: 'Every row.', access: 'Browser.' },
      provenance: {
        sourceUrl: 'https://example.test/lemmas',
        licence: 'CC BY 4.0',
        citation: 'Bandoma citata.'
      },
      content: { entryKind: 'lemma' },
      views: [],
      viewCount: 1,
      manifestUrl: '/data-products/lemmas/manifest.json'
    },
    {
      id: 'blocked',
      title: 'Ribotas bandomasis šaltinis',
      productType: 'metadata-only',
      publication: { status: 'metadata-only', scope: 'Metadata only.', access: 'Manifest.' },
      provenance: {
        sourceUrl: 'https://example.test/blocked',
        licence: 'unresolved',
        citation: 'Ribota citata.'
      },
      views: [],
      viewCount: 0,
      manifestUrl: '/data-products/blocked/manifest.json'
    },
    {
      id: 'rimkute-morphemic-dictionary',
      title: 'Dažninis lietuvių kalbos morfemikos žodynas',
      productType: 'chunked-lexical-collection',
      publication: { status: 'published', scope: 'Every row.', access: 'Chunks.' },
      provenance: {
        sourceUrl: 'https://hdl.handle.net/20.500.12259/249',
        licence: 'Rightsholder permission',
        citation: 'Rimkutė, Kazlauskienė ir Raškinis (2011).',
        permission: {
          status: 'rightsholder-permission-confirmed',
          confirmedOn: '2026-08-13',
          scope: 'Pilno išvestinio rinkinio skelbimas ir pernaudojimas su priskyrimu.',
          privateCorrespondencePublished: false
        },
        attributionNotice: 'Rimkutė, Erika; Kazlauskienė, Asta; Raškinis, Gailius. 2011.',
        modificationNotice: 'MODIFIED FILE: deterministiškai išgauta iš PDF.'
      },
      views: [{ id: 'entries', title: 'Įrašai' }],
      viewCount: 1,
      manifestUrl: '/data-products/rimkute-morphemic-dictionary/manifest.json'
    }
  ]))
}));

import Page from '../../../src/routes/apie/+page.svelte';

describe('Methodology page', () => {
  it('makes per-source attribution, licence, source record, and publication limits visible', async () => {
    const { getAllByRole, getByRole, getByText, queryByText } = render(Page);

    expect(getByText('Kraunami šaltinių metaduomenys…')).toBeInTheDocument();
    await waitFor(() => expect(queryByText('Kraunami šaltinių metaduomenys…')).not.toBeInTheDocument());

    expect(getByRole('heading', { name: 'Metodika ir šaltiniai' })).toBeInTheDocument();
    expect(getByText('Lemų bandomasis sąrašas')).toBeInTheDocument();
    expect(getByText('CC BY 4.0')).toBeInTheDocument();
    expect(getAllByRole('link', { name: 'Pirminis šaltinio įrašas' })[0]).toHaveAttribute('href', 'https://example.test/lemmas');
    expect(getByText(/Šaltinio eilutės sąmoningai neskelbiamos/)).toBeInTheDocument();
    expect(getByText(/Leidžiama išgauti ir taisyti PDF duomenis/)).toBeInTheDocument();
    expect(getByText(/Privatus susirašinėjimas neskelbiamas/)).toBeInTheDocument();
    expect(getByText(/Rimkutė, Erika/)).toBeInTheDocument();
    expect(getByText(/MODIFIED FILE/)).toBeInTheDocument();
    expect(getByRole('link', { name: '← Tyrinėti duomenis' })).toHaveAttribute('href', '/');
  });

  it('keeps the public methodology structure accessible', async () => {
    const { queryByText } = render(Page);
    await waitFor(() => expect(queryByText('Kraunami šaltinių metaduomenys…')).not.toBeInTheDocument());

    const result = await axe.run(document.body, {
      rules: { 'color-contrast': { enabled: false } }
    });
    expect(result.violations).toEqual([]);
  });

  it('uses the configured methodology URL as its canonical page', () => {
    render(Page);

    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:4173/apie'
    );
    expect(document.head.querySelector('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'http://127.0.0.1:4173/apie'
    );
  });
});
