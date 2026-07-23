# Dažniausi lietuviški žodžiai

A static SvelteKit application for exploring Lithuanian word-frequency lists.
It loads one catalog-selected dataset at a time, then offers filters, a
frequency dashboard, a paginated table, and a faithful CSV export.

The browser catalog includes reviewed Lithuanian lemma-frequency datasets. Their
source licences and citations are shown in the app and preserved in dataset
metadata; larger products are available through the public JSON catalog.

## What the app does

- Select a curated dataset from `static/datasets/catalog.json`.
- Inspect headline totals, top words, rank/frequency, cumulative coverage, and
  source-provided part-of-speech composition.
- Search, filter by part of speech, sort by word/frequency/type, and browse a
  50-row page at a time.
- Export the complete active filtered and sorted result set as UTF-8 CSV.

## Development

Requires Node.js 20 or newer.

```bash
npm ci
npm run dev
```

Run the same checks used for pull requests and GitHub Pages deployment:

```bash
npm run check
npm test
npx playwright install chromium firefox webkit # once per machine
npm run test:browser
npm run products:verify
npm run build
```

`npm run preview` serves the production build locally. The repeatable
browser-release matrix and deployed-site sign-off steps are in
[docs/browser-acceptance.md](docs/browser-acceptance.md).

## Dataset maintenance

Datasets are prepared rarely by a maintainer, not uploaded through the public
app. The canonical schema, source configuration, validation rules, and command
are in [docs/data-preparation.md](docs/data-preparation.md). The reviewed
decision for every maintained source collection is tracked in
[docs/source-catalog.md](docs/source-catalog.md).
Larger and non-generic collections have implementation-ready source contracts in
[docs/source-contracts.md](docs/source-contracts.md). The complete public JSON
delivery model is documented in [docs/data-products.md](docs/data-products.md).

```bash
npm run data:build -- --config data/datasets/utka-2018-lemmatized-totals.json --source-root /path/to/dazniausi-zodziai-sources --output static/datasets/utka-2018-lemmatized-totals.json --catalog static/datasets/catalog.json
npm run data:verify -- --source-root /path/to/dazniausi-zodziai-sources
npm run source:verify -- --source-root /path/to/dazniausi-zodziai-sources
npm run products:build -- --source-root /path/to/dazniausi-zodziai-sources
npm run products:verify
```

Review provenance, licence, citation, source snapshot, summary totals, and the
generated catalog entry before committing a new dataset. `products:build`
recreates the checked-in `static/data-products/` artifacts from the pinned
raw-source snapshot; stage those regenerated JSON files together with their
contract change. `products:verify` checks every generated manifest and chunk.
The table's large-list strategy is documented in [docs/scalable-exploration.md](docs/scalable-exploration.md).

## Deployment

GitHub Pages deploys automatically after a successful push to `main` through
`.github/workflows/deploy.yml`. Repository Settings → Pages must use **GitHub
Actions** as its source. Pull requests run the separate verification workflow
in `.github/workflows/verify.yml`. The checked-in public data products are
verified before each deployment and copied unchanged into the static site.
Maintainers rebuild them locally from raw source revision
`5aa69dd8df47c17b21e50ca4b41709159deb1bf0` before updating a product.

## Analytics and privacy

The application contains no analytics, tracking script, referrer collection, or
browser-storage telemetry. The static host may still have its own operational
logs under its service terms.

## Licence

The application code is available under the [MIT License](LICENSE). Individual
datasets retain the licences and attribution recorded in their provenance;
those terms can differ from the code licence.
