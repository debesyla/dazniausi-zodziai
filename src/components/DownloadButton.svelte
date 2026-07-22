<script lang="ts">
  import pkg from 'papaparse';
  import type { WordSortKey } from '$lib/utils';
  import { t } from '$lib/translations';
  const { unparse } = pkg;
  // Keep the Blob URL alive long enough for the browser to start its native
  // download. Revoking it in the same task can cancel downloads in browsers
  // that resolve the link asynchronously.
  const BLOB_URL_REVOKE_DELAY_MS = 1_000;

  interface Word {
    word: string;
    type?: string;
    frequency: number;
  }

  interface ExportMetadata {
    id: string;
    title: string;
    author: string;
    year: number;
  }

  interface ExplorationState {
    query: string;
    types: string[];
    sortKey: WordSortKey;
    sortAsc: boolean;
  }

  let { words, metadata, exploration }: {
    words: Word[];
    metadata: ExportMetadata;
    exploration: ExplorationState;
  } = $props();

  function exportDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function filename(id: string, date: string) {
    return `${id.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-${date}.csv`;
  }

  function sortDescription({ sortKey, sortAsc }: ExplorationState) {
    const label = sortKey === 'word' ? t('word') : sortKey === 'frequency' ? t('frequency') : t('type');
    return `${label} (${sortAsc ? t('ascending') : t('descending')})`;
  }

  function downloadCSV() {
    const date = exportDate();
    const metadataLines = [
      `# Dataset ID: ${metadata.id}`,
      `# Dataset: ${metadata.title}`,
      `# ${t('author')}: ${metadata.author}`,
      `# ${t('year')}: ${metadata.year}`,
      `# ${t('exported')}: ${date}`,
      `# ${t('query')}: ${exploration.query || t('all')}`,
      `# ${t('types')}: ${exploration.types.length ? exploration.types.join(', ') : t('all')}`,
      `# ${t('sortOrder')}: ${sortDescription(exploration)}`
    ];
    const rows = words.map((word) => [word.word, word.type ?? '', word.frequency]);
    const csv = `\ufeff${metadataLines.join('\r\n')}\r\n${unparse({
      fields: [t('word'), t('type'), t('frequency')],
      data: rows
    }, { newline: '\r\n' })}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename(metadata.id, date);
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_REVOKE_DELAY_MS);
  }
</script>

<button onclick={downloadCSV}>{t('downloadData')}</button>

<style>
  button {
    background: transparent;
    border: 1px solid #FFBF00;
    color: #FFBF00;
    padding: var(--xs) var(--sm);
    cursor: pointer;
    user-select: none;
  }
  button:hover {
    background: #FFBF00;
    color: #222;
  }
</style>
