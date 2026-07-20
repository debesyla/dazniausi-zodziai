# Dataset preparation

The application is a curated static catalog. Dataset imports are rare maintainer tasks, not a browser-upload feature. Review the source decision table in [source-catalog.md](source-catalog.md) before adding a configuration or public artifact.

## Build and verify

Build one reviewed dataset from an explicit local source root:

```bash
npm run data:build -- \
  --config data/datasets/dadurkevicius-2020-jcl-lemmas.json \
  --source-root /path/to/dazniausi-zodziai-sources \
  --output static/datasets/dadurkevicius-2020-jcl-lemmas.json \
  --catalog static/datasets/catalog.json
```

After building every configured dataset, compare each generated JSON file byte-for-byte with the committed public artifact:

```bash
npm run data:verify -- --source-root /path/to/dazniausi-zodziai-sources
```

`--source-root` is intentionally explicit so no local machine path is committed to the repository. The importer only accepts a relative input path that remains within that root after symbolic links are resolved.

## Dataset configuration

Every public dataset configuration must define its identity, field mapping, aggregation policy, source encoding and reviewed snapshot, visible provenance, expected summary, and manual samples.

```json
{
  "id": "example-2024-lemmas",
  "title": "Reviewed Lithuanian lemma list",
  "author": "Dataset author",
  "year": 2024,
  "entryKind": "lemma",
  "duplicatePolicy": "keep",
  "input": {
    "path": "collection/original/lemmas.tsv",
    "delimiter": "\t",
    "hasHeader": true,
    "encoding": "utf-8",
    "snapshot": {
      "repositoryUrl": "https://example.org/reviewed-source-repository",
      "revision": "reviewed-release-or-revision",
      "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    },
    "columns": { "word": "lemma", "type": "pos", "frequency": "count" }
  },
  "provenance": {
    "licence": "CC BY 4.0",
    "citation": "Source-specific citation",
    "sourceUrl": "https://example.org/source-record",
    "partOfSpeech": {
      "name": "Source POS scheme",
      "labels": { "N": "Noun", "V": "Verb" }
    }
  },
  "validation": {
    "summary": {
      "sourceRows": 2,
      "entryCount": 2,
      "totalFrequency": 15,
      "duplicateEntries": 0
    },
    "samples": [
      { "word": "pavyzdys", "type": "N", "frequency": 10 },
      { "word": "būti", "type": "V", "frequency": 5 }
    ]
  }
}
```

For a source without part-of-speech data, omit both `input.columns.type` and `provenance.partOfSpeech`; samples then omit `type` as well.

`entryKind` is either `lemma` or `wordform`. Use `keep` to preserve every source row, or `aggregate-word-type` only when repeated word-plus-POS rows should be combined. `summary.duplicateEntries` always records the number of duplicate word-plus-type keys found in the source, even when an aggregation policy collapses those published rows.

## Import validation

The importer rejects a build when any of these checks fail:

- the source path is absolute, escapes the supplied root, or escapes it through a symbolic link;
- the raw source bytes do not match the configured SHA-256 snapshot;
- UTF-8 decoding, headers, field mapping, quoting, words, or positive integer frequencies are invalid;
- a typed source has missing, unmapped, or unused POS labels;
- the generated source-row count, published-entry count, total frequency, duplicate-key count, or reviewed representative sample differs from the configuration.

The generated dataset preserves `sourceSnapshot` in its public provenance: repository URL, revision, relative path, encoding, and SHA-256. The browser validates this metadata alongside every word entry and its summary before showing a dataset.

## Catalog behavior

When `--catalog` is supplied, the importer upserts a compact catalog record. The catalog’s `defaultDatasetId` is preserved so adding an alphabetically earlier title does not silently change the dataset selected on first visit. Review the visible licence, citation, source URL, summary totals, and generated catalog entry before committing.
