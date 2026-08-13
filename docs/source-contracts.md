# Source contracts and public data products

The machine-readable inventory in
[`data/contracts/deferred-sources.json`](../data/contracts/deferred-sources.json)
is the provenance boundary for the larger and non-generic collections. It
records content-bound source artifact IDs, byte counts, checksums,
row-level shape, representative samples, metric meaning, and public-delivery
constraints. [`data/products/publication-plan.json`](../data/products/publication-plan.json)
turns those reviewed contracts into public JSON manifests, indexes, and chunks.

Verify the checked-in contract against the raw-data repository with:

```bash
npm run source:verify -- --source-root /path/to/reviewed-source-root
```

The verifier rejects absent or ambiguous content matches, symbolic links,
changed bytes, invalid UTF-8, wrong row/column counts, invalid numeric values,
unexpected coverage codes, changed totals, changed null counts, or missing
representative samples. This keeps every conversion reproducible without
copying the raw source repository into the application source tree.

## Contract decisions

| Contract | Decision | What it can support | Publication gate |
| --- | --- | --- | --- |
| `utka-ccll-wordforms` | Published chunked JSON and bounded genre profile | Wordform token counts for the aggregate and five named subcorpora; exact-form comparison across the five named subcorpora | Static manifest, source-order index, bounded chunks, and a compact routed lookup that excludes the aggregate |
| `dadurkevicius-dml6-vs-jcl-comparison` | Published chunked comparison JSON and coverage profile | JCL token counts, DML6 coverage categories, lemma/POS occurrences, missing types, and form/token shares by six transparent frequency bands | Three separate views plus a compact, checksum-described profile with on-demand bounded examples |
| `utka-ccll2-war-ukraine-comparison` | Published chunked comparison JSON | Six normalized token/document metrics across three source collections | Null-preserving view with source denominators in every field definition |
| `kapociute-dzikiene-2017-parliament-frequency-aggregates` | Published chunked frequency JSON | Corpus-wide legislative-speech wordform and lemma totals | Two separate aggregate-only views; the [disclosure policy](parliament-disclosure-policy.md) and full-artifact verifier reject raw text, document, time, and person-level structure |
| `vssa-2026-blkt-wordform-profile` | Published privacy-safe chunked comparison JSON | Exact normalized wordform counts, document support, and per-million rates for the corpus plus eligible document-type and period families | Owner-confirmed project-specific publication permission; verified NewGenLTU and CC BY-SA source inventories; both full licence texts, both attributions, and a modification notice; thresholded aggregate rows only; exact bounded lookup; no raw text, identity fields, subtypes, or crossed dimensions; explicit warning that media and document texts dominate BLKT |
| `bielinskiene-2019-delfi-1grams` | Published chunked frequency JSON | Every raw CSV one-gram and its raw count | CSV quoting, header handling, and integer-valued scientific notation are verified before chunking |
| `rimkute-2024-matas-v3-frequencies` | Published chunked derived-frequency JSON | Non-punctuation MATAS lemma/POS and wordform/POS frequencies | The reviewed ZIP is checksummed; the single CoNLL-U member is selected during a verified build, and derivation totals and record counts are pinned per view |
| `zemriete-2025-lithuanian-homoforms` | Published chunked lexical JSON | Homoform, lemma, morphology, two separate MATAS-related counts, and type/subtype | The reviewed artifacts are checksummed; source order is retained because it is not a consistent frequency order |
| `raskinis-2025-foreign-name-transliterations` | Published chunked lexical JSON | Source left and parenthesized name strings plus a source match count | Every one of 68,167 source lines must match the reviewed pair grammar; source string direction and documented noise remain literal |
| `birvinskaite-2026-lithuanian-basketball-slang` | Published chunked lexical JSON | Entry, source, senses, definitions, examples, variants, user groups, and compilers | The reviewed artifacts are checksummed; parser totals pin 223 entries despite the record page's 233-entry claim |
| `rimkute-2019-alksnis-syntactic-context` | Published prefix-chunked syntax-context JSON | ALKSNIS dependency-relation and genre totals, non-punctuation lemmas, and bounded sentence contexts | The reviewed ZIP and canonical sorted-member hash are pinned; source sentence-count discrepancy, root rows, punctuation exclusion, direction, and context cap are explicit |
| `rimkute-morphemic-dictionary` | Published chunked lexical JSON | Source wordform, corpus-scoped frequency, literal morphemic analysis, combined lemma-and-morphology text, volume, and printed page | The three PDF checksums, deterministic canonical TSV, extraction summary, row count, total frequency, and representative samples are pinned; owner-confirmed rightsholder permission, attribution, and modification notices accompany the complete derivative |

