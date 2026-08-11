import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptPath = path.join(repositoryRoot, 'scripts', 'prepare-blkt-profile.py');
const temporaryDirectories = [];

const HEADER = [
  'word',
  'corpusTokenCount',
  'corpusDocumentCount',
  'typeGroTokenCount',
  'typeGroDocumentCount',
  'typeNegTokenCount',
  'typeNegDocumentCount',
  'typeZinTokenCount',
  'typeZinDocumentCount',
  'typeSakTokenCount',
  'typeSakDocumentCount',
  'typeDokTokenCount',
  'typeDokDocumentCount',
  'period1TokenCount',
  'period1DocumentCount',
  'period2TokenCount',
  'period2DocumentCount',
  'period3TokenCount',
  'period3DocumentCount',
  'period4TokenCount',
  'period4DocumentCount'
];

const TYPE_DEFINITIONS = [
  ['gro', 'fiction', 'Grožinė literatūra', 1_700_000, 800_000_000, 2_000],
  ['neg', 'non-fiction', 'Negrožinė literatūra', 1_700_000, 800_000_000, 2_000],
  ['zin', 'media', 'Žiniasklaida', 1_700_000, 800_000_000, 2_000],
  ['sak', 'speech', 'Sakytinė kalba', 1_700_000, 800_000_000, 2_000],
  ['dok', 'documents', 'Dokumentai', 1_638_155, 741_476_219, 2_000]
];

const PERIOD_DEFINITIONS = [
  ['1', '1922-1940', '1922–1940', 2_100_000, 1_000_000_000, 2_500],
  ['2', '1941-1990', '1941–1990', 2_100_000, 1_000_000_000, 2_500],
  ['3', '1990-2004', '1990–2004', 2_100_000, 1_000_000_000, 2_500],
  ['4', '2008-2026', '2008–2026', 2_138_155, 941_476_219, 2_500]
];

const TOKENIZER = {
  id: 'blkt-unicode-letter-lower-v1',
  engine: 'DuckDB 1.5.5',
  normalization: 'NFC before segmentation, DuckDB simple Unicode lowercase per code point, then NFC for each token',
  boundary: String.raw`A token is a maximal contiguous sequence matched by RE2 Unicode \p{L}+.`,
  hyphenPolicy: 'Hyphens and apostrophes are separators.',
  digitPolicy: 'Digits are separators.',
  length: { minimumCodePoints: 1, maximumCodePoints: 64 }
};

