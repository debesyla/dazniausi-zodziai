# Public data products

Every maintained collection has a public JSON product. The compact catalog is
published at `data-products/catalog.json` on the site. It points to one
`manifest.json` per collection; a manifest then either points to the existing
generic dataset JSON or to a set of independently fetchable chunk indexes.

The generated files live under `static/data-products/` and are checked in with
the application. This keeps the GitHub Pages deployment self-contained: the
site publishes the exact reviewed JSON artifacts without requiring the raw
source at deploy time. The public manifests still preserve the reviewed raw
source revision, paths, checksums, source URL, licence, and citation.

## Build and verify

```bash
npm run products:build -- --source-root /path/to/dazniausi-zodziai-sources
npm run products:verify
```

`products:build` first runs the byte-level source-contract verifier. It then
replaces only `static/data-products/`, creates all manifests, view indexes, and
chunks, and keeps the raw source paths, checksums, source URL, licence, and
citation in public provenance. Stage the regenerated files when the reviewed
source changes. `products:verify` re-reads every generated JSON file, checks
every chunk checksum and byte size, validates every record shape, recomputes
totals and null counts, and confirms that metadata-only products do not contain
rows.

Use `--output`, `--static-root`, `--plan`, or `--contract` only for an isolated
review or test build. The normal command has no hard-coded local source path.

## Product shapes

| Product type | Data location | Row form | Meaning |
| --- | --- | --- | --- |
| `generic-frequency-dataset` | Existing `static/datasets/*.json` file | Objects with `word`, optional `type`, and `frequency` | Browser-selectable reviewed frequency datasets. |
| `chunked-wordform-list` | Manifest → view `index.json` → chunk files | Arrays; field order is declared in the index | Raw token counts for the CCLL aggregate or one named subcorpus. |
| `chunked-frequency-list` | Manifest → view `index.json` → chunk files | Arrays; field order is declared in the index | A complete raw frequency list too large for the browser selector, such as the Delfi.lt one-gram list. |
| `chunked-derived-frequency-list` | Manifest → view `index.json` → chunk files | Arrays; field order is declared in the index | A reproducible aggregation from an annotated source. Derived fields are explicitly marked in the index. |
| `chunked-syntactic-context` | Manifest → compact summaries, prefix-indexed lemma and context chunks | Arrays; field order and prefix selection are declared in each index | Source-scoped dependency relations and sentence contexts, where the browser fetches a lemma index and sentence examples only after a visitor asks for them. |
| `chunked-comparison` | Manifest → view `index.json` → chunk files | Arrays; field order is declared in the index | Comparison measures whose meaning cannot safely be represented by a generic frequency field. |
| `metadata-only` | Manifest only | No rows | Source inventory and publication decision for a collection whose rows cannot yet be redistributed. |

Each chunk is self-identifying JSON:

```json
{
  "schemaVersion": 1,
  "productId": "example",
  "viewId": "example-view",
  "chunk": 0,
  "records": [["word", 42]]
}
```

The corresponding index supplies field metadata, source-file snapshot, order,
row count, numeric totals, null counts, maximum chunk bytes, and a SHA-256
descriptor for every chunk. Consumers must use that field list instead of
assuming the second value is a generic frequency.

## Published collection coverage

- `utka-2018-lemmatized-totals`, `dadurkevicius-2020-jcl-lemmas`, and
  `petkevicius-2025-ccll-lemmas` remain complete direct JSON datasets.
- `utka-ccll-wordforms` has seven bounded JSON views: aggregate frequency and
  alphabetical orders plus five named subcorpora. The aggregate is never added
  to the subcorpora.
- `dadurkevicius-dml6-vs-jcl-comparison` has separate views for type coverage,
  lemma/POS occurrences, and types missing in DML6. Coverage codes are labelled
  categories, not counts.
- `utka-ccll2-war-ukraine-comparison` keeps all six normalized token/document
  metrics separate. Source absence is JSON `null`, not zero.
- `bielinskiene-2019-delfi-1grams` publishes all 1,030,562 raw one-gram rows
  in bounded chunks. Its counts are not lemma frequencies.
- `rimkute-2024-matas-v3-frequencies` derives separate lemma/POS and
  wordform/POS views from CoNLL-U. Punctuation is excluded and a missing
  source POS is labelled `UNSPECIFIED`.
- `rimkute-2019-alksnis-syntactic-context` publishes ALKSNIS v3.0 relation and
  genre totals, a complete non-punctuation lemma index, and capped source
  sentence contexts. It preserves dependency direction, relation, document,
  genre, and sentence identifier; it is not a general frequency ranking or a
  similarity product.
- `rimkute-morphemic-dictionary` has a metadata-only manifest. It deliberately
  contains neither PDF content nor extracted dictionary rows while
  [issue #41](https://github.com/debesyla/dazniausi-zodziai/issues/41) seeks a
  licensable machine-readable source.

The full public decision table is in [source-catalog.md](source-catalog.md),
and the fixed raw-source inventory is in
[source-contracts.md](source-contracts.md).

## ALKSNIS syntax-context delivery

ALKSNIS v3.0 is a small, manually reviewed syntactic treebank. Its product
starts with a compact manifest carrying corpus totals, relation/genre view
locations, the observed sentence-ID count, and the repository's different
sentence claim. The repository says 3,643 sentences; the delivered CoNLL-U
members contain 3,642 `sent_id` values. Both numbers remain visible rather
than being silently reconciled.

The relation and genre summaries are small static views. Lemma-index chunks
are selected by the first lower-cased source-lemma code point; sentence-context
chunks use the first three while small adjacent prefix groups are packed into
the same bounded file. A visitor therefore fetches neither the whole
treebank nor its context rows until they submit a lookup and choose a concrete
lemma. Every context row retains the selected lemma's role (`dependent`,
`head`, or `root`), the source relation label, both sides of the relation,
genre, source CoNLL-U document, source sentence identifier, and sentence text.

Punctuation (`UPOS=PUNCT`) is excluded from the public lemma index, relation
summary, and contexts. A source root stays explicit as `HEAD=0` / `ROOT`.
Contexts are capped at 12 per lemma in archive-member, sentence, and token
source order; the manifest declares how many otherwise eligible context rows
were omitted by that delivery limit. These choices make the feature navigable
without turning a finite source sample into unsupported claims about Lithuanian
syntax, synonymy, or genre significance.
