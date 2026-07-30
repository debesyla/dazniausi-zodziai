<script lang="ts">
  import { base } from '$app/paths';
  import {
    loadCcllGenreProfile,
    lookupCcllGenreWord,
    ratePerMillion,
    type CcllGenreProfile,
    type GenreProfileLookupResult
  } from '$lib/ccll-genre-profile';
  import { site } from '$lib/site';

  let profile = $state<CcllGenreProfile | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let query = $state('');
  let result = $state<GenreProfileLookupResult | null>(null);
  let lookupError = $state<string | null>(null);
  let lookupLoading = $state(false);
  let searched = $state(false);
  let requestNumber = 0;
  const homeUrl = `${base}/`;

  let maximumRate = $derived.by(() => {
    const activeProfile = profile;
    const activeResult = result;
    if (!activeProfile || !activeResult) return 1;
    return Math.max(1, ...activeProfile.sources.map((source) => ratePerMillion(activeProfile, activeResult, source.id) ?? 0));
  });

  function formatNumber(value: number) {
    return value.toLocaleString('lt-LT');
  }

  function formatRate(value: number | null) {
    return value === null ? 'Neaptikta' : value.toLocaleString('lt-LT', { maximumFractionDigits: 2 });
  }

  function rateWidth(value: number | null) {
    if (value === null) return '0%';
    return `${Math.max(3, value / maximumRate * 100)}%`;
  }

  async function search() {
    if (!profile || !query.trim()) return;
    searched = true;
    result = null;
    lookupError = null;
    lookupLoading = true;
    const request = ++requestNumber;
    try {
      const loaded = await lookupCcllGenreWord(profile, query);
      if (request !== requestNumber) return;
      result = loaded;
    } catch (cause) {
      if (request !== requestNumber) return;
      lookupError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (request === requestNumber) lookupLoading = false;
    }
  }

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    void search();
  }

  function downloadResult() {
    const activeProfile = profile;
    const activeResult = result;
    if (!activeProfile || !activeResult) return;
    const payload = {
      schemaVersion: 1,
      productId: activeProfile.productId,
      profileId: activeProfile.profileId,
      query: activeResult.word,
      rate: activeProfile.rate,
      sources: activeProfile.sources.map((source) => ({
        id: source.id,
        label: source.label,
        sourceTokens: source.sourceTokens,
        rawCount: activeResult.rawCounts[source.id],
        ratePerMillion: ratePerMillion(activeProfile, activeResult, source.id)
      })),
      observedGenres: activeResult.observedGenres,
      provenance: activeProfile.provenance
    };
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `ccll-zanru-profilis-${encodeURIComponent(activeResult.word)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  $effect(() => {
    let cancelled = false;
    loadCcllGenreProfile().then((loaded) => {
      if (cancelled) return;
      profile = loaded;
      loading = false;
    }).catch((cause) => {
      if (cancelled) return;
      loadError = cause instanceof Error ? cause.message : String(cause);
      loading = false;
    });
    return () => {
      cancelled = true;
    };
  });
</script>

<svelte:head>
  <title>CCLL žanrų profilis pagal žodžio formą</title>
  <meta name="description" content="Tiksli žodžio formos paieška penkiuose pavadintuose CCLL subkorpusuose, su atskirais dažniais ir vardikliais." />
  <link rel="canonical" href={site.genreProfileUrl} />
  <meta property="og:title" content="CCLL žanrų profilis pagal žodžio formą" />
  <meta property="og:description" content="Tiksli žodžio formos paieška penkiuose pavadintuose CCLL subkorpusuose." />
  <meta property="og:url" content={site.genreProfileUrl} />
</svelte:head>

<main>
  <a class="back-link" href={homeUrl}>← Grįžti į žodžių dažnumo tyrinėjimą</a>
  <h1>CCLL žanrų profilis pagal žodžio formą</h1>
  <p class="intro">Įveskite tikslią žodžio formą ir palyginkite ją penkiuose pavadintuose Dabartinės lietuvių kalbos tekstyno subkorpusuose. Rodomi pirminiai žetonų skaičiai ir iš kiekvieno subkorpuso vardiklio apskaičiuoti rodikliai milijonui žetonų.</p>

  {#if loading}
    <p class="status" role="status" aria-live="polite">Kraunama žanrų profilio suvestinė…</p>
  {:else if loadError}
    <section class="error" role="alert" aria-labelledby="profile-load-error">
      <h2 id="profile-load-error">Nepavyko įkelti žanrų profilio</h2>
      <p>{loadError}</p>
    </section>
  {:else if profile}
    <form class="lookup" onsubmit={submitSearch}>
      <label for="word-query">Tiksli žodžio forma</label>
      <div class="lookup-controls">
        <input id="word-query" bind:value={query} autocomplete="off" spellcheck="false" placeholder="pvz., karas" required />
        <button type="submit" disabled={lookupLoading}>{lookupLoading ? 'Ieškoma…' : 'Ieškoti žanruose'}</button>
      </div>
      <p>Paieška neskaito visų sąrašų: įkeliama tik nedidelė maršruto dalis ir viena riboto dydžio duomenų dalis pasirinktam žodžiui.</p>
    </form>

    <dl class="source-facts">
      <div>
        <dt>Paieškos formų</dt>
        <dd>{formatNumber(profile.summary.joinedWordforms)}</dd>
      </div>
      <div>
        <dt>Pavadintų subkorpusų</dt>
        <dd>{formatNumber(profile.sources.length)}</dd>
      </div>
      <div>
        <dt>Rodiklio vienetas</dt>
        <dd>{profile.rate.unit}</dd>
      </div>
      <div>
        <dt>Licencija</dt>
        <dd>{profile.provenance.licence}</dd>
      </div>
    </dl>

    {#if lookupLoading}
      <p class="status" role="status" aria-live="polite">Ieškoma pasirinktos žodžio formos…</p>
    {:else if lookupError}
      <p class="error-message" role="alert">{lookupError}</p>
    {:else if searched && !result}
      <section class="empty" aria-live="polite">
        <h2>Forma nerasta</h2>
        <p>Ši tiksli forma nebuvo aptikta penkių pavadintų CCLL subkorpusų sąrašuose. Tai nereiškia, kad jos nėra lietuvių kalboje ar kad jos dažnis lygus nuliui.</p>
      </section>
    {:else if result}
      <section class="result" aria-labelledby="result-title" aria-live="polite">
        <div class="result-heading">
          <div>
            <h2 id="result-title">{result.word}</h2>
            <p>Aptikta {formatNumber(result.observedGenres)} iš {formatNumber(profile.sources.length)} pavadintų subkorpusų.</p>
          </div>
          <button type="button" onclick={downloadResult}>Atsisiųsti šio atsakymo JSON</button>
        </div>

        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Subkorpusas</th>
                <th scope="col">Pirminis žetonų skaičius</th>
                <th scope="col">/ 1 mln. šaltinio žetonų</th>
                <th scope="col">Šaltinio vardiklis</th>
                <th scope="col">Santykinė juosta</th>
              </tr>
            </thead>
            <tbody>
              {#each profile.sources as source}
                {@const rawCount = result.rawCounts[source.id]}
                {@const rate = ratePerMillion(profile, result, source.id)}
                <tr>
                  <th scope="row">{source.label}</th>
                  <td class:absent={rawCount === null}>{rawCount === null ? 'Neaptikta' : formatNumber(rawCount)}</td>
                  <td class:absent={rate === null}>{formatRate(rate)}</td>
                  <td>{formatNumber(source.sourceTokens)}</td>
                  <td>
                    <div class="bar-track" aria-hidden="true"><span class="bar" style:width={rateWidth(rate)}></span></div>
                    <span class="sr-only">{rate === null ? 'Neaptikta' : `${formatRate(rate)} milijonui šaltinio žetonų`}</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}

    <section class="limitations" aria-labelledby="limits-title">
      <h2 id="limits-title">Kaip šį palyginimą skaityti</h2>
      <ul>
        <li>Rodomi tik penki pavadinti subkorpusai; bendras CCLL sąrašas ir jo abėcėlinis indeksas nėra žanrai ir čia neįtraukiami.</li>
        <li>„Neaptikta“ yra šaltinio <code>null</code>, o ne nulinis dažnis.</li>
        <li>Rodiklis milijonui žetonų apskaičiuojamas atskirai iš kiekvieno subkorpuso vardiklio. Tai nėra bendras žodžių populiarumo reitingas ar „būdingiausių žodžių“ lentelė.</li>
        <li>Skyrybos ženklai, didžiosios ir mažosios raidės išlaikomi taip, kaip pateikta šaltinio žodžių formų sąrašuose.</li>
      </ul>
      <p><a href={profile.provenance.sourceUrl} target="_blank" rel="noreferrer">Atverti pirminį CLARIN-LT šaltinio įrašą</a> · {profile.provenance.citation}</p>
    </section>
  {/if}
</main>

<style>
  main,
  .lookup,
  .result,
  .limitations,
  .empty,
  .error,
  .status {
    display: grid;
    gap: var(--md);
  }

  main {
    min-width: 0;
    gap: var(--lg);
  }

  h1,
  h2 {
    color: var(--text-color);
  }

  h1 {
    margin-top: var(--sm);
  }

  .back-link {
    justify-self: start;
  }

  .intro,
  .lookup > p,
  .result-heading > div > p,
  .limitations p {
    color: color-mix(in srgb, var(--text-color) 78%, transparent);
  }

  .lookup,
  .source-facts,
  .result,
  .limitations,
  .empty,
  .error,
  .status {
    border: 1px solid var(--border-color);
    padding: var(--md);
  }

  .lookup,
  .source-facts,
  .result,
  .limitations,
  .empty,
  .error,
  .status,
  .table-scroll {
    min-width: 0;
  }

  .lookup-controls,
  .result-heading {
    align-items: start;
    display: flex;
    flex-wrap: wrap;
    gap: var(--sm);
  }

  .result-heading {
    justify-content: space-between;
  }

  input {
    background: #222;
    border: 1px solid #ffbf00;
    color: #ffbf00;
    flex: 1 1 18ch;
    max-width: 100%;
    min-width: 0;
    padding: var(--xs) var(--sm);
  }

  .source-facts {
    display: grid;
    gap: var(--sm);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .source-facts > div {
    min-width: 0;
  }

  dt {
    color: color-mix(in srgb, var(--text-color) 68%, transparent);
    font-size: 0.875em;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .table-scroll {
    max-width: 100%;
    overflow-x: auto;
    width: 100%;
  }

  table {
    border-collapse: collapse;
    min-width: 48rem;
    width: 100%;
  }

  th,
  td {
    border: 1px solid var(--border-color);
    overflow-wrap: anywhere;
    padding: var(--sm);
    text-align: left;
    vertical-align: top;
  }

  .absent {
    color: color-mix(in srgb, var(--text-color) 65%, transparent);
    font-style: italic;
  }

  .bar-track {
    background: color-mix(in srgb, var(--border-color) 70%, transparent);
    height: 0.75rem;
    min-width: 5rem;
  }

  .bar {
    background: #ffbf00;
    display: block;
    height: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .error {
    border-color: #ff7f7f;
  }

  .error-message {
    border: 1px solid #ff7f7f;
    color: #ffb4b4;
    padding: var(--md);
  }

  code {
    font-family: inherit;
  }

  .sr-only {
    height: 1px;
    margin: -1px;
    overflow: hidden;
    position: absolute;
    width: 1px;
    clip: rect(0, 0, 0, 0);
  }

  @media (max-width: 639px) {
    .source-facts {
      grid-template-columns: minmax(0, 1fr);
    }

    .result-heading {
      display: grid;
    }

    th,
    td {
      font-size: 0.875em;
      padding: var(--xs);
    }

    table {
      min-width: 100%;
      table-layout: fixed;
    }

    .bar-track {
      min-width: 0;
    }
  }
</style>
