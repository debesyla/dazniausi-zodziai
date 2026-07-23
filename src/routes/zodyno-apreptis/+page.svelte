<script lang="ts">
  import {
    coverageCategoryDefinitions,
    loadDml6CoverageDrilldown,
    loadDml6CoverageProfile,
    type CoverageCategoryDefinition,
    type Dml6CoverageDrilldown,
    type Dml6CoverageProfile
  } from '$lib/dml6-coverage';

  let profile = $state<Dml6CoverageProfile | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);
  let selection = $state<{ bandId: string; coverageCode: number } | null>(null);
  let drilldown = $state<Dml6CoverageDrilldown | null>(null);
  let drilldownLoading = $state(false);
  let drilldownError = $state<string | null>(null);
  let requestNumber = 0;
  const siteRoot = `${import.meta.env.BASE_URL.replace(/\/+$/, '')}/`;

  let categories = $derived<CoverageCategoryDefinition[]>(profile ? coverageCategoryDefinitions(profile) : []);
  let selectedBand = $derived(profile?.summary.bands.find((band) => band.id === selection?.bandId) ?? null);
  let selectedCategory = $derived(selectedBand?.categories.find((category) => category.coverageCode === selection?.coverageCode) ?? null);
  let selectedCategoryLabel = $derived(categories.find((category) => category.code === selection?.coverageCode)?.label ?? '');

  function formatNumber(value: number) {
    return value.toLocaleString('lt-LT');
  }

  function formatPercent(value: number) {
    return new Intl.NumberFormat('lt-LT', { style: 'percent', maximumFractionDigits: 1 }).format(value);
  }

  function typeShare(typeCount: number, bandTypeCount: number) {
    return bandTypeCount === 0 ? 0 : typeCount / bandTypeCount;
  }

  function tokenShare(tokenCount: number, bandTokenCount: number) {
    return bandTokenCount === 0 ? 0 : tokenCount / bandTokenCount;
  }

  async function showExamples(bandId: string, coverageCode: number) {
    if (!profile) return;
    selection = { bandId, coverageCode };
    drilldown = null;
    drilldownError = null;
    drilldownLoading = true;
    const request = ++requestNumber;
    try {
      const loaded = await loadDml6CoverageDrilldown(profile, bandId, coverageCode);
      if (request !== requestNumber) return;
      drilldown = loaded;
    } catch (cause) {
      if (request !== requestNumber) return;
      drilldownError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (request === requestNumber) drilldownLoading = false;
    }
  }

  function csvCell(value: string | number) {
    return `"${String(value).replaceAll('"', '""')}"`;
  }

  function downloadSummary() {
    if (!profile) return;
    const rows = [
      ['Dažnumo intervalas', 'DML6 aprėptis', 'Žodžių formų skaičius', 'Žodžių formų dalis intervale', 'JCL žetonų skaičius', 'JCL žetonų dalis intervale'],
      ...profile.summary.bands.flatMap((band) => categories.map((category) => {
        const summary = band.categories.find((item) => item.coverageCode === category.code);
        return [
          band.label,
          category.label,
          summary?.typeCount ?? 0,
          typeShare(summary?.typeCount ?? 0, band.typeCount),
          summary?.tokenCount ?? 0,
          tokenShare(summary?.tokenCount ?? 0, band.tokenCount)
        ];
      }))
    ];
    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dml6-jcl-zodyno-apreptis-pagal-daznuma.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  $effect(() => {
    let cancelled = false;
    loadDml6CoverageProfile().then((loaded) => {
      if (cancelled) return;
      profile = loaded;
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

<svelte:head>
  <title>Žodyno aprėptis pagal dažnumą</title>
  <meta name="description" content="Jungtinio lietuvių kalbos tekstyno žodžių formų aprėptis Dabartinės lietuvių kalbos žodyne pagal skaidrius dažnumo intervalus." />
</svelte:head>

<main>
  <a class="back-link" href={siteRoot}>← Grįžti į žodžių dažnumo tyrinėjimą</a>
  <h1>Žodyno aprėptis pagal dažnumą</h1>
  <p class="intro">Šis vaizdas rodo, kokios Jungtinio lietuvių kalbos tekstyno žodžių formos patenka į skirtingas Dabartinės lietuvių kalbos žodyno aprėpties kategorijas. Kategorijos nėra skalė ir nėra žodžio „teisingumo“ įvertinimas.</p>

  {#if loading}
    <p class="status" role="status" aria-live="polite">Kraunama aprėpties suvestinė…</p>
  {:else if error}
    <section class="error" role="alert" aria-labelledby="coverage-load-error">
      <h2 id="coverage-load-error">Nepavyko įkelti aprėpties duomenų</h2>
      <p>{error}</p>
    </section>
  {:else if profile}
    <section class="overview" aria-labelledby="overview-title">
      <div>
        <h2 id="overview-title">Ką apima suvestinė</h2>
        <p>{formatNumber(profile.summary.totalTypeCount)} skirtingos žodžių formos ir {formatNumber(profile.summary.totalTokenCount)} JCL žetonai, suskirstyti į šešis nesikertančius dažnumo intervalus.</p>
      </div>
      <button type="button" onclick={downloadSummary}>Atsisiųsti suvestinę CSV</button>
    </section>

    <dl class="source-facts">
      <div>
        <dt>Duomenų vienetas</dt>
        <dd>Žodžio forma</dd>
      </div>
      <div>
        <dt>Dažnumo matas</dt>
        <dd>JCL žetonų skaičius</dd>
      </div>
      <div>
        <dt>Aprėpties šaltinis</dt>
        <dd>Dabartinės lietuvių kalbos žodynas (DML6)</dd>
      </div>
      <div>
        <dt>Licencija</dt>
        <dd>{profile.provenance.licence}</dd>
      </div>
    </dl>

    <p class="method-note">Kiekvienoje eilutėje pateikiama ir žodžių formų dalis, ir jų JCL žetonų dalis. Jos gali skirtis: daug retų formų sudaro daug tipų, bet mažesnę visų žetonų dalį.</p>

    <section aria-labelledby="bands-title">
      <div class="section-heading">
        <div>
          <h2 id="bands-title">Aprėptis dažnumo intervaluose</h2>
          <p>Pasirinkite eilutės pavyzdžius tik tada, kai norite atsisiųsti mažą tos kategorijos sąrašą.</p>
        </div>
      </div>

      <div class="bands">
        {#each profile.summary.bands as band}
          <article class="band" aria-labelledby={`band-${band.id}`}>
            <header>
              <h3 id={`band-${band.id}`}>Dažnumas {band.label}</h3>
              <p>{formatNumber(band.typeCount)} formų · {formatNumber(band.tokenCount)} žetonų</p>
            </header>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">DML6 aprėptis</th>
                    <th scope="col">Žodžių formos</th>
                    <th scope="col">JCL žetonai</th>
                    <th scope="col"><span class="visually-hidden">Pavyzdžiai</span></th>
                  </tr>
                </thead>
                <tbody>
                  {#each categories as category}
                    {@const summary = band.categories.find((item) => item.coverageCode === category.code)}
                    {#if summary}
                      <tr>
                        <th scope="row">{category.label}</th>
                        <td>
                          <strong>{formatNumber(summary.typeCount)}</strong>
                          <span>{formatPercent(typeShare(summary.typeCount, band.typeCount))} intervalo formų</span>
                        </td>
                        <td>
                          <strong>{formatNumber(summary.tokenCount)}</strong>
                          <span>{formatPercent(tokenShare(summary.tokenCount, band.tokenCount))} intervalo žetonų</span>
                        </td>
                        <td><button type="button" onclick={() => showExamples(band.id, category.code)}>Rodyti iki {summary.drilldown.records} pavyzdžių</button></td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
          </article>
        {/each}
      </div>
    </section>

    {#if selection && selectedBand && selectedCategory}
      <section class="examples" aria-labelledby="examples-title" aria-live="polite">
        <h2 id="examples-title">Pavyzdžiai: {selectedCategoryLabel}, dažnumas {selectedBand.label}</h2>
        <p>Rodomi daugiausia {formatNumber(selectedCategory.drilldown.records)} įrašų, rikiuojamų pagal mažėjantį JCL žetonų skaičių; tai nėra visa kategorija.</p>
        {#if drilldownLoading}
          <p role="status">Kraunami pasirinktos kategorijos pavyzdžiai…</p>
        {:else if drilldownError}
          <p class="error-message" role="alert">{drilldownError}</p>
        {:else if drilldown}
          <div class="table-scroll">
            <table>
              <thead><tr><th scope="col">Rangas</th><th scope="col">Žodžio forma</th><th scope="col">JCL žetonų skaičius</th></tr></thead>
              <tbody>
                {#each drilldown.records as record, index}
                  <tr><td>{index + 1}</td><td>{record[0]}</td><td>{formatNumber(record[1])}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    {/if}

    <section class="limitations" aria-labelledby="limits-title">
      <h2 id="limits-title">Kaip šio vaizdo neinterpretuoti</h2>
      <ul>
        <li>Aprėpties kodas yra kategorija: jo negalima vidurkinti ar sudėti kaip skaitinio balo.</li>
        <li>Žodyne nerasta forma nebūtinai yra klaida, neologizmas ar nelietuviškas žodis.</li>
        <li>Čia lyginamos žodžių formos ir vieno tekstyno žetonų skaičiai; rezultatas nėra bendras visų lietuvių kalbos tekstynų reitingas.</li>
      </ul>
      <p><a href={profile.provenance.sourceUrl} target="_blank" rel="noreferrer">Atverti pirminį CLARIN-LT šaltinio įrašą</a> · {profile.provenance.citation}</p>
    </section>
  {/if}
</main>

<style>
  main {
    display: grid;
    gap: var(--lg);
  }

  h1,
  h2,
  h3 {
    color: var(--text-color);
  }

  h1 {
    margin-top: var(--sm);
  }

  .back-link {
    justify-self: start;
  }

  .intro,
  .method-note,
  .section-heading p,
  .band header p,
  .examples > p,
  .limitations p {
    color: color-mix(in srgb, var(--text-color) 78%, transparent);
  }

  .overview,
  .source-facts,
  .band,
  .examples,
  .limitations,
  .error,
  .status {
    border: 1px solid var(--border-color);
    padding: var(--md);
  }

  .overview {
    display: flex;
    align-items: end;
    gap: var(--md);
    justify-content: space-between;
  }

  .overview p,
  .section-heading p,
  .band header p,
  .examples > p,
  .limitations p {
    margin-top: var(--xs);
  }

  .source-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sm);
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
  }

  .bands {
    display: grid;
    gap: var(--md);
    margin-top: var(--md);
  }

  .band {
    overflow: hidden;
  }

  .band header {
    display: flex;
    align-items: baseline;
    gap: var(--sm);
    justify-content: space-between;
    margin-bottom: var(--sm);
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    min-width: 40rem;
    width: 100%;
  }

  th,
  td {
    border: 1px solid var(--border-color);
    padding: var(--sm);
    text-align: left;
    vertical-align: top;
  }

  td strong,
  td span {
    display: block;
  }

  td span {
    color: color-mix(in srgb, var(--text-color) 72%, transparent);
    font-size: 0.875em;
    margin-top: var(--xs);
  }

  .examples,
  .limitations {
    display: grid;
    gap: var(--sm);
  }

  .error {
    border-color: #ff7f7f;
  }

  .error-message {
    color: #ffb4b4;
  }

  .visually-hidden {
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    width: 1px;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  @media (max-width: 639px) {
    .overview,
    .band header {
      align-items: stretch;
      flex-direction: column;
    }

    .source-facts {
      grid-template-columns: minmax(0, 1fr);
    }

    table {
      min-width: 36rem;
    }
  }
</style>
