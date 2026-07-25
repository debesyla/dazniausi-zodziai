<script lang="ts">
  import { base } from '$app/paths';
  import SyntaxExplorer from '../../components/SyntaxExplorer.svelte';

  const homeUrl = `${base}/`;
</script>

<svelte:head>
  <title>ALKSNIS sintaksės kontekstai · Dažniausi lietuviški žodžiai</title>
</svelte:head>

<main>
  <a href={homeUrl}>← Grįžti į dažninių sąrašų tyrinėjimą</a>
  <h1>ALKSNIS sintaksės kontekstai</h1>
  <SyntaxExplorer />
</main>

<style>
  h1 {
    margin: var(--lg) 0;
  }
</style>
