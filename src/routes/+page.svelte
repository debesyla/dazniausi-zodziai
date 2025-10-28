<script>
  import DataLoader from '../components/DataLoader.svelte';
  import { t } from '$lib/translations';

  let selectedFilename = $state('sample-dataset.json');
</script>

<svelte:head>
  <title>{t('pageTitle')}</title>
</svelte:head>

<h1>{t('pageTitle')}</h1>
<p>{t('description')}</p>

<div class="dataset-selector">
  <label for="dataset-select">{t('selectDataset')}:</label>
  <select id="dataset-select" bind:value={selectedFilename}>
    <option value="sample-dataset.json">{t('dataset1')}</option>
    <option value="sample-dataset-2.json">{t('dataset2')}</option>
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
