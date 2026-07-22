# Content-led visual and interaction system

This document is the practical visual baseline for the public Lithuanian
word-data explorer. It is deliberately based on the current catalog, controls,
and frequency views; it does not assume that a frequency list can answer
questions about meanings, grammatical relations, or language use outside the
source corpus.

## Product promise and launch audiences

The site lets a visitor explore a published Lithuanian word list while keeping
the active source, its units, and its limitations visible. A visitor should be
able to answer three different questions without first reading the repository:

| Audience and top task | The page must make this easy | The page must not imply |
| --- | --- | --- |
| Curious visitor: “What words are common in this list?” | Select a dataset, see its headline totals and top entries, then search. | That a result describes all Lithuanian or a word's cultural importance. |
| Learner: “Does this word occur here, and how often?” | Search an exact/partial form, read its frequency and source-provided type, and compare nearby results. | That a lemma and an observed word form are interchangeable. |
| Research-oriented lookup: “What exactly is being counted?” | Identify the dataset, author, year, licence, citation, source link, active filters, sort order, and exported scope. | That the application has added linguistic annotation not present in the source. |

The primary action is **explore a selected dataset**. Downloading, changing a
chart control, or opening a raw data product are secondary actions. The visual
system should make the current data scope more prominent than interface chrome.

## Information hierarchy

The page is read in this order. Each section should use the same active dataset
and active filters unless it explicitly says otherwise.

1. **Orientation** — what the site contains, a concise limitation, and a link
   to methodology and sources.
2. **Dataset identity** — dataset selector, title, author, year, entry kind,
   licence, citation, and source link. This is the evidence for every number
   below it.
3. **Active scope** — search and part-of-speech filters, plus a clear reset.
   The visible result count states the scope in plain language.
4. **Key findings** — entries, total frequency, most frequent entry, and the
   source dimensions available for the selected scope.
5. **Visual exploration** — top entries, rank/frequency curve, cumulative
   coverage, and source-provided part-of-speech composition.
6. **Verifiable results** — the sortable, paginated table and the complete
   active CSV export. Both must have the same filter and sort semantics.
7. **Further material** — public data-product catalog, methodology, contact,
   and privacy statement.

### Desktop wireframe

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Dažniausi lietuviški žodžiai                                               │
│ Tyrinėkite viešų lietuvių kalbos sąrašų dažnumus. [Apie duomenis ir ribas] │
├──────────────────────────────────────────────────────────────────────────┤
│ Pasirinkite duomenis  [Lemuotas 1 mln. ... tekstyno žodžių sąrašas ▾]    │
│                                                                          │
│ Lemuotas 1 mln. lietuvių kalbos tekstyno žodžių sąrašas                  │
│ Andrius Utka · 2018 · Lema · CC BY 4.0                                  │
│ [Citata] [Šaltinis]                                                      │
├──────────────────────────────────────────────────────────────────────────┤
│ Ieškoti žodžių [____________________]  Kalbos dalis [dkt] [v]  [Išvalyti]│
│ Rodomi 1–50 iš 41 977                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│ Pagrindiniai dažnumo rodikliai                                            │
│ [Įrašai 41 977] [Bendras dažnumas 922 949] [Dažniausias būti]            │
│ [Turimi matmenys žodis · dažnumas · kalbos dalis]                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Dažniausi žodžiai                         Rodyti pirmus [10 ▾]           │
│ būti      ██████████████████████  23 941                                 │
│ ...                                                                      │
│ Rango ir dažnumo kreivė        |  Sukaupta žetonų aprėptis               │
│ [aiškiai pažymėtos log skalės] |  [aiškiai pažymėtos ašys ir vienetai]   │
├──────────────────────────────────────────────────────────────────────────┤
│ [Atsisiųsti duomenis .csv formatu]                                       │
│ Rangas | Žodis | Dažnumas ↕ | Tipas                                      │
│ 1      | būti  | 23 941     | v                                          │
│ ...                                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Narrow-screen wireframe