The comparison contracts deliberately have no generic `frequency` field. A
coverage code is categorical, document counts are not token counts, and a
normalized count cannot be compared with a raw count without its denominator.
Missing source metrics remain `null`; they are not converted to zero.

## Rimkutė morphemic-dictionary boundary

On 2026-08-13 the project owner confirmed rightsholder permission for
deterministic extraction and correction of the three 2011 dictionary PDFs,
publication and redistribution of the complete derived dataset and its
statistics, and downstream reuse with normal attribution. The public metadata
records the permission scope and date but does not publish private
correspondence.

The canonical source-order TSV is the only row input to the web product. The
source contract pins that TSV and its extraction summary alongside all three
input PDF checksums. It retains duplicate wordforms, the literal morphemic
analysis, the source's combined lemma-and-morphology text, volume, and printed
page; it does not heuristically split alternative analyses. The public
manifest exposes the `pdf-coordinate-columns-v1` method, Python 3.12.13 and
Poppler `pdftotext` 26.05.0 runtime, per-volume and combined row/frequency
totals, representative samples, summary identity, citation, and a modification
notice. The compact notice is repeated on each independently downloadable
index and data chunk. The separate live Morfema database is neither an input
nor an implied snapshot of this product.

## BLKT exact-word profile boundary

The pinned public BLKT Parquet snapshot remains inside the non-public source
workspace during preparation. Its original NewGenLTU OpenRAIL-D v1.0 terms
still apply, and the project owner confirmed on 2026-08-02 that this
Lithuanian-word project has permission to publish BLKT-derived aggregate
results and datasets. The permission status is recorded in the derived-product
metadata; private correspondence is not published as evidence.
The public manifest and each selected-result download carry the official
licence URL, an aggregate-derivative modification notice, the BLKT attribution,
the language-technology/model-training field-of-use restriction, and the ban
on extracting, reconstructing, or publishing personal data. Redistributors
must retain those notices and restrictions.

The only public row key is a normalized wordform. Before tokenization, text is
NFC-normalized. A token is a maximal contiguous sequence of Unicode letters
(`\p{L}+`); hyphens, apostrophes, and digits are separators. Tokens use
DuckDB's simple Unicode lowercase mapping per code point and are NFC-normalized
again; the browser mirrors that mapping for exact queries. Forms longer than 64 Unicode code
points are excluded. The derived-token total for each scope, rather than the
source's `alpha_word_count`, is the denominator for the displayed per-million
rate.

The canonical build requires CPython 3.14 with Unicode data 16.0.0 and DuckDB
1.5.5. The companion source manifest is pinned by its own byte count and
SHA-256 before its 25 raw-file descriptors are trusted. Per-file partials are
versioned, checksum-verified, resumable, and kept in an owner-only private work
directory; processing time, configured memory, and private-work size are
reported as run diagnostics without making the canonical summary vary between
identical builds.

The public dimensions are deliberately limited to the whole corpus, five
broad document types (fiction, non-fiction, media, speech, and documents), and
four periods (1922–1940, 1941–1990, 1990–2004, and 2008–2026). The eleven
subtypes observed in the pinned snapshot are validated against their parent types during the build but
are not published. Type-by-period intersections are not built or exposed.

A corpus wordform is eligible only with at least 100 token occurrences in at
least 20 distinct document rows. Type and period cells use the same two
thresholds and an all-or-nothing family rule: if any positive sibling in a
family misses either threshold, every cell in that family is emitted as
`null`. Consequently a missing public result intentionally does not reveal
whether a word was absent or suppressed. The derived artifact contains no raw
text, excerpts, document rows, titles, authors, URLs, source identifiers,
publication dates, or personal data.

