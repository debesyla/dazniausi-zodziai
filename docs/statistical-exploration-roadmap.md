# Statistical exploration roadmap

This is the implementation decision record for [issue #31](https://github.com/debesyla/dazniausi-zodziai/issues/31). It starts from what the reviewed public collections can actually measure, rather than choosing charts first and inventing meaning for the available fields.

## Decision summary

- Keep the existing frequency dashboard as the baseline for a single selected frequency list: rank, concentration, cumulative token coverage, and source-provided part-of-speech composition are already useful and reproducible.
- Build the next small analytical products from the two comparison collections, where a question, unit, and denominator are already explicit.
- Treat the CCLL subcorpora as a source-scoped normalized wordform-comparison product, not as six independent generic lists and never as an aggregate-plus-five total.
- Treat BLKT as an exact-word, privacy-thresholded profile: broad document types
  and broad periods are categorical scopes, not a browseable ranking or a
  continuous historical time series.
- MATAS can support sentence concordances and window-based co-occurrence after a dedicated derived product. It cannot support grammatical-relation word sketches from the reviewed archive.
- Do not add time-series charts, generic cross-corpus rankings, or analytical word clouds until the required data dimensions exist.

## Patterns worth borrowing — and their limits

| Pattern | What the reference establishes | Decision here |
| --- | --- | --- |
| Frequency, relative frequency, distribution, and linked table-to-context exploration | [Voyant's document terms](https://docs.voyant-tools.org/docs/tutorial-documentterms.html) distinguishes raw counts, relative frequency, and distribution; its [trends](https://docs.voyant-tools.org/docs/tutorial-trends.html) documentation cautions that a line can imply continuity where categories are discrete. | Use frequency, rank, coverage, and categorical frequency bands for a selected list. Use bars or a table for discrete corpus categories; reserve a line for genuinely ordered series such as rank or time. |
| Concordance | [Voyant contexts](https://docs.voyant-tools.org/docs/tutorial-contexts.html) requires a token's surrounding text and position, rather than a frequency table alone. | Add concordance only for a source that retains sentence text, order, and stable identifiers: MATAS after a separate context product is built. |
| Normalized historical frequency | [Google Books Ngram Viewer](https://books.google.com/ngrams/info) plots occurrences by year as a share of the corpus and documents that corpus releases and tagging can change results. | BLKT can compare an exact word across four reviewed broad period categories with separate denominators. Do not turn those discontinuous categories into an annual trend, interpolate missing years, or derive a time chart from another source's publication year. |
| Collocation comparison | [Sketch Engine word sketch difference](https://www.sketchengine.eu/guide/word-sketch-difference-compare-words/) compares collocates in grammatical relations. | Do not label window co-occurrence as a word sketch. The reviewed MATAS archive has sentence order but no populated dependency head or relation fields. |
| Word cloud | [Voyant Cirrus](https://docs.voyant-tools.org/docs/tutorial-cirrus.html) makes clear that it is a frequency-oriented orientation tool, not a precise positional or colour encoding. | Do not use a word cloud as an analytical result. A ranked, searchable table and an accessible bar chart are clearer and exportable. |

## Capability matrix

The table records the strongest safe claim for each collection. “No” means the required reviewed field is absent from the public product, not that the language phenomenon does not exist.

| Collection / public product | Published unit and measures | Segments or categories | Time | Context / relations | Safely supports now |
| --- | --- | --- | --- | --- | --- |
| Utka 2018 lemmatised totals | Lemma, source POS, raw token frequency | POS | No | No | Within-list rank, concentration, coverage, POS composition |
| JCL lemmas | Lemma, source POS, raw token frequency | POS | No | No | Within-list rank, concentration, coverage, POS composition |
| CCLL lemmatised list | Lemma, raw token frequency | None | No | No | Within-list rank, concentration, coverage |
| CCLL wordforms | Wordform, raw token frequency; aggregate plus five named subcorpora with pinned token totals | Fiction, non-fiction, administrative, periodicals, spoken | No | No | Exact-form genre profile with raw counts, `null` absence, separate denominators, and per-million rates; no universal genre leaderboard |
| DML6 vs JCL | JCL raw token counts; categorical DML6 coverage; separate lemma-occurrence and missing-type views | Coverage category and source POS where supplied | No | No | Dictionary-coverage profile by frequency band; high-frequency missing-type inspection |
| CCLL2 vs wartime media / social networks | Separate normalized token and document measures for three sources, each per 100 million source words; nulls retained | CCLL2, wartime media, social networks | No | No | Side-by-side source contrast for complete, sufficiently frequent rows |
| BLKT exact-word profile | Thresholded wordform token and document counts, with rates per million derived tokens | Whole corpus; five broad document types; four broad periods | Four categorical periods, not annual bins | No | Exact-form corpus/type/period comparison when every published cell passes the 100-token and 20-document safeguards; no ranking, subtype, or crossed-dimension claim |
| Delfi.lt 1-grams | Raw wordform token frequency, including punctuation and non-alphabetic forms | None | No | No | Within-list rank and concentration; not lemma or POS analysis |
| MATAS v3 derived frequencies | Derived lemma/POS and wordform/POS frequency views | Universal POS | No | Aggregate product: no. Reviewed source: sentence and document structure, but no syntactic relations | Within-list frequency/POS today; future concordance and window co-occurrence after a new derived product |
| Morphemic dictionary | Source wordform frequency with literal morphemic and combined lemma/morphology analyses | Dictionary part and grammatical descriptions in the retained source text | No | No | Source-scoped frequency and morphemic-structure exploration; retain duplicate rows and do not treat the PDF derivative as a live Morfema export |

### MATAS context audit

The reviewed MATAS archive contains 1,234 document identifiers, 45,761 paragraph identifiers, 144,026 sentence identifiers, and a matching `# text` comment for every sentence. Its 2,137,281 integer-ID token rows retain form, lemma, Universal POS, morphological features, and sentence order. This is sufficient to derive stable concordance snippets and token-window co-occurrence.

The same audit found zero populated `HEAD` values and zero populated `DEPREL` values across those 2,137,281 token rows. Therefore a grammatical-relation view, dependency tree, or a feature named “word sketch” would claim information that the source does not contain. A future MATAS feature must be named and explained as a sentence-context or window-co-occurrence tool.

## Ranked product concepts

The ranking accounts for public value, statistical clarity, delivery effort, and the data already published in static JSON. “Static feasible” means compatible with ordinary static hosting; it does not mean that all rows may be loaded on the main browser thread.

| Rank | Question and product | Measure and interaction | Static feasibility | Guardrails and decision |
| --- | --- | --- | --- | --- |
| 1 | **[DML6 coverage profile](https://github.com/debesyla/dazniausi-zodziai/issues/48).** Which high-frequency JCL wordforms are covered by the dictionary, and how does coverage change across frequency bands? | Precompute counts of types and JCL token mass in transparent bands (for example 1; 2–4; 5–9; 10–99; 100–999; 1,000+), split by the four labelled coverage categories. Let a visitor select a band/category and inspect an ordered sample. | High. A compact summary and a bounded drill-down index can be generated from the existing comparison view. | Coverage codes are categories, never a numeric scale. Show type share and token-mass share separately. Do not call a missing entry an error or proof that a word is not Lithuanian. |
| 2 | **[Wartime lexical contrast](https://github.com/debesyla/dazniausi-zodziai/issues/47).** For a searched word, how do its normalized token and document measures differ between CCLL2, wartime media, and social networks? | Three aligned bars or a compact table of the six existing measures, always labelled “per 100 million source words.” An optional log-ratio ranking may use only rows with observed positive token measures in both selected sources and a stated minimum-rate threshold. | Medium. The 2.26-million-row product needs a worker-backed search/index or a precomputed, bounded complete-case summary; the selected result remains a small static payload. | Preserve `null` as “not observed in this source”; never turn it into zero. Keep document and token measures separate. Do not attach a significance claim without document-level sampling information. |
| 3 | **CCLL genre profile.** For one exact wordform, how does its presence differ across fiction, non-fiction, administration, periodicals, and spoken language? | Join the five named subcorpus lists by wordform during the build, retain each raw count, derive each rate per million from its pinned token total, and show dispersion (how many named subcorpora contain the form). | Shipped as a compact routed lookup at `/zanru-profilis`; the existing aggregate is not a sixth genre. | Compare wordforms only, not lemmas. `null` stays “not observed”; preserve punctuation and case; show source totals and avoid interpreting rare forms as genre signals. No universal ranking or ratio leaderboard is produced. |
| 4 | **MATAS concordance and co-occurrence.** In which sentences does a lemma occur, and which lemmas occur within a stated window around it? | Return a sentence snippet with a stable sentence ID and highlight the matched token. Separately precompute window co-occurrence counts and an association score for terms above a documented frequency threshold. | Medium. Static sentence and occurrence indexes can be chunked by lemma; a search fetches only the relevant index and sentence chunks. | Preserve source sentence text and attribution under its licence. State window width, punctuation/stop-word policy, threshold, and association formula. Do not imply syntactic relationships or expose a dependency-word-sketch control. |
| Baseline, already shipped | **Frequency concentration and POS composition.** How concentrated is the active selected frequency list, and which source POS values account for its token mass? | Rank/frequency, cumulative coverage, top words, and source-labelled POS composition with table equivalents. | Already implemented for browser-selectable generic frequency datasets. | Keep analyses scoped to the active filtered list. Do not compare raw values between differently defined collections. |

## Data contracts required by the ranked concepts

The following contracts make the future work reproducible and prevent a visual layer from silently recoding source meaning.

### DML6 coverage profile contract

- Input: the existing `jcl-types-dml6-coverage` view, retaining `word`, `jclTokenCount`, and the labelled `dml6CoverageCode`.
- Derived records: `{ band, coverageCode, typeCount, tokenCount, typeShare, tokenShare }`, plus a bounded ordered drill-down per band/category.
- Invariants: category values remain `0`–`3` with their published labels; `tokenCount` sums JCL raw token counts; band boundaries and sort tie-breakers are stored in the manifest.
- Delivery: a small summary must load without any source chunks; a drill-down index/chunk must be fetched only after selection.

### Wartime contrast contract

- Input: the existing normalized comparison view with all six source fields and their source-token denominators.
- Derived complete-case record: `{ word, leftSource, rightSource, leftTokenRate, rightTokenRate, leftDocumentRate, rightDocumentRate, log2TokenRateRatio }` only when the two requested token fields are non-null and positive.
- Invariants: retain original fields and null counts in the provenance manifest; never generate a ratio for a null value; record the minimum-rate threshold, selected source pair, and log base.
- Delivery: create a bounded precomputed summary or a worker-searchable index. The explorer must not download all 2.26 million rows at load.

### CCLL genre profile contract

- Input: the five named CCLL wordform lists and their published token totals. The aggregate list is explicitly excluded from this join.
- Derived record: `[word, fictionRawCount|null, nonFictionRawCount|null, administrativeRawCount|null, periodicalsRawCount|null, spokenRawCount|null, observedGenres]`; the browser derives rates per million from the five published denominators only for the selected form.
- Invariants: normalization denominator comes from each named source file; the aggregate and alphabetical aggregate index are excluded; a missing wordform is `null`, not a generic source total or zero; repeated exact normalized forms are rejected within a source; punctuation and case are preserved.
- Delivery: a small profile manifest points to prefix-routing nodes and packed lookup buckets, each no larger than 64 KiB. A lookup loads only the needed route and one bucket; a small worker parses and scans that bucket, without preloading the joined list or exposing a ranked summary.

### MATAS context and co-occurrence contract

- Input: the pinned CC BY 4.0 MATAS CoNLL-U archive, including `newdoc`, `newpar`, `sent_id`, `# text`, and integer token rows.
- Sentence record: `{ documentId, paragraphId, sentenceId, text, tokens: [{ id, form, lemma, universalPos, features }] }`.
- Occurrence index: `{ lemma, sentenceId, tokenIds }`, stored separately from sentence content so a selected lemma fetches a small index first.
- Co-occurrence record: `{ lemma, neighbourLemma, windowTokens, occurrenceCount, associationScore, sourceTokenCount }` with the score formula, stop-word policy, punctuation policy, and minimum occurrence threshold written into the manifest.
- Invariants: do not publish `HEAD` or `DEPREL`-derived claims; keep exact source identifiers; preserve archive checksum and sentence/token counts; document whether multiword tokens and empty nodes are included.
- Delivery: sentence data and indexes are statically chunked by stable key. The UI renders a bounded result page, offers a table equivalent, and never preloads the corpus.

## Non-goals until new evidence exists

- **No time trend from proxy dates:** BLKT has four reviewed broad periods with
  per-period denominators, so they may be compared as labelled categories for
  one exact word. They do not support annual interpolation or a continuous
  trend, and a release date or publication year still cannot substitute for a
  token timestamp in any other product.
- **No generic “most different corpus” leaderboard:** lemma versus wordform, raw versus normalized counts, and unequal corpus definitions cannot be pooled into one meaningful rank.
- **No “representative Lithuanian” claim from BLKT:** media and document texts dominate its document and token composition, so its exact-word profiles describe this source collection rather than all Lithuanian language use.
- **No statistical significance badge:** the current public products lack a documented document-level sampling design needed for that claim.
- **No connection graph from frequency lists:** frequency alone has no co-occurrence edge. Connections require the MATAS context contract or another reviewed ordered-token source.

## Delivery sequence and acceptance checks

1. Build and review the [DML6 coverage profile](https://github.com/debesyla/dazniausi-zodziai/issues/48) first: it has the clearest semantics and smallest additional delivery footprint.
2. Add the [bounded wartime contrast explorer](https://github.com/debesyla/dazniausi-zodziai/issues/47) next, using only observed normalized rates and explicit comparison pair controls.
3. The CCLL exact-form genre contract is implemented; require a separate stability review before producing any genre ranking or ratio.
4. Approve the MATAS context contract before exposing sentence text, concordances, or co-occurrence.
5. For every new view, test its manifest invariants, a zero/`null` edge case, an accessible table equivalent, keyboard operation, mobile overflow, and the specified initial/interaction payload budget.

This order deliberately favours explainable questions over decorative charts. It also keeps each new feature independently publishable, reviewable, and reversible on a static site.
