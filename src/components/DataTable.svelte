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

  let sortedWords = $derived<Word[]>(sortWords(words, sortKey, sortAsc));

  function displayType(type?: string) {
    if (!type) return '';
    return typeLabels[type] ? `${typeLabels[type]} (${type})` : type;
  }
</script>

<table>
  <thead>
    <tr>
      <th>{t('rank')}</th>
      <th onclick={() => sortBy('word')} class="sortable">{t('word')} {sortKey === 'word' ? (sortAsc ? '↑' : '↓') : ''}</th>
      <th onclick={() => sortBy('frequency')} class="sortable">{t('frequency')} {sortKey === 'frequency' ? (sortAsc ? '↑' : '↓') : ''}</th>
      <th onclick={() => sortBy('type')} class="sortable">{t('type')} {sortKey === 'type' ? (sortAsc ? '↑' : '↓') : ''}</th>
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

<style>
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
    cursor: pointer;
    background-color: #333;
  }
  th.sortable:hover {
    background-color: #444;
  }

  @media (max-width: 767px) {
    table {
      overflow-x: auto;
      display: block;
      white-space: nowrap;
    }
    th, td {
      padding: var(--xs);
    }
  }
</style>
