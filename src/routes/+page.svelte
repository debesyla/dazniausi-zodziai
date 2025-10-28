<script>
  import DataLoader from '../components/DataLoader.svelte';
</script>

<svelte:head>
  <title>Dažniausi Žodžiai</title>
</svelte:head>

<h1>Dažniausi lietuviški žodžiai</h1>
<p>Explore Lithuanian word frequency data with an interactive, culturally-inspired interface.</p>

<DataLoader filename="sample-dataset.json" />
