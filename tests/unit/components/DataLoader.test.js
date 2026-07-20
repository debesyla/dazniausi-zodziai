import { render, waitFor } from '@testing-library/svelte/svelte5';
import { vi } from 'vitest';
import { loadDataset } from '../../../src/lib/data';
import DataLoader from '../../../src/components/DataLoader.svelte';

// Mock dependencies
vi.mock('../../../src/lib/data', () => ({
  loadDataset: vi.fn()
}));

vi.mock('../../../src/lib/translations', () => ({
  t: vi.fn((key, parameters) => parameters
    ? `${key}:${Object.values(parameters).join('/')}`
    : key)
}));

vi.mock('../../../src/components/SearchBar.svelte', () => ({
  default: vi.fn(() => ({ render: () => ({ html: '<input />', css: '' }) }))
}));

vi.mock('../../../src/components/DataTable.svelte', () => ({
  default: vi.fn(() => ({ render: () => ({ html: '<table></table>', css: '' }) }))
}));

vi.mock('../../../src/components/DownloadButton.svelte', () => ({
  default: vi.fn(() => ({ render: () => ({ html: '<button></button>', css: '' }) }))
}));

describe('DataLoader', () => {
  const mockDataset = {
    schemaVersion: 1,
    id: 'test-dataset',
    title: 'Test dataset',
    author: 'Test Author',
    year: 2023,
    entryKind: 'lemma',
    provenance: {},
    summary: { sourceRows: 2, entryCount: 2, totalFrequency: 15, duplicateEntries: 0 },
    words: [
      { word: 'test', type: 'noun', frequency: 10 },
      { word: 'word', frequency: 5 }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    loadDataset.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { getByText } = render(DataLoader, { filename: 'test.json' });

    expect(getByText('loading')).toBeInTheDocument();
  });

  it('shows data on successful load', async () => {
    loadDataset.mockResolvedValue(mockDataset);

    const { queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    expect(loadDataset).toHaveBeenCalledWith('test.json');
  });

  it('shows error on load failure', async () => {
    loadDataset.mockRejectedValue(new Error('Load failed'));

    const { getByText, queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    expect(getByText('errorLoadingData')).toBeInTheDocument();
    expect(getByText('Load failed')).toBeInTheDocument();
  });

  it('ignores an older dataset response after the filename changes', async () => {
    const deferred = {};
    const firstDataset = { ...mockDataset, author: 'First Author' };
    const secondDataset = { ...mockDataset, author: 'Second Author' };
    loadDataset.mockImplementation((filename) => new Promise((resolve) => {
      deferred[filename] = resolve;
    }));

    const { getByText, rerender } = render(DataLoader, { filename: 'first.json' });
    await rerender({ filename: 'second.json' });

    deferred['second.json'](secondDataset);
    await waitFor(() => {
      expect(getByText('Second Author')).toBeInTheDocument();
    });

    deferred['first.json'](firstDataset);
    await Promise.resolve();
    expect(getByText('Second Author')).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', async () => {
    loadDataset.mockResolvedValue(mockDataset);

    const { getByText, getByLabelText, queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    // Set a filter by checking the type checkbox
    const nounCheckbox = getByLabelText('noun');
    nounCheckbox.click();

    // Wait for the clear button to appear
    await waitFor(() => {
      expect(getByText('clearFilters')).toBeInTheDocument();
    });

    const clearButton = getByText('clearFilters');
    clearButton.click();

    await waitFor(() => {
      expect(nounCheckbox).not.toBeChecked();
      expect(queryByText('clearFilters')).not.toBeInTheDocument();
    });
  });

  it('resets dataset-specific filters when the filename changes', async () => {
    const secondDataset = {
      ...mockDataset,
      id: 'second-dataset',
      author: 'Second Author',
      year: 2024,
      words: [{ word: 'other', type: 'verb', frequency: 20 }]
    };
    loadDataset.mockImplementation((filename) => Promise.resolve(
      filename === 'second.json' ? secondDataset : mockDataset
    ));

    const { getByLabelText, getByText, queryByText, rerender } = render(DataLoader, { filename: 'first.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    getByLabelText('noun').click();
    await waitFor(() => {
      expect(getByText('clearFilters')).toBeInTheDocument();
    });

    await rerender({ filename: 'second.json' });

    await waitFor(() => {
      expect(getByText('Second Author')).toBeInTheDocument();
      expect(getByLabelText('verb')).not.toBeChecked();
    });
    expect(queryByText('clearFilters')).not.toBeInTheDocument();
  });

  it('shows bounded pagination when more than 50 words', async () => {
    const largeDataset = {
      ...mockDataset,
      words: Array.from({ length: 51 }, (_, i) => ({ word: `word${i}`, frequency: 100 - i }))
    };
    loadDataset.mockResolvedValue(largeDataset);

    const { getByText, queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    expect(getByText('nextPage')).toBeInTheDocument();
    expect(getByText('pageOf:1/2')).toBeInTheDocument();
  });

  it('does not show pagination when 50 or fewer words', async () => {
    loadDataset.mockResolvedValue(mockDataset); // 2 words

    const { queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    expect(queryByText('nextPage')).not.toBeInTheDocument();
  });

  it('shows a table empty state when no active results remain', async () => {
    loadDataset.mockResolvedValue({ ...mockDataset, words: [] });

    const { container, queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    expect(container.querySelector('.empty-state')).toHaveTextContent('noMatchingWords');
  });

  it('moves to the next bounded result page', async () => {
    const largeDataset = {
      ...mockDataset,
      words: Array.from({ length: 51 }, (_, i) => ({ word: `word${i}`, frequency: 100 - i }))
    };
    loadDataset.mockResolvedValue(largeDataset);

    const { getByText, queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    const nextButton = getByText('nextPage');
    nextButton.click();

    await waitFor(() => {
      expect(getByText('pageOf:2/2')).toBeInTheDocument();
      expect(getByText('previousPage')).toBeInTheDocument();
    });
  });
});
