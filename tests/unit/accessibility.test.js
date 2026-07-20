import axe from 'axe-core';
import { render } from '@testing-library/svelte/svelte5';
import { expect, it } from 'vitest';
import DataTable from '../../src/components/DataTable.svelte';
import SearchBar from '../../src/components/SearchBar.svelte';

it('has no automated accessibility violations in the core search and table controls', async () => {
  render(SearchBar, { value: '' });
  render(DataTable, { words: [{ word: 'žodis', type: 'dkt', frequency: 10, rank: 1 }] });

  const result = await axe.run(document.body, {
    // Components are mounted without the application's page landmark here.
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } }
  });
  expect(result.violations).toEqual([]);
});
