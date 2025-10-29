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