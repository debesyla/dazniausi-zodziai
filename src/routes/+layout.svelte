<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	import { t } from '$lib/translations';

	let { children } = $props();
	const homeUrl = import.meta.env.BASE_URL;
	const methodologyUrl = `${homeUrl}apie`;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="site-header">
	<nav class="site-navigation" aria-label={t('siteNavigation')}>
		<a href={homeUrl}>{t('exploreData')}</a>
		<a href={methodologyUrl}>{t('methodologyAndSources')}</a>
	</nav>
</header>

{@render children?.()}

<footer>
	<p>{t('footerText')}<a href="mailto:{t('footerEmail')}">{t('footerEmail')}</a></p>
</footer>

<style>
	.site-header {
		border-bottom: 1px solid var(--border-color);
		margin-bottom: var(--xl);
		padding-bottom: var(--md);
	}

	.site-navigation {
		display: flex;
		flex-wrap: wrap;
		gap: var(--md);
	}
</style>
