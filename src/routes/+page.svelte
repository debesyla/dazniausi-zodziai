<script>
  import DataLoader from '../components/DataLoader.svelte';

  let selectedFilename = $state('sample-dataset.json');
</script>

<svelte:head>
  <title>Dažniausi Žodžiai</title>
</svelte:head>

<h1>Dažniausi lietuviški žodžiai</h1>
<p>Explore Lithuanian word frequency data with an interactive, culturally-inspired interface.</p>

<div class="dataset-selector">
  <label for="dataset-select">Select Dataset:</label>
  <select id="dataset-select" bind:value={selectedFilename}>
    <option value="sample-dataset.json">Lithuanian Language Institute (2023)</option>
    <option value="sample-dataset-2.json">Vilnius University Linguistics Department (2024)</option>
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
