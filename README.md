# Dažniausi lietuviški žodžiai

A static SvelteKit application for exploring Lithuanian word-frequency lists.
It loads one catalog-selected dataset at a time, then offers filters, a
frequency dashboard, a paginated table, and a faithful CSV export.

The initial published dataset is Andrius Utka's 2018 lemmatised word list. Its
source licence and citation are shown in the app and preserved in the dataset
metadata.

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
npm run build
```

`npm run preview` serves the production build locally.

## Dataset maintenance

Datasets are prepared rarely by a maintainer, not uploaded through the public
app. The canonical schema, source configuration, validation rules, and command
are in [docs/data-preparation.md](docs/data-preparation.md).

```bash
npm run data:build -- --config data/datasets/utka-2018-lemmatized-totals.json --source-root /path/to/dazniausi-zodziai-sources --output static/datasets/utka-2018-lemmatized-totals.json --catalog static/datasets/catalog.json
```

Review provenance, licence, citation, summary totals, and the generated catalog
entry before committing a new dataset. The table's large-list strategy is
documented in [docs/scalable-exploration.md](docs/scalable-exploration.md).

## Deployment

GitHub Pages deploys automatically after a successful push to `main` through
`.github/workflows/deploy.yml`. Repository Settings → Pages must use **GitHub
Actions** as its source. Pull requests run the separate verification workflow
in `.github/workflows/verify.yml`.

## Analytics and privacy

The application contains no analytics, tracking script, referrer collection, or
browser-storage telemetry. The static host may still have its own operational
logs under its service terms.

## Licence

The application code is available under the [MIT License](LICENSE). Individual
datasets retain the licences and attribution recorded in their provenance;
those terms can differ from the code licence.
