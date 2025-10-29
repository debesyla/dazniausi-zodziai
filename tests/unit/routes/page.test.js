import { render } from '@testing-library/svelte/svelte5';
import { vi } from 'vitest';

// Mock translations
vi.mock('../../../src/lib/translations', () => ({
  t: vi.fn((key) => key)
}));

// Mock data
vi.mock('../../../src/lib/data', () => ({
  getAvailableDatasets: vi.fn(() => [
    { filename: 'sample-dataset-2.json', author: 'Vilnius University Linguistics Department' },
    { filename: 'sample-dataset.json', author: 'Lithuanian Language Institute' }
  ])
}));

// Mock DataLoader
vi.mock('../../../src/components/DataLoader.svelte', () => ({
  default: vi.fn(() => ({ render: () => ({ html: '<div>DataLoader</div>', css: '' }) }))
}));

import Page from '../../../src/routes/+page.svelte';

describe('Page', () => {
  it('renders page title and description', () => {
    const { getByText, getByRole } = render(Page);

    expect(getByText('pageTitle')).toBeInTheDocument();

    const select = getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('sample-dataset-2.json');
  });

  it('renders dataset options', () => {
    const { getByRole } = render(Page);

    const select = getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveValue('sample-dataset-2.json');
    expect(options[0]).toHaveTextContent('Vilnius University Linguistics Department');
    expect(options[1]).toHaveValue('sample-dataset.json');
    expect(options[1]).toHaveTextContent('Lithuanian Language Institute');
  });
});