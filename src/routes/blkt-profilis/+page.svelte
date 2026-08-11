<script lang="ts">
  import { base } from '$app/paths';
  import {
    loadBlktWordformProfile,
    loadBlktLicenceTexts,
    lookupBlktWordform,
    type BlktScopeResult,
    type BlktWordformResult,
    type LoadedBlktWordformProfile
  } from '$lib/blkt-wordform-profile';
  import { site } from '$lib/site';

  let profile = $state<LoadedBlktWordformProfile | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let query = $state('');
  let result = $state<BlktWordformResult | null>(null);
  let searched = $state(false);
  let lookupLoading = $state(false);
  let lookupError = $state<string | null>(null);
  let downloadLoading = $state(false);
  let downloadError = $state<string | null>(null);
  let requestNumber = 0;
  const homeUrl = `${base}/`;

  function formatInteger(value: number) {
    return value.toLocaleString('lt-LT');
  }

  function formatRate(value: number) {
    return value.toLocaleString('lt-LT', { maximumFractionDigits: 2 });
  }

  async function search() {
    if (!profile || !query.trim()) return;
    const request = ++requestNumber;
    searched = true;
    result = null;
    lookupError = null;
    lookupLoading = true;
    try {
      const loaded = await lookupBlktWordform(profile, query);
      if (request === requestNumber) result = loaded;
    } catch (cause) {
      if (request === requestNumber) lookupError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (request === requestNumber) lookupLoading = false;
    }
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    void search();
  }

  function scrollTable(event: KeyboardEvent) {
    const region = event.currentTarget as HTMLElement;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      region.scrollLeft += 160;
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      region.scrollLeft -= 160;
    } else if (event.key === 'Home') {
      event.preventDefault();
      region.scrollLeft = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      region.scrollLeft = region.scrollWidth;
    }
  }

  async function downloadResult() {
    if (!result || !profile || downloadLoading) return;
    downloadLoading = true;
    downloadError = null;
    try {
      const licences = await loadBlktLicenceTexts(profile);
      const payload = {
        schemaVersion: 1,
        productId: profile.manifest.id,
        word: result.word,
        sourceScopeCaveat: profile.metadata.sourceScopeCaveat,
        sourceLicences: profile.metadata.sourceLicences,
        corpus: result.corpus,
        documentTypes: result.documentTypes,
        periods: result.periods,
        rate: profile.metadata.rate,
        tokenizer: profile.metadata.tokenizer,
        disclosure: profile.metadata.disclosure,
        permission: profile.metadata.permission,
        exclusions: profile.metadata.exclusions,
        source: {
          url: profile.manifest.provenance.sourceUrl,
          licence: profile.manifest.provenance.licence,
          citation: profile.manifest.provenance.citation,
          rights: { ...profile.metadata.rights, licences }
        }
      };
      const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `blkt-${result.word}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      downloadError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      downloadLoading = false;
    }
  }

  $effect(() => {
    let cancelled = false;
    loading = true;
    loadError = null;
    loadBlktWordformProfile().then((loaded) => {
      if (cancelled) return;
      profile = loaded;
      loading = false;
    }).catch((cause) => {
      if (cancelled) return;
      loadError = cause instanceof Error ? cause.message : String(cause);
      loading = false;
    });
    return () => { cancelled = true; };
  });
</script>

<svelte:head>
  <title>BLKT žodžio profilis · {site.name}</title>
  <meta name="description" content="Privatumo slenksčiais apsaugotas BLKT žodžio dažnumo palyginimas pagal teksto tipą ir laikotarpį." />
  <link rel="canonical" href={site.blktProfileUrl} />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="lt_LT" />
  <meta property="og:site_name" content={site.name} />
  <meta property="og:title" content={`BLKT žodžio profilis · ${site.name}`} />
  <meta property="og:description" content="Privatumo slenksčiais apsaugotas BLKT žodžio dažnumo palyginimas." />
  <meta property="og:url" content={site.blktProfileUrl} />
</svelte:head>

<main class="profile-page">
  <a class="back-link" href={homeUrl}>← Grįžti į pradžią</a>
  <header>
    <p class="eyebrow">Bendrasis lietuvių kalbos tekstynas</p>
    <h1>BLKT žodžio profilis</h1>
    <p class="lead">Patikrinkite vieną sunormintą žodžio formą visame BLKT ir palyginkite saugiai paskelbtus dažnius pagal penkis plačius teksto tipus bei keturis laikotarpius.</p>
  </header>

  {#if loading}
    <p class="status" role="status" aria-live="polite">Kraunama BLKT profilio suvestinė…</p>
  {:else if loadError}
    <div class="status error" role="alert">
      <h2>Nepavyko įkelti profilio</h2>
      <p>{loadError}</p>
    </div>
  {:else if profile}
    <section class="method" aria-labelledby="method-title">
      <h2 id="method-title">Ką rodo šis profilis</h2>
      <p class="scope-warning"><strong>Šaltinio riba:</strong> BLKT nėra reprezentatyvus visos lietuvių kalbos portretas, nes jame vyrauja žiniasklaida ir dokumentai. Rezultatai apibūdina tik šio tekstyno sudėtį.</p>
      <p>Skaičiuojami projekto taisykle išskirti mažosiomis raidėmis sunorminti žodžiai. Dažnis milijonui skaičiuojamas pagal to paties pjūvio išvestinių žodžių vardiklį, o ne pagal šaltinio <code>alpha_word_count</code>.</p>
      <p>Įrašai yra tokenizatoriaus aptiktos raidžių sekos, o ne patvirtinti lietuviški ar taisyklingi žodžiai. Iš dažnio negalima spręsti apie kalbinį taisyklingumą.</p>
      <p>Žodis arba pjūvių šeima skelbiama tik tada, kai kiekviena teigiama reikšmė turi bent <strong>{profile.metadata.disclosure.minimumTokenCount}</strong> pavartojimų bent <strong>{profile.metadata.disclosure.minimumDocumentSupport}</strong> dokumentų. Potipiai, tekstai, pavadinimai, autoriai, nuorodos ir šaltinių identifikatoriai neskelbiami.</p>
      <dl class="facts">
        <div><dt>Dokumentų</dt><dd>{formatInteger(profile.metadata.corpus.documents)}</dd></div>
        <div><dt>Išvestinių žodžių</dt><dd>{formatInteger(profile.metadata.corpus.derivedTokens)}</dd></div>
        <div><dt>Paskelbtų žodžių formų</dt><dd>{formatInteger(profile.index.summary.recordCount)}</dd></div>
      </dl>
    </section>

    <section class="lookup" aria-labelledby="lookup-title">
      <h2 id="lookup-title">Ieškoti žodžio</h2>
      <form onsubmit={submitSearch}>
        <label for="blkt-word">Viena žodžio forma</label>
        <div class="search-row">
          <input id="blkt-word" bind:value={query} autocomplete="off" placeholder="pavyzdžiui, kalba" />
          <button type="submit" disabled={lookupLoading || !query.trim()}>{lookupLoading ? 'Ieškoma…' : 'Ieškoti BLKT'}</button>
        </div>
      </form>
      <p class="hint">Didžiosios raidės suvienodinamos. Įveskite tik vieną 1–64 raidžių žodį.</p>

      {#if lookupError}
        <p class="status error" role="alert">{lookupError}</p>
      {:else if lookupLoading}
        <p class="status" role="status" aria-live="polite">Ieškoma paskelbtame profilyje…</p>
      {:else if searched && !result}
        <div class="status" role="status">
          <h3>Žodis paskelbtame profilyje nerastas</h3>
          <p>Jis galėjo būti neaptiktas arba nepraeiti saugos slenksčio. Tai nereiškia, kad tokios raidžių sekos nėra BLKT.</p>
        </div>
      {/if}
    </section>

    {#if result}
      <article class="result" aria-labelledby="result-title">
        <p class="sr-only" role="status" aria-live="polite">Rastas žodžio „{result.word}“ BLKT profilis.</p>
        <header class="result-header">
          <div>
            <p class="eyebrow">Sunorminta forma</p>
            <h2 id="result-title">{result.word}</h2>
          </div>
          <button type="button" class="secondary" disabled={downloadLoading} onclick={() => void downloadResult()}>{downloadLoading ? 'Ruošiamas atsisiuntimas…' : 'Atsisiųsti šį atsakymą JSON'}</button>
        </header>
        {#if downloadError}<p class="status error" role="alert">{downloadError}</p>{/if}

        <section aria-labelledby="corpus-title">
          <h3 id="corpus-title">Visas tekstynas</h3>
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
          <div class="table-scroll" role="region" aria-label="Viso BLKT rezultatų lentelė" tabindex="0" onkeydown={scrollTable}>
            <table>
              <thead><tr><th scope="col">Apimtis</th><th scope="col">Pavartojimai</th><th scope="col">Dokumentai su žodžiu</th><th scope="col">Dažnis milijonui</th><th scope="col">Tekstyno dokumentai</th><th scope="col">Pjūvio žodžiai</th></tr></thead>
              <tbody><tr><th scope="row">Visas BLKT</th><td>{formatInteger(result.corpus.tokenCount)}</td><td>{formatInteger(result.corpus.documentCount)}</td><td>{formatRate(result.corpus.ratePerMillion)}</td><td>{formatInteger(result.corpus.documents)}</td><td>{formatInteger(result.corpus.derivedTokens)}</td></tr></tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="types-title">
          <h3 id="types-title">Pagal teksto tipą</h3>
          {#if result.documentTypes}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
            <div class="table-scroll" role="region" aria-label="Rezultatai pagal teksto tipą" tabindex="0" onkeydown={scrollTable}>
              <table>
                <thead><tr><th scope="col">Teksto tipas</th><th scope="col">Pavartojimai</th><th scope="col">Dokumentai su žodžiu</th><th scope="col">Dažnis milijonui</th><th scope="col">Tipo dokumentai</th><th scope="col">Tipo žodžiai</th></tr></thead>
                <tbody>
                  {#each result.documentTypes as item (item.id)}
                    <tr><th scope="row">{item.label}</th><td>{formatInteger(item.tokenCount)}</td><td>{formatInteger(item.documentCount)}</td><td>{formatRate(item.ratePerMillion)}</td><td>{formatInteger(item.documents)}</td><td>{formatInteger(item.derivedTokens)}</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="withheld">Šio žodžio teksto tipų pjūvis neskelbiamas. Viešas atsakymas neatskleidžia, kuri reikšmė nepasiekė saugos ribos.</p>
          {/if}
        </section>

        <section aria-labelledby="periods-title">
          <h3 id="periods-title">Pagal laikotarpį</h3>
          {#if result.periods}
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
            <div class="table-scroll" role="region" aria-label="Rezultatai pagal laikotarpį" tabindex="0" onkeydown={scrollTable}>
              <table>
                <thead><tr><th scope="col">Laikotarpis</th><th scope="col">Pavartojimai</th><th scope="col">Dokumentai su žodžiu</th><th scope="col">Dažnis milijonui</th><th scope="col">Laikotarpio dokumentai</th><th scope="col">Laikotarpio žodžiai</th></tr></thead>
                <tbody>
                  {#each result.periods as item (item.id)}
                    <tr><th scope="row">{item.label}</th><td>{formatInteger(item.tokenCount)}</td><td>{formatInteger(item.documentCount)}</td><td>{formatRate(item.ratePerMillion)}</td><td>{formatInteger(item.documents)}</td><td>{formatInteger(item.derivedTokens)}</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="withheld">Šio žodžio laikotarpių pjūvis neskelbiamas. Viešas atsakymas neatskleidžia, kuri reikšmė nepasiekė saugos ribos.</p>
          {/if}
        </section>
      </article>
    {/if}

    <section class="source" aria-labelledby="source-title">
      <h2 id="source-title">Šaltinis ir leidimas</h2>
      <p>{profile.manifest.provenance.citation}</p>
      <p><a href={profile.manifest.provenance.sourceUrl}>Oficialus BLKT šaltinio įrašas</a></p>
      <p>Taikomos abi šaltinio licencijos. Projekto savininkas patvirtino leidimą skelbti šio projekto išvestinius agregatus ir duomenų rinkinius.</p>
      <ul>
        {#each profile.metadata.rights.licences as licence}
          <li><a href={licence.url}>{licence.name}</a> (<a href={`${base}/data-products/${profile.manifest.id}/${licence.file}`}>pilnas tekstas</a>)</li>
        {/each}
      </ul>
      <p>{profile.metadata.rights.modificationNotice}</p>
      <ul>
        {#each profile.metadata.rights.attributionNotices as attribution}
          <li>{attribution}</li>
        {/each}
      </ul>
      <ul>
        {#each profile.metadata.rights.downstreamRequirements as requirement}
          <li>{requirement}</li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<style>
  .profile-page { display: grid; gap: var(--xl); grid-template-columns: minmax(0, 1fr); min-width: 0; }
  .back-link { margin-bottom: calc(var(--lg) * -1); }
  .eyebrow { font-size: 0.85rem; letter-spacing: 0.08em; margin-bottom: var(--xs); text-transform: uppercase; }
  .lead { font-size: 1.15rem; max-width: 72ch; }
  .method, .lookup, .result, .source { border: 1px solid var(--border-color); min-width: 0; padding: var(--lg); }
  .method h2, .lookup h2, .source h2, .result h3 { margin-bottom: var(--sm); }
  .facts { display: grid; gap: var(--md); grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: var(--md); }
  .facts div { border-left: 2px solid var(--border-color); padding-left: var(--sm); }
  .facts dd { font-size: 1.2rem; font-weight: 700; margin: 0; }
  form label { display: block; font-weight: 700; margin-bottom: var(--xs); }
  .search-row { display: flex; gap: var(--sm); }
  .search-row input { flex: 1; min-width: 0; }
  input, button { background: #222; border: 1px solid #FFBF00; color: #FFBF00; padding: var(--sm); }
  button { cursor: pointer; font-weight: 700; }
  button:disabled { cursor: wait; opacity: 0.6; }
  .secondary { background: transparent; }
  .hint { margin-top: var(--xs); }
  .status { border: 1px solid var(--border-color); margin-top: var(--md); padding: var(--md); }
  .error { border-color: #ff7d7d; }
  .scope-warning { border-left: 3px solid #FFBF00; padding-left: var(--md); }
  .result { display: grid; gap: var(--xl); min-width: 0; }
  .result > section { min-width: 0; }
  .result-header { align-items: center; display: flex; flex-wrap: wrap; gap: var(--md); justify-content: space-between; }
  .table-scroll { max-width: 100%; min-width: 0; overflow-x: auto; width: 100%; }
  table { border-collapse: collapse; min-width: 48rem; width: 100%; }
  th, td { border-bottom: 1px solid var(--border-color); padding: var(--sm); text-align: right; vertical-align: top; }
  th:first-child, td:first-child { text-align: left; }
  .withheld { border-left: 2px solid var(--border-color); padding-left: var(--md); }
  .source li, .source a { overflow-wrap: anywhere; }
  .sr-only { height: 1px; margin: -1px; overflow: hidden; padding: 0; position: absolute; width: 1px; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  code { overflow-wrap: anywhere; }
  @media (max-width: 767px) {
    .method, .lookup, .result, .source { padding: var(--md); }
    .facts { grid-template-columns: 1fr; }
    .search-row { align-items: stretch; flex-direction: column; }
    .search-row button { width: 100%; }
  }
</style>
