<script lang="ts">
  import {
    contrastPair,
    loadWarContrastProfile,
    logRatioForPair,
    lookupWarContrastWord,
    type WarContrastLookupResult,
    type WarContrastProfile
  } from '$lib/war-contrast';

  let profile = $state<WarContrastProfile | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let query = $state('');
  let result = $state<WarContrastLookupResult | null>(null);
  let lookupError = $state<string | null>(null);
  let lookupLoading = $state(false);
  let searched = $state(false);
  let selectedPairId = $state('');
  let requestNumber = 0;
  const siteRoot = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/`;

  let selectedPair = $derived(profile ? contrastPair(profile, selectedPairId) : null);
  let logRatio = $derived(profile && result && selectedPair ? logRatioForPair(profile, result, selectedPair.id) : null);

  function formatNumber(value: number) {
    return value.toLocaleString('lt-LT');
  }

  function formatRate(value: number | null) {
    return value === null ? 'Neaptikta' : formatNumber(value);
  }

  function formatLogRatio(value: number) {
    return `${value >= 0 ? '+' : ''}${value.toLocaleString('lt-LT', { maximumFractionDigits: 2 })}`;
  }

  function formatMultiplier(value: number) {
    return Math.pow(2, Math.abs(value)).toLocaleString('lt-LT', { maximumFractionDigits: 1 });
  }

  async function search() {
    if (!profile || !query.trim()) return;
    searched = true;
    result = null;
    lookupError = null;
    lookupLoading = true;
    const request = ++requestNumber;
    try {
      const loaded = await lookupWarContrastWord(profile, query);
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

  $effect(() => {
    let cancelled = false;
    loadWarContrastProfile().then((loaded) => {
      if (cancelled) return;
      profile = loaded;
      selectedPairId = loaded.contrast.pairs[0]?.id ?? '';
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
  <title>Karo laikotarpio žodžių palyginimas</title>
  <meta name="description" content="Paieška ir skaidrus CCLL2, karo meto žiniasklaidos bei socialinių tinklų žodžių formų dažnumo palyginimas." />
</svelte:head>

<main>
  <a class="back-link" href={siteRoot}>← Grįžti į žodžių dažnumo tyrinėjimą</a>
  <h1>Karo laikotarpio žodžių palyginimas</h1>
  <p class="intro">Įveskite tikslią žodžio formą ir palyginkite jau šaltinyje apskaičiuotus CCLL2, karo meto žiniasklaidos ir socialinių tinklų rodiklius. Kiekvienas žetonų ir dokumentų rodiklis normalizuotas iki 100 milijonų to šaltinio žodžių.</p>

  {#if loading}
    <p class="status" role="status" aria-live="polite">Kraunama paieškos suvestinė…</p>
  {:else if loadError}
    <section class="error" role="alert" aria-labelledby="profile-load-error">
      <h2 id="profile-load-error">Nepavyko įkelti palyginimo duomenų</h2>
      <p>{loadError}</p>
    </section>
  {:else if profile}
    <form class="lookup" onsubmit={submitSearch}>
      <label for="word-query">Žodžio forma</label>
      <div class="lookup-controls">
        <input id="word-query" bind:value={query} autocomplete="off" spellcheck="false" placeholder="pvz., karas" required />
        <button type="submit" disabled={lookupLoading}>{lookupLoading ? 'Ieškoma…' : 'Palyginti'}</button>
      </div>
      <p>Paieška neskaito viso sąrašo: po įvedimo įkeliama tik viena maža paieškos dalis ir ne daugiau kaip {profile.delivery.maxSourceRowsPerWord} susijusios šaltinio dalys.</p>
    </form>

    <dl class="source-facts">
      <div>
        <dt>Duomenų vienetas</dt>
        <dd>Žodžio forma</dd>
      </div>
      <div>
        <dt>Normalizavimo tikslas</dt>
        <dd>{formatNumber(profile.contrast.targetTokens)} šaltinio žodžių</dd>
      </div>
      <div>
        <dt>Paieškos formos</dt>
        <dd>{formatNumber(profile.summary.uniqueNormalizedWordForms)}</dd>
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
        <p>Ši tiksli forma nebuvo rasta palyginimo šaltinyje. Tai nereiškia, kad žodžio nėra lietuvių kalboje ar kad jo dažnis yra nulis.</p>
      </section>
    {:else if result}
      <section class="result" aria-labelledby="result-title" aria-live="polite">
        <div class="result-heading">
          <div>
            <h2 id="result-title">{result.word}</h2>
            <p>Normalizuota paieškos forma: {result.normalizedWord}</p>
          </div>
          {#if result.sourceRows.length > 1}
            <p class="merge-note">Sujungtos {result.sourceRows.length} to paties įvedimo šaltinio eilutės; nesutampančios reikšmės nebūtų sujungiamos.</p>
          {/if}
        </div>

        <table>
          <thead>
            <tr>
              <th scope="col">Matas</th>
              {#each profile.sources as source}
                <th scope="col">{source.label}<span>{formatNumber(source.tokenField.normalization.sourceTokens)} šaltinio žodžių</span></th>
              {/each}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Žetonai / 100 mln.</th>
              {#each profile.sources as source}
                {@const value = result.metrics[source.id]?.tokenCount ?? null}
                <td class:absent={value === null}>{formatRate(value)}</td>
              {/each}
            </tr>
            <tr>
              <th scope="row">Dokumentai / 100 mln.</th>
              {#each profile.sources as source}
                {@const value = result.metrics[source.id]?.documentCount ?? null}
                <td class:absent={value === null}>{formatRate(value)}</td>
              {/each}
            </tr>
          </tbody>
        </table>
      </section>

      <section class="contrast" aria-labelledby="contrast-title">
        <h2 id="contrast-title">Santykinis kontrastas</h2>
        <label for="contrast-pair">Lyginama pora</label>
        <select id="contrast-pair" bind:value={selectedPairId}>
          {#each profile.contrast.pairs as pair}
            <option value={pair.id}>{pair.label}</option>
          {/each}
        </select>
        {#if selectedPair && logRatio !== null}
          <p><strong>{formatLogRatio(logRatio)} log₂</strong> · {selectedPair.label} rodiklis yra maždaug {formatMultiplier(logRatio)} karto {logRatio >= 0 ? 'didesnis' : 'mažesnis'} pagal normalizuotą žetonų dažnį.</p>
        {:else if selectedPair}
          <p>Kontrastas nerodomas: abiejų šaltinių žetonų rodikliai turi būti aptikti ir siekti bent {formatNumber(profile.contrast.minimumRate)} / 100 mln.</p>
        {/if}
        <p class="method-note">Formulė: log₂(skaitiklio normalizuotas žetonų rodiklis / vardiklio normalizuotas žetonų rodiklis). Tai palyginimo priemonė, ne statistinio reikšmingumo testas.</p>
      </section>
    {/if}

    <section class="limitations" aria-labelledby="limits-title">
      <h2 id="limits-title">Kaip šio vaizdo neinterpretuoti</h2>
      <ul>
        <li>„Neaptikta“ reiškia šaltinio <code>null</code>, o ne nulinį dažnį.</li>
        <li>Žetonų ir dokumentų rodikliai yra skirtingi ir čia nėra sudedami į vieną bendrą balą.</li>
        <li>Skirtingi šaltinių laikotarpiai, žanrai ir apimtys gali paaiškinti kontrastą; jis nėra kalbinis ar socialinis vertinimas.</li>
      </ul>
      <p><a href={profile.provenance.sourceUrl} target="_blank" rel="noreferrer">Atverti pirminį CLARIN-LT šaltinio įrašą</a> · {profile.provenance.citation}</p>
    </section>
  {/if}
</main>

<style>
  main,
  .lookup,
  .result,
  .contrast,
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
  .merge-note,
  .method-note,
  .limitations p {
    color: color-mix(in srgb, var(--text-color) 78%, transparent);
  }

  .lookup,
  .source-facts,
  .result,
  .contrast,
  .limitations,
  .empty,
  .error,
  .status {
    border: 1px solid var(--border-color);
    padding: var(--md);
  }

  .lookup-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sm);
  }

  input,
  select {
    background: #222;
    border: 1px solid #ffbf00;
    color: #ffbf00;
    max-width: 100%;
    padding: var(--xs) var(--sm);
  }

  input {
    flex: 1 1 18ch;
    min-width: 0;
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

  .result-heading {
    align-items: start;
    display: flex;
    flex-wrap: wrap;
    gap: var(--md);
    justify-content: space-between;
  }

  .merge-note {
    flex: 0 1 26ch;
    font-size: 0.875em;
  }

  table {
    border-collapse: collapse;
    table-layout: fixed;
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

  thead th span {
    color: color-mix(in srgb, var(--text-color) 68%, transparent);
    display: block;
    font-size: 0.8em;
    font-weight: normal;
    margin-top: var(--xs);
  }

  .absent {
    color: color-mix(in srgb, var(--text-color) 65%, transparent);
    font-style: italic;
  }

  .contrast label {
    margin-top: var(--xs);
  }

  .contrast select {
    max-width: 100%;
    width: fit-content;
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

  @media (max-width: 639px) {
    .source-facts {
      grid-template-columns: minmax(0, 1fr);
    }

    th,
    td {
      font-size: 0.825em;
      padding: var(--xs);
    }

    .result-heading {
      display: grid;
    }
  }
</style>
