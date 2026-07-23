<script lang="ts">
  import { loadPublicDataProducts, type DataProductType, type PublicDataProduct } from '$lib/publication';
  import { base } from '$app/paths';
  import { site } from '$lib/site';

  const homeUrl = `${base}/`;
  let products = $state<PublicDataProduct[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  function productForm(product: PublicDataProduct) {
    const forms: Record<DataProductType, string> = {
      'generic-frequency-dataset': product.content?.entryKind === 'wordform'
        ? 'Žodžių formų dažnumo sąrašas'
        : 'Lemų dažnumo sąrašas',
      'chunked-wordform-list': 'Didelis žodžių formų dažnumo sąrašas',
      'chunked-frequency-list': 'Žodžių formų arba viengramių dažnumo sąrašas',
      'chunked-derived-frequency-list': 'Iš anotuoto tekstyno išvestas dažnumo sąrašas',
      'chunked-comparison': 'Atskirų metrikų palyginamasis rinkinys',
      'metadata-only': 'Šaltinio metaduomenys be publikuojamų eilučių'
    };
    return forms[product.productType];
  }

  function publicationStatus(product: PublicDataProduct) {
    return product.publication.status === 'published' ? 'Viešas JSON duomenų produktas' : 'Metaduomenys; įrašai neskelbiami';
  }

  $effect(() => {
    let cancelled = false;
    loadPublicDataProducts().then((loadedProducts) => {
      if (cancelled) return;
      products = loadedProducts;
      loading = false;
    }).catch((loadError) => {
      if (cancelled) return;
      error = loadError instanceof Error ? loadError.message : String(loadError);
      loading = false;
    });

    return () => {
      cancelled = true;
    };
  });
</script>

<svelte:head>
  <title>Metodika ir šaltiniai · Dažniausi lietuviški žodžiai</title>
  <meta name="description" content="Sužinokite, iš kokių viešų šaltinių sudaryti šios svetainės lietuvių kalbos duomenys, kokios jų licencijos ir kaip skaityti rodiklius." />
  <link rel="canonical" href={site.methodologyUrl} />
  <meta property="og:title" content="Metodika ir šaltiniai · Dažniausi lietuviški žodžiai" />
  <meta property="og:description" content="Viešų lietuvių kalbos duomenų šaltiniai, licencijos, ribos ir rodiklių paaiškinimas." />
  <meta property="og:url" content={site.methodologyUrl} />
</svelte:head>

<main class="methodology">
  <p class="back-link"><a href={homeUrl}>← Tyrinėti duomenis</a></p>
  <h1>Metodika ir šaltiniai</h1>
  <p class="lead">Ši svetainė padeda tyrinėti lietuvių kalbos žodžių dažnumo ir gretimus leksinius rinkinius. Kiekvienas skaičius lieka susietas su konkrečiu šaltiniu, jo apimtimi ir licencija.</p>

  <section aria-labelledby="reading-title">
    <h2 id="reading-title">Kaip skaityti rodiklius</h2>
    <ul>
      <li><strong>Dažnumas</strong> yra šaltinyje suskaičiuotas žetonų ar įrašų skaičius, o ne bendras visos lietuvių kalbos „populiarumo“ matas.</li>
      <li><strong>Lema</strong> sujungia tos pačios leksemos formas, o <strong>žodžio forma</strong> paliekama tokia, kokia pateikta šaltinyje. Tai nėra keičiami vienetai.</li>
      <li>Diagramos, paieška, filtrai ir CSV eksportas visuomet aprašo tik pasirinktą rinkinį bei aktyvius filtrus. Skirtingų tekstynų dažnių negalima tiesiogiai lyginti nepatikrinus jų apimties, laikotarpio, atrankos ir normalizavimo.</li>
      <li>Vien dažnumo sąrašas neparodo reikšmės, sinonimijos, kolokacijų ar vartosenos konteksto. Tokiems teiginiams reikia sakinių, dokumentų arba iš anksto apskaičiuotų ryšių duomenų.</li>
    </ul>
  </section>

  <section aria-labelledby="sources-title">
    <h2 id="sources-title">Vieši rinkiniai ir jų kilmė</h2>
    <p>Kiekvienam čia pateiktam rinkiniui nurodoma šaltinio citata, licencija ir nuoroda į pirminį įrašą. Dideli rinkiniai pateikiami JSON dalimis, kad jų metrikos nebūtų supainiotos su naršyklės dažnumo lentele.</p>

    {#if loading}
      <p class="loading" role="status" aria-live="polite">Kraunami šaltinių metaduomenys…</p>
    {:else if error}
      <div class="error" role="alert">
        <h3>Nepavyko įkelti šaltinių metaduomenų</h3>
        <p>{error}</p>
      </div>
    {:else}
      <div class="source-list">
        {#each products as product}
          <article class:metadata-only={product.publication.status === 'metadata-only'}>
            <h3>{product.title}</h3>
            <dl>
              <div>
                <dt>Duomenų forma</dt>
                <dd>{productForm(product)}</dd>
              </div>
              <div>
                <dt>Vieša būsena</dt>
                <dd>{publicationStatus(product)}</dd>
              </div>
              {#if product.viewCount > 0}
                <div>
                  <dt>Vieši vaizdai</dt>
                  <dd>{product.viewCount}</dd>
                </div>
              {/if}
              <div>
                <dt>Licencija</dt>
                <dd>{product.provenance.licence}</dd>
              </div>
            </dl>
            {#if product.publication.status === 'metadata-only'}
              <p class="notice">Šaltinio eilutės sąmoningai neskelbiamos, kol nėra patikimo mašininiu būdu apdorojamo šaltinio ir aiškių pakartotinio naudojimo sąlygų.</p>
            {/if}
            <p><strong>Citata:</strong> {product.provenance.citation}</p>
            <p><a href={product.provenance.sourceUrl} target="_blank" rel="noreferrer">Pirminis šaltinio įrašas</a> · <a href={product.manifestUrl}>Viešo JSON produkto aprašas</a></p>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section aria-labelledby="reuse-title">
    <h2 id="reuse-title">Atnaujinimas ir pakartotinis naudojimas</h2>
    <p>Rinkiniai atnaujinami retai ir tik po šaltinio, licencijos, eilučių schemos, kontrolinių sumų bei rezultatų suvestinių peržiūros. Svetainė nepriima lankytojų įkeliamų duomenų. Naudojant duomenis būtina laikytis prie kiekvieno rinkinio nurodytos licencijos ir pateikti jo citatą.</p>
  </section>

  <section aria-labelledby="privacy-title">
    <h2 id="privacy-title">Privatumas ir ryšys</h2>
    <p>Svetainėje nėra analizės, sekimo scenarijų ar naršyklės saugyklos telemetrijos. Statinis prieglobos paslaugos teikėjas gali tvarkyti savo techninius veikimo žurnalus pagal savo taisykles.</p>
    <p>Pastabas apie šaltinius, netikslumus ar pakartotinį naudojimą siųskite <a href="mailto:labas@dago.lt">labas@dago.lt</a>.</p>
  </section>
</main>

<style>
  .methodology {
    display: grid;
    gap: var(--xl);
    grid-template-columns: minmax(0, 1fr);
  }

  .methodology > * {
    min-width: 0;
  }

  h1,
  h2,
  h3 {
    color: var(--text-color);
  }

  h2 {
    margin-bottom: var(--sm);
  }

  .back-link {
    margin-bottom: calc(var(--lg) * -1);
  }

  .lead {
    font-size: 1.15em;
    max-width: 62ch;
  }

  .source-list {
    display: grid;
    gap: var(--md);
    grid-template-columns: minmax(0, 1fr);
    margin-top: var(--md);
  }

  .source-list > * {
    min-width: 0;
  }

  article,
  .loading,
  .error {
    border: 1px solid var(--border-color);
    overflow-wrap: anywhere;
    padding: var(--md);
  }

  article.metadata-only {
    border-style: dashed;
  }

  article h3 {
    margin-bottom: var(--sm);
  }

  dl {
    display: grid;
    gap: var(--sm);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: var(--md) 0;
  }

  dl > div {
    border-left: 2px solid var(--border-color);
    padding-left: var(--sm);
  }

  dt {
    color: color-mix(in srgb, var(--text-color) 72%, transparent);
  }

  dd {
    margin: 0;
  }

  article p + p {
    margin-top: var(--sm);
  }

  .notice {
    border-left: 2px solid var(--text-color);
    padding-left: var(--sm);
  }

  @media (max-width: 639px) {
    dl {
      grid-template-columns: 1fr;
    }
  }
</style>
