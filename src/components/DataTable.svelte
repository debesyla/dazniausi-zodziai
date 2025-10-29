<script lang="ts">
  import { t } from '$lib/translations';
  interface Word {
    word: string;
    type?: string;
    frequency: number;
  }

  let { words = [] } = $props<{ words?: Word[] }>();

  let sortKey = $state<'word' | 'frequency'>('frequency');
  let sortAsc = $state(false);

  function sortBy(key: 'word' | 'frequency') {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }

  // For display, assume words are already sorted by parent
  // Or sort here
  let sortedWords = $derived([...words].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (sortKey === 'word') {
      const aStr = aVal as string;
      const bStr = bVal as string;
      return sortAsc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    } else {
      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortAsc ? aNum - bNum : bNum - aNum;
    }
  }));
</script>

<table>
  <thead>
    <tr>
      <th onclick={() => sortBy('word')} class="sortable">{t('word')} {sortKey === 'word' ? (sortAsc ? '↑' : '↓') : ''}</th>
      <th>{t('type')}</th>
      <th onclick={() => sortBy('frequency')} class="sortable">{t('frequency')} {sortKey === 'frequency' ? (sortAsc ? '↑' : '↓') : ''}</th>
    </tr>
  </thead>
  <tbody>
    {#each sortedWords as word}
      <tr>
        <td>{word.word}</td>
        <td>{word.type || ''}</td>
        <td>{word.frequency.toLocaleString()}</td>
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