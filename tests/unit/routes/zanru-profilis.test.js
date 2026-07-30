import { render, waitFor } from '@testing-library/svelte/svelte5';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, vi } from 'vitest';

const profile = {
  rate: { targetTokens: 1000000, unit: 'tokens per million source tokens' },
  sources: [
    { id: 'fiction', label: 'Grožinė literatūra', sourceTokens: 100 },
    { id: 'non-fiction', label: 'Negrožinė literatūra', sourceTokens: 200 },
    { id: 'administrative', label: 'Administraciniai tekstai', sourceTokens: 50 },
    { id: 'periodicals', label: 'Periodika', sourceTokens: 500 },
    { id: 'speech', label: 'Sakytinė kalba', sourceTokens: 10 }
  ],
  summary: { joinedWordforms: 1733157 },
  provenance: { licence: 'CC BY 4.0', sourceUrl: 'https://example.test/ccll', citation: 'Fixture citation' }
};

vi.mock('../../../src/lib/ccll-genre-profile', () => ({
  loadCcllGenreProfile: vi.fn(),
  lookupCcllGenreWord: vi.fn(),
  ratePerMillion: (loaded, result, sourceId) => {
    const source = loaded.sources.find((candidate) => candidate.id === sourceId);
    const rawCount = result.rawCounts[sourceId];
    return rawCount === null ? null : rawCount * loaded.rate.targetTokens / source.sourceTokens;
  }
}));

import { loadCcllGenreProfile, lookupCcllGenreWord } from '../../../src/lib/ccll-genre-profile';
import Page from '../../../src/routes/zanru-profilis/+page.svelte';

beforeEach(() => {
  vi.mocked(loadCcllGenreProfile).mockResolvedValue(profile);
  vi.mocked(lookupCcllGenreWord).mockResolvedValue({
    word: 'karas',
    rawCounts: { fiction: 2, 'non-fiction': null, administrative: 3, periodicals: 4, speech: 5 },
    observedGenres: 4
  });
});

it('loads only profile metadata initially and exposes a keyboard-operable, denominator-aware genre table', async () => {
  const user = userEvent.setup();
  const { getByText, getByLabelText, getByRole, getAllByText } = render(Page);

  expect(getByText('Kraunama žanrų profilio suvestinė…')).toBeInTheDocument();
  await waitFor(() => expect(getByRole('button', { name: 'Ieškoti žanruose' })).toBeInTheDocument());
  expect(loadCcllGenreProfile).toHaveBeenCalledTimes(1);
  expect(lookupCcllGenreWord).not.toHaveBeenCalled();

  await user.type(getByLabelText('Tiksli žodžio forma'), 'karas');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(getByRole('heading', { name: 'karas' })).toBeInTheDocument());
  expect(lookupCcllGenreWord).toHaveBeenCalledWith(profile, 'karas');
  expect(getByRole('table')).toBeInTheDocument();
  expect(getAllByText('Neaptikta')).toHaveLength(3);
  expect(getByText('100')).toBeInTheDocument();
  expect(getByRole('button', { name: 'Atsisiųsti šio atsakymo JSON' })).toBeInTheDocument();
  expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
});

it('makes a no-result lookup explicit instead of inventing a zero', async () => {
  vi.mocked(lookupCcllGenreWord).mockResolvedValueOnce(null);
  const user = userEvent.setup();
  const { getByLabelText, getByRole, getByText } = render(Page);

  await waitFor(() => expect(getByRole('button', { name: 'Ieškoti žanruose' })).toBeInTheDocument());
  await user.type(getByLabelText('Tiksli žodžio forma'), 'nerasta');
  await user.click(getByRole('button', { name: 'Ieškoti žanruose' }));

  await waitFor(() => expect(getByText('Forma nerasta')).toBeInTheDocument());
  expect(getByText(/nereiškia, kad jos nėra lietuvių kalboje/i)).toBeInTheDocument();
});
