<script lang="ts">
  import DataLoader from '../components/DataLoader.svelte';
  import { t } from '$lib/translations';
  import { getAvailableDatasets } from '$lib/data';

  let selectedFilename = $state(getAvailableDatasets()[0]?.filename || 'sample-dataset.json');

  let options = $derived(getAvailableDatasets().map(({filename, author}) => ({
    value: filename,
    label: author
  })));
</script>

<svelte:head>
  <title>{t('pageTitle')}</title>
</svelte:head>

<h1>{t('pageTitle')}</h1>
<p>{t('description')}</p>

<div class="dataset-selector">
  <label for="dataset-select">{t('selectDataset')}:</label>
  <select id="dataset-select" bind:value={selectedFilename}>
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>

<DataLoader filename={selectedFilename} />

<style>
  h1 {
    margin-bottom: var(--lg);
  }

  p {
    margin-bottom: var(--md);
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
</style>
