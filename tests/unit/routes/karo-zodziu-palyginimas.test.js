import { render, waitFor } from '@testing-library/svelte/svelte5';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import axe from 'axe-core';

const profile = {
  contrast: {
    minimumRate: 100,
    targetTokens: 100000000,
    pairs: [{ id: 'media-vs-ccll2', label: 'Media / CCLL2', numeratorSource: 'media', denominatorSource: 'ccll2' }]
  },
  delivery: { maxSourceRowsPerWord: 2 },
  sources: [
    { id: 'ccll2', label: 'CCLL2', tokenField: { normalization: { sourceTokens: 162000000 } } },
    { id: 'media', label: 'Karo žiniasklaida', tokenField: { normalization: { sourceTokens: 36000000 } } },
    { id: 'social', label: 'Socialiniai tinklai', tokenField: { normalization: { sourceTokens: 2000000 } } }
  ],
  summary: { uniqueNormalizedWordForms: 2264668 },
  provenance: { licence: 'CC BY 4.0', sourceUrl: 'https://example.test/source', citation: 'Fixture citation' }
};

vi.mock('../../../src/lib/war-contrast', () => ({
  contrastPair: (loaded, id) => loaded.contrast.pairs.find((pair) => pair.id === id) ?? null,
  loadWarContrastProfile: vi.fn(),
  logRatioForPair: vi.fn(() => 2),
  lookupWarContrastWord: vi.fn()
}));

import { loadWarContrastProfile, lookupWarContrastWord } from '../../../src/lib/war-contrast';
import Page from '../../../src/routes/karo-zodziu-palyginimas/+page.svelte';

beforeEach(() => {
  vi.mocked(loadWarContrastProfile).mockResolvedValue(profile);
  vi.mocked(lookupWarContrastWord).mockResolvedValue({
    word: 'KARAS',
    normalizedWord: 'KARAS',
    sourceRows: [12],
    metrics: {
      ccll2: { tokenCount: 200, documentCount: 50 },
      media: { tokenCount: 800, documentCount: 200 },
      social: { tokenCount: null, documentCount: null }
    }
  });
});

it('loads only the lookup profile initially and exposes a keyboard-operable comparison table', async () => {
  const user = userEvent.setup();
  const { getByText, getByLabelText, getByRole, getAllByRole, getAllByText } = render(Page);

  expect(getByText('Kraunama paieškos suvestinė…')).toBeInTheDocument();
  await waitFor(() => expect(getByRole('button', { name: 'Palyginti' })).toBeInTheDocument());
  expect(loadWarContrastProfile).toHaveBeenCalledTimes(1);
  expect(lookupWarContrastWord).not.toHaveBeenCalled();

  await user.type(getByLabelText('Žodžio forma'), 'karas');
  await user.click(getByRole('button', { name: 'Palyginti' }));

  await waitFor(() => expect(getByText('KARAS')).toBeInTheDocument());
  expect(lookupWarContrastWord).toHaveBeenCalledWith(profile, 'karas');
  expect(getAllByRole('table')).toHaveLength(1);
  expect(getAllByText('Neaptikta')).toHaveLength(2);
  expect(getByText('+2 log₂')).toBeInTheDocument();
  expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
});

it('makes the absent-data state explicit instead of presenting it as zero', async () => {
  vi.mocked(lookupWarContrastWord).mockResolvedValueOnce(null);
  const user = userEvent.setup();
  const { getByLabelText, getByRole, getByText } = render(Page);

  await waitFor(() => expect(getByRole('button', { name: 'Palyginti' })).toBeInTheDocument());
  await user.type(getByLabelText('Žodžio forma'), 'nerasta');
  await user.click(getByRole('button', { name: 'Palyginti' }));

  await waitFor(() => expect(getByText('Forma nerasta')).toBeInTheDocument());
  expect(getByText(/nereiškia, kad žodžio nėra lietuvių kalboje/i)).toBeInTheDocument();
});