```text
┌──────────────────────────────┐
│ Dažniausi lietuviški žodžiai │
│ Trumpa paskirtis ir [Apie]   │
├──────────────────────────────┤
│ Pasirinkite duomenis         │
│ [Lemuotas 1 mln. ...      ▾] │
│                              │
│ Lemuotas 1 mln. ...          │
│ Utka · 2018 · Lema           │
│ CC BY 4.0 · [Šaltinis]       │
├──────────────────────────────┤
│ Ieškoti žodžių               │
│ [__________________________] │
│ Kalbos dalis                  │
│ [dkt] [v] [prl]              │
│ [Išvalyti filtrus]           │
│ Rodomi 1–50 iš 41 977         │
├──────────────────────────────┤
│ Pagrindiniai rodikliai        │
│ Įrašai                 41 977 │
│ Bendras dažnumas      922 949 │
│ Dažniausias                būti│
├──────────────────────────────┤
│ Dažniausi žodžiai             │
│ [Rodyti pirmus: 10 ▾]         │
│ būti  ███████████████ 23 941  │
│ ...                           │
│ [Rango ir dažnumo kreivė]     │
│ [Sukaupta žetonų aprėptis]    │
├──────────────────────────────┤
│ [Atsisiųsti CSV]              │
│ ← horizontally contained →    │
│ Rangas | Žodis | Dažnumas     │
└──────────────────────────────┘
```

At narrow widths, content becomes a single reading column. The data table may
scroll within its own labelled container; the page, chart axes, labels, and
controls must not create page-level horizontal overflow. Long dataset names,
citations, part-of-speech labels, and word forms wrap rather than being hidden.

## States and interaction contract

| State | Visitor-facing behaviour | Required visual treatment |
| --- | --- | --- |
| Loading | “Kraunamas duomenų katalogas…” or “Kraunamas duomenų rinkinys…” is announced. | Reserve the content area; do not show zero-value metrics or an empty table as if they were data. |
| Loaded, unfiltered | Default frequency-descending scope is visible. | Put result count, dataset identity, and source units above charts and rows. |
| Filtering/search pending | “Atnaujinami rezultatai…” is announced. | Keep the last stable result visible until the 150 ms query debounce completes; do not imply it is the new result. |
| Empty result | “Nėra žodžių, atitinkančių aktyvius filtrus.” | Keep the query/filter state and offer the reset adjacent to it. |
| Data-load error | Explain that the selected data could not load. | Use an alert with a recovery action: select again or reload. Do not expose a raw parsing stack trace. |
| Long label / narrow viewport | Labels and citations remain available. | Wrap prose and control labels; preserve a contained scroll fallback only for tables. |

Interaction rules:

- Dataset selection resets search, filters, sort, and page because those states
  describe the former dataset, not the new one.
- Search, part-of-speech filter, headline metrics, charts, table, and CSV all
  describe the same active result set. The rank used by charts is recalculated
  within that filtered set.
- A sort changes the table and CSV order. It does not change the frequency
  ranking used by charts unless a chart control explicitly says it does.
- Chart controls use visible labels and keyboard-native controls. Every chart
  has an accessible textual summary and a table equivalent.
- The CSV export includes its current query, types, sort order, dataset metadata,
  BOM, and deterministic filename. It is never presented as a new source file.

## Token and component baseline

The current app already has a compact visual language: dark canvas, warm yellow
ink, monospaced text, thin rules, and a small spacing scale. The next
implementation should consolidate—not replace—those tokens in `src/app.css` so
components do not independently hard-code the same values.

