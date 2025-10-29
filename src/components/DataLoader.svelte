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

  let uniqueTypes = $derived(dataset ? [...new Set(dataset.words.map(w => w.type).filter(Boolean))] : []);

  let filteredWords = $derived(dataset?.words ? filterWords(dataset.words, searchQuery, selectedTypes) : []);

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
    
    <h3>{t('words')} ({filteredWords.length})</h3>
    <SearchBar bind:value={searchQuery} />
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
    <button onclick={clearFilters} class="clear-filters">{t('clearFilters')}</button>
    <DownloadButton words={filteredWords} metadata={{author: dataset.author, year: dataset.year}} />
    <DataTable words={filteredWords} />
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
    margin: var(--sm) 0;
  }

  .clear-filters:hover {
    background: #FFBF00;
    color: #222;
  }
</style>
