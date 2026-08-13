<script lang="ts">
  import { base } from '$app/paths';
  import { loadPublicDataProducts, type DataProductType, type PublicDataProduct } from '$lib/publication';
  import { site } from '$lib/site';

  type CategoryId = 'frequency' | 'comparisons' | 'lexical' | 'syntax' | 'metadata';
  type PrimaryAction = { href: string; label: string } | null;

  interface Category {
    id: CategoryId;
    title: string;
    description: string;
  }

  const homeUrl = `${base}/`;
  const categoryDefinitions: Category[] = [
    {
      id: 'frequency',
      title: 'Dažnumo sąrašai',
      description: 'Lemų, žodžių formų ir viengramių skaičiai, kurie visada galioja tik nurodytam šaltiniui.'
    },
    {
      id: 'comparisons',
      title: 'Palyginimai',
      description: 'Kelių šaltinių santykio ar aprėpties rodikliai; jų negalima perskaityti kaip bendro dažnumo reitingo.'
    },
    {
      id: 'lexical',
      title: 'Leksiniai rinkiniai',
      description: 'Specializuoti žodyno, analizės ar porų įrašai, o ne dažnumo lentelės.'
    },
    {
      id: 'syntax',
      title: 'Sintaksės kontekstai',
      description: 'Šaltiniui būdingi priklausomybių ryšiai, žanrai ir riboti sakinių kontekstai.'
    },
    {
      id: 'metadata',
      title: 'Metaduomenys be eilučių',
      description: 'Šaltiniai, kuriems paskelbtas tik saugus aprašas, o ne duomenų įrašai.'
    }
  ];

  let products = $state<PublicDataProduct[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  let groupedCategories = $derived(categoryDefinitions
    .map((category) => ({
      ...category,
      products: products.filter((product) => categoryId(product) === category.id)
    }))
    .filter((category) => category.products.length > 0));

  function categoryId(product: PublicDataProduct): CategoryId {
    switch (product.productType) {
      case 'generic-frequency-dataset':
      case 'chunked-wordform-list':
      case 'chunked-frequency-list':
      case 'chunked-derived-frequency-list':
        return 'frequency';
      case 'chunked-comparison':
        return 'comparisons';
      case 'chunked-lexical-collection':
        return 'lexical';
      case 'chunked-syntactic-context':
        return 'syntax';
      case 'metadata-only':
        return 'metadata';
    }
  }

  function productForm(product: PublicDataProduct) {
    if (product.id === 'vssa-2026-blkt-wordform-profile') {
      return 'Vieno tekstyno žodžio profilis pagal tipą ir laikotarpį';
    }
    const forms: Record<DataProductType, string> = {
      'generic-frequency-dataset': product.content?.entryKind === 'wordform'
        ? 'Naršyklėje tiriamas žodžių formų dažnumo sąrašas'
        : 'Naršyklėje tiriamas lemų dažnumo sąrašas',
      'chunked-wordform-list': 'Didelis žodžių formų dažnumo sąrašas',
      'chunked-frequency-list': 'Šaltinio leksinių vienetų dažnumo sąrašas',
      'chunked-derived-frequency-list': 'Iš anotuoto tekstyno išvestas dažnumo sąrašas',
      'chunked-lexical-collection': 'Specializuotų leksinių įrašų rinkinys',
      'chunked-syntactic-context': 'Sintaksinių ryšių ir kontekstų rinkinys',
      'chunked-comparison': 'Tarp šaltinių apskaičiuotas palyginimas',
      'metadata-only': 'Šaltinio metaduomenys be viešų įrašų'
    };
    return forms[product.productType];
  }

  function sourceScope(product: PublicDataProduct) {
    const scopes: Record<string, string> = {
      'utka-2018-lemmatized-totals': '1 mln. lietuvių kalbos tekstyno lemos ir kalbos dalių žymos.',
      'dadurkevicius-2020-jcl-lemmas': 'Jungtinio lietuvių kalbos tekstyno lemų ir kalbos dalių dažniai.',
      'petkevicius-2025-ccll-lemmas': 'Dabartinės lietuvių kalbos tekstyno lemų dažniai.',
      'utka-ccll-wordforms': 'Bendras CCLL sąrašas ir penki atskirų subkorpusų žodžių formų sąrašai.',
      'dadurkevicius-dml6-vs-jcl-comparison': 'DML6 žodyno aprėpties ir JCL vartosenos palyginimo rodikliai.',
      'utka-ccll2-war-ukraine-comparison': 'CCLL2, karo laikotarpio žiniasklaidos ir socialinių tinklų leksikonų palyginimas.',
      'bielinskiene-2019-delfi-1grams': 'Delfi.lt tekstyno viengramiai.',
      'rimkute-2024-matas-v3-frequencies': 'Iš MATAS v3.0 anotuoto tekstyno išvesti lemų ir žodžių formų dažniai.',
      'zemriete-2025-lithuanian-homoforms': 'Lietuvių homoformų analizės su šaltiniui būdingais laukais.',
      'raskinis-2025-foreign-name-transliterations': 'Užsienio vardų perteikimo poros ir šaltinio atitikčių skaičiai.',
      'birvinskaite-2026-lithuanian-basketball-slang': 'Lietuvių krepšinio žargono leksiniai įrašai.',
      'rimkute-2019-alksnis-syntactic-context': 'ALKSNIS medyno priklausomybių ryšiai, žanrai, lemos ir riboti sakinių kontekstai.',
      'kapociute-dzikiene-2017-parliament-frequency-aggregates': 'Lietuvos parlamento kalbų tekstyno bendri lemų ir žodžių formų dažniai.',
      'vssa-2026-blkt-wordform-profile': 'Vienos tikslios žodžio formos rodikliai visame BLKT ir saugiai paskelbtuose penkių teksto tipų bei keturių laikotarpių pjūviuose.',
      'rimkute-morphemic-dictionary': 'Iš trijų 2011 m. PDF tomų deterministiškai išgauti 72 325 įrašai; šaltinio dažnių suma – 310 012.'
    };
    return scopes[product.id] ?? product.publication.scope;
  }

  function limitation(product: PublicDataProduct) {
    const sourceSpecificLimits: Record<string, string> = {
      'kapociute-dzikiene-2017-parliament-frequency-aggregates': 'Pateikiamos tik viso tekstyno suvestinės; tai nėra autorystės nustatymo, politikų reitingavimo, citatų ar kalendorinės analizės priemonė.',
      'vssa-2026-blkt-wordform-profile': 'BLKT nėra reprezentatyvus visos lietuvių kalbos portretas, nes jame vyrauja žiniasklaida ir dokumentai. Tokenizatoriaus raidžių sekos nėra taisyklingumo ar lietuviškumo įvertinimas. Ieškoma tik viena tiksli forma; neskelbiami reitingai, potipiai, sankirtos ar saugos slenksčio nepasiekusios pjūvių šeimos.',
      'rimkute-morphemic-dictionary': 'Dažniai aprašo tik žodyno šaltinio tekstyną. PDF turi 61 eilute daugiau nei vėlesnei gyvai „Morfema“ bazei nurodomi 72 264 įrašai; gyvos bazės skaičius pateikiamas tik kontekstui, o ne kaip išgavimo tikslas. Tai nėra gyvos bazės eksportas.'
    };
    if (sourceSpecificLimits[product.id]) return sourceSpecificLimits[product.id];
    if (product.publication.reason) return product.publication.reason;

    const limits: Record<DataProductType, string> = {
      'generic-frequency-dataset': 'Skaičiai nėra bendras visos lietuvių kalbos populiarumo reitingas.',
      'chunked-wordform-list': 'Bendras ir subkorpusų dažnius reikia interpretuoti atskirai; tai nėra vienas bendras kalbos reitingas.',
      'chunked-frequency-list': 'Kiekvienas skaičius aprašo tik nurodytą tekstyną, o ne visą lietuvių kalbą.',
      'chunked-derived-frequency-list': 'Dažniai priklauso nuo šaltinio anotavimo ir atrankos; jie nėra bendras vartosenos matas.',
      'chunked-lexical-collection': 'Tai nėra dažnumo sąrašas: laukai ir reikšmės išlaiko konkretaus šaltinio paskirtį.',
      'chunked-syntactic-context': 'Kontekstai ir ryšiai aprašo tik šį medyną; iš jų negalima daryti bendrų kalbos vartosenos išvadų.',
      'chunked-comparison': 'Metrikos yra skirtos tik nurodytiems šaltiniams palyginti, o ne jų dažniams sudėti ar reitinguoti.',
      'metadata-only': 'Viešai pateiktas tik aprašas; žodyno eilutės, PDF puslapiai ir iš jų išgauti duomenys neskelbiami.'
    };
    return limits[product.productType];
  }

  function accessDescription(product: PublicDataProduct) {
    if (product.publication.status === 'metadata-only') {
      return 'Pateikiamas tik viešas JSON sprendimo aprašas; duomenų eilučių nėra.';
    }
    if (product.productType === 'generic-frequency-dataset') {
      return 'Tyrinėjimas naršyklėje ir pilnas peržiūrėtas JSON rinkinys.';
    }
    if (product.productType === 'chunked-comparison' || product.productType === 'chunked-syntactic-context') {
      return 'Galimas specialus tyrinėjimo vaizdas; JSON aprašas nurodo atskiras statines duomenų dalis.';
    }
    return 'JSON aprašas įkeliamas pirmas, o duomenys pateikiami mažesnėmis statinėmis dalimis.';
  }

  function availability(product: PublicDataProduct) {
    return product.publication.status === 'published'
      ? 'Viešas JSON duomenų produktas'
      : 'Tik metaduomenys; įrašai neskelbiami';
  }

  function permissionDescription(product: PublicDataProduct) {
    if (product.id === 'rimkute-morphemic-dictionary') {
      return 'Leidžiama išgauti ir taisyti PDF duomenis, skelbti bei platinti visą išvestinį rinkinį ir statistiką, taip pat pernaudoti su įprastu priskyrimu.';
    }
    return product.provenance.permission?.scope ?? '';
  }

  function primaryAction(product: PublicDataProduct): PrimaryAction {
    if (product.publication.status === 'metadata-only') return null;

    if (product.productType === 'generic-frequency-dataset') {
      return { href: homeUrl, label: 'Tyrinėti dažnumo sąrašą' };
    }

    const explorerActions: Record<string, PrimaryAction> = {
      'utka-ccll-wordforms': {
        href: `${base}/zanru-profilis`,
        label: 'Tyrinėti žanrų profilį'
      },
      'dadurkevicius-dml6-vs-jcl-comparison': {
        href: `${base}/zodyno-apreptis`,
        label: 'Tyrinėti žodyno aprėptį'
      },
      'utka-ccll2-war-ukraine-comparison': {
        href: `${base}/karo-zodziu-palyginimas`,
        label: 'Palyginti šaltinius'
      },
      'rimkute-2019-alksnis-syntactic-context': {
        href: `${base}/sintakse`,
        label: 'Tyrinėti sintaksės kontekstus'
      },
      'vssa-2026-blkt-wordform-profile': {
        href: `${base}/blkt-profilis`,
        label: 'Tyrinėti BLKT žodžio profilį'
      }
    };

    return explorerActions[product.id] ?? {
      href: product.manifestUrl,
      label: 'Atverti JSON aprašą ir prieigą'
    };
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
  <title>Viešų duomenų katalogas · Dažniausi lietuviški žodžiai</title>
  <meta name="description" content="Naršykite visus viešus lietuvių kalbos duomenų produktus: jų šaltinio apimtį, licenciją, prieigą ir interpretavimo ribas." />
  <link rel="canonical" href={site.catalogueUrl} />
  <meta property="og:title" content="Viešų duomenų katalogas · Dažniausi lietuviški žodžiai" />
  <meta property="og:description" content="Viešų lietuvių kalbos duomenų produktų apimtis, licencijos, prieiga ir ribos vienoje vietoje." />
  <meta property="og:url" content={site.catalogueUrl} />
</svelte:head>

<main class="catalogue">
  <p class="back-link"><a href={homeUrl}>← Tyrinėti dažnumo sąrašus</a></p>
  <h1>Viešų duomenų katalogas</h1>
  <p class="lead">Kiekvienas produktas išlaiko savo šaltinio ribas. Prieš atveriant JSON duomenis čia matoma, ką jo reikšmės aprašo, ko jos neaprašo, ir kokiomis sąlygomis galima juos naudoti.</p>

  {#if loading}
    <p class="loading" role="status" aria-live="polite">Kraunami viešų produktų aprašai…</p>
  {:else if error}
    <section class="error" role="alert" aria-labelledby="catalogue-load-error">
      <h2 id="catalogue-load-error">Nepavyko įkelti viešų produktų katalogo</h2>
      <p>{error}</p>
    </section>
  {:else}
    <p class="result-count" role="status">Kataloge: {products.length} produktų.</p>

    {#each groupedCategories as category}
      <section class="category" aria-labelledby={`category-${category.id}`}>
        <header>
          <h2 id={`category-${category.id}`}>{category.title}</h2>
          <p>{category.description}</p>
        </header>

        <div class="product-grid">
          {#each category.products as product}
            {@const action = primaryAction(product)}
            <article class:metadata-only={product.publication.status === 'metadata-only'} class="product-card" aria-labelledby={`product-${product.id}`}>
              <div class="card-header">
                <p class="status">{availability(product)}</p>
                <h3 id={`product-${product.id}`}>{product.title}</h3>
              </div>

              <dl class="facts">
                <div>
                  <dt>Ką pateikia</dt>
                  <dd>{productForm(product)}</dd>
                </div>
                <div>
                  <dt>Licencija</dt>
                  <dd>{product.provenance.licence}</dd>
                </div>
                <div class="scope">
                  <dt>Šaltinio apimtis</dt>
                  <dd>{sourceScope(product)}</dd>
                </div>
                <div class="scope">
                  <dt>Prieiga</dt>
                  <dd>{accessDescription(product)}</dd>
                </div>
                {#if product.provenance.permission}
                  <div class="scope">
                    <dt>Teisių turėtojo leidimo apimtis</dt>
                    <dd>{permissionDescription(product)} ({product.provenance.permission.confirmedOn})</dd>
                  </div>
                {/if}
                {#if product.provenance.attributionNotice}
                  <div class="scope">
                    <dt>Priskyrimas</dt>
                    <dd>{product.provenance.attributionNotice}</dd>
                  </div>
                {/if}
              </dl>

              <p class="limitation"><strong>Interpretavimo riba:</strong> {limitation(product)}</p>
              {#if product.provenance.modificationNotice}
                <p class="modification-notice"><strong>Pakeitimo pranešimas:</strong> {product.provenance.modificationNotice}</p>
              {/if}

              <div class="card-actions">
                {#if action}
                  <a href={action.href}>{action.label}</a>
                  <a href={product.manifestUrl}>JSON produkto aprašas</a>
                {:else}
                  <a href={product.manifestUrl}>Peržiūrėti viešą sprendimo aprašą</a>
                {/if}
                <a href={product.provenance.sourceUrl} target="_blank" rel="noreferrer">Pirminio šaltinio įrašas</a>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/each}

    <details class="table-equivalent">
      <summary>Visas katalogas tekstine lentele</summary>
      <div class="table-scroll">
        <table>
          <caption>Visi katalogo produktai, jų paskirtis, būsena ir prieiga</caption>
          <thead>
            <tr>
              <th scope="col">Kategorija</th>
              <th scope="col">Produktas</th>
              <th scope="col">Šaltinio apimtis</th>
              <th scope="col">Būsena</th>
              <th scope="col">Prieiga</th>
            </tr>
          </thead>
          <tbody>
            {#each groupedCategories as category}
              {#each category.products as product}
                {@const action = primaryAction(product)}
                <tr>
                  <th scope="row">{category.title}</th>
                  <td>{product.title}</td>
                  <td>{sourceScope(product)}</td>
                  <td>{availability(product)}</td>
                  <td>
                    {#if action}
                      <a href={action.href}>{action.label}</a>
                    {:else}
                      <a href={product.manifestUrl}>Sprendimo aprašas</a>
                    {/if}
                  </td>
                </tr>
              {/each}
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}
</main>

<style>
  .catalogue {
    display: grid;
    gap: var(--xl);
  }

  .back-link {
    margin-bottom: calc(var(--lg) * -1);
  }

  .lead {
    font-size: 1.15em;
    max-width: 68ch;
  }

  .loading,
  .error,
  .result-count {
    border: 1px solid var(--border-color);
    padding: var(--md);
  }

  .category {
    display: grid;
    gap: var(--md);
  }

  .category header {
    max-width: 72ch;
  }

  .category h2,
  .category h3,
  .category header p {
    margin-bottom: var(--sm);
  }

  .category header p {
    margin-bottom: 0;
  }

  .product-grid {
    display: grid;
    gap: var(--md);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr));
  }

  .product-card {
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: var(--md);
    min-width: 0;
    padding: var(--md);
  }

  .product-card.metadata-only {
    border-style: dashed;
  }

  .card-header {
    display: grid;
    gap: var(--xs);
  }

  .status {
    color: color-mix(in srgb, var(--text-color) 76%, transparent);
    font-size: 0.9em;
  }

  .facts {
    display: grid;
    gap: var(--sm);
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .facts > div {
    border-left: 2px solid var(--border-color);
    min-width: 0;
    padding-left: var(--sm);
  }

  .facts .scope {
    grid-column: 1 / -1;
  }

  dt {
    color: color-mix(in srgb, var(--text-color) 72%, transparent);
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .limitation {
    border-left: 2px solid var(--text-color);
    padding-left: var(--sm);
  }

  .modification-notice {
    border-left: 2px dashed var(--text-color);
    padding-left: var(--sm);
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sm) var(--md);
    margin-top: auto;
  }

  .table-equivalent {
    margin: 0;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  .table-scroll {
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    margin-top: var(--md);
    min-width: 60rem;
    width: 100%;
  }

  caption {
    margin-bottom: var(--sm);
    text-align: left;
  }

  th,
  td {
    border: 1px solid var(--border-color);
    padding: var(--sm);
    text-align: left;
    vertical-align: top;
  }

  @media (max-width: 639px) {
    .facts {
      grid-template-columns: 1fr;
    }

    .facts .scope {
      grid-column: auto;
    }
  }
</style>
