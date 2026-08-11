import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDataProducts } from '../../scripts/prepare-data-products.mjs';
import { verifyDataProducts } from '../../scripts/verify-data-products.mjs';

const PRODUCT_ID = 'vssa-2026-blkt-wordform-profile';
const VIEW_ID = 'wordform-scope-metrics';
const SOURCE_ROLE = 'wordform-profile';
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
const RIGHTS = {
  licences: [
    {
      id: 'newgenltu-openrail-d-v1.0', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', file: 'LICENSE-NewGenLTU-OpenRAIL-D-1.0.txt',
      sha256: 'abf61fc83225e088c1ed91aae517f0d5c606c2c9b441f3fc245ce821c1c79ab9'
    },
    {
      id: 'cc-by-sa-4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/', file: 'LICENSE-CC-BY-SA-4.0.txt',
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
const SOURCE_SCOPE_CAVEAT = 'BLKT is not representative of all Lithuanian language use: media and document texts dominate its document and token composition.';
const SOURCE_LICENCES = {
  inventory: [
    {
      sourceLabel: 'NewGenLTU OpenRAIL-D', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', documents: 8267437, sourceAlphaWords: 3906734476
    },
    {
      sourceLabel: 'CC BY-SA 4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/', attribution: 'Wikipedia contributors (BLKT source_name: Vikipedija).',
      documents: 170718, sourceAlphaWords: 34741743
    }
  ],
  application: 'The combined aggregate retains the notices and conditions of both source licence groups.'
};
const FILE_NOTICE = {
  modificationNotice: RIGHTS.modificationNotice,
  attribution: 'BLKT: Valstybės skaitmeninių sprendimų agentūra (2026); Vikipedija subset: Wikipedia contributors.',
  licenceLocation: 'product-root',
  licences: RIGHTS.licences.map(({ name, file }) => ({ name, file }))
};

const temporaryDirectories = [];

async function makeDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dazniausi-zodziai-blkt-product-'));
  temporaryDirectories.push(directory);
  return directory;
}

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeJson(filename, value, { compact = false } = {}) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, compact ? 0 : 2)}\n`);
}

const dimensions = {
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
    ['fiction', 'gro', 'Grožinė literatūra', 'fiction', 425, 10722386, 10741419],
    ['non-fiction', 'neg', 'Negrožinė literatūra', 'nonFiction', 832271, 280296836, 284770783],
    ['media', 'zin', 'Žiniasklaida', 'media', 6388765, 2060625648, 2082912032],
    ['speech', 'sak', 'Sakytinė kalba', 'speech', 4563, 80483739, 81943532],
    ['documents', 'dok', 'Dokumentai', 'documents', 1212131, 1509347610, 1525990431]
  ].map(([id, sourceCode, label, fieldPrefix, documents, sourceAlphaWords, derivedTokens]) => ({
    id,
    sourceCode,
    label,
    tokenField: `${fieldPrefix}TokenCount`,
    documentField: `${fieldPrefix}DocumentCount`,
    documents,
    sourceAlphaWords,
    derivedTokens
  })),
  periods: [
    ['1922-1940', '1', '1922–1940', 'period1', 290, 11226438, 11260489],
    ['1941-1990', '2', '1941–1990', 'period2', 4288, 10440807, 10511716],
    ['1990-2004', '3', '1990–2004', 'period3', 684359, 229967268, 233679092],
    ['2008-2026', '4', '2008–2026', 'period4', 7749218, 3689841706, 3730906900]
  ].map(([id, sourceCode, label, fieldPrefix, documents, sourceAlphaWords, derivedTokens]) => ({
    id,
    sourceCode,
    label,
    tokenField: `${fieldPrefix}TokenCount`,
    documentField: `${fieldPrefix}DocumentCount`,
    documents,
    sourceAlphaWords,
    derivedTokens
  }))
};

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
    ...dimensions,
    validatedSubtypes: { count: 11, published: false },
    permission: { status: 'confirmed-by-project-owner', confirmedOn: '2026-08-02' },
    rights: RIGHTS,
    exclusions: EXCLUSIONS
  };
}

function countFields() {
  const pairs = [dimensions.corpus, ...dimensions.documentTypes, ...dimensions.periods];
  return [
    { id: 'word', label: 'Žodžio forma', type: 'string', sourceColumn: 0 },
    ...pairs.flatMap((dimension, index) => [
      {
        id: dimension.tokenField,
        label: `${dimension.label}: pavartojimai`,
        type: 'raw-token-count',
        unit: 'tokens',
        sourceColumn: index * 2 + 1,
        ...(index === 0 ? {} : { nullable: true })
      },
      {
        id: dimension.documentField,
        label: `${dimension.label}: dokumentai`,
        type: 'raw-document-count',
        unit: 'documents',
        sourceColumn: index * 2 + 2,
        ...(index === 0 ? {} : { nullable: true })
      }
    ])
  ];
}

function fixtureSource() {
  const fields = countFields();
  const header = fields.map((field) => field.id).join('\t');
  const fullyPublished = [
    'kalba',
    1000, 200,
    200, 40, 200, 40, 200, 40, 200, 40, 200, 40,
    250, 50, 250, 50, 250, 50, 250, 50
  ].join('\t');
  const suppressedFamilies = ['žodis', 500, 100, ...Array(18).fill('')].join('\t');
  return `${header}\n${fullyPublished}\n${suppressedFamilies}\n`;
}

function publishedFixtureSource(rowCount) {
  const header = countFields().map((field) => field.id).join('\t');
  const suffix = [
    1000, 200,
    200, 40, 200, 40, 200, 40, 200, 40, 200, 40,
    250, 50, 250, 50, 250, 50, 250, 50
  ];
  const word = (value) => {
    const characters = Array(4).fill('a');
    let remainder = value;
    for (let index = characters.length - 1; index >= 0; index -= 1) {
      characters[index] = String.fromCharCode(97 + (remainder % 26));
      remainder = Math.floor(remainder / 26);
    }
    return `a${characters.join('')}`;
  };
  const records = Array.from({ length: rowCount }, (_, index) => [word(index), ...suffix].join('\t'));
  return `${header}\n${records.join('\n')}\n`;
}

function sourceContract(source) {
  const numericTotals = { 1: 1500, 2: 300 };
  const missingCounts = {};
  for (let column = 3; column <= 20; column += 1) {
    numericTotals[column] = column % 2 === 1
      ? (column <= 12 ? 200 : 250)
      : (column <= 12 ? 40 : 50);
    missingCounts[column] = 1;
  }
  return {
    schemaVersion: 1,
    contracts: [{
      id: PRODUCT_ID,
      title: 'BLKT wordform profile fixture',
      source: {
        sourceUrl: 'https://clarin.vdu.lt/xmlui/handle/20.500.11821/64',
        licence: 'NewGenLTU OpenRAIL-D v1.0; CC BY-SA 4.0 for BLKT rows labelled Vikipedija',
        citation: 'BLKT 2026 synthetic test fixture.',
        sourceLicences: SOURCE_LICENCES,
        rights: RIGHTS,
        files: [{
          artifactId: 'blkt-wordform-profile-fixture',
          role: SOURCE_ROLE,
          bytes: Buffer.byteLength(source),
          rows: 2,
          sha256: checksum(source),
          columns: 21,
          delimiter: '\t',
          hasHeader: true,
          numericColumns: Array.from({ length: 20 }, (_, index) => index + 1),
          nullableColumns: Array.from({ length: 18 }, (_, index) => index + 3),
          numericTotals,
          missingCounts
        }]
      },
      schema: { sourceScopeCaveat: SOURCE_SCOPE_CAVEAT },
      delivery: { constraints: ['Publish only thresholded, scope-level aggregates.'] }
    }]
  };
}

function publishedRowsSourceContract(source, rows) {
  const contract = sourceContract(source);
  const file = contract.contracts[0].source.files[0];
  file.rows = rows;
  file.numericTotals = {};
  file.missingCounts = {};
  for (let column = 1; column <= 20; column += 1) {
    const perRow = column === 1 ? 1000
      : column === 2 ? 200
        : column <= 12 ? (column % 2 === 1 ? 200 : 40)
          : (column % 2 === 1 ? 250 : 50);
    file.numericTotals[column] = perRow * rows;
    if (column >= 3) file.missingCounts[column] = 0;
  }
  return contract;
}

function publicationPlan() {
  return {
    schemaVersion: 1,
    title: 'BLKT test products',
    genericProducts: [],
    contractProducts: [{
      contractId: PRODUCT_ID,
      productType: 'chunked-comparison',
      publication: {
        status: 'published',
        scope: 'Exact selected-word aggregate lookup.',
        access: 'Bounded static JSON range lookup.'
      },
      views: [{
        id: VIEW_ID,
        sourceRole: SOURCE_ROLE,
        title: 'BLKT wordform scope metrics',
        description: 'Privacy-thresholded counts by document type and period.',
        ordering: { field: 'word', direction: 'ascending' },
        chunkBytes: 1024,
        lookup: {
          type: 'exact-string-range',
          field: 'word',
          normalization: 'trim-nfc-lower',
          maxIndexBytes: 8192
        },
        fields: countFields()
      }],
      wordformProfile: wordformProfile()
    }]
  };
}

async function buildFixture({ source = fixtureSource(), contract = sourceContract(source), plan = publicationPlan() } = {}) {
  const root = await makeDirectory();
  const sourceRoot = path.join(root, 'sources');
  const staticRoot = path.join(root, 'static');
  const outputRoot = path.join(staticRoot, 'data-products');
  const planPath = path.join(root, 'plan.json');
  const contractPath = path.join(root, 'contract.json');

  await mkdir(sourceRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(sourceRoot, 'wordform-profile.tsv'), source),
    writeJson(planPath, plan),
    writeJson(contractPath, contract)
  ]);
  await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
  return { outputRoot, staticRoot };
}

async function readFirstRoutingPage(productRoot, index) {
  const pageDescriptor = index.routing.pages[0];
  const pagePath = path.join(productRoot, 'views', VIEW_ID, pageDescriptor.file);
  return {
    pageDescriptor,
    pagePath,
    page: JSON.parse(await readFile(pagePath, 'utf8'))
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('BLKT wordform data product', () => {
  it('builds and verifies a compact exact-range lookup with the complete 21-column privacy schema', async () => {
    const { outputRoot, staticRoot } = await buildFixture();

    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toEqual({
      products: 1,
      chunkedViews: 1,
      chunks: 1,
      records: 2,
      metadataOnlyProducts: 0
    });

    const productRoot = path.join(outputRoot, PRODUCT_ID);
    const manifest = JSON.parse(await readFile(path.join(productRoot, 'manifest.json'), 'utf8'));
    const indexPath = path.join(productRoot, 'views', VIEW_ID, 'index.json');
    const indexBuffer = await readFile(indexPath);
    const index = JSON.parse(indexBuffer);
    const { page } = await readFirstRoutingPage(productRoot, index);
    const chunk = JSON.parse(await readFile(path.join(productRoot, 'views', VIEW_ID, page.chunks[0].file)));

    expect(manifest.wordformProfile).toEqual(wordformProfile());
    expect(manifest.notice).toEqual(FILE_NOTICE);
    expect(index.notice).toEqual(FILE_NOTICE);
    expect(page.notice).toEqual(FILE_NOTICE);
    expect(chunk.notice).toEqual(FILE_NOTICE);
    for (const licence of RIGHTS.licences) {
      const buffer = await readFile(path.join(productRoot, licence.file));
      expect(checksum(buffer)).toBe(licence.sha256);
      expect(buffer.byteLength).toBeLessThanOrEqual(65536);
    }
    expect(index.fields).toHaveLength(21);
    expect(index.fields.filter((field) => field.type === 'raw-document-count')).toHaveLength(10);
    expect(index.lookup).toEqual({
      type: 'exact-string-range',
      field: 'word',
      normalization: 'trim-nfc-lower',
      maxIndexBytes: 8192
    });
    expect(indexBuffer.byteLength).toBeLessThanOrEqual(index.lookup.maxIndexBytes);
    expect(index).not.toHaveProperty('chunks');
    expect(index.routing).toMatchObject({ type: 'range-pages', maxPageBytes: 8192 });
    expect(index.routing.pages[0].range).toEqual(['kalba', 'žodis']);
    expect(page.chunks[0].range).toEqual(['kalba', 'žodis']);
    expect(chunk.records[0]).toHaveLength(21);
    expect(chunk.records[1]).toEqual(['žodis', 500, 100, ...Array(18).fill(null)]);
  });

  it('keeps both routing levels within budget when the flat chunk list would be too large', async () => {
    const rows = 1200;
    const source = publishedFixtureSource(rows);
    const { outputRoot, staticRoot } = await buildFixture({
      source,
      contract: publishedRowsSourceContract(source, rows)
    });
    const productRoot = path.join(outputRoot, PRODUCT_ID);
    const viewRoot = path.join(productRoot, 'views', VIEW_ID);
    const indexBuffer = await readFile(path.join(viewRoot, 'index.json'));
    const index = JSON.parse(indexBuffer);

    expect(indexBuffer.byteLength).toBeLessThanOrEqual(index.lookup.maxIndexBytes);
    expect(index.routing.pages.length).toBeGreaterThan(1);
    let chunkCount = 0;
    let recordCount = 0;
    for (const descriptor of index.routing.pages) {
      const pageBuffer = await readFile(path.join(viewRoot, descriptor.file));
      const page = JSON.parse(pageBuffer);
      expect(pageBuffer.byteLength).toBeLessThanOrEqual(index.lookup.maxIndexBytes);
      expect(pageBuffer.byteLength).toBe(descriptor.bytes);
      expect(checksum(pageBuffer)).toBe(descriptor.sha256);
      expect(page.chunks).toHaveLength(descriptor.chunks);
      chunkCount += page.chunks.length;
      recordCount += page.chunks.reduce((total, chunk) => total + chunk.records, 0);
    }
    expect(chunkCount).toBeGreaterThan(index.routing.pages.length);
    expect(recordCount).toBe(rows);
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 1,
      chunkedViews: 1,
      chunks: chunkCount,
      records: rows
    });
  });

  it('rejects a published family member below the disclosure threshold', async () => {
    const { outputRoot, staticRoot } = await buildFixture();
    const viewRoot = path.join(outputRoot, PRODUCT_ID, 'views', VIEW_ID);
    const indexPath = path.join(viewRoot, 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    const { pageDescriptor, pagePath, page } = await readFirstRoutingPage(path.join(outputRoot, PRODUCT_ID), index);
    const chunkPath = path.join(viewRoot, page.chunks[0].file);
    const chunk = JSON.parse(await readFile(chunkPath, 'utf8'));

    chunk.records[0][3] = 99;
    const chunkBuffer = Buffer.from(`${JSON.stringify(chunk)}\n`);
    await writeFile(chunkPath, chunkBuffer);
    page.chunks[0].bytes = chunkBuffer.byteLength;
    page.chunks[0].sha256 = checksum(chunkBuffer);
    const pageBuffer = Buffer.from(`${JSON.stringify(page)}\n`);
    await writeFile(pagePath, pageBuffer);
    pageDescriptor.bytes = pageBuffer.byteLength;
    pageDescriptor.sha256 = checksum(pageBuffer);
    await writeJson(indexPath, index, { compact: true });

    await expect(verifyDataProducts({ outputRoot, staticRoot })).rejects.toThrow(/violates the disclosure threshold/);
  });

  it('rejects lookup range metadata that does not match its chunk records', async () => {
    const { outputRoot, staticRoot } = await buildFixture();
    const productRoot = path.join(outputRoot, PRODUCT_ID);
    const indexPath = path.join(productRoot, 'views', VIEW_ID, 'index.json');
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    const { pageDescriptor, pagePath, page } = await readFirstRoutingPage(productRoot, index);
    page.chunks[0].range = ['a', 'žodis'];
    const pageBuffer = Buffer.from(`${JSON.stringify(page)}\n`);
    await writeFile(pagePath, pageBuffer);
    pageDescriptor.bytes = pageBuffer.byteLength;
    pageDescriptor.sha256 = checksum(pageBuffer);
    pageDescriptor.range = ['a', 'žodis'];
    await writeJson(indexPath, index, { compact: true });

    await expect(verifyDataProducts({ outputRoot, staticRoot })).rejects.toThrow(/does not match its lookup range/);
  });
});
