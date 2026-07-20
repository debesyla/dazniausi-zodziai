# Deferred source contracts

The machine-readable inventory in
[`data/contracts/deferred-sources.json`](../data/contracts/deferred-sources.json)
is the implementation boundary for collections that are not yet in the public
catalog. It records the source revision, exact input files, byte counts,
checksums, row-level shape, representative samples, metric meaning, and the
delivery constraints that must be satisfied before publication.

Verify the checked-in contract against the raw-data repository with:

```bash
npm run source:verify -- --source-root /path/to/dazniausi-zodziai-sources
```

The verifier rejects changed bytes, path traversal, symlinks that leave the
source root, invalid UTF-8, wrong row/column counts, invalid numeric values,
unexpected coverage codes, changed totals, changed null counts, or missing
representative samples. This keeps a future conversion reproducible without
copying the raw source repository into the web application.

## Contract decisions

| Contract | Decision | What it can support | Publication gate |
| --- | --- | --- | --- |
| `utka-ccll-wordforms` | Deferred | Wordform token counts for the aggregate and five named subcorpora | Issue #31 capability review, indexed worker delivery, and the budgets below |
| `dadurkevicius-dml6-vs-jcl-comparison` | Reshape | JCL token counts, DML6 coverage categories, lemma/POS occurrences, and missing types | A comparison view with separate metric fields and labels |
| `utka-ccll2-war-ukraine-comparison` | Reshape | Six normalized token/document metrics across three source collections | Null-preserving comparison view with source denominators visible |
| `rimkute-morphemic-dictionary` | No-go | No approved machine-readable rows | Reviewed machine-readable source and reuse terms |

The comparison contracts deliberately have no generic `frequency` field. A
coverage code is categorical, document counts are not token counts, and a
normalized count cannot be compared with a raw count without its denominator.
Missing source metrics remain `null`; they are not converted to zero.

## CCLL delivery budget

The aggregate CCLL frequency list has 1,733,157 rows and 25,251,347 UTF-8
bytes. Its source already provides two useful orderings: frequency-descending
and alphabetical. The contract therefore targets a static indexed worker
transport rather than loading the complete file into the page’s main thread.

Before the source can enter `static/datasets/catalog.json`, the implementation
must meet these budgets:

- Initial catalog metadata: at most 10 KiB.
- One requested worker chunk: at most 64 KiB before transport compression.
- Main-thread rendered rows: at most 50, matching the current table contract.
- Interaction p95 after a search, sort, page, or rank request: at most 100 ms
  for the worker response and result handoff on the agreed test devices.
- Initial mobile dataset payload: at most 256 KiB; the aggregate is fetched
  only after the visitor selects it.

The worker owns chunk parsing, search, ordering, ranking, pagination, and CSV
streaming. The UI receives only bounded pages and explicit result metadata.
The aggregate must never be added to the five subcorpus totals: the aggregate
is a view of the complete corpus, not a sixth independent subcorpus.

The budgets are a publication gate, not a claim that the current app already
meets them. The implementation slice is intentionally sequenced after issue
#31’s capability review.

## Updating a contract

1. Record the reviewed source revision and source URL.
2. Recompute every listed file’s bytes and SHA-256 from the raw source root.
3. Recheck row shape, totals, null counts, allowed values, and representative
   samples.
4. Update the visitor-facing metric and delivery rules before adding a public
   dataset configuration.
5. Run `npm run source:verify` and the full project verification suite.
