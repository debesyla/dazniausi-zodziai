# Scalable table exploration

The table intentionally renders **at most 50 rows**. Pagination is applied
after filtering and sorting, so the exported file and frequency dashboard still
represent the complete active result set while the browser only creates DOM for
the page being inspected.

## Interaction path

1. Dataset selection fetches one selected word-list file; the compact catalog
   does not preload every source.
2. Text search waits 150 ms after the most recent keystroke before filtering,
   allowing the input to paint rather than recalculating on each keypress.
3. The active result is ranked by descending frequency, then sorted using the
   selected table column. The rank stays tied to the active result's frequency
   order even when the table is sorted alphabetically or by POS.
4. The pager slices exactly 50 rows for rendering. Any filter, search, sort, or
   dataset change returns to page one and reports the visible range.

## CCLL-scale datasets

This strategy keeps the rendered DOM constant for a list such as CCLL (over
1.7 million rows): a page remains 50 rows, not 1.7 million table rows. The
catalog-first loader also ensures such a dataset is fetched only when selected.

The current generic explorer still keeps the selected file in browser memory.
The 15.2-million-row raw CCLL wordform list and the 1,030,562-row Delfi.lt
one-gram list are already published as compact, pre-indexed JSON chunks; neither
is selectable in that explorer. The separate 142,228-row CCLL lemma list is
small enough for the browser catalog. Before adding either larger list to the
explorer, move filtering and sorting to a web worker or server-side page
endpoint. Pagination, rank semantics, result counts, and CSV export are
deliberately independent of that future transport, so the UI contract does not
need to change.
