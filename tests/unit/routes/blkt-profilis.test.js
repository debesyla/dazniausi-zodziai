import { render, waitFor } from '@testing-library/svelte/svelte5';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, vi } from 'vitest';

const dimension = (id, label, derivedTokens, documents) => ({
  id,
  label,
  tokenField: `${id.replaceAll('-', '')}TokenCount`,
  documentField: `${id.replaceAll('-', '')}DocumentCount`,
  sourceAlphaWords: derivedTokens + 100,
  derivedTokens,
  documents
});

const documentTypes = [
  dimension('fiction', 'Grožinė literatūra', 1_800, 200),
  dimension('non-fiction', 'Negrožinė literatūra', 1_800, 200),
  dimension('media', 'Žiniasklaida', 1_800, 200),
  dimension('speech', 'Sakytinė kalba', 1_800, 200),
  dimension('documents', 'Dokumentai', 1_800, 200)
];

const profile = {
  manifest: {
    id: 'vssa-2026-blkt-wordform-profile',
    provenance: {
      licence: 'Leidimas skelbti išvestinius duomenis',
      sourceUrl: 'https://example.test/blkt',
      citation: 'BLKT bandomoji citata.'
    }
  },
  metadata: {
    sourceScopeCaveat: 'BLKT is not representative of all Lithuanian language use: media and document texts dominate its document and token composition.',
    sourceLicences: {
      inventory: [
        { sourceLabel: 'NewGenLTU OpenRAIL-D', name: 'NewGenLTU OpenRAIL-D v1.0', url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', documents: 800, sourceAlphaWords: 8_000 },
        { sourceLabel: 'CC BY-SA 4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International', url: 'https://creativecommons.org/licenses/by-sa/4.0/', attribution: 'Wikipedia contributors (BLKT source_name: Vikipedija).', documents: 200, sourceAlphaWords: 2_000 }
      ],
      application: 'The combined aggregate retains the notices and conditions of both source licence groups.'
    },
    tokenizer: {
      id: 'blkt-unicode-letter-lower-v1',
      normalization: 'trim-nfc-lower',
      maximumCodePoints: 64,
      caseMapping: 'duckdb-simple-per-code-point'
    },
    disclosure: {
      minimumTokenCount: 100,
      minimumDocumentSupport: 20,
      familyRule: 'all-positive-siblings-must-pass-or-family-is-null'
    },
    permission: { status: 'confirmed-by-project-owner', confirmedOn: '2026-08-02' },
    exclusions: ['raw-text', 'document-rows', 'personal-data'],
    rate: { targetTokens: 1_000_000, unit: 'tokens per million derived tokens' },
    rights: {
      licences: [
        { id: 'newgenltu-openrail-d-v1.0', name: 'NewGenLTU OpenRAIL-D v1.0', url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', file: 'LICENSE-NewGenLTU-OpenRAIL-D-1.0.txt', sha256: 'a'.repeat(64) },
        { id: 'cc-by-sa-4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International', url: 'https://creativecommons.org/licenses/by-sa/4.0/', file: 'LICENSE-CC-BY-SA-4.0.txt', sha256: 'b'.repeat(64) }
      ],
      modificationNotice: 'MODIFIED FILE: Privacy-thresholded aggregate-only BLKT derivative.',
      attributionNotices: ['BLKT attribution.', 'Wikipedia contributors.'],
      downstreamRequirements: ['Retain both licence copies and attributions.']
    },
    corpus: dimension('corpus', 'Visas BLKT', 9_000, 1_000),
    documentTypes,
    periods: [
      dimension('1922-1940', '1922–1940', 2_250, 250),
      dimension('1941-1990', '1941–1990', 2_250, 250),
      dimension('1990-2004', '1990–2004', 2_250, 250),
      dimension('2008-2026', '2008–2026', 2_250, 250)
    ]
  },
  index: { summary: { recordCount: 12_345 } }
};

const result = {
  word: 'žodis',
  corpus: { ...profile.metadata.corpus, tokenCount: 1_000, documentCount: 200, ratePerMillion: 111_111.111 },
  documentTypes: documentTypes.map((item) => ({
    ...item,
    tokenCount: 200,
    documentCount: 40,
    ratePerMillion: 111_111.111
  })),
  periods: null
};

function collectObjectKeys(value, keys = []) {
  if (Array.isArray(value)) value.forEach((item) => collectObjectKeys(item, keys));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectObjectKeys(child, keys);
    }
  }
  return keys;
}

vi.mock('../../../src/lib/blkt-wordform-profile', () => ({
  loadBlktWordformProfile: vi.fn(),
  loadBlktLicenceTexts: vi.fn(),
  lookupBlktWordform: vi.fn()
}));

