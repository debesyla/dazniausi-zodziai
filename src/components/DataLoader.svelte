<script lang="ts">
  import { loadDataset } from '$lib/data';
  import { filterWords } from '$lib/utils';
  import { t } from '$lib/translations';
  import SearchBar from './SearchBar.svelte';
  import DataTable from './DataTable.svelte';
  import DownloadButton from './DownloadButton.svelte';

  let { filename = 'sample-dataset.json' } = $props();

  interface Word {
    word: string;
    type?: string;
    frequency: number;
  }

  interface Dataset {
    author: string;
    year: number;
    words: Word[];
  }

  let dataset = $state<Dataset | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let selectedTypes = $state<string[]>([]);
  let loadedAll = $state(false);

  let uniqueTypes = $derived(dataset ? [...new Set(dataset.words.map(w => w.type).filter(Boolean))] : []);

  let filteredWords = $derived(dataset?.words ? filterWords(dataset.words, searchQuery, selectedTypes) : []);

  let sortedFilteredWords = $derived(filteredWords.slice().sort((a, b) => b.frequency - a.frequency));

  let displayedWords = $derived(loadedAll ? sortedFilteredWords : sortedFilteredWords.slice(0, 10));

  function clearFilters() {
    searchQuery = '';
    selectedTypes = [];
  }

  $effect(() => {
    loading = true;
    error = null;
    dataset = null;
    loadDataset(filename).then((d) => {
      dataset = d;
      loading = false;
    }).catch((err) => {
      error = err instanceof Error ? err.message : String(err);
      loading = false;
    });
  });

  $effect(() => {
    searchQuery;
    selectedTypes;
    loadedAll = false;
  });
</script>

{#if loading}
  <div class="loading">{t('loading')}</div>
{:else if error}
  <div class="error">
    <h3>{t('errorLoadingData')}</h3>
    <p>{error}</p>
  </div>
{:else if dataset}
  <div class="dataset">
    <h2>{t('datasetInformation')}</h2>
    <p><strong>{t('author')}:</strong> {dataset.author}</p>
    <p><strong>{t('year')}:</strong> {dataset.year}</p>
    
    <h3>{t('words')} ({displayedWords.length}{#if sortedFilteredWords.length > 10 && !loadedAll} / {sortedFilteredWords.length}{/if})</h3>
    <div class="search-and-clear">
      <SearchBar bind:value={searchQuery} />
      {#if searchQuery || selectedTypes.length > 0}
        <button onclick={clearFilters} class="clear-filters">{t('clearFilters')}</button>
      {/if}
    </div>
    {#if uniqueTypes.length > 0}
      <div class="type-filter">
        <h4>{t('filterByType')}</h4>
        {#each uniqueTypes as type}
          <label>
            <input type="checkbox" bind:group={selectedTypes} value={type} />
            {type}
          </label>
        {/each}
      </div>
    {/if}
    <DownloadButton words={filteredWords} metadata={{author: dataset.author, year: dataset.year}} />
    <div class="table-container">
      <DataTable words={displayedWords} />
      {#if sortedFilteredWords.length > 10 && !loadedAll}
        <button onclick={() => loadedAll = true} class="load-all">{t('loadAll')}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .loading {
    padding: var(--md);
    text-align: center;
    color: #FFBF00;
  }

  .error {
    padding: var(--md);
    background-color: #111;
    border: 1px solid #FFBF00;
  }

  .error h3 {
    margin: 0 0 var(--sm) 0;
    color: #FFBF00;
  }

  .dataset h2 {
    margin: 0 0 var(--lg) 0;
    color: #FFBF00;
  }

  .dataset h3 {
    margin: var(--lg) 0 var(--sm) 0;
    color: #FFBF00;
  }

  .type-filter {
    margin: var(--sm) 0;
  }

  .type-filter h4 {
    margin: 0 0 var(--sm) 0;
    color: #FFBF00;
  }

  .type-filter label {
    display: inline-block;
    margin-right: var(--lg);
    color: #FFBF00;
  }

  .clear-filters {
    background: transparent;
    border: 1px solid #FFBF00;
    color: #FFBF00;
    padding: var(--xs) var(--sm);
    cursor: pointer;
    user-select: none;
    margin: 0;
  }

  .clear-filters:hover {
    background: #FFBF00;
    color: #222;
  }

  .load-all {
    background: transparent;
    border: 1px solid #FFBF00;
    color: #FFBF00;
    padding: var(--xs) var(--sm);
    cursor: pointer;
    user-select: none;
    margin: var(--sm) 0;
  }

  .load-all:hover {
    background: #FFBF00;
    color: #222;
  }

  .table-container {
    margin-top: var(--sm);
    text-align: center;
  }

  .search-and-clear {
    display: flex;
    gap: var(--sm);
    align-items: center;
  }

  @media (max-width: 767px) {
    .search-and-clear {
      flex-direction: column;
      align-items: stretch;
    }
    .clear-filters {
      align-self: flex-end;
    }
  }
</style>
