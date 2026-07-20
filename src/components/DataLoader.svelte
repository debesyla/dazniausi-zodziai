<script lang="ts">
  import { loadDataset, type Dataset } from '$lib/data';
  import { filterWords, paginate, RESULTS_PER_PAGE, sortWords } from '$lib/utils';
  import type { WordSortKey } from '$lib/utils';
  import { t } from '$lib/translations';
  import SearchBar from './SearchBar.svelte';
  import DataTable from './DataTable.svelte';
  import DownloadButton from './DownloadButton.svelte';
  import FrequencyDashboard from './FrequencyDashboard.svelte';

  let { filename } = $props<{ filename: string }>();

  let dataset = $state<Dataset | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let appliedSearchQuery = $state('');
  let searchPending = $state(false);
  let selectedTypes = $state<string[]>([]);
  let sortKey = $state<WordSortKey>('frequency');
  let sortAsc = $state(false);
  let currentPage = $state(1);

  let uniqueTypes = $derived(dataset
    ? [...new Set(dataset.words.map((word) => word.type).filter((type): type is string => type !== undefined))]
    : []);

  let typeLabels = $derived(dataset?.provenance.partOfSpeech?.labels ?? {});

  let filteredWords = $derived(dataset?.words ? filterWords(dataset.words, appliedSearchQuery, selectedTypes) : []);

  let rankedFilteredWords = $derived(sortWords(filteredWords, 'frequency', false).map((word, index) => ({ ...word, rank: index + 1 })));

  let sortedFilteredWords = $derived(sortWords(rankedFilteredWords, sortKey, sortAsc));

  let resultPage = $derived(paginate(sortedFilteredWords, currentPage));

  let hasActiveFilters = $derived(searchQuery.trim().length > 0 || selectedTypes.length > 0);

  function clearFilters() {
    searchQuery = '';
    appliedSearchQuery = '';
    searchPending = false;
    selectedTypes = [];
  }

  function previousPage() {
    currentPage = Math.max(1, resultPage.currentPage - 1);
  }

  function nextPage() {
    currentPage = Math.min(resultPage.totalPages, resultPage.currentPage + 1);
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
    appliedSearchQuery = '';
    searchPending = false;
    selectedTypes = [];
    sortKey = 'frequency';
    sortAsc = false;
    currentPage = 1;
  });

  $effect(() => {
    const query = searchQuery;
    searchPending = query !== appliedSearchQuery;
    const timer = window.setTimeout(() => {
      appliedSearchQuery = query;
      searchPending = false;
    }, 150);
    return () => window.clearTimeout(timer);
  });

  $effect(() => {
    appliedSearchQuery;
    selectedTypes;
    sortKey;
    sortAsc;
    dataset?.id;
    currentPage = 1;
  });
</script>

{#if loading}
  <div class="loading" role="status" aria-live="polite">{t('loading')}</div>
{:else if error}
  <div class="error" role="alert">
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
    
    <h3>{t('words')} ({sortedFilteredWords.length})</h3>
    <div class="search-and-clear">
      <SearchBar bind:value={searchQuery} />
      {#if hasActiveFilters}
        <button onclick={clearFilters} class="clear-filters">{t('clearFilters')}</button>
      {/if}
    </div>
    {#if searchPending}
      <p class="updating-results" role="status" aria-live="polite">{t('updatingResults')}</p>
    {/if}
    {#if uniqueTypes.length > 0}
      <div class="type-filter">
        <h4>{t('filterByType')}</h4>
        {#if dataset.provenance.partOfSpeech}
          <p class="type-note">{t('posScheme')}: {dataset.provenance.partOfSpeech.name}</p>
        {/if}
        {#each uniqueTypes as type}
          <label>
            <input type="checkbox" bind:group={selectedTypes} value={type} />
            {typeLabels[type] ?? type}{#if typeLabels[type]} ({type}){/if}
          </label>
        {/each}
      </div>
    {/if}
    {#if sortedFilteredWords.length > 0}
      <FrequencyDashboard words={filteredWords} typeLabels={typeLabels} />
    {/if}
    <DownloadButton
      words={sortedFilteredWords}
      metadata={{ id: dataset.id, title: dataset.title, author: dataset.author, year: dataset.year }}
      exploration={{ query: appliedSearchQuery, types: selectedTypes, sortKey, sortAsc }}
    />
    <div class="table-container">
      {#if sortedFilteredWords.length === 0}
        <p class="empty-state" role="status" aria-live="polite">{t('noMatchingWords')}</p>
      {:else}
        {#key filename}
          <p class="result-count" role="status" aria-live="polite">{t('showingResults', { start: resultPage.start, end: resultPage.end, total: sortedFilteredWords.length })}</p>
          <DataTable words={resultPage.items} typeLabels={typeLabels} bind:sortKey bind:sortAsc />
        {/key}
        {#if resultPage.totalPages > 1}
          <nav class="pagination" aria-label={t('pagination')}>
            <button onclick={previousPage} disabled={resultPage.currentPage === 1}>{t('previousPage')}</button>
            <span>{t('pageOf', { page: resultPage.currentPage, total: resultPage.totalPages })}</span>
            <button onclick={nextPage} disabled={resultPage.currentPage === resultPage.totalPages}>{t('nextPage')}</button>
          </nav>
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

  .type-note {
    margin: 0 0 var(--sm);
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

  .updating-results,
  .result-count {
    margin-top: var(--sm);
  }

  .pagination {
    align-items: center;
    display: flex;
    gap: var(--sm);
    justify-content: center;
    margin: var(--md) 0 0;
  }

  .pagination button:disabled {
    cursor: not-allowed;
    opacity: .5;
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
