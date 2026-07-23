# Source contracts and public data products

The machine-readable inventory in
[`data/contracts/deferred-sources.json`](../data/contracts/deferred-sources.json)
is the provenance boundary for the larger and non-generic collections. It
records the source revision, exact input files, byte counts, checksums,
row-level shape, representative samples, metric meaning, and public-delivery
constraints. [`data/products/publication-plan.json`](../data/products/publication-plan.json)
turns those reviewed contracts into public JSON manifests, indexes, and chunks.

Verify the checked-in contract against the raw-data repository with:

```bash
npm run source:verify -- --source-root /path/to/dazniausi-zodziai-sources
```

The verifier rejects changed bytes, path traversal, symlinks that leave the
source root, invalid UTF-8, wrong row/column counts, invalid numeric values,
unexpected coverage codes, changed totals, changed null counts, or missing
representative samples. This keeps every conversion reproducible without
copying the raw source repository into the application source tree.

## Contract decisions

| Contract | Decision | What it can support | Publication gate |
| --- | --- | --- | --- |
| `utka-ccll-wordforms` | Published chunked JSON | Wordform token counts for the aggregate and five named subcorpora | Static manifest, source-order index, and bounded chunks; a future interactive explorer must still meet the budgets below |
| `dadurkevicius-dml6-vs-jcl-comparison` | Published chunked comparison JSON | JCL token counts, DML6 coverage categories, lemma/POS occurrences, and missing types | Three separate views with explicit fields and labels |
| `utka-ccll2-war-ukraine-comparison` | Published chunked comparison JSON | Six normalized token/document metrics across three source collections | Null-preserving view with source denominators in every field definition |
| `bielinskiene-2019-delfi-1grams` | Published chunked frequency JSON | Every raw CSV one-gram and its raw count | CSV quoting, header handling, and integer-valued scientific notation are verified before chunking |
| `rimkute-2024-matas-v3-frequencies` | Published chunked derived-frequency JSON | Non-punctuation MATAS lemma/POS and wordform/POS frequencies | The original ZIP and its CoNLL-U member are checksummed; derivation totals and record counts are pinned per view |
| `zemriete-2025-lithuanian-homoforms` | Published chunked lexical JSON | Homoform, lemma, morphology, two separate MATAS-related counts, and type/subtype | The original ZIP and 177,226-row TSV are checksummed; source order is retained because it is not a consistent frequency order |
| `raskinis-2025-foreign-name-transliterations` | Published chunked lexical JSON | Source left and parenthesized name strings plus a source match count | Every one of 68,167 source lines must match the reviewed pair grammar; source string direction and documented noise remain literal |
| `birvinskaite-2026-lithuanian-basketball-slang` | Published chunked lexical JSON | Entry, source, senses, definitions, examples, variants, user groups, and compilers | The original ZIP and 2,286-line NVH file are checksummed; parser totals pin 223 entries despite the record page's 233-entry claim |
| `rimkute-morphemic-dictionary` | Published metadata-only JSON | Citation and source-file inventory only | Licensable machine-readable source and reuse terms, tracked in [issue #41](https://github.com/debesyla/dazniausi-zodziai/issues/41) |

The comparison contracts deliberately have no generic `frequency` field. A
coverage code is categorical, document counts are not token counts, and a
normalized count cannot be compared with a raw count without its denominator.
Missing source metrics remain `null`; they are not converted to zero.

## CCLL delivery and future explorer budget

The aggregate CCLL frequency list has 1,733,157 rows and 25,251,347 UTF-8
bytes. Its source already provides two useful orderings: frequency-descending
and alphabetical. The public product uses static chunked JSON; a visitor first
receives a compact catalog, then one manifest and view index, then only the
required chunks.

Before a future CCLL explorer is added to `static/datasets/catalog.json`, its
implementation must meet these budgets:

- Initial catalog metadata: at most 10 KiB.
- One requested CCLL JSON chunk: at most 64 KiB before transport compression.
- Main-thread rendered rows: at most 50, matching the current table contract.
- Interaction p95 after a search, sort, page, or rank request: at most 100 ms
  for the worker response and result handoff on the agreed test devices.
- Initial mobile dataset payload: at most 256 KiB; the aggregate is fetched
  only after the visitor selects it.

The public JSON is deliberately not loaded into the current generic frequency
picker. A future worker owns chunk parsing, search, ordering, ranking,
pagination, and CSV streaming; its UI receives only bounded pages and explicit
result metadata. The aggregate must never be added to the five subcorpus
totals: the aggregate is a view of the complete corpus, not a sixth independent
subcorpus.

The budgets are an interactive-explorer gate, not a publication gate: the
source is already available in the public data-product catalog.

## Derived MATAS frequency views

MATAS v3.0 is stored as its original public ZIP archive. During the product
build, its UTF-8 CoNLL-U member is checksummed and parsed. Only integer-ID
rows participate; `UPOS=PUNCT` rows are excluded from word-frequency totals.
The builder aggregates the remaining rows by either source lemma or source
wordform plus Universal POS. A blank source POS is retained as
`UNSPECIFIED`, rather than silently dropping the token. The index marks the
count field as derived and pins the reviewed source-row, output-row, and total
counts for each view.

## Special lexical collections

The three special lexical products use `chunked-lexical-collection`, rather
than a generic frequency-list shape. Homoform rows preserve both the source's
MATAS total and its separate component count; neither is a site-wide rank.
Foreign-name pairs preserve the source's first and parenthesized strings, and
their match count is an extraction count from the cited news-source work—not a
general frequency measure or a spelling decision. The source itself documents
noise and inconsistent transliteration direction, so the build does not infer
either.

The basketball collection is parsed from NVH into structured JSON with a
single source object, one or more senses, and arrays for definitions, examples,
user groups, variants, and compilers. Blank source fields, blank sense labels,
and explicitly blank examples are emitted as JSON `null`; all supplied lexical
evidence is retained. It must never be ranked or labelled
as frequency data. Its catalogue page says 233 entries, but the retained NVH
file contains 223 top-level `entry` records; both numbers are pinned in the
public derivation metadata so the discrepancy is visible rather than hidden.

## Updating a contract

1. Record the reviewed source revision and source URL.
2. Recompute every listed file’s bytes and SHA-256 from the raw source root.
3. Recheck row shape, totals, null counts, allowed values, and representative
   samples.
4. Update the visitor-facing metric and delivery rules before changing a public
   product configuration.
5. Run `npm run source:verify`, `npm run products:build`,
   `npm run products:verify`, and the full project verification suite.
