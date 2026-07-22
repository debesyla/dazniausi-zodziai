import { render, waitFor } from '@testing-library/svelte/svelte5';
import { vi } from 'vitest';

const catalog = {
  schemaVersion: 1,
  defaultDatasetId: 'second',
  datasets: [
    {
      id: 'first', title: 'First dataset', author: 'First author', year: 2024,
      entryKind: 'lemma', file: 'first.json', records: 2, totalFrequency: 10,
      hasPartOfSpeech: true, licence: null, citation: null
    },
    {
      id: 'second', title: 'Second dataset', author: 'Second author', year: 2023,
      entryKind: 'wordform', file: 'second.json', records: 3, totalFrequency: 20,
      hasPartOfSpeech: false, licence: null, citation: null
    }
  ]
};

vi.mock('../../../src/lib/translations', () => ({
  t: vi.fn((key) => key)
}));

vi.mock('../../../src/lib/data', () => ({
  loadCatalog: vi.fn(() => Promise.resolve(catalog))
}));

vi.mock('../../../src/components/DataLoader.svelte', () => ({
  default: vi.fn(() => ({ render: () => ({ html: '<div>DataLoader</div>', css: '' }) }))
}));

import Page from '../../../src/routes/+page.svelte';

describe('Page', () => {
  it('loads catalog metadata before rendering the dataset selector', async () => {
    const { getByText, getByRole, queryByText } = render(Page);

    expect(getByText('loadingCatalog')).toBeInTheDocument();
    await waitFor(() => {
      expect(queryByText('loadingCatalog')).not.toBeInTheDocument();
    });

    const select = getByRole('combobox');
    expect(select).toHaveValue('second');
    expect(select.querySelectorAll('option')).toHaveLength(2);
    expect(select).toHaveTextContent('First dataset (2024)');
    expect(getByRole('link', { name: 'Tyrinėti DML6 žodyno aprėptį pagal dažnumą' })).toHaveAttribute('href', '/zodyno-apreptis');
    expect(getByRole('link', { name: 'openDataProducts' })).toHaveAttribute('href', '/data-products/catalog.json');
  });
});
