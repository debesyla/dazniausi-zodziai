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
  .dataset-selector {
    margin-bottom: 1rem;
  }

  .dataset-selector label {
    margin-right: 0.5rem;
    font-weight: bold;
  }

  .dataset-selector select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