The view is sorted by normalized wordform. A compact exact-range root selects
one routing page, which selects one JSON data chunk; the root, routing page,
and data chunk are each at most 64 KiB. The browser performs an exact search in
that one data chunk. `/blkt-profilis` therefore does not preload or enumerate
the published word list and downloads only the selected answer as JSON.

## DML6 coverage profile delivery

The DML6/JCL comparison has a separate public profile for the question “how do
dictionary coverage categories change across JCL frequency bands?” It has six
contiguous bands from one occurrence to `1,000+`. Each band reports the number
of word forms and the JCL token mass for each labelled coverage category.
Those quantities are intentionally separate: a category's share of forms is
not necessarily its share of tokens.

The profile manifest is compact and contains no source rows. Selecting a
band/category fetches at most 50 precomputed examples, ordered by descending
JCL token count and then wordform. The coverage code is never summed,
averaged, or treated as a numeric ranking. The builder verifies the source-row
and token totals before generating the profile; the product verifier checks
every optional example file's checksum, byte budget, interval, category, and
order.

## CCLL delivery and explorer budget

The aggregate CCLL frequency list has 1,733,157 rows and 25,251,347 UTF-8
bytes. Its source already provides two useful orderings: frequency-descending
and alphabetical. The public product uses static chunked JSON; a visitor first
receives a compact catalog, then one manifest and view index, then only the
required chunks.

Any broader CCLL explorer added to `static/datasets/catalog.json` must meet
these budgets:

- Initial catalog metadata: at most 10 KiB.
- One requested CCLL JSON chunk: at most 64 KiB before transport compression.
- Main-thread rendered rows: at most 50, matching the current table contract.
- Interaction p95 after a search, sort, page, or rank request: at most 100 ms
  for the worker response and result handoff on the agreed test devices.
- Initial mobile dataset payload: at most 256 KiB; the aggregate is fetched
  only after the visitor selects it.

The current `/zanru-profilis` exact-form lookup is deliberately narrower than
that broader explorer. It joins only the five named subcorpus lists during the
verified build, records every source raw count and token denominator separately,
and exposes `null` for a wordform not observed in a source. Its profile
manifest, routing nodes, and lookup buckets are each bounded to 64 KiB; a
lookup requests only the route needed for the typed form and one packed bucket.
The selected bucket is parsed and scanned by a small browser worker. It has no
aggregate-plus-subcorpus calculation, ratio ranking, or universal genre
leaderboard.

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

## ALKSNIS syntactic-context views

ALKSNIS v3.0 is stored as its original public ZIP archive. The product builder
lists and sorts its 76 CoNLL-U members, hashes the member path-plus-bytes stream,
and parses integer-ID rows sentence by sentence. The contract pins 70,047
integer-ID rows, 57,156 non-punctuation rows, 3,642 delivered sentence IDs,
and 3,643 as the repository's stated count. It also pins 104 source relation
labels across all integer rows and 92 after the public punctuation exclusion.

For each retained token, the builder keeps the source relation and its
dependent/head direction. `HEAD=0` becomes an explicit `root` context with
`ROOT` values rather than a guessed head. A non-punctuation lemma index records
source token rows and its retained dependent/head/root roles. The sentence view
keeps at most 12 source-order contexts per lemma and is prefix-chunked so the
browser requests it only after a lemma has been selected. Source document,
genre, sentence ID, and sentence text remain attached to every published
context. These are source-scoped annotations, not cross-corpus frequency,
similarity, or statistical-significance claims.

## Updating a contract

1. Record the public source URL and a safe content-bound artifact ID.
2. Recompute every listed file’s bytes and SHA-256 from the raw source root.
3. Recheck row shape, totals, null counts, allowed values, and representative
   samples.
4. Update the visitor-facing metric and delivery rules before changing a public
   product configuration.
5. Run `npm run source:verify`, `npm run products:build`,
   `npm run products:verify`, `npm run public:verify`, and the full project verification suite.
