<script lang="ts">
  import {
    loadSyntaxContexts,
    loadSyntaxOverview,
    searchSyntaxLemmas,
    type SyntaxContextExample,
    type SyntaxLemma,
    type SyntaxOverviewData
  } from '$lib/syntax-context';

  let overview = $state<SyntaxOverviewData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let query = $state('');
  let searching = $state(false);
  let searchError = $state<string | null>(null);
  let results = $state<SyntaxLemma[]>([]);
  let resultTotal = $state(0);
  let selectedLemma = $state<SyntaxLemma | null>(null);
  let contextLoading = $state(false);
  let contextError = $state<string | null>(null);
  let contexts = $state<SyntaxContextExample[]>([]);

  function directionLabel(direction: SyntaxContextExample['direction']) {
    if (direction === 'head') return 'pasirinkta lema yra pagrindinis žodis';
    if (direction === 'root') return 'pasirinkta lema turi šaknies (HEAD=0) vaidmenį';
    return 'pasirinkta lema yra priklausomasis žodis';
  }

  async function search(event: SubmitEvent) {
    event.preventDefault();
    if (!overview) return;
    const term = query.trim();
    searchError = null;
    results = [];
    resultTotal = 0;
    selectedLemma = null;
    contexts = [];
    contextError = null;
    if (!term) {
      searchError = 'Įveskite bent vieną lemos raidę.';
      return;
    }
    searching = true;
    try {
      const found = await searchSyntaxLemmas(overview.manifest, term);
      results = found.matches;
      resultTotal = found.total;
    } catch (cause) {
      searchError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      searching = false;
    }
  }

  async function selectLemma(lemma: SyntaxLemma) {
    if (!overview) return;
    selectedLemma = lemma;
    contexts = [];
    contextError = null;
    contextLoading = true;
    try {
      contexts = await loadSyntaxContexts(overview.manifest, lemma.lemma);
    } catch (cause) {
      contextError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      contextLoading = false;
    }
  }

  $effect(() => {
    let cancelled = false;
    loadSyntaxOverview().then((loaded) => {
      if (cancelled) return;
      overview = loaded;
      loading = false;
    }).catch((cause) => {
      if (cancelled) return;
      error = cause instanceof Error ? cause.message : String(cause);
      loading = false;
    });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if loading}
  <p class="status" role="status" aria-live="polite">Kraunama ALKSNIS apžvalga…</p>
{:else if error}
  <section class="error" role="alert">
    <h2>Nepavyko įkelti sintaksės duomenų</h2>
    <p>{error}</p>
  </section>
{:else if overview}
  <section class="explorer" aria-labelledby="syntax-overview-title">
    <header>
      <h2 id="syntax-overview-title">{overview.manifest.title}</h2>
      <p>
        Tai yra ribotas, ranka tikrintas sintaksinis medis, o ne bendras lietuvių kalbos dažnumo reitingas ar sinonimų šaltinis.
        Rodomi tik šaltinio pateikti ryšiai ir sakinių kontekstai.
      </p>
      <p>
        <a href={overview.manifest.provenance.sourceUrl} target="_blank" rel="noreferrer">Pirminis ALKSNIS įrašas</a>
        · {overview.manifest.provenance.licence}
      </p>
    </header>

    <dl class="overview-grid">
      <div><dt>Dokumentai</dt><dd>{overview.manifest.syntaxContext.overview.documents}</dd></div>
      <div><dt>Pristatyti sakinių ID</dt><dd>{overview.manifest.syntaxContext.overview.deliveredSentenceIds}</dd></div>
      <div><dt>Nepunktuacijos žetonai</dt><dd>{overview.manifest.syntaxContext.overview.nonPunctuationRows}</dd></div>
      <div><dt>Ryšių žymos</dt><dd>{overview.manifest.syntaxContext.overview.nonPunctuationRelationLabels}</dd></div>
    </dl>

    <p class="source-note">
      Repozitorija nurodo {overview.manifest.syntaxContext.overview.repositorySentenceClaim} sakinius, o pristatytose CoNLL-U bylose yra
      {overview.manifest.syntaxContext.overview.deliveredSentenceIds} sakinių ID. Šį skirtumą išsaugome, o ne taisome spėjimu.
    </p>

    <div class="summary-columns">
      <section aria-labelledby="relation-summary-title">
        <h3 id="relation-summary-title">Dažniausios ryšių žymos</h3>
        <table>
          <thead><tr><th scope="col">Žyma</th><th scope="col">Eilučių</th></tr></thead>
          <tbody>
            {#each overview.relations.slice(0, 12) as relation}
              <tr><td>{relation.relation}</td><td>{relation.count}</td></tr>
            {/each}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="genre-summary-title">
        <h3 id="genre-summary-title">Šaltinio žanrai</h3>
        <table>
          <thead><tr><th scope="col">Žanras</th><th scope="col">Dok.</th><th scope="col">Sak.</th></tr></thead>
          <tbody>
            {#each overview.genres as genre}
              <tr><td>{genre.genre}</td><td>{genre.documents}</td><td>{genre.sentences}</td></tr>
            {/each}
          </tbody>
        </table>
      </section>
    </div>

    <section class="lemma-search" aria-labelledby="lemma-search-title">
      <h3 id="lemma-search-title">Ieškoti lemos konteksto</h3>
      <p>
        Įvedus lemos pradžią, atsiunčiamas tik atitinkamas lemos rodyklės fragmentas. Sakiniai atsiunčiami tik pasirinkus konkrečią lemą.
      </p>
      <form onsubmit={search}>
        <label for="syntax-lemma-query">Lemos pradžia</label>
        <div class="search-controls">
          <input id="syntax-lemma-query" bind:value={query} autocomplete="off" placeholder="pvz., kalba" />
          <button type="submit" disabled={searching}>{searching ? 'Ieškoma…' : 'Ieškoti'}</button>
        </div>
      </form>

      {#if searchError}
        <p class="error-inline" role="alert">{searchError}</p>
      {/if}
      {#if !searching && query.trim() && !searchError}
        <p class="result-count" role="status" aria-live="polite">
          {#if resultTotal === 0}
            Atitikmenų nerasta.
          {:else if resultTotal > results.length}
            Rasta {resultTotal}; rodomi pirmi {results.length}.
          {:else}
            Rasta {resultTotal}.
          {/if}
        </p>
      {/if}
      {#if results.length > 0}
        <ul class="lemma-results" aria-label="Rastos lemos">
          {#each results as lemma}
            <li>
              <button
                type="button"
                aria-pressed={selectedLemma?.lemma === lemma.lemma}
                onclick={() => selectLemma(lemma)}
              >
                <strong>{lemma.lemma}</strong>
                <span>{lemma.tokenCount} žet.; pagrindinis {lemma.headEdgeCount}; priklausomasis {lemma.dependentEdgeCount}; šaknis {lemma.rootEdgeCount}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if selectedLemma}
      <section class="contexts" aria-labelledby="contexts-title">
        <h3 id="contexts-title">Sakinių kontekstai: {selectedLemma.lemma}</h3>
        <p>
          Rodoma ne daugiau kaip {overview.manifest.syntaxContext.exampleSelection.maxExamplesPerLemma} pavyzdžių, parinktų
          {overview.manifest.syntaxContext.exampleSelection.order.toLocaleLowerCase('lt')}
          Dėl ribos neparodyta {overview.manifest.syntaxContext.exampleSelection.omittedRows} kitų galimų vaidmenų eilučių visame produkte.
        </p>
        {#if contextLoading}
          <p class="status" role="status" aria-live="polite">Kraunami pasirinktos lemos sakiniai…</p>
        {:else if contextError}
          <p class="error-inline" role="alert">{contextError}</p>
        {:else if contexts.length === 0}
          <p class="status" role="status">Šiai lemai išsaugotų kontekstų nėra.</p>
        {:else}
          <ol class="context-list">
            {#each contexts as context}
              <li>
                <p><strong>{context.relation}</strong> · {directionLabel(context.direction)}</p>
                <p class="relation-pair">
                  <span>priklausomasis: <strong>{context.dependentForm}</strong> ({context.dependentLemma})</span>
                  <span>pagrindinis: <strong>{context.headForm}</strong> ({context.headLemma})</span>
                </p>
                <blockquote>{context.sentenceText}</blockquote>
                <p class="context-source">{context.genre} · {context.document} · sakinys {context.sourceSentenceId}</p>
              </li>
            {/each}
          </ol>
        {/if}
      </section>
    {/if}

    <details>
      <summary>Ribos ir kilmė</summary>
      <div class="details-content">
        <p>{overview.manifest.provenance.citation}</p>
        <ul>
          {#each overview.manifest.syntaxContext.exclusions as exclusion}
            <li>{exclusion}</li>
          {/each}
          <li>Šaknies vaidmuo išsaugomas kaip šaltinio HEAD=0 / ROOT, be sugalvotos leksinės galvos.</li>
          <li>Žanrų lentelė aprašo šio šaltinio sandarą; ji nėra reikšmingumo ar visos kalbos palyginimas.</li>
        </ul>
      </div>
    </details>
  </section>
{/if}

<style>
  .status,
  .error,
  .source-note,
  .lemma-search,
  .contexts {
    border: 1px solid var(--border-color);
    margin-top: var(--lg);
    padding: var(--md);
  }

  .error,
  .error-inline {
    border-color: #ffbf00;
  }

  header p + p,
  .source-note,
  .lemma-search > p,
  .contexts > p,
  .context-list p,
  blockquote {
    margin-top: var(--sm);
  }

  .overview-grid {
    display: grid;
    gap: var(--sm);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: var(--lg);
  }

  .overview-grid div {
    border-left: 2px solid var(--border-color);
    padding-left: var(--sm);
  }

  .overview-grid dt {
    font-size: 0.875em;
  }

  .overview-grid dd {
    font-size: 1.25em;
    margin: 0;
  }

  .summary-columns {
    display: grid;
    gap: var(--lg);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: var(--lg);
  }

  h3 {
    margin-bottom: var(--sm);
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  th,
  td {
    border-bottom: 1px solid var(--border-color);
    padding: var(--xs);
    text-align: left;
    vertical-align: top;
  }

  .search-controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sm);
    margin-top: var(--xs);
  }

  .search-controls input {
    background: #222;
    border: 1px solid #ffbf00;
    color: #ffbf00;
    flex: 1 1 16rem;
    padding: var(--xs) var(--sm);
  }

  .result-count,
  .error-inline {
    margin-top: var(--sm);
  }

  .lemma-results {
    list-style: none;
    margin-top: var(--md);
    padding: 0;
  }

  .lemma-results li + li {
    margin-top: var(--xs);
  }

  .lemma-results button {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sm);
    justify-content: space-between;
    text-align: left;
    width: 100%;
  }

  .lemma-results span {
    font-size: 0.875em;
  }

  .context-list {
    margin-top: var(--md);
  }

  .context-list li {
    border-left: 2px solid var(--border-color);
    padding-left: var(--sm);
  }

  .relation-pair {
    display: flex;
    flex-wrap: wrap;
    gap: var(--md);
  }

  blockquote {
    border-left: 2px solid #ffbf00;
    margin-left: 0;
    padding-left: var(--sm);
  }

  .context-source {
    font-size: 0.875em;
  }

  details {
    margin-top: var(--lg);
  }

  .details-content {
    margin: var(--md) 0 var(--sm);
  }

  @media (max-width: 639px) {
    .overview-grid,
    .summary-columns {
      grid-template-columns: 1fr;
    }
  }
</style>