function findPythonRuntime() {
  const candidates = [
    process.env.BLKT_PROFILE_PYTHON,
    process.env.PYTHON,
    'python3.14',
    'python3'
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  const probe = [
    'import platform, sys, unicodedata',
    "print('|'.join((platform.python_implementation(), f'{sys.version_info.major}.{sys.version_info.minor}', unicodedata.unidata_version)))"
  ].join('; ');
  for (const executable of candidates) {
    const result = spawnSync(executable, ['-I', '-c', probe], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim() === 'CPython|3.14|16.0.0') {
      return executable;
    }
  }
  return null;
}

const pythonRuntime = findPythonRuntime();

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validRows() {
  return [
    [
      'kalba',
      1000,
      200,
      200,
      40,
      200,
      40,
      200,
      40,
      200,
      40,
      200,
      40,
      250,
      50,
      250,
      50,
      250,
      50,
      250,
      50
    ],
    ['žodis', 500, 100, ...Array(18).fill('')]
  ];
}

function encodeTsv(rows) {
  return Buffer.from(`${[HEADER, ...rows].map((row) => row.join('\t')).join('\n')}\n`, 'utf8');
}

function outputDescriptor(tsv) {
  const numericTotals = {
    corpusTokenCount: 1500,
    corpusDocumentCount: 300
  };
  const missingCounts = {
    corpusTokenCount: 0,
    corpusDocumentCount: 0
  };
  for (const field of HEADER.slice(3)) {
    const period = field.startsWith('period');
    numericTotals[field] = field.endsWith('TokenCount') ? (period ? 250 : 200) : (period ? 50 : 40);
    missingCounts[field] = 1;
  }
  return {
    file: 'wordform-profile.tsv',
    rows: 2,
    columns: 21,
    bytes: tsv.byteLength,
    sha256: sha256(tsv),
    numericTotals,
    missingCounts,
    publishedTypeFamilies: 1,
    publishedPeriodFamilies: 1
  };
}

function dimensionRecord([sourceCode, id, label, documents, sourceAlphaWords, derivedTokens]) {
  return { sourceCode, id, label, documents, sourceAlphaWords, derivedTokens };
}

function canonicalSummary(tsv) {
  return {
    schemaVersion: 1,
    id: 'vssa-blkt-privacy-safe-wordform-profile',
    source: {
      manifestId: 'vssa-2026-04-21-general-lithuanian-corpus',
      manifestBytes: 9040,
      manifestSha256: '573d57238f8ca82b43c5b5095d4fab286c03d1294d43c0279b2722e3f172650a',
      revision: '4fa6c3894fd9f1f9f8db773ae844e126fa61f61d',
      files: 25,
      bytes: 12_570_497_752,
      documents: 8_438_155,
      sourceAlphaWords: 3_941_476_219
    },
    permission: {
      status: 'confirmed-by-project-owner',
      confirmedOn: '2026-08-02',
      scope: 'Publication of BLKT-derived aggregate results and derived datasets for this Lithuanian word project.',
      privateCorrespondencePublished: false
    },
    sourceLicences: {
      inventory: [
        {
          sourceLabel: 'NewGenLTU OpenRAIL-D',
          name: 'NewGenLTU OpenRAIL-D v1.0',
          url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/',
          documents: 8_267_437,
          sourceAlphaWords: 3_906_734_476
        },
        {
          sourceLabel: 'CC BY-SA 4.0',
          name: 'Creative Commons Attribution-ShareAlike 4.0 International',
          url: 'https://creativecommons.org/licenses/by-sa/4.0/',
          attribution: 'Wikipedia contributors (BLKT source_name: Vikipedija).',
          documents: 170_718,
          sourceAlphaWords: 34_741_743
        }
      ],
      application: 'The combined aggregate retains the notices and conditions of both source licence groups.'
    },
    tokenizer: TOKENIZER,
    disclosure: {
      minimumTokenCount: 100,
      minimumDocumentSupport: 20,
      familyRule: 'Publish every type or period cell for a word only when every positive sibling meets both thresholds; otherwise publish no cells for that family.',
      overlengthTokenOccurrencesExcluded: 0
    },
    dimensions: {
      corpus: {
        documents: 8_438_155,
        sourceAlphaWords: 3_941_476_219,
        derivedTokens: 10_000
      },
      documentTypes: TYPE_DEFINITIONS.map(dimensionRecord),
      periods: PERIOD_DEFINITIONS.map(dimensionRecord),
      validatedDocumentSubtypesNotPublished: {
        count: 11,
        parentMappingsValidated: true,
        documentTotalsReconciled: true,
        sourceAlphaWordTotalsReconciled: true
      }
    },
    output: outputDescriptor(tsv),
    privacy: {
      rawTextPublished: false,
      documentRowsPublished: false,
      documentSubtypesPublished: false,
      jointDimensionsPublished: false,
      titlesPublished: false,
      authorsPublished: false,
      urlsPublished: false,
      sourceIdentifiersPublished: false,
      publicationDatesPublished: false,
      personalDataPublished: false
    },
    build: {
      duckdbVersion: '1.5.5',
      partialFormatVersion: 2,
      pythonImplementation: 'CPython',
      pythonMajorMinor: '3.14',
      pythonUnicodeVersion: '16.0.0'
    }
  };
}

async function createFixture() {
  const createdRoot = await mkdtemp(path.join(os.tmpdir(), 'dazniausi-zodziai-blkt-profile-script-'));
  const root = await realpath(createdRoot);
  temporaryDirectories.push(root);
  const outputDirectory = path.join(root, 'output');
  const tsv = encodeTsv(validRows());
  await mkdir(outputDirectory);
  await Promise.all([
    writeFile(path.join(outputDirectory, 'wordform-profile.tsv'), tsv),
    writeFile(
      path.join(outputDirectory, 'aggregation-summary.json'),
      `${JSON.stringify(canonicalSummary(tsv), null, 2)}\n`
    )
  ]);
  return { root, outputDirectory };
}

function verify(outputDirectory) {
  return spawnSync(
    pythonRuntime,
    ['-I', scriptPath, '--verify', '--output-dir', outputDirectory],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );
}

async function readSummary(outputDirectory) {
  return JSON.parse(await readFile(path.join(outputDirectory, 'aggregation-summary.json'), 'utf8'));
}

async function writeSummary(outputDirectory, summary) {
  await writeFile(path.join(outputDirectory, 'aggregation-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const describeWithPython = pythonRuntime ? describe : describe.skip;

describeWithPython('prepare-blkt-profile.py --verify (requires CPython 3.14 with Unicode 16.0)', () => {
  it('accepts the exact two-file aggregate-only fixture without DuckDB or raw Parquet', async () => {
    const { outputDirectory } = await createFixture();

    const result = verify(outputDirectory);

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      verified: 'vssa-blkt-privacy-safe-wordform-profile',
      rows: 2
    });
  });

  it('rejects an extra raw metadata key', async () => {
    const { outputDirectory } = await createFixture();
    const summary = await readSummary(outputDirectory);
    summary.rawText = 'must never be published';
    await writeSummary(outputDirectory, summary);

    const result = verify(outputDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('aggregation summary has an invalid or open-ended schema');
  });

  it('rejects malformed dimension metadata', async () => {
    const { outputDirectory } = await createFixture();
    const summary = await readSummary(outputDirectory);
    summary.dimensions.documentTypes[0].id = 'unreviewed-type';
    await writeSummary(outputDirectory, summary);

    const result = verify(outputDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('aggregation summary documentTypes[0] identity is invalid');
  });

  it('rejects an altered mixed-licence inventory', async () => {
    const { outputDirectory } = await createFixture();
    const summary = await readSummary(outputDirectory);
    summary.sourceLicences.inventory[1].documents -= 1;
    await writeSummary(outputDirectory, summary);

    const result = verify(outputDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('aggregation summary mixed-licence inventory is invalid');
  });

  it('rejects malformed period and validated-subtype metadata', async () => {
    const periodFixture = await createFixture();
    const periodSummary = await readSummary(periodFixture.outputDirectory);
    periodSummary.dimensions.periods[0].id = 'unreviewed-period';
    await writeSummary(periodFixture.outputDirectory, periodSummary);
    const periodResult = verify(periodFixture.outputDirectory);
    expect(periodResult.status).toBe(1);
    expect(periodResult.stderr).toContain('aggregation summary periods[0] identity is invalid');

    const subtypeFixture = await createFixture();
    const subtypeSummary = await readSummary(subtypeFixture.outputDirectory);
    subtypeSummary.dimensions.validatedDocumentSubtypesNotPublished.count = 12;
    await writeSummary(subtypeFixture.outputDirectory, subtypeSummary);
    const subtypeResult = verify(subtypeFixture.outputDirectory);
    expect(subtypeResult.status).toBe(1);
    expect(subtypeResult.stderr).toContain('aggregation summary subtype privacy boundary is invalid');
  });

  it.each([
    ['an upper-case word', 'Kalba'],
    ['a non-NFC word', 'z\u030codis'],
    ['an empty word', '']
  ])('rejects %s in the public lookup key', async (_name, word) => {
    const { outputDirectory } = await createFixture();
    const rows = validRows();
    rows[0][0] = word;
    await writeFile(path.join(outputDirectory, 'wordform-profile.tsv'), encodeTsv(rows));

    const result = verify(outputDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has an invalid word');
  });

  it('rejects an extra output file', async () => {
    const { outputDirectory } = await createFixture();
    await writeFile(path.join(outputDirectory, 'raw-document.txt'), 'forbidden');

    const result = verify(outputDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must contain exactly the reviewed TSV and summary');
  });

  it('rejects a symlinked output file', async () => {
    const { root, outputDirectory } = await createFixture();
    const linkedTarget = path.join(root, 'linked-wordform-profile.tsv');
    const outputPath = path.join(outputDirectory, 'wordform-profile.tsv');
    await writeFile(linkedTarget, encodeTsv(validRows()));
    await unlink(outputPath);
    await symlink(linkedTarget, outputPath);

    const result = verify(outputDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('aggregate output files must be regular files, not links');
  });

  it.each([
    {
      name: 'a below-threshold family cell',
      mutate: (rows) => {
        rows[0][3] = 99;
      },
      expected: 'contains a cell below the disclosure threshold'
    },
    {
      name: 'a partially published family',
      mutate: (rows) => {
        rows[0][3] = '';
      },
      expected: 'must be entirely published or entirely suppressed'
    }
  ])('rejects $name', async ({ mutate, expected }) => {
    const { outputDirectory } = await createFixture();
    const rows = validRows();
    mutate(rows);
    await writeFile(path.join(outputDirectory, 'wordform-profile.tsv'), encodeTsv(rows));

    const result = verify(outputDirectory);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(expected);
  });
});
