<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<footer>
	<p>Turi pasiūlymų? Parašyk! <a href="mailto:labas@dago.lt">labas@dago.lt</a></p>
</footer>
