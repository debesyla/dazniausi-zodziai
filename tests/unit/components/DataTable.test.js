import { render, fireEvent } from '@testing-library/svelte/svelte5';
import userEvent from '@testing-library/user-event';
import DataTable from '../../../src/components/DataTable.svelte';

const mockWords = [
  { word: 'test', type: 'verb', frequency: 10 },
  { word: 'word', type: 'noun', frequency: 5 }
];

const mockWordsLarge = [
  { word: 'apple', type: 'noun', frequency: 100 },
  { word: 'banana', type: 'noun', frequency: 50 },
  { word: 'cherry', type: 'noun', frequency: 75 },
  { word: 'date', type: 'noun', frequency: 25 },
  { word: 'elderberry', type: 'noun', frequency: 10 }
];

test('DataTable renders table with words', () => {
  const { getByText, getAllByRole } = render(DataTable, { words: mockWords });

  expect(getByText('test')).toBeInTheDocument();
  expect(getByText('word')).toBeInTheDocument();
  expect(getByText('10')).toBeInTheDocument();
  expect(getByText('5')).toBeInTheDocument();

  const headers = getAllByRole('columnheader');
  expect(headers).toHaveLength(3);
  expect(headers[0]).toHaveTextContent('Žodis');
  expect(headers[1]).toHaveTextContent('Dažnumas ↓');
  expect(headers[2]).toHaveTextContent('Tipas');
});

test('DataTable sortable headers have correct class', () => {
  const { getByText } = render(DataTable, { words: mockWords });

  const wordHeader = getByText('Žodis');
  expect(wordHeader).toHaveClass('sortable');

  const freqHeader = getByText('Dažnumas ↓');
  expect(freqHeader).toHaveClass('sortable');

  const typeHeader = getByText('Tipas');
  expect(typeHeader).toHaveClass('sortable');
});

test('DataTable sorts by frequency descending by default', () => {
  const { getAllByRole } = render(DataTable, { words: mockWords });

  const rows = getAllByRole('row');
  // rows[0] is header, rows[1] first data row, etc.
  expect(rows[1]).toHaveTextContent('test'); // higher frequency first
  expect(rows[2]).toHaveTextContent('word');
});

test('DataTable sorts large data set by frequency descending by default', () => {
  const { getAllByRole } = render(DataTable, { words: mockWordsLarge });

  const rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('apple'); // 100
  expect(rows[2]).toHaveTextContent('cherry'); // 75
  expect(rows[3]).toHaveTextContent('banana'); // 50
  expect(rows[4]).toHaveTextContent('date'); // 25
  expect(rows[5]).toHaveTextContent('elderberry'); // 10
});

test('DataTable allows manual sorting to ascending', async () => {
  const user = userEvent.setup();
  const { getByText, getAllByRole } = render(DataTable, { words: mockWords });

  const freqHeader = getByText('Dažnumas ↓');
  await user.click(freqHeader);

  // Now, should be ↑, and order reversed to ascending
  expect(getByText('Dažnumas ↑')).toBeInTheDocument();

  const rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('word'); // lower frequency first
  expect(rows[2]).toHaveTextContent('test');
});

test('DataTable allows manual sorting by word', async () => {
  const user = userEvent.setup();
  const { getByText, getAllByRole } = render(DataTable, { words: mockWords });

  const wordHeader = getByText('Žodis');
  await user.click(wordHeader);

  // First click, ascending
  expect(getByText('Žodis ↑')).toBeInTheDocument();

  let rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('test'); // alphabetical first
  expect(rows[2]).toHaveTextContent('word');

  // Second click, descending
  await user.click(wordHeader);
  expect(getByText('Žodis ↓')).toBeInTheDocument();

  rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('word');
  expect(rows[2]).toHaveTextContent('test');
});

test('DataTable allows manual sorting by type', async () => {
  const user = userEvent.setup();
  const { getByText, getAllByRole } = render(DataTable, { words: mockWords });

  const typeHeader = getByText('Tipas');
  await user.click(typeHeader);

  // First click, ascending
  expect(getByText('Tipas ↑')).toBeInTheDocument();

  let rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('word'); // noun first
  expect(rows[2]).toHaveTextContent('test');

  // Second click, descending
  await user.click(typeHeader);
  expect(getByText('Tipas ↓')).toBeInTheDocument();

  rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('test'); // verb first
  expect(rows[2]).toHaveTextContent('word');
});
