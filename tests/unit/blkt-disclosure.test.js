import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyBlktDisclosure } from '../../scripts/verify-blkt-disclosure.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const policySourcePath = path.join(repositoryRoot, 'data', 'policies', 'blkt-disclosure.json');
const licenceSourcePaths = [
  path.join(repositoryRoot, 'data', 'licenses', 'newgenltu-openrail-d-v1.0.txt'),
  path.join(repositoryRoot, 'data', 'licenses', 'cc-by-sa-4.0-legalcode.txt')
];
const PRODUCT_ID = 'vssa-2026-blkt-wordform-profile';
const VIEW_ID = 'wordform-scope-metrics';
const RIGHTS = {
  licences: [
    {
      id: 'newgenltu-openrail-d-v1.0', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/',
      file: 'LICENSE-NewGenLTU-OpenRAIL-D-1.0.txt',
      sha256: 'abf61fc83225e088c1ed91aae517f0d5c606c2c9b441f3fc245ce821c1c79ab9'
    },
    {
      id: 'cc-by-sa-4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      file: 'LICENSE-CC-BY-SA-4.0.txt',
      sha256: '23ee78c8bae49cf08ea2f0c84945c66b987ebe4520881fb51b3dad4fb43d07c2'
    }
  ],
  modificationNotice: 'MODIFIED FILE: Privacy-thresholded aggregate-only BLKT derivative produced by dazniausi-zodziai; no original text or document-level metadata is distributed.',
  attributionNotices: [
    'Valstybės skaitmeninių sprendimų agentūra. 2026. Bendrasis lietuvių kalbos tekstynas. Hugging Face. https://huggingface.co/datasets/VSSA-SDSA/LT_AI_BLKT.',
    'Wikipedia contributors. The BLKT source rows labelled “Vikipedija” are derived from Lithuanian Wikipedia material licensed under CC BY-SA 4.0. https://lt.wikipedia.org/'
  ],
  downstreamRequirements: [
    'Retain both applicable licence copies, this modification notice, the BLKT attribution, and the Wikipedia-contributor attribution with any redistribution.',
    'Use this derivative only for model training, other language-technology development, or production of datasets for model training.',
    'Do not use this derivative to extract, obtain, reconstruct, or publish personal data.',
    'For material derived from the BLKT rows labelled “Vikipedija”, comply with CC BY-SA 4.0 attribution and ShareAlike requirements.'
  ]
};
const FILE_NOTICE = {
  modificationNotice: RIGHTS.modificationNotice,
  attribution: 'BLKT: Valstybės skaitmeninių sprendimų agentūra (2026); Vikipedija subset: Wikipedia contributors.',
  licenceLocation: 'product-root',
  licences: RIGHTS.licences.map(({ name, file }) => ({ name, file }))
};
const SOURCE_SCOPE_CAVEAT = 'BLKT is not representative of all Lithuanian language use: media and document texts dominate its document and token composition.';
const SOURCE_LICENCES = {
  inventory: [
    {
      sourceLabel: 'NewGenLTU OpenRAIL-D', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', documents: 8267437, sourceAlphaWords: 3906734476
    },
    {
      sourceLabel: 'CC BY-SA 4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attribution: 'Wikipedia contributors (BLKT source_name: Vikipedija).',
      documents: 170718, sourceAlphaWords: 34741743
    }
  ],
  application: 'The combined aggregate retains the notices and conditions of both source licence groups.'
};
const EXCLUSIONS = [
  'raw-text',
  'document-rows',
  'document-subtypes',
  'joint-dimensions',
  'titles',
  'authors',
  'urls',
  'source-identifiers',
  'publication-dates',
  'personal-data'
];
const PRODUCT_TITLE = 'BLKT privatumo slenksčiais apsaugotas žodžio profilis';
const PUBLICATION = {
  status: 'published',
  scope: 'Privatumo slenksčiais apsaugoti vienos tikslios žodžio formos skaitikliai visame BLKT ir atskiruose plačiuose teksto tipo bei laikotarpio pjūviuose.',
  access: 'Kompaktiškas pradinis indeksas nukreipia į vieną riboto dydžio maršruto puslapį ir daugiausia vieną riboto dydžio duomenų dalį.',
  reason: 'Tai yra kalbos technologijų darbui skirtas agreguotas išvestinis duomenų produktas; jis nėra tekstų, dokumentų ar asmenų paieškos priemonė.'
};
const DELIVERY_CONSTRAINTS = [
  'Publish only thresholded corpus, broad document-type, and broad period marginal aggregates for one exact normalized wordform.',
  'Do not publish raw text, document rows, document subtypes, crossed dimensions, titles, authors, URLs, source identifiers, publication dates, or personal data.',
  'Retain the BLKT attribution, NewGenLTU OpenRAIL-D v1.0 licence, modification notice, downstream field-of-use restriction, and personal-data prohibition.',
  'Retain the CC BY-SA 4.0 licence and Wikipedia-contributor attribution for the Vikipedija-labelled source subset, and make both complete licence texts available with the product.',
  'State that BLKT is not representative of all Lithuanian language use because media and document texts dominate its composition.'
];

