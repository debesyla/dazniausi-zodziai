<script lang="ts">
  import DataLoader from '../components/DataLoader.svelte';
  import { base } from '$app/paths';
  import { t } from '$lib/translations';
  import { loadCatalog, type DatasetCatalog } from '$lib/data';
  import { site } from '$lib/site';

  let catalog = $state<DatasetCatalog | null>(null);
  let catalogLoading = $state(true);
  let catalogError = $state<string | null>(null);
  let selectedDatasetId = $state('');
  const dataProductsCatalog = `${base}/data-products/catalog.json`;
  const methodologyUrl = `${base}/apie`;
  const coverageProfile = `${base}/zodyno-apreptis`;

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
      selectedDatasetId = loadedCatalog.defaultDatasetId ?? loadedCatalog.datasets[0]?.id ?? '';
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
  <title>{site.name} · lietuvių kalbos dažnumo duomenys</title>
  <meta name="description" content={site.description} />
  <link rel="canonical" href={site.homeUrl} />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="lt_LT" />
  <meta property="og:site_name" content={site.name} />
  <meta property="og:title" content={`${site.name} · lietuvių kalbos dažnumo duomenys`} />
  <meta property="og:description" content={site.description} />
  <meta property="og:url" content={site.homeUrl} />
  <meta property="og:image" content={site.socialImageUrl} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Dažniausi lietuviški žodžiai – viešų lietuvių kalbos dažnumo sąrašų tyrinėjimas" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={`${site.name} · lietuvių kalbos dažnumo duomenys`} />
  <meta name="twitter:description" content={site.description} />
  <meta name="twitter:image" content={site.socialImageUrl} />
  <meta name="twitter:image:alt" content="Dažniausi lietuviški žodžiai – viešų lietuvių kalbos dažnumo sąrašų tyrinėjimas" />
</svelte:head>

<main>
  <h1>{t('pageTitle')}</h1>

  <section class="site-introduction" aria-label={t('methodologyAndSources')}>
    <p>{t('siteIntroduction')}</p>
    <a href={methodologyUrl}>{t('openMethodology')}</a>
  </section>

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

  <section class="data-products" aria-labelledby="data-products-title">
    <h2 id="data-products-title">{t('dataProductsTitle')}</h2>
    <p>{t('dataProductsDescription')}</p>
    <p><a href={coverageProfile}>Tyrinėti DML6 žodyno aprėptį pagal dažnumą</a></p>
    <a href={dataProductsCatalog}>{t('openDataProducts')}</a>
  </section>
</main>

<style>
  h1 {
    margin-bottom: var(--lg);
  }

  .site-introduction {
    border-left: 2px solid var(--border-color);
    margin-bottom: var(--xl);
    padding-left: var(--md);
  }

  .site-introduction p {
    margin-bottom: var(--sm);
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

  .data-products {
    margin-top: var(--xl);
    padding: var(--md);
    border: 1px solid var(--border-color);
  }

  .data-products h2,
  .data-products p {
    margin-bottom: var(--sm);
  }
</style>
