import { render } from '@testing-library/svelte/svelte5';
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
  expect(headers).toHaveLength(4);
  expect(headers[0]).toHaveTextContent('Rangas');
  expect(headers[1]).toHaveTextContent('Žodis');
  expect(headers[2]).toHaveTextContent('Dažnumas ↓');
  expect(headers[3]).toHaveTextContent('Tipas');
});

test('DataTable displays a source-specific POS label without losing the raw code', () => {
  const { getByText } = render(DataTable, {
    words: [{ word: 'ir', type: 'jng', frequency: 10 }],
    typeLabels: { jng: 'Jungtukas' }
  });

  expect(getByText('Jungtukas (jng)')).toBeInTheDocument();
});

test('DataTable displays the frequency rank supplied by the active result set', () => {
  const { getByText } = render(DataTable, {
    words: [{ word: 'ir', type: 'jng', frequency: 10, rank: 3 }]
  });

  expect(getByText('3')).toBeInTheDocument();
});

test('DataTable exposes sortable columns as labelled controls with aria-sort state', () => {
  const { getByRole } = render(DataTable, { words: mockWords });

  const wordControl = getByRole('button', { name: 'Rikiuoti pagal Žodis: nerikiuota' });
  const frequencyControl = getByRole('button', { name: 'Rikiuoti pagal Dažnumas: mažėjančia tvarka' });
  const typeControl = getByRole('button', { name: 'Rikiuoti pagal Tipas: nerikiuota' });

  expect(wordControl).toHaveClass('sort-button');
  expect(wordControl.closest('th')).toHaveAttribute('aria-sort', 'none');
  expect(frequencyControl.closest('th')).toHaveAttribute('aria-sort', 'descending');
  expect(typeControl.closest('th')).toHaveAttribute('aria-sort', 'none');
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
  const { getByRole, getAllByRole } = render(DataTable, { words: mockWords });

  const freqHeader = getByRole('button', { name: 'Rikiuoti pagal Dažnumas: mažėjančia tvarka' });
  await user.click(freqHeader);

  // Now, should be ↑, and order reversed to ascending
  expect(freqHeader).toHaveTextContent('Dažnumas ↑');
  expect(freqHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');

  const rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('word'); // lower frequency first
  expect(rows[2]).toHaveTextContent('test');
});

test('DataTable allows manual sorting by word', async () => {
  const user = userEvent.setup();
  const { getByRole, getAllByRole } = render(DataTable, { words: mockWords });

  const wordHeader = getByRole('button', { name: 'Rikiuoti pagal Žodis: nerikiuota' });
  await user.click(wordHeader);

  // First click, ascending
  expect(wordHeader).toHaveTextContent('Žodis ↑');
  expect(wordHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');

  let rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('test'); // alphabetical first
  expect(rows[2]).toHaveTextContent('word');

  // Second click, descending
  await user.click(wordHeader);
  expect(wordHeader).toHaveTextContent('Žodis ↓');
  expect(wordHeader.closest('th')).toHaveAttribute('aria-sort', 'descending');

  rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('word');
  expect(rows[2]).toHaveTextContent('test');
});

test('DataTable allows manual sorting by type', async () => {
  const user = userEvent.setup();
  const { getByRole, getAllByRole } = render(DataTable, { words: mockWords });

  const typeHeader = getByRole('button', { name: 'Rikiuoti pagal Tipas: nerikiuota' });
  await user.click(typeHeader);

  // First click, ascending
  expect(typeHeader).toHaveTextContent('Tipas ↑');
  expect(typeHeader.closest('th')).toHaveAttribute('aria-sort', 'ascending');

  let rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('word'); // noun first
  expect(rows[2]).toHaveTextContent('test');

  // Second click, descending
  await user.click(typeHeader);
  expect(typeHeader).toHaveTextContent('Tipas ↓');
  expect(typeHeader.closest('th')).toHaveAttribute('aria-sort', 'descending');

  rows = getAllByRole('row');
  expect(rows[1]).toHaveTextContent('test'); // verb first
  expect(rows[2]).toHaveTextContent('word');
});

test('DataTable sorting works with keyboard alone', async () => {
  const user = userEvent.setup();
  const { getByRole, getAllByRole } = render(DataTable, { words: mockWords });

  await user.tab();
  const wordControl = getByRole('button', { name: 'Rikiuoti pagal Žodis: nerikiuota' });
  expect(wordControl).toHaveFocus();

  await user.keyboard('{Enter}');
  expect(wordControl.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  expect(getAllByRole('row')[1]).toHaveTextContent('test');
});