| Semantic token | Current baseline | Use | Applies first to |
| --- | --- | --- | --- |
| Canvas | `--bg-color: #222` | Page and quiet control surfaces. | `body`, selects, tables. |
| Ink / primary data mark | `--text-color: #FFBF00` | Text, focus ring, primary bar/line mark, and active control state. | headings, buttons, charts, table headers. |
| Quiet rule | `--border-color: #333333` | Section separation, data grouping, non-interactive table dividers. | dashboard sections, metric groups, cards. |
| Supporting ink | `color-mix(in srgb, var(--text-color) 72%, transparent)` | Descriptions, units, provenance context; never the only indicator of a state. | chart text and metadata. |
| Spacing | `--xs` through `--3xl` | One rhythm for controls, sections, and narrow-screen stacks. | all components. |
| Type | `monospace, "Courier New", Courier, sans-serif` | Data-oriented reading and aligned numbers. | whole app; use tabular numerals for metrics. |

| Reusable component | Existing implementation | Contract for the next slice |
| --- | --- | --- |
| Page shell | `src/app.css`, `src/routes/+layout.svelte` | Owns width, canvas, skip/focus treatment, footer, and public orientation. |
| Dataset identity | `DataLoader.svelte` | Groups title, source, licence, citation, and entry unit before exploration. |
| Scope controls | `SearchBar.svelte`, POS filters, clear button | Makes active query/types legible and gives one reset path. |
| Metrics | `FrequencyDashboard.svelte` | Shows only measures derived from the active result set, with units. |
| Charts | `FrequencyDashboard.svelte` | Uses a single primary mark colour, labels axes/units, preserves a table alternative, and documents logarithmic scales. |
| Results table | `DataTable.svelte` | Uses semantic headers, keyboard-sortable controls, numeric alignment, and a contained mobile overflow fallback. |
| Export | `DownloadButton.svelte` | Exports exactly the active, sorted scope and announces a normal browser download. |
| Status and error | loader/empty/error branches | Uses live regions for change, explicit text, and a visible recovery choice. |

Focus is a first-class state: every interactive element has a high-contrast
visible focus indicator that is not represented only by hover or colour change.
Buttons, selects, search, checkboxes, chart controls, table sort controls,
details summaries, and links retain native keyboard operation.

## Chart conventions and honest claims

- **Source scope appears before visual insight.** A chart belongs to the
  selected dataset and current filters, not to Lithuanian in general.
- **Counts retain their source unit.** Use “dažnumas” only where the source
  provides a frequency. Use “įrašai”, “žetonai”, “dokumentai”, “lemos”, or
  “žodžių formos” where those are the actual units.
- **Logarithmic axes are labelled as such** and have an adjacent text summary.
  They reveal distribution shape; they do not establish significance or a
  linguistic relationship.
- **Bars and coverage use a direct value label.** No colour-only legend or
  unexplained scale is necessary for a one-series view.
- **Charts never hide data access.** A table equivalent remains available, and
  the complete active result set is downloadable.
- **Comparison products preserve null.** A missing measurement is labelled
  “Neaptikta” (or the product's explicit equivalent), never rendered as zero.
- **No co-occurrence, association, or word-sketch claim** is shown for a flat
  frequency list. The proposed expansion is tracked in
  [issue #31](https://github.com/debesyla/dazniausi-zodziai/issues/31).

## Ordered implementation slices

1. **Foundation:** consolidate the existing visual tokens and focus styles in
   `src/app.css`; remove repeated component-local hard-coded values; preserve
   current contrast and native controls.
2. **Public entry:** add the short orientation, methodology route, canonical
   metadata, and share preview defined by issue #32. Keep the dataset selector
   and first search control above the fold at practical widths.
3. **Dataset and scope:** reshape `DataLoader.svelte` so source identity and
   active filters read as one coherent scope before the dashboard.
4. **Metrics, charts, and table:** apply the component contracts above,
   including contained mobile table overflow and consistent focus states.
5. **Evidence:** run the browser/keyboard/mobile matrix in issue #34, document
   any exception, then use the release gate in issue #37.

Each slice is independently reviewable. A visual revision is not accepted just
because it looks different: it must make source scope, active scope, and a
visitor's next action easier to understand.
