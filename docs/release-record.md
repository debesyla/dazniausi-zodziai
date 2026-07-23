# Public-release record

Complete this record only after the final candidate is merged to `main` and its
GitHub Pages workflow has succeeded. It is evidence for the launch decision,
not a pre-merge checklist: leave a field blank rather than assuming a result.

The release gate is tracked in [issue #37](https://github.com/debesyla/dazniausi-zodziai/issues/37).
Use one copy of the template below for each public release candidate.

## Evidence commands

Run these from the deployed candidate commit. Keep the command output or link
to its workflow run with the record.

```bash
git rev-parse HEAD
git status --short
shasum -a 256 static/datasets/catalog.json static/data-products/catalog.json
npm run products:verify
PLAYWRIGHT_BASE_URL=https://debesyla.github.io/dazniausi-zodziai/ npm run test:browser:deployed
npm audit --omit=dev
npm audit
```

`npm audit` may contain a documented development-only upstream advisory. Record
the exact conclusion and issue link rather than silently treating a warning as
either a release blocker or a non-issue.

## Copyable record template

```md
# Public release: YYYY-MM-DD

## Decision

- Decision: GO / NO-GO
- Decision maker:
- Decision time and timezone:
- Rationale:
- Known limitations and safe visitor-facing fallbacks:

## Deployed candidate

- Main commit:
- GitHub Pages workflow URL:
- Deployed URL: https://debesyla.github.io/dazniausi-zodziai/
- Deployment inspection time and timezone:
- Rollback: revert the deployment commit on `main` and let GitHub Pages deploy
  the reverted commit. Record the revert commit and replacement workflow URL.

## Public data inventory

- Browser catalog SHA-256 (`static/datasets/catalog.json`):
- Data-product catalog SHA-256 (`static/data-products/catalog.json`):
- Browser dataset IDs, record counts, and licences reviewed:
- Data-product IDs, publication status, and manifest/checksum verification:
- Attribution, citations, and source links inspected on the deployed site:
- Deferred/no-go sources and rationale (including #41 if still unresolved):
- `npm run products:verify` result and evidence URL:

## Browser and accessibility evidence

- Production browser workflow URL:
- Deployed `test:browser:deployed` result:
- Browser matrix / viewport coverage:
- Console errors, failed first-party requests, and page-overflow result:
- CSV download result:
- Keyboard smoke check (landmarks, selector, search, POS controls, sorting,
  pagination, chart table equivalents, download):
- Screen-reader/browser pairing and result (title, result count, filter state,
  chart labels, table-equivalent summaries):
- Browser-specific limitation and fallback, if any:

## Security and privacy

- `npm audit --omit=dev` result:
- Full `npm audit` result and #29 conclusion:
- Confirmed no new analytics, tracking, external services, or browser-storage
  telemetry were introduced:

## Public release note

Describe what visitors can explore now, what data is available, and what is
intentionally not inferred. In particular, do not claim word relationships,
context, grammatical relations, or historical change from an independent flat
frequency list unless that product explicitly supplies the required evidence.
```

## Final review guidance

The browser matrix proves a controlled core journey; it does not replace a
review of the real deployed catalog. Verify the currently selected collection,
its visible attribution, its source URL, and its licence on the deployed page.
For all comparison products, confirm that their source-specific metrics and
null/absence conventions are still described as such rather than as ordinary
frequency totals.

Do not close the release-gate issue until the filled record contains a clear
go/no-go decision and every required item has linked evidence, an explicit
exception, or a maintainer-approved removal from scope.