import { loadBlktLicenceTexts, loadBlktWordformProfile, lookupBlktWordform } from '../../../src/lib/blkt-wordform-profile';
import Page from '../../../src/routes/blkt-profilis/+page.svelte';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadBlktWordformProfile).mockResolvedValue(profile);
  vi.mocked(loadBlktLicenceTexts).mockResolvedValue([
    { ...profile.metadata.rights.licences[0], fullText: 'NewGenLTU openRAIL-D license\nAttachment A\n' },
    { ...profile.metadata.rights.licences[1], fullText: 'Attribution-ShareAlike 4.0 International\nSection 3 -- License Conditions.\n' }
  ]);
  vi.mocked(lookupBlktWordform).mockResolvedValue(result);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('submits from the keyboard and renders an accessible, denominator-aware result', async () => {
  const user = userEvent.setup();
  const { getAllByRole, getByLabelText, getByRole, getByText } = render(Page);

  expect(getByText('Kraunama BLKT profilio suvestinė…')).toBeInTheDocument();
  await waitFor(() => expect(getByRole('button', { name: 'Ieškoti BLKT' })).toBeInTheDocument());
  expect(getByText(/BLKT nėra reprezentatyvus visos lietuvių kalbos portretas/)).toBeInTheDocument();
  expect(getByText(/ne patvirtinti lietuviški ar taisyklingi žodžiai/)).toBeInTheDocument();
  expect(loadBlktWordformProfile).toHaveBeenCalledTimes(1);
  expect(lookupBlktWordform).not.toHaveBeenCalled();

  await user.type(getByLabelText('Viena žodžio forma'), '  ŽODIS  ');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(getByRole('heading', { name: 'žodis' })).toBeInTheDocument());
  expect(lookupBlktWordform).toHaveBeenCalledWith(profile, '  ŽODIS  ');
  expect(getAllByRole('table')).toHaveLength(2);
  expect(getByText('Šio žodžio laikotarpių pjūvis neskelbiamas. Viešas atsakymas neatskleidžia, kuri reikšmė nepasiekė saugos ribos.')).toBeInTheDocument();
  expect(getByRole('button', { name: 'Atsisiųsti šį atsakymą JSON' })).toBeInTheDocument();
  expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
});

it('downloads only the selected aggregate response as JSON', async () => {
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blkt-result');
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const realCreateElement = document.createElement.bind(document);
  const downloadLink = realCreateElement('a');
  const click = vi.spyOn(downloadLink, 'click').mockImplementation(() => {});
  vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => (
    tagName === 'a' ? downloadLink : realCreateElement(tagName, options)
  ));
  const user = userEvent.setup();
  const { getByLabelText, getByRole } = render(Page);

  await waitFor(() => expect(getByRole('button', { name: 'Ieškoti BLKT' })).toBeInTheDocument());
  await user.type(getByLabelText('Viena žodžio forma'), 'žodis');
  await user.keyboard('{Enter}');
  await waitFor(() => expect(getByRole('heading', { name: 'žodis' })).toBeInTheDocument());
  await user.click(getByRole('button', { name: 'Atsisiųsti šį atsakymą JSON' }));

  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(downloadLink.href).toBe('blob:blkt-result');
  expect(downloadLink.download).toBe('blkt-žodis.json');
  await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:blkt-result'));
  const blob = createObjectURL.mock.calls[0][0];
  expect(blob.type).toBe('application/json');
  const payload = JSON.parse(await blob.text());
  expect(payload).toMatchObject({
    schemaVersion: 1,
    productId: 'vssa-2026-blkt-wordform-profile',
    word: 'žodis',
    corpus: { tokenCount: 1_000, documentCount: 200 },
    periods: null,
    disclosure: { minimumTokenCount: 100, minimumDocumentSupport: 20 },
    tokenizer: { id: 'blkt-unicode-letter-lower-v1', normalization: 'trim-nfc-lower' },
    permission: { status: 'confirmed-by-project-owner', confirmedOn: '2026-08-02' },
    exclusions: ['raw-text', 'document-rows', 'personal-data'],
    sourceScopeCaveat: expect.stringMatching(/not representative/),
    sourceLicences: expect.objectContaining({ inventory: expect.arrayContaining([expect.objectContaining({ sourceLabel: 'CC BY-SA 4.0' })]) }),
    source: {
      url: 'https://example.test/blkt',
      rights: {
        licences: expect.arrayContaining([
          expect.objectContaining({ id: 'newgenltu-openrail-d-v1.0', fullText: expect.stringContaining('Attachment A') }),
          expect.objectContaining({ id: 'cc-by-sa-4.0', fullText: expect.stringContaining('License Conditions') })
        ])
      }
    }
  });
  for (const key of ['rawText', 'documentId', 'sourceId', 'author', 'title', 'excerpt', 'context']) {
    expect(collectObjectKeys(payload)).not.toContain(key);
  }
});

it('explains a no-result response without presenting it as a zero', async () => {
  vi.mocked(lookupBlktWordform).mockResolvedValueOnce(null);
  const user = userEvent.setup();
  const { getByLabelText, getByRole, getByText } = render(Page);

  await waitFor(() => expect(getByRole('button', { name: 'Ieškoti BLKT' })).toBeInTheDocument());
  await user.type(getByLabelText('Viena žodžio forma'), 'nerasta');
  await user.click(getByRole('button', { name: 'Ieškoti BLKT' }));

  await waitFor(() => expect(getByRole('heading', { name: 'Žodis paskelbtame profilyje nerastas' })).toBeInTheDocument());
  expect(getByText(/galėjo būti neaptiktas arba nepraeiti saugos slenksčio/i)).toBeInTheDocument();
  expect(getByText(/nereiškia, kad tokios raidžių sekos nėra BLKT/i)).toBeInTheDocument();
  expect((await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
});
