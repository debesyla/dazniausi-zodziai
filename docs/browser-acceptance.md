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
and mobile touch-target dimensions. CI runs this matrix from a non-root
`/lietuviu-zodziai/` base path so absolute-navigation regressions cannot hide
behind a root deployment.

CI combines the GitHub annotation reporter with a complete HTML report. The
HTML report is a separately required artifact on green and failing browser
runs. Screenshots, traces, videos, and `test-results` are uploaded as optional
diagnostics when Playwright creates them. A missing HTML report makes the
required artifact step fail instead of silently leaving the release without
browser evidence.

## Local and hosted runs

Install the browser matrix once per machine:

```bash
npx playwright install chromium firefox webkit
npm run test:browser
```

For release sign-off against the chosen server, supply its fully qualified
public base URL, including a trailing subpath and slash when applicable:

```bash
PLAYWRIGHT_BASE_URL=https://zodziai.example.lt/lietuviu-zodziai/ npm run test:browser:deployed
```

The hosted run uses the same controlled dataset routes, while exercising the
published application shell, base path, static assets, and browser behavior.
All test navigation is relative to `PLAYWRIGHT_BASE_URL`, so a URL below a
hosting subpath remains below that subpath. The runner normalizes a missing
trailing slash, while the documented command keeps it explicit for clarity.

## Manual release record

Before the release decision, a maintainer records the published commit, date,
browser-test evidence, and a short manual assistive-technology smoke check:

- navigate landmarks, dataset selector, search, POS controls, table sorting,
  pagination, chart table equivalents, and download with a keyboard;
- confirm focus is visible and logical, and no control traps focus;
- with one current screen reader/browser pairing, confirm the page title,
  result count, filter state, chart labels, and table-equivalent summaries are
  understandable;
- inspect the hosted page at a narrow viewport for page-level horizontal
  overflow and controls smaller than the documented 44 px target;
- record any browser-specific limitation and a safe user-facing fallback.

Automated fixtures do not replace a final review of the real hosted catalog,
source attribution, and licences. That review belongs in the release record.
