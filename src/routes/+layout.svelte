<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { t } from '$lib/translations';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}

<footer>
	<p>{t('footerText')}<a href="mailto:{t('footerEmail')}">{t('footerEmail')}</a></p>
</footer>
