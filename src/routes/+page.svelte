<script lang="ts">
  import DataLoader from '../components/DataLoader.svelte';
  import { t } from '$lib/translations';
  import { loadCatalog, type DatasetCatalog } from '$lib/data';

  let catalog = $state<DatasetCatalog | null>(null);
  let catalogLoading = $state(true);
  let catalogError = $state<string | null>(null);
  let selectedDatasetId = $state('');

  let selectedDataset = $derived(catalog?.datasets.find((dataset) => dataset.id === selectedDatasetId));

  function selectDataset(event: Event) {
    selectedDatasetId = (event.currentTarget as HTMLSelectElement).value;
  }

  $effect(() => {
    let cancelled = false;
    catalogLoading = true;
    catalogError = null;
    loadCatalog().then((loadedCatalog) => {
      if (cancelled) return;
      catalog = loadedCatalog;
      selectedDatasetId = loadedCatalog.datasets[0]?.id ?? '';
      catalogLoading = false;
    }).catch((error) => {
      if (cancelled) return;
      catalogError = error instanceof Error ? error.message : String(error);
      catalogLoading = false;
    });

    return () => {
      cancelled = true;
    };
  });
</script>

<svelte:head>
  <title>{t('pageTitle')}</title>
</svelte:head>

<main>
  <h1>{t('pageTitle')}</h1>

  {#if catalogLoading}
    <div class="loading" role="status" aria-live="polite">{t('loadingCatalog')}</div>
  {:else if catalogError}
    <div class="error" role="alert">
      <h2>{t('errorLoadingCatalog')}</h2>
      <p>{catalogError}</p>
    </div>
  {:else if catalog && catalog.datasets.length > 0}
    <div class="dataset-selector">
      <label for="dataset-select">{t('selectDataset')}:</label>
      <select id="dataset-select" value={selectedDatasetId} onchange={selectDataset}>
        {#each catalog.datasets as dataset}
          <option value={dataset.id}>{dataset.title} ({dataset.year})</option>
        {/each}
      </select>
    </div>

    {#if selectedDataset}
      <DataLoader filename={selectedDataset.file} />
    {/if}
  {:else}
    <p class="empty-catalog" role="status">{t('noDatasets')}</p>
  {/if}
</main>

<style>
  h1 {
    margin-bottom: var(--lg);
  }

  .dataset-selector {
    margin-bottom: var(--md);
  }

  .dataset-selector label {
    margin-right: var(--sm);
    font-weight: bold;
  }

  .dataset-selector select {
    background: #222;
    color: #FFBF00;
    border: 1px solid #FFBF00;
    padding: var(--xs) var(--sm);
  }

  .loading,
  .error,
  .empty-catalog {
    padding: var(--md);
    border: 1px solid #FFBF00;
  }

  .error h2 {
    margin-bottom: var(--sm);
  }
</style>
