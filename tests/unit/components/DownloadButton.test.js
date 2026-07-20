import { fireEvent, render } from '@testing-library/svelte/svelte5';
import Papa from 'papaparse';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DownloadButton from '../../../src/components/DownloadButton.svelte';

describe('DownloadButton', () => {
  const metadata = {
    id: 'utka-2018-lemmatized-totals',
    title: 'Lemų sąrašas, su kableliu',
    author: 'Andrius Utka',
    year: 2018
  };
  const exploration = {
    query: 'ąžuolas',
    types: ['dkt', 'tikr. dkt'],
    sortKey: 'frequency',
    sortAsc: false
  };
  let createObjectURL;
  let revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T12:00:00Z'));
    createObjectURL = vi.fn(() => 'blob:test-download');
    revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders download button', () => {
    const { getByRole } = render(DownloadButton, {
      words: [],
      metadata,
      exploration
    });

    expect(getByRole('button')).toHaveTextContent('Atsisiųsti duomenis .csv formatu');
  });

  it('downloads a UTF-8 CSV with descriptive metadata, a safe filename, and the supplied sorted result set', async () => {
    const wordsInVisibleSortOrder = [
      { word: 'ąžuolas, paprastasis', type: 'dkt', frequency: 42 },
      { word: 'žemė', type: 'dkt', frequency: 11 }
    ];
    const { getByRole } = render(DownloadButton, {
      words: wordsInVisibleSortOrder,
      metadata,
      exploration
    });
    const realCreateElement = document.createElement.bind(document);
    const downloadLink = realCreateElement('a');
    const click = vi.spyOn(downloadLink, 'click').mockImplementation(() => {});
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      return tagName === 'a' ? downloadLink : realCreateElement(tagName, options);
    });

    await fireEvent.click(getByRole('button'));

    expect(createElement).toHaveBeenCalledWith('a');
    expect(click).toHaveBeenCalledOnce();
    expect(downloadLink.href).toBe('blob:test-download');
    expect(downloadLink.download).toBe('utka-2018-lemmatized-totals-2026-07-20.csv');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-download');

    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
    const csv = await blob.text();
    expect(csv).toContain('# Dataset ID: utka-2018-lemmatized-totals');
    expect(csv).toContain('# Paieška: ąžuolas');
    expect(csv).toContain('# Tipai: dkt, tikr. dkt');
    expect(csv).not.toContain('Filtruoti pagal tipą::');
    expect(csv).toContain('# Rikiavimas: Dažnumas (mažėjančia tvarka)');
    expect(csv.startsWith('\ufeff')).toBe(true);

    const parsed = Papa.parse(csv.slice(1), { comments: '#' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toEqual([
      ['Žodis', 'Tipas', 'Dažnumas'],
      ['ąžuolas, paprastasis', 'dkt', '42'],
      ['žemė', 'dkt', '11']
    ]);
  });
});
