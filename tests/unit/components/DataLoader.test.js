import { render, waitFor } from '@testing-library/svelte/svelte5';
import { vi } from 'vitest';
import { loadDataset } from '../../../src/lib/data';
import { filterWords } from '../../../src/lib/utils';
import DataLoader from '../../../src/components/DataLoader.svelte';

// Mock dependencies
vi.mock('../../../src/lib/data', () => ({
  loadDataset: vi.fn()
}));

vi.mock('../../../src/lib/utils', () => ({
  filterWords: vi.fn((words, query, types) => words.filter(w => w.word.includes(query) && (!types.length || types.includes(w.type))))
}));

vi.mock('../../../src/lib/translations', () => ({
  t: vi.fn((key) => key)
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
    author: 'Test Author',
    year: 2023,
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

  it('clears filters when clear button is clicked', async () => {
    loadDataset.mockResolvedValue(mockDataset);

    const { getByText, queryByText } = render(DataLoader, { filename: 'test.json' });

    await waitFor(() => {
      expect(queryByText('loading')).not.toBeInTheDocument();
    });

    const clearButton = getByText('clearFilters');
    clearButton.click();

    // Check that filterWords was called with empty filters
    expect(filterWords).toHaveBeenCalledWith(mockDataset.words, '', []);
  });
});