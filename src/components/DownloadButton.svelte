<script lang="ts">
  import pkg from 'papaparse';
  import { t } from '$lib/translations';
  const { unparse } = pkg;

  let { words, metadata }: { words: { word: string; type?: string; frequency: number }[]; metadata: { author: string; year: number } } = $props();

  function downloadCSV() {
    const csvData = [
      [t('author'), metadata.author],
      [t('year'), metadata.year],
      [], // blank line
      [t('word'), t('type'), t('frequency')],
      ...words.map(w => [w.word, w.type || '', w.frequency])
    ];

    const csv = unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'words.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<button onclick={downloadCSV}>{t('downloadData')}</button>

<style>
  button {
    background-color: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    padding: 0.5rem;
    cursor: pointer;
  }
  button:hover {
    background-color: #111;
  }
</style>