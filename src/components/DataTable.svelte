<script lang="ts">
  import { t } from '$lib/translations';
  import { sortWords } from '$lib/utils';
  import type { WordSortKey } from '$lib/utils';
  interface Word {
    word: string;
    type?: string;
    frequency: number;
    rank?: number;
  }

  let {
    words = [],
    typeLabels = {},
    sortKey = $bindable<WordSortKey>('frequency'),
    sortAsc = $bindable(false)
  } = $props<{
    words?: Word[];
    typeLabels?: Record<string, string>;
    sortKey?: WordSortKey;
    sortAsc?: boolean;
  }>();

  function sortBy(key: WordSortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }

  function sortState(key: WordSortKey) {
    if (sortKey !== key) return 'none';
    return sortAsc ? 'ascending' : 'descending';
  }

  function sortControlLabel(key: WordSortKey) {
    const column = key === 'word' ? t('word') : key === 'frequency' ? t('frequency') : t('type');
    const direction = sortKey === key ? (sortAsc ? t('ascending') : t('descending')) : t('unsorted');
    return `${t('sortBy')} ${column}: ${direction}`;
  }

  let sortedWords = $derived<Word[]>(sortWords(words, sortKey, sortAsc));

  function displayType(type?: string) {
    if (!type) return '';
    return typeLabels[type] ? `${typeLabels[type]} (${type})` : type;
  }
</script>

<div class="table-scroll">
  <table>
    <thead>
      <tr>
        <th scope="col">{t('rank')}</th>
        <th scope="col" aria-sort={sortState('word')} class="sortable">
          <button type="button" class="sort-button" onclick={() => sortBy('word')} aria-label={sortControlLabel('word')}>
            {t('word')} {#if sortKey === 'word'}<span aria-hidden="true">{sortAsc ? '↑' : '↓'}</span>{/if}
          </button>
        </th>
        <th scope="col" aria-sort={sortState('frequency')} class="sortable">
          <button type="button" class="sort-button" onclick={() => sortBy('frequency')} aria-label={sortControlLabel('frequency')}>
            {t('frequency')} {#if sortKey === 'frequency'}<span aria-hidden="true">{sortAsc ? '↑' : '↓'}</span>{/if}
          </button>
        </th>
        <th scope="col" aria-sort={sortState('type')} class="sortable">
          <button type="button" class="sort-button" onclick={() => sortBy('type')} aria-label={sortControlLabel('type')}>
            {t('type')} {#if sortKey === 'type'}<span aria-hidden="true">{sortAsc ? '↑' : '↓'}</span>{/if}
          </button>
        </th>
      </tr>
    </thead>
    <tbody>
      {#each sortedWords as word}
        <tr>
          <td>{word.rank ?? ''}</td>
          <td>{word.word}</td>
          <td>{word.frequency.toLocaleString()}</td>
          <td>{displayType(word.type)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background-color: #222;
    color: #FFBF00;
  }
  th, td {
    padding: var(--sm);
    border: 1px solid #FFBF00;
    text-align: left;
    color: #FFBF00;
  }
  th.sortable {
    background-color: #333;
  }
  .sort-button {
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
    width: 100%;
  }
  .sort-button:hover {
    background-color: #444;
  }
  .sort-button:focus-visible {
    outline: 2px solid #FFBF00;
    outline-offset: 2px;
  }

  @media (max-width: 767px) {
    table {
      min-width: 31rem;
      white-space: nowrap;
    }
    th, td {
      padding: var(--xs);
    }
  }
</style>
