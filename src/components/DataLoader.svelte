<script lang="ts">
  import { loadDataset, type Dataset } from '$lib/data';
  import { filterWords } from '$lib/utils';
  import { t } from '$lib/translations';
  import SearchBar from './SearchBar.svelte';
  import DataTable from './DataTable.svelte';
  import DownloadButton from './DownloadButton.svelte';

  let { filename = 'sample-dataset.json' } = $props();

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

  let hasActiveFilters = $derived(searchQuery.trim().length > 0 || selectedTypes.length > 0);

  function clearFilters() {
    searchQuery = '';
    selectedTypes = [];
  }

  $effect(() => {
    let cancelled = false;
    loading = true;
    error = null;
    dataset = null;
    loadDataset(filename).then((d) => {
      if (cancelled) return;
      dataset = d;
      loading = false;
    }).catch((err) => {
      if (cancelled) return;
      error = err instanceof Error ? err.message : String(err);
      loading = false;
    });

    return () => {
      cancelled = true;
    };
  });

  // Filters describe a dataset-specific exploration. Keeping them when the
  // source changes can make a valid dataset look empty.
  $effect(() => {
    if (!filename) return;
    searchQuery = '';
    selectedTypes = [];
    loadedAll = false;
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
    <h2>{dataset.title}</h2>
    <p><strong>{t('author')}:</strong> {dataset.author}</p>
    <p><strong>{t('year')}:</strong> {dataset.year}</p>
    <p><strong>{t('entryKind')}:</strong> {dataset.entryKind === 'lemma' ? t('lemma') : t('wordform')}</p>
    {#if dataset.provenance.licence}
      <p><strong>{t('licence')}:</strong> {dataset.provenance.licence}</p>
    {/if}
    {#if dataset.provenance.citation}
      <p><strong>{t('citation')}:</strong> {dataset.provenance.citation}</p>
    {/if}
    {#if dataset.provenance.sourceUrl}
      <p><a href={dataset.provenance.sourceUrl} target="_blank" rel="noreferrer">{t('source')}</a></p>
    {/if}
    
    <h3>{t('words')} ({displayedWords.length}{#if sortedFilteredWords.length > 10 && !loadedAll} / {sortedFilteredWords.length}{/if})</h3>
    <div class="search-and-clear">
      <SearchBar bind:value={searchQuery} />
      {#if hasActiveFilters}
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
      {#if sortedFilteredWords.length === 0}
        <p class="empty-state" role="status">{t('noMatchingWords')}</p>
      {:else}
        {#key filename}
          <DataTable words={displayedWords} />
        {/key}
        {#if sortedFilteredWords.length > 10 && !loadedAll}
          <button onclick={() => loadedAll = true} class="load-all">{t('loadAll')}</button>
        {/if}
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

  .empty-state {
    margin: var(--md) 0;
    padding: var(--md);
    border: 1px solid #FFBF00;
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
