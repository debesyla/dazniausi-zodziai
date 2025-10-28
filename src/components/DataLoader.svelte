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
    <DownloadButton words={filteredWords} metadata={{author: dataset.author, year: dataset.year}} />
    <DataTable words={filteredWords} />
  </div>
{/if}

<style>
  .loading {
    padding: 1rem;
    text-align: center;
    color: var(--text-color);
  }

  .error {
    padding: 1rem;
    background-color: #200000;
    border: 1px solid #800000;
    border-radius: 4px;
  }

  .error h3 {
    margin: 0 0 0.5rem 0;
    color: #FFBF00;
  }

  .dataset {
    padding: 1rem;
  }

  .dataset h2 {
    margin: 0 0 1rem 0;
    color: var(--text-color);
  }

  .dataset h3 {
    margin: 1.5rem 0 0.5rem 0;
    color: var(--text-color);
  }

  .type-filter {
    margin: 0.5rem 0;
  }

  .type-filter h4 {
    margin: 0 0 0.5rem 0;
    color: var(--text-color);
  }

  .type-filter label {
    display: inline-block;
    margin-right: 1rem;
    color: var(--text-color);
  }
</style>
