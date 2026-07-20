# Dataset preparation

The application is a curated static catalog. Dataset imports are a rare maintainer task, not a browser upload feature.

## Build command

```bash
npm run data:build -- \
  --config data/datasets/example.json \
  --source-root /path/to/raw-sources \
  --output static/datasets/example.json \
  --catalog static/datasets/catalog.json
```

`--source-root` is intentionally explicit so no local machine path is committed to the repository. The configured source file must remain inside that directory.

The command accepts UTF-8 CSV and TSV input, handles a UTF-8 BOM and CRLF line endings, validates every frequency, and writes formatted JSON only after the full source has been accepted.

## Dataset configuration

```json
{
  "id": "utka-2018-lemmatized-totals",
  "title": "Utka 2018 Lithuanian Wordlist — Lemmatized totals",
  "author": "Andrius Utka",
  "year": 2018,
  "entryKind": "lemma",
  "duplicatePolicy": "keep",
  "input": {
    "path": "utka-2018/lemmatized_totals.csv",
    "delimiter": ",",
    "hasHeader": false,
    "columns": { "word": 0, "type": 1, "frequency": 2 }
  },
  "provenance": {
    "licence": "Confirm before publishing",
    "citation": "Source-specific citation"
  }
}
```

For input with headers, use the header names instead of numeric indexes:

```json
"columns": { "word": "lemma", "type": "pos", "frequency": "count" }
```

`entryKind` is either `lemma` or `wordform`. Choose `keep` to preserve all source entries, or `aggregate-word-type` only when repeated word-plus-POS rows should be summed. The generated summary reports the number of duplicate keys either way.

## Generated outputs

The generated dataset contains source metadata, provenance, validated word entries, and a summary of source rows, published entries, total frequency, and duplicate keys. When `--catalog` is supplied, it also upserts a compact catalog record suitable for loading before the full dataset.

Review the generated summary against the raw source before committing a newly published dataset.