const temporaryDirectories = [];

function checksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function writeJson(filename, value, { compact = false } = {}) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, compact ? 0 : 2)}\n`);
}

function dimensions() {
  return {
    corpus: {
      id: 'corpus',
      label: 'Visas BLKT',
      tokenField: 'corpusTokenCount',
      documentField: 'corpusDocumentCount',
      documents: 8438155,
      sourceAlphaWords: 3941476219,
      derivedTokens: 3986358197
    },
    documentTypes: [
      ['fiction', 'gro', 'Grožinė literatūra', 'typeGro', 425, 10722386, 10741419],
      ['non-fiction', 'neg', 'Negrožinė literatūra', 'typeNeg', 832271, 280296836, 284770783],
      ['media', 'zin', 'Žiniasklaida', 'typeZin', 6388765, 2060625648, 2082912032],
      ['speech', 'sak', 'Sakytinė kalba', 'typeSak', 4563, 80483739, 81943532],
      ['documents', 'dok', 'Dokumentai', 'typeDok', 1212131, 1509347610, 1525990431]
    ].map(([id, sourceCode, label, prefix, documents, sourceAlphaWords, derivedTokens]) => ({
      id,
      sourceCode,
      label,
      tokenField: `${prefix}TokenCount`,
      documentField: `${prefix}DocumentCount`,
      documents,
      sourceAlphaWords,
      derivedTokens
    })),
    periods: [
      ['1922-1940', '1', '1922–1940', 'period1', 290, 11226438, 11260489],
      ['1941-1990', '2', '1941–1990', 'period2', 4288, 10440807, 10511716],
      ['1990-2004', '3', '1990–2004', 'period3', 684359, 229967268, 233679092],
      ['2008-2026', '4', '2008–2026', 'period4', 7749218, 3689841706, 3730906900]
    ].map(([id, sourceCode, label, prefix, documents, sourceAlphaWords, derivedTokens]) => ({
      id,
      sourceCode,
      label,
      tokenField: `${prefix}TokenCount`,
      documentField: `${prefix}DocumentCount`,
      documents,
      sourceAlphaWords,
      derivedTokens
    }))
  };
}

function wordformProfile() {
  return {
    schemaVersion: 1,
    viewId: VIEW_ID,
    sourceScopeCaveat: SOURCE_SCOPE_CAVEAT,
    sourceLicences: SOURCE_LICENCES,
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
    rate: {
      targetTokens: 1000000,
      formula: 'tokenCount * 1000000 / derivedTokens',
      unit: 'tokens per million derived tokens'
    },
    ...dimensions(),
    validatedSubtypes: { count: 11, published: false },
    permission: { status: 'confirmed-by-project-owner', confirmedOn: '2026-08-02' },
    rights: RIGHTS,
    exclusions: EXCLUSIONS
  };
}

function fields() {
  const profile = dimensions();
  const scopes = [profile.corpus, ...profile.documentTypes, ...profile.periods];
  return [
    { id: 'word', label: 'Žodžio forma', type: 'string', sourceColumn: 0 },
    ...scopes.flatMap((scope, index) => [
      {
        id: scope.tokenField,
        label: `${scope.label}: pavartojimai`,
        type: 'raw-token-count',
        unit: 'tokens',
        sourceColumn: index * 2 + 1,
        ...(index === 0 ? {} : { nullable: true })
      },
      {
        id: scope.documentField,
        label: `${scope.label}: dokumentai su žodžiu`,
        type: 'raw-document-count',
        unit: 'documents',
        sourceColumn: index * 2 + 2,
        ...(index === 0 ? {} : { nullable: true })
      }
    ])
  ];
}

function records() {
  return [
    [
      'kalba',
      1000, 200,
      200, 40, 200, 40, 200, 40, 200, 40, 200, 40,
      250, 50, 250, 50, 250, 50, 250, 50
    ],
    ['žodis', 500, 100, ...Array(18).fill(null)]
  ];
}

function summary() {
  const numericTotals = { corpusTokenCount: 1500, corpusDocumentCount: 300 };
  const nullCounts = {};
  for (const field of fields().slice(3)) {
    numericTotals[field.id] = field.type === 'raw-token-count'
      ? (field.id.startsWith('period') ? 250 : 200)
      : (field.id.startsWith('period') ? 50 : 40);
    nullCounts[field.id] = 1;
  }
  return { sourceRows: 2, recordCount: 2, numericTotals, nullCounts };
}

function sourceFile() {
  return {
    role: 'wordform-profile',
    artifactId: 'vssa-2026-blkt-wordform-profile',
    format: 'text',
    bytes: 1234,
    sha256: 'a'.repeat(64),
    rows: 2,
    columns: 21,
    delimiter: '\t',
    hasHeader: true
  };
}

function productPaths(root) {
  const productRoot = path.join(root, 'static', 'data-products', PRODUCT_ID);
  const viewRoot = path.join(productRoot, 'views', VIEW_ID);
  return {
    productRoot,
    newgenLicencePath: path.join(productRoot, RIGHTS.licences[0].file),
    ccLicencePath: path.join(productRoot, RIGHTS.licences[1].file),
    manifestPath: path.join(productRoot, 'manifest.json'),
    indexPath: path.join(viewRoot, 'index.json'),
    routingPath: path.join(viewRoot, 'routing', '000001.json'),
    chunkPath: path.join(viewRoot, 'chunks', '000001.json')
  };
}

async function buildFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dazniausi-zodziai-blkt-disclosure-'));
  temporaryDirectories.push(root);
  const paths = productPaths(root);
  const policyPath = path.join(root, 'data', 'policies', 'blkt-disclosure.json');
  await mkdir(path.dirname(policyPath), { recursive: true });
  await mkdir(paths.productRoot, { recursive: true });
  await copyFile(policySourcePath, policyPath);

  const aggregateSummary = summary();
  const aggregateSource = sourceFile();
  const chunk = {
    schemaVersion: 1,
    productId: PRODUCT_ID,
    viewId: VIEW_ID,
    chunk: 0,
    notice: FILE_NOTICE,
    records: records()
  };
  const chunkBuffer = Buffer.from(`${JSON.stringify(chunk)}\n`);
  const chunkDescriptor = {
    file: 'chunks/000001.json',
    records: 2,
    bytes: chunkBuffer.byteLength,
    sha256: checksum(chunkBuffer),
    range: ['kalba', 'žodis']
  };
  const routingPage = {
    schemaVersion: 1,
    productId: PRODUCT_ID,
    viewId: VIEW_ID,
    page: 0,
    notice: FILE_NOTICE,
    chunks: [chunkDescriptor]
  };
  const routingBuffer = Buffer.from(`${JSON.stringify(routingPage)}\n`);
  const index = {
    schemaVersion: 1,
    productId: PRODUCT_ID,
    viewId: VIEW_ID,
    recordEncoding: 'array',
    fields: fields(),
    ordering: { field: 'word', direction: 'ascending' },
    sourceFile: aggregateSource,
    maxChunkBytes: 65536,
    notice: FILE_NOTICE,
    lookup: {
      type: 'exact-string-range',
      field: 'word',
      normalization: 'trim-nfc-lower',
      maxIndexBytes: 65536
    },
    summary: aggregateSummary,
    routing: {
      type: 'range-pages',
      maxPageBytes: 65536,
      pages: [{
        file: 'routing/000001.json',
        chunks: 1,
        records: 2,
        bytes: routingBuffer.byteLength,
        sha256: checksum(routingBuffer),
        range: ['kalba', 'žodis']
      }]
    }
  };
  const manifest = {
    schemaVersion: 1,
    id: PRODUCT_ID,
    title: PRODUCT_TITLE,
    productType: 'chunked-comparison',
    publication: PUBLICATION,
    provenance: {
      sourceUrl: 'https://clarin-repo.lt/items/2b51a918-55c3-4e62-8e45-e763fc7fc157',
      licence: 'NewGenLTU OpenRAIL-D v1.0; CC BY-SA 4.0 for BLKT rows labelled Vikipedija',
      citation: 'Valstybės skaitmeninių sprendimų agentūra. 2026. Bendrasis lietuvių kalbos tekstynas. Hugging Face. https://huggingface.co/datasets/VSSA-SDSA/LT_AI_BLKT.',
      files: [
        {
          artifactId: 'vssa-2026-blkt-source-manifest',
          format: 'binary',
          bytes: 7230,
          sha256: 'b'.repeat(64)
        },
        {
          artifactId: 'vssa-2026-blkt-aggregation-summary',
          format: 'binary',
          bytes: 4321,
          sha256: 'c'.repeat(64)
        },
        aggregateSource
      ]
    },
    delivery: {
      mode: 'static-chunked-json',
      constraints: DELIVERY_CONSTRAINTS
    },
    notice: FILE_NOTICE,
    views: [{
      id: VIEW_ID,
      title: 'BLKT žodžio rodikliai pagal viešus pjūvius',
      description: 'Privatumo slenksčiais apsaugoti vienos tikslios žodžio formos skaitikliai visame BLKT, penkiuose plačiuose teksto tipuose ir keturiuose laikotarpiuose.',
      index: `views/${VIEW_ID}/index.json`,
      sourceRole: 'wordform-profile',
      recordEncoding: 'array',
      summary: aggregateSummary
    }],
    wordformProfile: wordformProfile()
  };
  await Promise.all([
    writeJson(paths.manifestPath, manifest),
    writeJson(paths.indexPath, index, { compact: true }),
    mkdir(path.dirname(paths.routingPath), { recursive: true }).then(() => writeFile(paths.routingPath, routingBuffer)),
    mkdir(path.dirname(paths.chunkPath), { recursive: true }).then(() => writeFile(paths.chunkPath, chunkBuffer)),
    copyFile(licenceSourcePaths[0], paths.newgenLicencePath),
    copyFile(licenceSourcePaths[1], paths.ccLicencePath)
  ]);
  return { root, ...paths };
}

async function rewriteJson(filename, mutate, { compact = false } = {}) {
  const value = JSON.parse(await readFile(filename, 'utf8'));
  mutate(value);
  await writeJson(filename, value, { compact });
}

async function rewriteChunk(fixture, mutate) {
  const index = JSON.parse(await readFile(fixture.indexPath, 'utf8'));
  const routingPage = JSON.parse(await readFile(fixture.routingPath, 'utf8'));
  const chunk = JSON.parse(await readFile(fixture.chunkPath, 'utf8'));
  mutate(chunk, index);
  const buffer = Buffer.from(`${JSON.stringify(chunk)}\n`);
  routingPage.chunks[0].records = chunk.records.length;
  routingPage.chunks[0].bytes = buffer.byteLength;
  routingPage.chunks[0].sha256 = checksum(buffer);
  if (chunk.records.length > 0) routingPage.chunks[0].range = [chunk.records[0][0], chunk.records.at(-1)[0]];
  const routingBuffer = Buffer.from(`${JSON.stringify(routingPage)}\n`);
  index.routing.pages[0].records = chunk.records.length;
  index.routing.pages[0].bytes = routingBuffer.byteLength;
  index.routing.pages[0].sha256 = checksum(routingBuffer);
  if (chunk.records.length > 0) index.routing.pages[0].range = [chunk.records[0][0], chunk.records.at(-1)[0]];
  await Promise.all([
    writeFile(fixture.chunkPath, buffer),
    writeFile(fixture.routingPath, routingBuffer),
    writeJson(fixture.indexPath, index, { compact: true })
  ]);
}

async function rewriteRoutingPage(fixture, mutate) {
  const index = JSON.parse(await readFile(fixture.indexPath, 'utf8'));
  const routingPage = JSON.parse(await readFile(fixture.routingPath, 'utf8'));
  mutate(routingPage, index);
  const buffer = Buffer.from(`${JSON.stringify(routingPage)}\n`);
  index.routing.pages[0].bytes = buffer.byteLength;
  index.routing.pages[0].sha256 = checksum(buffer);
  index.routing.pages[0].chunks = routingPage.chunks.length;
  index.routing.pages[0].records = routingPage.chunks.reduce((total, chunk) => total + chunk.records, 0);
  if (routingPage.chunks.length > 0) {
    index.routing.pages[0].range = [routingPage.chunks[0].range[0], routingPage.chunks.at(-1).range[1]];
  }
  await Promise.all([
    writeFile(fixture.routingPath, buffer),
    writeJson(fixture.indexPath, index, { compact: true })
  ]);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('BLKT disclosure quarantine', () => {
  it('verifies the complete synthetic aggregate product tree', async () => {
    const fixture = await buildFixture();
    await expect(verifyBlktDisclosure({ root: fixture.root })).resolves.toEqual({
      productId: PRODUCT_ID,
      views: 1,
      routingPages: 1,
      chunks: 1,
      records: 2
    });
  });

  it.each([
    {
      name: 'an extra source-row value',
      mutate: (record) => record.push('source-row-1'),
      message: /exactly one 21-field aggregate array record/
    },
    {
      name: 'a positive cell below the disclosure threshold',
      mutate: (record) => { record[3] = 99; },
      message: /100-token\/20-document disclosure threshold/
    },
    {
      name: 'a zero corpus count that bypasses the disclosure threshold',
      mutate: (record) => { record[1] = 0; record[2] = 0; },
      message: /must meet the 100-token\/20-document disclosure threshold/
    },
    {
      name: 'a partially suppressed marginal family',
      mutate: (record) => { record[3] = null; },
      message: /all-or-nothing family suppression/
    }
  ])('rejects $name', async ({ mutate, message }) => {
    const fixture = await buildFixture();
    await rewriteChunk(fixture, (chunk) => mutate(chunk.records[0]));
    await expect(verifyBlktDisclosure({ root: fixture.root })).rejects.toThrow(message);
  });

  it('rejects forbidden raw-text, identity, and source-row object keys recursively', async () => {
    const fixture = await buildFixture();
    await rewriteJson(fixture.manifestPath, (manifest) => {
      manifest.publication.source_row_id = 'row-1';
    });
    await expect(verifyBlktDisclosure({ root: fixture.root }))
      .rejects.toThrow(/forbidden raw-text, identity, or source-row key source_row_id/);
  });

  it('rejects recursively nested metadata that is outside the public allowlist', async () => {
    const fixture = await buildFixture();
    await rewriteJson(fixture.manifestPath, (manifest) => {
      manifest.publication.analytics = { cohorts: [] };
    });
    await expect(verifyBlktDisclosure({ root: fixture.root }))
      .rejects.toThrow(/unapproved metadata key analytics/);
  });

  it('rejects arbitrary text hidden under an otherwise approved metadata key', async () => {
    const fixture = await buildFixture();
    await rewriteJson(fixture.manifestPath, (manifest) => {
      manifest.views[0].description = 'Unreviewed document text placed in a public description.';
    });
    await expect(verifyBlktDisclosure({ root: fixture.root }))
      .rejects.toThrow(/manifest view is not the approved BLKT marginal view/);
  });

  it('rejects a crossed type-by-period field even when it replaces an approved count field', async () => {
    const fixture = await buildFixture();
    await rewriteJson(fixture.indexPath, (index) => {
      index.fields[3].id = 'fictionPeriod1TokenCount';
    }, { compact: true });
    await expect(verifyBlktDisclosure({ root: fixture.root }))
      .rejects.toThrow(/does not match the approved 21-field record schema/);
  });

  it('rejects lookup ranges that do not exactly match their chunk boundaries', async () => {
    const fixture = await buildFixture();
    await rewriteRoutingPage(fixture, (routingPage) => {
      routingPage.chunks[0].range = ['a', 'žodis'];
    });
    await expect(verifyBlktDisclosure({ root: fixture.root }))
      .rejects.toThrow(/does not match its exact lookup range/);
  });

  it('rejects a manifest, index, routing page, or chunk larger than 64 KiB', async () => {
    const manifestFixture = await buildFixture();
    await rewriteJson(manifestFixture.manifestPath, (manifest) => {
      manifest.publication.scope = 'x'.repeat(66_000);
    });
    await expect(verifyBlktDisclosure({ root: manifestFixture.root })).rejects.toThrow(/manifest exceeds 64 KiB/);

    const indexFixture = await buildFixture();
    await rewriteJson(indexFixture.indexPath, (index) => {
      index.fields[0].label = 'x'.repeat(66_000);
    }, { compact: true });
    await expect(verifyBlktDisclosure({ root: indexFixture.root })).rejects.toThrow(/index exceeds 64 KiB/);

    const routingFixture = await buildFixture();
    await rewriteRoutingPage(routingFixture, (routingPage) => {
      routingPage.chunks[0].file = `chunks/${'x'.repeat(66_000)}.json`;
    });
    await expect(verifyBlktDisclosure({ root: routingFixture.root })).rejects.toThrow(/unsafe path, size, checksum, count, or range/);

    const chunkFixture = await buildFixture();
    const chunk = await readFile(chunkFixture.chunkPath);
    const oversized = Buffer.concat([chunk, Buffer.alloc(66_000, 0x20)]);
    await writeFile(chunkFixture.chunkPath, oversized);
    await rewriteRoutingPage(chunkFixture, (routingPage) => {
      routingPage.chunks[0].bytes = oversized.byteLength;
      routingPage.chunks[0].sha256 = checksum(oversized);
    });
    await expect(verifyBlktDisclosure({ root: chunkFixture.root })).rejects.toThrow(/unsafe path, size, checksum, count, or range/);
  });

  it('rejects unexpected files and symbolic links in the public product tree', async () => {
    const extraFileFixture = await buildFixture();
    await writeFile(path.join(extraFileFixture.productRoot, 'document-rows.json'), '[]\n');
    await expect(verifyBlktDisclosure({ root: extraFileFixture.root })).rejects.toThrow(/unapproved or missing entries/);

    const symlinkFixture = await buildFixture();
    const linkPath = path.join(symlinkFixture.productRoot, 'leak.json');
    await symlink('manifest.json', linkPath);
    await expect(verifyBlktDisclosure({ root: symlinkFixture.root })).rejects.toThrow(/unapproved symbolic link/);
    await unlink(linkPath);
  });

  it('requires the exact public BLKT licence, modification notice, and downstream restrictions', async () => {
    const fixture = await buildFixture();
    await rewriteJson(fixture.manifestPath, (manifest) => {
      manifest.wordformProfile.rights.downstreamRequirements.pop();
    });
    await expect(verifyBlktDisclosure({ root: fixture.root }))
      .rejects.toThrow(/wordformProfile.rights does not match the approved disclosure policy/);
  });

  it('requires exact bundled licence texts and the source-scope caveat', async () => {
    const licenceFixture = await buildFixture();
    await writeFile(licenceFixture.ccLicencePath, 'incomplete licence\n');
    await expect(verifyBlktDisclosure({ root: licenceFixture.root }))
      .rejects.toThrow(/bundled licence text is missing, changed, linked, or oversized/);

    const scopeFixture = await buildFixture();
    await rewriteJson(scopeFixture.manifestPath, (manifest) => {
      manifest.wordformProfile.sourceScopeCaveat = 'Representative of all Lithuanian.';
    });
    await expect(verifyBlktDisclosure({ root: scopeFixture.root }))
      .rejects.toThrow(/sourceScopeCaveat does not match the approved disclosure policy/);
  });
});
