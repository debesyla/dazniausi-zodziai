# Browser release acceptance

`npm run test:browser` starts a fresh production build and tests the visitor
journey against it. It does not reuse a development server. The Playwright
matrix covers:

| Project | Browser engine | Viewport |
| --- | --- | --- |
| `chromium-desktop` | Chromium | Desktop Chrome profile |
| `firefox-desktop` | Firefox | Desktop Firefox profile |
| `webkit-desktop` | WebKit | Desktop Safari profile |
| `chromium-mobile` | Chromium | Pixel 5 profile |
| `firefox-mobile` | Firefox | 393 × 852 touch viewport |
| `webkit-mobile` | WebKit | iPhone 13 profile |

The automated journey uses a controlled catalog and dataset fixture so it can
reliably prove catalog/data loading, search, POS filter, sorting, pagination,
dashboard control change, table-equivalent disclosure, reset, keyboard sort,
CSV download, console health, first-party request health, page-level overflow,
and mobile touch-target dimensions. Failure screenshots, traces, videos, and
reports are uploaded from CI when present.

## Local and deployed runs

Install the browser matrix once per machine:

```bash
npx playwright install chromium firefox webkit
npm run test:browser
```

For release sign-off against GitHub Pages, supply the fully qualified deployed
base URL, including its trailing project path and slash:

```bash
PLAYWRIGHT_BASE_URL=https://debesyla.github.io/dazniausi-zodziai/ npm run test:browser:deployed
```

The deployed run uses the same controlled dataset routes, while exercising the
deployed application shell, base path, static assets, and browser behavior.

## Manual release record

Before the release decision, a maintainer records the deployed commit, date,
browser-test workflow URL, and a short manual assistive-technology smoke check:

- navigate landmarks, dataset selector, search, POS controls, table sorting,
  pagination, chart table equivalents, and download with a keyboard;
- confirm focus is visible and logical, and no control traps focus;
- with one current screen reader/browser pairing, confirm the page title,
  result count, filter state, chart labels, and table-equivalent summaries are
  understandable;
- inspect the deployed page at a narrow viewport for page-level horizontal
  overflow and controls smaller than the documented 44 px target;
- record any browser-specific limitation and a safe user-facing fallback.

Automated fixtures do not replace a final review of the real deployed catalog,
source attribution, and licences. That review belongs in the release record.
