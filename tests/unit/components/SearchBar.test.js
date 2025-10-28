import { render } from '@testing-library/svelte';
import SearchBar from '../../../src/components/SearchBar.svelte';

test('SearchBar renders input and button with accessibility when value is set', () => {
  const { getByRole, getByPlaceholderText } = render(SearchBar, { value: 'test' });

  expect(getByPlaceholderText('Ieškoti žodžių...')).toBeInTheDocument();

  const button = getByRole('button');
  expect(button).toBeInTheDocument();
  expect(button).toHaveAttribute('aria-label', 'Išvalyti paiešką');
  expect(button).toHaveTextContent('✕');
});

test('SearchBar does not render button when value is empty', () => {
  const { queryByRole, getByPlaceholderText } = render(SearchBar, { value: '' });

  expect(getByPlaceholderText('Ieškoti žodžių...')).toBeInTheDocument();
  expect(queryByRole('button')).not.toBeInTheDocument();
});
