import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDataProducts } from '../../scripts/prepare-data-products.mjs';
import { verifyDataProducts } from '../../scripts/verify-data-products.mjs';

const temporaryDirectories = [];

async function makeDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dazniausi-zodziai-products-'));
  temporaryDirectories.push(directory);
  return directory;
}

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function writeJson(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function genericDataset() {
  return {
    schemaVersion: 1,
    id: 'generic-fixture',
    title: 'Generic fixture',
    author: 'Fixture author',
    year: 2026,
    entryKind: 'lemma',
    duplicatePolicy: 'keep',
    provenance: {
      licence: 'CC BY 4.0',
      citation: 'Fixture citation',
      sourceUrl: 'https://example.test/generic',
      sourceSnapshot: {
        repositoryUrl: 'https://example.test/source.git',
        revision: 'fixture',
        path: 'generic.tsv',
        encoding: 'utf-8',
        sha256: checksum('generic')
      }
    },
    summary: { sourceRows: 2, entryCount: 2, totalFrequency: 3, duplicateEntries: 0 },
    words: [
      { word: 'a', frequency: 2 },
      { word: 'b', frequency: 1 }
    ]
  };
}

function comparisonContract(source) {
  return {
    schemaVersion: 1,
    sourceRepository: {
      repositoryUrl: 'https://example.test/source.git',
      revision: 'fixture-revision'
    },
    contracts: [{
      id: 'comparison-fixture',
      title: 'Comparison fixture',
      source: {
        sourceUrl: 'https://example.test/comparison',
        licence: 'CC BY 4.0',
        citation: 'Fixture comparison citation',
        files: [{
          path: 'comparison.tsv',
          role: 'normalized-comparison',
          bytes: Buffer.byteLength(source),
          rows: 2,
          sha256: checksum(source),
          columns: 3,
          numericColumns: [1, 2],
          nullableColumns: [1],
          numericTotals: { 1: 10 },
          missingCounts: { 1: 1 },
          allowedValues: { 2: [0, 1] },
          samples: ['IR\t10\t1', 'HRS\t\t0']
        }]
      },
      delivery: { constraints: ['Keep missing counts as null.'] }
    }]
  };
}

function comparisonPlan() {
  return {
    schemaVersion: 1,
    title: 'Fixture data products',
    genericProducts: [{
      datasetFile: 'datasets/generic-fixture.json',
      description: 'A direct generic fixture.'
    }],
    contractProducts: [{
      contractId: 'comparison-fixture',
      productType: 'chunked-comparison',
      publication: {
        status: 'published',
        scope: 'Every fixture row.',
        access: 'Chunked JSON.'
      },
      views: [{
        id: 'comparison',
        sourceRole: 'normalized-comparison',
        title: 'Fixture comparison',
        description: 'A raw count and a categorical coverage code.',
        ordering: { field: 'word', direction: 'ascending' },
        chunkBytes: 1024,
        fields: [
          { id: 'word', label: 'Word form', type: 'string', sourceColumn: 0 },
          { id: 'count', label: 'Token count', type: 'raw-token-count', unit: 'tokens', sourceColumn: 1, nullable: true },
          { id: 'coverage', label: 'Coverage', type: 'coverage-code', unit: 'category', sourceColumn: 2, values: { 0: 'missing', 1: 'present' } }
        ]
      }]
    }]
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('public data-product preparation', () => {
  it('publishes generic JSON alongside a chunked comparison that preserves nulls and coverage codes', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const source = 'IR\t10\t1\nHRS\t\t0\n';

    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(sourceRoot, 'comparison.tsv'), source),
      writeJson(path.join(staticRoot, 'datasets', 'generic-fixture.json'), genericDataset()),
      writeJson(planPath, comparisonPlan()),
      writeJson(contractPath, comparisonContract(source))
    ]);

    await expect(buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath })).resolves.toMatchObject({
      products: 2,
      publishedProducts: 2,
      metadataOnlyProducts: 0
    });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toEqual({
      products: 2,
      chunkedViews: 1,
      chunks: 1,
      records: 4,
      metadataOnlyProducts: 0
    });

    const index = JSON.parse(await readFile(path.join(outputRoot, 'comparison-fixture', 'views', 'comparison', 'index.json'), 'utf8'));
    const chunk = JSON.parse(await readFile(path.join(outputRoot, 'comparison-fixture', 'views', 'comparison', index.chunks[0].file), 'utf8'));
    expect(chunk.records).toEqual([['IR', 10, 1], ['HRS', null, 0]]);
    expect(index.summary).toEqual({
      sourceRows: 2,
      recordCount: 2,
      numericTotals: { count: 10 },
      nullCounts: { count: 1 }
    });
    expect(index.fields.map((field) => field.id)).not.toContain('frequency');
  });

  it('publishes a metadata-only JSON manifest without extracting rows from a blocked PDF source', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const pdf = Buffer.from('%PDF-fixture');
    const contract = {
      schemaVersion: 1,
      sourceRepository: { repositoryUrl: 'https://example.test/source.git', revision: 'fixture-revision' },
      contracts: [{
        id: 'blocked-fixture',
        title: 'Blocked fixture',
        source: {
          sourceUrl: 'https://example.test/blocked',
          licence: 'unresolved',
          citation: 'Fixture citation',
          files: [{ path: 'fixture.pdf', format: 'binary', bytes: pdf.byteLength, sha256: checksum(pdf) }]
        },
        delivery: { constraints: ['Do not extract rows.'] }
      }]
    };
    const plan = {
      schemaVersion: 1,
      title: 'Fixture data products',
      genericProducts: [],
      contractProducts: [{
        contractId: 'blocked-fixture',
        productType: 'metadata-only',
        publication: {
          status: 'metadata-only',
          scope: 'Metadata only.',
          access: 'Manifest only.',
          reason: 'Fixture rights are unresolved.'
        },
        blockedBy: ['https://example.test/issues/1']
      }]
    };
    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(sourceRoot, 'fixture.pdf'), pdf),
      writeJson(planPath, plan),
      writeJson(contractPath, contract)
    ]);

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 1,
      metadataOnlyProducts: 1,
      records: 0
    });
    const manifest = JSON.parse(await readFile(path.join(outputRoot, 'blocked-fixture', 'manifest.json'), 'utf8'));
    expect(manifest).toMatchObject({
      id: 'blocked-fixture',
      productType: 'metadata-only',
      publication: { status: 'metadata-only' }
    });
    expect(manifest).not.toHaveProperty('views');
    expect(manifest).not.toHaveProperty('entries');
  });

  it('publishes a headered CSV frequency list with integer-valued scientific notation', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const source = '_id,frequency\n"ir,",2.5e1\nkad,5\n';
    const contract = {
      schemaVersion: 1,
      sourceRepository: { repositoryUrl: 'https://example.test/source.git', revision: 'fixture-revision' },
      contracts: [{
        id: 'onegrams-fixture',
        title: 'One-gram fixture',
        source: {
          sourceUrl: 'https://example.test/onegrams',
          licence: 'CC BY 4.0',
          citation: 'Fixture one-gram citation',
          files: [{
            path: 'onegrams.csv',
            role: 'all-by-frequency',
            bytes: Buffer.byteLength(source),
            rows: 2,
            sha256: checksum(source),
            delimiter: ',',
            hasHeader: true,
            columns: 2,
            numericColumns: [1],
            numericTotals: { 1: 30 },
            samples: ['"ir,",2.5e1', 'kad,5']
          }]
        },
        delivery: { constraints: ['Keep raw counts separate from lemma frequencies.'] }
      }]
    };
    const plan = {
      schemaVersion: 1,
      title: 'Fixture data products',
      genericProducts: [],
      contractProducts: [{
        contractId: 'onegrams-fixture',
        productType: 'chunked-frequency-list',
        publication: { status: 'published', scope: 'Every fixture row.', access: 'Chunked JSON.' },
        views: [{
          id: 'all-by-frequency',
          sourceRole: 'all-by-frequency',
          title: 'Fixture one-grams',
          description: 'Raw one-gram counts.',
          ordering: { field: 'count', direction: 'descending' },
          chunkBytes: 1024,
          fields: [
            { id: 'word', label: 'One-gram', type: 'string', sourceColumn: 0 },
            { id: 'count', label: 'Token count', type: 'raw-token-count', unit: 'tokens', sourceColumn: 1 }
          ]
        }]
      }]
    };

    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(sourceRoot, 'onegrams.csv'), source),
      writeJson(planPath, plan),
      writeJson(contractPath, contract)
    ]);

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 1,
      chunkedViews: 1,
      records: 2
    });
    const index = JSON.parse(await readFile(path.join(outputRoot, 'onegrams-fixture', 'views', 'all-by-frequency', 'index.json'), 'utf8'));
    const chunk = JSON.parse(await readFile(path.join(outputRoot, 'onegrams-fixture', 'views', 'all-by-frequency', index.chunks[0].file), 'utf8'));
    expect(chunk.records).toEqual([['ir,', 25], ['kad', 5]]);
  });
});
