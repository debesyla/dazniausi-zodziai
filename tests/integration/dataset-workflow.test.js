import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, waitFor } from '@testing-library/svelte/svelte5';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from '../../src/routes/+page.svelte';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function provenance(labels) {
  return {
    licence: 'CC BY 4.0',
    citation: 'Test citation',
    sourceUrl: 'https://example.test/source',
    sourceSnapshot: {
      repositoryUrl: 'https://example.test/sources',
      revision: 'test-revision',
      path: 'source.tsv',
      encoding: 'utf-8',
      sha256: 'a'.repeat(64)
    },
    partOfSpeech: {
      name: 'Test POS',
      labels
    }
  };
}

const firstDataset = {
  schemaVersion: 1,
  id: 'first',
  title: 'Pirmas rinkinys',
  author: 'Pirmas autorius',
  year: 2024,
  entryKind: 'lemma',
  duplicatePolicy: 'keep',
  provenance: provenance({ noun: 'Noun', verb: 'Verb' }),
  summary: { sourceRows: 2, entryCount: 2, totalFrequency: 15, duplicateEntries: 0 },
  words: [
    { word: 'beta', type: 'noun', frequency: 10 },
    { word: 'alfa', type: 'verb', frequency: 5 }
  ]
};

const secondDataset = {
  schemaVersion: 1,
  id: 'second',
  title: 'Antras rinkinys',
  author: 'Antras autorius',
  year: 2023,
  entryKind: 'wordform',
  duplicatePolicy: 'keep',
  provenance: provenance({ adjective: 'Adjective' }),
  summary: { sourceRows: 1, entryCount: 1, totalFrequency: 20, duplicateEntries: 0 },
  words: [{ word: 'kitas', type: 'adjective', frequency: 20 }]
};

const workflowCatalog = {
  schemaVersion: 1,
  datasets: [
    { id: 'first', title: firstDataset.title, author: firstDataset.author, year: firstDataset.year, entryKind: firstDataset.entryKind, file: 'first.json', records: 2, totalFrequency: 15, hasPartOfSpeech: true, licence: null, citation: null },
    { id: 'second', title: secondDataset.title, author: secondDataset.author, year: secondDataset.year, entryKind: secondDataset.entryKind, file: 'second.json', records: 1, totalFrequency: 20, hasPartOfSpeech: true, licence: null, citation: null }
  ]
};

function jsonResponse(data) {
  return { ok: true, status: 200, statusText: 'OK', json: vi.fn().mockResolvedValue(data) };
}

function installDatasetFetch(resources) {
  vi.stubGlobal('fetch', vi.fn((url) => {
    const resource = Object.entries(resources).find(([suffix]) => String(url).endsWith(suffix));
    if (!resource) return Promise.resolve({ ok: false, status: 404, statusText: 'Not found', json: vi.fn() });
    return Promise.resolve(jsonResponse(resource[1]));
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dataset workflow integration', () => {
  it('uses actual components for selection, sorting, filter reset, export, and an empty search', async () => {
    installDatasetFetch({ 'catalog.json': workflowCatalog, 'first.json': firstDataset, 'second.json': secondDataset });
    const createObjectURL = vi.fn(() => 'blob:download');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const user = userEvent.setup();
    const { container, getByRole, getByText, queryByRole, queryByText } = render(Page);

    await waitFor(() => expect(getByRole('heading', { name: firstDataset.title })).toBeInTheDocument());
    expect(container.querySelector('.table-container tbody tr')).toHaveTextContent('beta');

    await user.click(getByRole('button', { name: 'Rikiuoti pagal Žodis: nerikiuota' }));
    await waitFor(() => expect(container.querySelector('.table-container tbody tr')).toHaveTextContent('alfa'));

    await user.click(getByRole('checkbox', { name: /Noun/ }));
    await waitFor(() => expect(getByRole('button', { name: 'Išvalyti filtrus' })).toBeInTheDocument());

    await user.selectOptions(getByRole('combobox', { name: 'Pasirinkite duomenis:' }), 'second');
    await waitFor(() => expect(getByRole('heading', { name: secondDataset.title })).toBeInTheDocument());
    expect(container.querySelector('.table-container tbody tr')).toHaveTextContent('kitas');
    expect(queryByRole('button', { name: 'Išvalyti filtrus' })).not.toBeInTheDocument();

    await user.click(getByRole('button', { name: 'Atsisiųsti duomenis .csv formatu' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    await user.type(getByRole('textbox'), 'nėra-tokio-žodžio');
    await waitFor(() => expect(getByText('Nėra žodžių, atitinkančių aktyvius filtrus.')).toBeInTheDocument());
    expect(queryByText('kitas')).not.toBeInTheDocument();
  });

  it('renders the actual published Utka dataset through the catalog-selected path', async () => {
    const catalog = JSON.parse(await readFile(path.join(repositoryRoot, 'static/datasets/catalog.json'), 'utf8'));
    const utka = JSON.parse(await readFile(path.join(repositoryRoot, 'static/datasets/utka-2018-lemmatized-totals.json'), 'utf8'));
    installDatasetFetch({ 'catalog.json': catalog, 'utka-2018-lemmatized-totals.json': utka });

    const { container, getByRole } = render(Page);

    await waitFor(() => expect(getByRole('heading', { name: utka.title })).toBeInTheDocument(), { timeout: 5_000 });
    expect(container.querySelectorAll('.table-container tbody tr')).toHaveLength(50);
    expect(container.querySelector('.dashboard')).toHaveTextContent(/922\s+949/);
  });
});
