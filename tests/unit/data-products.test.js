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
        artifactId: 'fixture-generic',
        bytes: Buffer.byteLength('generic'),
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
    contracts: [{
      id: 'comparison-fixture',
      title: 'Comparison fixture',
      source: {
        sourceUrl: 'https://example.test/comparison',
        licence: 'CC BY 4.0',
        citation: 'Fixture comparison citation',
        files: [{
          artifactId: 'fixture-comparison',
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
      contracts: [{
        id: 'blocked-fixture',
        title: 'Blocked fixture',
        source: {
          sourceUrl: 'https://example.test/blocked',
          licence: 'unresolved',
          citation: 'Fixture citation',
          files: [{ artifactId: 'fixture-pdf', format: 'binary', bytes: pdf.byteLength, sha256: checksum(pdf) }]
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

  it('publishes the permission-backed Rimkute PDF derivative with attribution and a modification notice', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const source = 'wordform\tfrequency\tmorphemic_analysis\tlemma_and_morphology\tvolume\tsource_page\n'
      + 'darbo\t1136\tdarb-o\tdarbas; dkt. vyr. g. vns. kilm.\tI\t9\n'
      + 'aišku\t186\taišk-u\taiškus; bdv. bev. g.\tII\t5\n'
      + 'būti\t982\tbū-ti\tbūti; vksm. bendr.\tIII\t5\n';
    const permission = {
      status: 'rightsholder-permission-confirmed',
      confirmedOn: '2026-08-13',
      scope: 'Extraction and correction of the three 2011 dictionary PDFs; publication and redistribution of the complete derived dataset and derived statistics; and downstream reuse, with normal attribution.',
      privateCorrespondencePublished: false
    };
    const attributionNotice = 'Rimkutė, Erika; Kazlauskienė, Asta; Raškinis, Gailius. 2011. Dažninis lietuvių kalbos morfemikos žodynas. Vytauto Didžiojo universitetas.';
    const modificationNotice = 'MODIFIED FILE: Deterministically extracted and reviewed by the dazniausi-zodziai Lithuanian word project from the three 2011 dictionary PDFs; this derivative is not an official VDU database export.';
    const downstreamRequirements = [
      'Retain the attribution notice and identify the files as a modified derivative when redistributing the dataset or statistics.'
    ];
    const representativeSamples = [
      { wordform: 'darbo', frequency: 1136, morphemic_analysis: 'darb-o', lemma_and_morphology: 'darbas; dkt. vyr. g. vns. kilm.', volume: 'I', source_page: 9 },
      { wordform: 'aišku', frequency: 186, morphemic_analysis: 'aišk-u', lemma_and_morphology: 'aiškus; bdv. bev. g.', volume: 'II', source_page: 5 },
      { wordform: 'būti', frequency: 982, morphemic_analysis: 'bū-ti', lemma_and_morphology: 'būti; vksm. bendr.', volume: 'III', source_page: 5 }
    ];
    const method = {
      id: 'pdf-coordinate-columns-v1',
      normalization: 'Unicode NFC; source text otherwise preserved',
      rowOrder: 'PDF volume order I, II, III; page order; top-to-bottom order',
      columnBoundariesPoints: [0, 145, 180, 285, 612],
      continuationPolicy: "A pure x >= 285 pt line is buffered: it is prepended to the next same-page row only when that row's description lacks a semicolon; otherwise it is appended to the preceding row, including across page boundaries.",
      splitFragmentPolicy: 'A reviewed non-row split line is joined to its adjacent row using source-layout direction; forward joins require the next row on the same page within 17 pt. Every split-line digest must match the manifest set.'
    };
    const pdfFixtures = [
      { volume: 'I', artifactId: 'rimkute-morphemic-dictionary-volume-one', name: 'I.pdf', pages: 801, content: 'fixture-volume-one' },
      { volume: 'II', artifactId: 'rimkute-morphemic-dictionary-volume-two', name: 'II.pdf', pages: 357, content: 'fixture-volume-two-longer' },
      { volume: 'III', artifactId: 'rimkute-morphemic-dictionary-volume-three', name: 'III.pdf', pages: 961, content: 'fixture-volume-three-longest' }
    ];
    const pdfDescriptors = pdfFixtures.map(({ volume, artifactId, name, pages, content }) => ({
      artifactId,
      volume,
      name,
      format: 'binary',
      bytes: Buffer.byteLength(content),
      pages,
      sha256: checksum(content)
    }));
    const volumes = [
      { volume: 'I', rows: 1, frequencyTotal: 1136, continuationLines: 0, reviewedSplitLines: 0, sectionHeadings: [{ page: 9, text: 'Daiktavardžiai' }] },
      { volume: 'II', rows: 1, frequencyTotal: 186, continuationLines: 0, reviewedSplitLines: 0, sectionHeadings: [{ page: 5, text: 'Būdvardžiai' }] },
      { volume: 'III', rows: 1, frequencyTotal: 982, continuationLines: 0, reviewedSplitLines: 0, sectionHeadings: [{ page: 5, text: 'Bendratys' }] }
    ];
    const summaryObject = {
      schemaVersion: 1,
      id: 'rimkute-2011-dazninis-morfemikos-zodynas',
      source: {
        scope: 'the three reviewed 2011 PDF volumes only; the live Morfema database was not accessed',
        files: pdfDescriptors.map(({ volume, name, pages, bytes, sha256 }) => ({ volume, name, pages, bytes, sha256 }))
      },
      method,
      runtime: { python: '3.12.13', popplerPdftotext: '26.05.0', dependencyLock: 'extraction-runtime.json' },
      volumes,
      output: {
        file: 'morphemic-entries.tsv',
        format: 'UTF-8 TSV with LF line endings',
        columns: ['wordform', 'frequency', 'morphemic_analysis', 'lemma_and_morphology', 'volume', 'source_page'],
        rows: 3,
        frequencyTotal: 2304,
        rowsByVolume: { I: 1, II: 1, III: 1 },
        bytes: Buffer.byteLength(source),
        sha256: checksum(source)
      },
      manualReview: { unresolvedRows: 0, corrections: 0, note: 'All fixture rows reviewed.' },
      representativeSamples
    };
    const summary = `${JSON.stringify(summaryObject, null, 2)}\n`;
    const summaryArtifact = {
      artifactId: 'rimkute-morphemic-dictionary-extraction-summary',
      format: 'rimkute-extraction-summary',
      bytes: Buffer.byteLength(summary),
      sha256: checksum(summary)
    };
    const extraction = {
      method,
      runtime: { python: '3.12.13', popplerPdftotext: '26.05.0' },
      rows: 3,
      frequencyTotal: 2304,
      volumes: volumes.map(({ volume, rows, frequencyTotal }) => ({ volume, rows, frequencyTotal })),
      representativeSamples,
      summaryArtifact
    };
    const contract = {
      schemaVersion: 1,
      contracts: [{
        id: 'rimkute-morphemic-dictionary',
        title: 'Dažninis lietuvių kalbos morfemikos žodynas',
        decision: 'publish-rightsholder-permission',
        source: {
          sourceUrl: 'https://hdl.handle.net/20.500.12259/249',
          licence: 'Rightsholder permission',
          citation: attributionNotice,
          permission,
          attributionNotice,
          modificationNotice,
          downstreamRequirements,
          extraction,
          files: [
            ...pdfDescriptors,
            {
              artifactId: 'rimkute-morphemic-dictionary-entries',
              role: 'morphemic-entries',
              format: 'text',
              bytes: Buffer.byteLength(source),
              rows: 3,
              sha256: checksum(source),
              hasHeader: true,
              header: ['wordform', 'frequency', 'morphemic_analysis', 'lemma_and_morphology', 'volume', 'source_page'],
              delimiter: '\t',
              columns: 6,
              numericColumns: [1, 5],
              numericTotals: { 1: 2304 },
              samples: representativeSamples.map((sample) => [sample.wordform, sample.frequency, sample.morphemic_analysis, sample.lemma_and_morphology, sample.volume, sample.source_page].join('\t'))
            },
            {
              ...summaryArtifact
            }
          ]
        },
        delivery: { constraints: ['Retain source order.'] }
      }]
    };
    const plan = {
      schemaVersion: 1,
      title: 'Fixture data products',
      genericProducts: [],
      contractProducts: [{
        contractId: 'rimkute-morphemic-dictionary',
        productType: 'chunked-lexical-collection',
        publication: { status: 'published', scope: 'Every source row.', access: 'Chunked JSON.' },
        views: [{
          id: 'entries-by-source-order',
          sourceRole: 'morphemic-entries',
          title: 'Morphemic dictionary entries',
          description: 'Every reviewed source entry.',
          ordering: { field: 'source', direction: 'as-stored' },
          chunkBytes: 1024,
          fields: [
            { id: 'wordform', label: 'Source word form', type: 'string', sourceColumn: 0 },
            { id: 'frequency', label: 'Source frequency', type: 'raw-token-count', unit: 'source tokens', sourceColumn: 1 },
            { id: 'morphemicAnalysis', label: 'Morphemic analysis', type: 'string', sourceColumn: 2 },
            { id: 'lemmaAndMorphology', label: 'Lemma and morphology', type: 'string', sourceColumn: 3 },
            { id: 'volume', label: 'Volume', type: 'string', sourceColumn: 4 },
            { id: 'sourcePage', label: 'Printed source page', type: 'string', sourceColumn: 5 }
          ]
        }]
      }]
    };
    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      ...pdfFixtures.map((fixture) => writeFile(path.join(sourceRoot, fixture.name), fixture.content)),
      writeFile(path.join(sourceRoot, 'rimkute.tsv'), source),
      writeFile(path.join(sourceRoot, 'extraction-summary.json'), summary),
      writeJson(planPath, plan),
      writeJson(contractPath, contract)
    ]);

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 1,
      chunkedViews: 1,
      records: 3,
      metadataOnlyProducts: 0
    });
    const manifest = JSON.parse(await readFile(path.join(outputRoot, 'rimkute-morphemic-dictionary', 'manifest.json'), 'utf8'));
    expect(manifest.provenance).toMatchObject({
      licence: 'Rightsholder permission',
      permission,
      attributionNotice,
      modificationNotice,
      downstreamRequirements,
      extraction
    });
    expect(manifest.notice).toEqual({
      modificationNotice,
      attribution: attributionNotice,
      licence: 'Rightsholder permission'
    });
    const index = JSON.parse(await readFile(path.join(outputRoot, 'rimkute-morphemic-dictionary', 'views', 'entries-by-source-order', 'index.json'), 'utf8'));
    const chunk = JSON.parse(await readFile(path.join(outputRoot, 'rimkute-morphemic-dictionary', 'views', 'entries-by-source-order', index.chunks[0].file), 'utf8'));
    expect(index.notice).toEqual(manifest.notice);
    expect(chunk.notice).toEqual(manifest.notice);
    expect(chunk.records).toEqual([
      ['darbo', 1136, 'darb-o', 'darbas; dkt. vyr. g. vns. kilm.', 'I', '9'],
      ['aišku', 186, 'aišk-u', 'aiškus; bdv. bev. g.', 'II', '5'],
      ['būti', 982, 'bū-ti', 'būti; vksm. bendr.', 'III', '5']
    ]);

    chunk.records[1][2] = 'tampered-analysis';
    const chunkPath = path.join(outputRoot, 'rimkute-morphemic-dictionary', 'views', 'entries-by-source-order', index.chunks[0].file);
    const tamperedChunk = `${JSON.stringify(chunk, null, 2)}\n`;
    await writeFile(chunkPath, tamperedChunk);
    index.chunks[0].bytes = Buffer.byteLength(tamperedChunk);
    index.chunks[0].sha256 = checksum(tamperedChunk);
    await writeJson(path.join(outputRoot, 'rimkute-morphemic-dictionary', 'views', 'entries-by-source-order', 'index.json'), index);
    await expect(verifyDataProducts({ outputRoot, staticRoot })).rejects.toThrow(
      'records do not byte-reconstruct the pinned canonical TSV'
    );

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    manifest.provenance.modificationNotice = 'Changed notice';
    await writeJson(path.join(outputRoot, 'rimkute-morphemic-dictionary', 'manifest.json'), manifest);
    await expect(verifyDataProducts({ outputRoot, staticRoot })).rejects.toThrow(
      'does not retain the reviewed rightsholder-permission provenance'
    );

    contract.contracts[0].source.files.push({
      artifactId: 'rimkute-live-morfema-export',
      format: 'binary',
      bytes: 1,
      sha256: checksum('x')
    });
    await writeJson(contractPath, contract);
    await expect(buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath })).rejects.toThrow(
      'must contain exactly the three pinned PDFs, canonical TSV, and extraction summary'
    );
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
      contracts: [{
        id: 'onegrams-fixture',
        title: 'One-gram fixture',
        source: {
          sourceUrl: 'https://example.test/onegrams',
          licence: 'CC BY 4.0',
          citation: 'Fixture one-gram citation',
          files: [{
            artifactId: 'fixture-onegrams',
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

  it('publishes source-ordered lexical collections with explicit transliteration and NVH derivations', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const transliterations = '2 Aaronas (Aaron)\n1 Maja (Maya)\n';
    const nvh = [
      'entry: pirmas',
      '  source_name: Pirmas šaltinis',
      '    source_date: 2026-01-01',
      '    source_URL: https://example.test/first',
      '  sense: 1',
      '    definition: Pirmas apibrėžimas.',
      '    example: Pirmas pavyzdys.',
      '  user_group: žiūrovai',
      '  variant: pirmasis',
      '  entry_compiler: AB',
      'entry: antras',
      '  source_name: Antras šaltinis',
      '    source_date: ',
      '  sense: ',
      '    definition: Antras apibrėžimas.',
      '    example: ',
      '  entry_compiler: CD',
      ''
    ].join('\n');
    const contract = {
      schemaVersion: 1,
      contracts: [
        {
          id: 'transliteration-fixture',
          title: 'Transliteration fixture',
          source: {
            sourceUrl: 'https://example.test/transliterations',
            licence: 'CC BY 4.0',
            citation: 'Fixture transliteration citation',
            files: [{
              artifactId: 'fixture-transliterations',
              role: 'source-name-pairs',
              bytes: Buffer.byteLength(transliterations),
              rows: 2,
              sha256: checksum(transliterations),
              columns: 1
            }]
          },
          delivery: { constraints: ['Keep the source pair direction.'] }
        },
        {
          id: 'nvh-fixture',
          title: 'NVH fixture',
          source: {
            sourceUrl: 'https://example.test/nvh',
            licence: 'CC BY 4.0',
            citation: 'Fixture NVH citation',
            files: [{
              artifactId: 'fixture-nvh',
              role: 'lexical-entries',
              format: 'nvh',
              bytes: Buffer.byteLength(nvh),
              rows: 17,
              sha256: checksum(nvh)
            }]
          },
          delivery: { constraints: ['Do not rank lexical entries as frequency observations.'] }
        }
      ]
    };
    const plan = {
      schemaVersion: 1,
      title: 'Fixture lexical collections',
      genericProducts: [],
      contractProducts: [
        {
          contractId: 'transliteration-fixture',
          productType: 'chunked-lexical-collection',
          publication: { status: 'published', scope: 'Every fixture pair.', access: 'Chunked JSON.' },
          views: [{
            id: 'source-name-pairs',
            sourceRole: 'source-name-pairs',
            title: 'Fixture source pairs',
            description: 'Source order is preserved.',
            ordering: { field: 'source', direction: 'as-stored' },
            chunkBytes: 1024,
            derivation: {
              type: 'name-transliteration',
              expectedSummary: { sourceRows: 2, recordCount: 2, totalFrequency: 3 }
            },
            fields: [
              { id: 'sourceLeftName', label: 'First source string', type: 'string', derived: true },
              { id: 'sourceParenthesizedName', label: 'Parenthesized source string', type: 'string', derived: true },
              { id: 'sourceMatchCount', label: 'Source match count', type: 'raw-token-count', unit: 'matches', derived: true }
            ]
          }]
        },
        {
          contractId: 'nvh-fixture',
          productType: 'chunked-lexical-collection',
          publication: { status: 'published', scope: 'Every fixture entry.', access: 'Chunked JSON.' },
          views: [{
            id: 'lexical-entries',
            sourceRole: 'lexical-entries',
            title: 'Fixture lexical entries',
            description: 'Source order is preserved.',
            ordering: { field: 'source', direction: 'as-stored' },
            chunkBytes: 1024,
            derivation: {
              type: 'nvh-lexicon',
              recordPageEntryCount: 3,
              expectedSummary: { sourceRows: 17, recordCount: 2, senseCount: 2, definitionCount: 2, exampleCount: 2 }
            },
            fields: [
              { id: 'entry', label: 'Entry', type: 'string', derived: true },
              { id: 'details', label: 'Lexical details', type: 'lexical-entry-details', derived: true }
            ]
          }]
        }
      ]
    };

    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(sourceRoot, 'transliterations.txt'), transliterations),
      writeFile(path.join(sourceRoot, 'lexicon.nvh'), nvh),
      writeJson(planPath, plan),
      writeJson(contractPath, contract)
    ]);

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 2,
      chunkedViews: 2,
      records: 4
    });

    const transliterationIndex = JSON.parse(await readFile(path.join(outputRoot, 'transliteration-fixture', 'views', 'source-name-pairs', 'index.json'), 'utf8'));
    const transliterationChunk = JSON.parse(await readFile(path.join(outputRoot, 'transliteration-fixture', 'views', 'source-name-pairs', transliterationIndex.chunks[0].file), 'utf8'));
    expect(transliterationChunk.records).toEqual([['Aaronas', 'Aaron', 2], ['Maja', 'Maya', 1]]);
    expect(transliterationIndex.ordering).toEqual({ field: 'source', direction: 'as-stored' });

    const nvhIndex = JSON.parse(await readFile(path.join(outputRoot, 'nvh-fixture', 'views', 'lexical-entries', 'index.json'), 'utf8'));
    const nvhChunk = JSON.parse(await readFile(path.join(outputRoot, 'nvh-fixture', 'views', 'lexical-entries', nvhIndex.chunks[0].file), 'utf8'));
    expect(nvhChunk.records).toEqual([
      ['pirmas', {
        source: { name: 'Pirmas šaltinis', date: '2026-01-01', url: 'https://example.test/first' },
        senses: [{ label: '1', definitions: ['Pirmas apibrėžimas.'], examples: ['Pirmas pavyzdys.'] }],
        userGroups: ['žiūrovai'],
        variants: ['pirmasis'],
        entryCompilers: ['AB']
      }],
      ['antras', {
        source: { name: 'Antras šaltinis', date: null, url: null },
        senses: [{ label: null, definitions: ['Antras apibrėžimas.'], examples: [null] }],
        userGroups: [],
        variants: [],
        entryCompilers: ['CD']
      }]
    ]);
    expect(nvhIndex.derivation).toMatchObject({ recordPageEntryCount: 3, expectedSummary: { recordCount: 2, exampleCount: 2 } });
  });

  it('derives a bounded DML6-style coverage profile with transparent frequency bands', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const source = 'one\t1\t0\ntwo\t2\t1\nthree\t9\t1\nten\t10\t2\ntie-b\t10\t3\ntie-a\t10\t3\n';
    const contract = {
      schemaVersion: 1,
      contracts: [{
        id: 'coverage-fixture',
        title: 'Coverage fixture',
        source: {
          sourceUrl: 'https://example.test/coverage',
          licence: 'CC BY 4.0',
          citation: 'Fixture coverage citation',
          files: [{
            artifactId: 'fixture-types',
            role: 'types-coverage',
            bytes: Buffer.byteLength(source),
            rows: 6,
            sha256: checksum(source),
            columns: 3,
            numericColumns: [1, 2],
            numericTotals: { 1: 42 },
            allowedValues: { 2: [0, 1, 2, 3] },
            samples: ['one\t1\t0', 'tie-a\t10\t3']
          }]
        },
        delivery: { constraints: ['Keep coverage codes categorical.'] }
      }]
    };
    const plan = {
      schemaVersion: 1,
      title: 'Fixture data products',
      genericProducts: [],
      contractProducts: [{
        contractId: 'coverage-fixture',
        productType: 'chunked-comparison',
        publication: { status: 'published', scope: 'Every fixture row.', access: 'Chunked JSON.' },
        views: [{
          id: 'types-coverage',
          sourceRole: 'types-coverage',
          title: 'Fixture coverage',
          description: 'A raw count and categorical coverage code.',
          ordering: { field: 'jclTokenCount', direction: 'descending' },
          chunkBytes: 1024,
          fields: [
            { id: 'word', label: 'Word form', type: 'string', sourceColumn: 0 },
            { id: 'jclTokenCount', label: 'JCL token count', type: 'raw-token-count', unit: 'tokens', sourceColumn: 1 },
            { id: 'dml6CoverageCode', label: 'DML6 coverage', type: 'coverage-code', unit: 'category', sourceColumn: 2, values: { 0: 'missing', 1: 'entry', 2: 'place', 3: 'abbreviation' } }
          ]
        }],
        analysisProfiles: [{
          id: 'coverage-by-band',
          type: 'frequency-band-coverage',
          sourceRole: 'types-coverage',
          title: 'Coverage by band',
          description: 'Transparent fixture bands.',
          summaryMaxBytes: 8192,
          frequencyBands: [
            { id: 'one', label: '1', minimum: 1, maximum: 1 },
            { id: 'two-to-nine', label: '2–9', minimum: 2, maximum: 9 },
            { id: 'ten-plus', label: '10+', minimum: 10, maximum: null }
          ],
          drilldown: {
            limit: 2,
            maxBytes: 4096,
            ordering: { field: 'jclTokenCount', direction: 'descending', tieBreak: 'word-ascending' }
          }
        }]
      }]
    };

    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(sourceRoot, 'types.tsv'), source),
      writeJson(planPath, plan),
      writeJson(contractPath, contract)
    ]);

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 1,
      chunkedViews: 1,
      records: 6
    });

    const profile = JSON.parse(await readFile(path.join(outputRoot, 'coverage-fixture', 'analysis', 'coverage-by-band', 'manifest.json'), 'utf8'));
    expect(profile.summary).toMatchObject({
      sourceRows: 6,
      totalTypeCount: 6,
      totalTokenCount: 42
    });
    expect(profile.summary.bands.map((band) => [band.id, band.typeCount, band.tokenCount])).toEqual([
      ['one', 1, 1],
      ['two-to-nine', 2, 11],
      ['ten-plus', 3, 30]
    ]);
    const abbreviation = profile.summary.bands[2].categories.find((category) => category.coverageCode === 3);
    const drilldown = JSON.parse(await readFile(path.join(outputRoot, 'coverage-fixture', 'analysis', 'coverage-by-band', abbreviation.drilldown.file), 'utf8'));
    expect(drilldown.records).toEqual([['tie-a', 10], ['tie-b', 10]]);
  });

  it('builds a bounded normalized-contrast lookup without copying the source metrics into lookup buckets', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const source = [
      'KARAS\t200\t50\t800\t200\t400\t100',
      'RETAS\t50\t12\t1000\t500\t\t',
      'IŠSPRĘSTA\t544\t405\t\t\t670\t670',
      'IŠSPRĘSTA\t\t\t638\t593\t\t'
    ].join('\n').concat('\n');
    const contract = {
      schemaVersion: 1,
      contracts: [{
        id: 'contrast-fixture',
        title: 'Contrast fixture',
        source: {
          sourceUrl: 'https://example.test/contrast',
          licence: 'CC BY 4.0',
          citation: 'Fixture contrast citation',
          files: [{
            artifactId: 'fixture-contrast',
            role: 'normalized-comparison',
            bytes: Buffer.byteLength(source),
            rows: 4,
            sha256: checksum(source),
            columns: 7,
            numericColumns: [1, 2, 3, 4, 5, 6],
            nullableColumns: [1, 2, 3, 4, 5, 6],
            numericTotals: { 1: 794, 2: 467, 3: 2438, 4: 1293, 5: 1070, 6: 770 },
            missingCounts: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2 },
            samples: ['KARAS\t200\t50\t800\t200\t400\t100', 'IŠSPRĘSTA\t\t\t638\t593\t\t']
          }]
        },
        delivery: { constraints: ['Keep absent metrics as null.'] }
      }]
    };
    const normalized = (id, label, type, sourceColumn, sourceTokens) => ({
      id, label, type, unit: `${type === 'normalized-token-count' ? 'tokens' : 'documents'} per 100 million source words`,
      sourceColumn, nullable: true, normalization: { sourceTokens, targetTokens: 100000000 }
    });
    const fields = [
      { id: 'word', label: 'Word form', type: 'string', sourceColumn: 0 },
      normalized('ccll2TokenCount', 'CCLL2 token count', 'normalized-token-count', 1, 162000000),
      normalized('ccll2DocumentCount', 'CCLL2 document count', 'normalized-document-count', 2, 162000000),
      normalized('mediaTokenCount', 'Media token count', 'normalized-token-count', 3, 36000000),
      normalized('mediaDocumentCount', 'Media document count', 'normalized-document-count', 4, 36000000),
      normalized('socialTokenCount', 'Social token count', 'normalized-token-count', 5, 2000000),
      normalized('socialDocumentCount', 'Social document count', 'normalized-document-count', 6, 2000000)
    ];
    const plan = {
      schemaVersion: 1,
      title: 'Fixture data products',
      genericProducts: [],
      contractProducts: [{
        contractId: 'contrast-fixture',
        productType: 'chunked-comparison',
        publication: { status: 'published', scope: 'Every fixture row.', access: 'Chunked JSON.' },
        views: [{
          id: 'normalized-comparison', sourceRole: 'normalized-comparison', title: 'Fixture comparison',
          description: 'Nullable normalized metrics.', ordering: { field: 'word', direction: 'ascending' },
          chunkBytes: 1024, fields
        }],
        analysisProfiles: [{
          id: 'contrast-lookup', type: 'normalized-contrast-lookup', sourceRole: 'normalized-comparison',
          title: 'Fixture lookup', description: 'Bounded lookup fixture.', summaryMaxBytes: 16384,
          lookup: { maxBucketBytes: 8192, normalization: 'trim-nfc-uppercase-lt', maxSourceRowsPerWord: 2 },
          sources: [
            { id: 'ccll2', label: 'CCLL2', tokenField: 'ccll2TokenCount', documentField: 'ccll2DocumentCount' },
            { id: 'media', label: 'Media', tokenField: 'mediaTokenCount', documentField: 'mediaDocumentCount' },
            { id: 'social', label: 'Social', tokenField: 'socialTokenCount', documentField: 'socialDocumentCount' }
          ],
          pairs: [{ id: 'media-vs-ccll2', label: 'Media / CCLL2', numeratorSource: 'media', denominatorSource: 'ccll2' }],
          minimumRate: 100
        }]
      }]
    };

    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      writeFile(path.join(sourceRoot, 'comparison.tsv'), source),
      writeJson(planPath, plan),
      writeJson(contractPath, contract)
    ]);

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 1,
      chunkedViews: 1,
      records: 4
    });

    const profile = JSON.parse(await readFile(path.join(outputRoot, 'contrast-fixture', 'analysis', 'contrast-lookup', 'manifest.json'), 'utf8'));
    expect(profile.summary).toEqual({
      lookupRecords: 4,
      uniqueNormalizedWordForms: 3,
      duplicateNormalizedWordForms: 1,
      extraDuplicateRows: 1,
      maxSourceRowsPerWord: 2,
      sourceRows: 4
    });
    const bucket = profile.lookup.routing.buckets[0];
    const lookupRecords = JSON.parse(await readFile(path.join(outputRoot, 'contrast-fixture', 'analysis', 'contrast-lookup', bucket.file), 'utf8')).records;
    expect(lookupRecords).toContainEqual(['KARAS', 0]);
    expect(lookupRecords[0]).toHaveLength(2);
    expect(bucket.bytes).toBeLessThanOrEqual(profile.delivery.lookupBucketMaxBytes);
  });

  it('joins only the five named CCLL subcorpora into bounded, null-preserving genre lookup files', async () => {
    const root = await makeDirectory();
    const sourceRoot = path.join(root, 'sources');
    const staticRoot = path.join(root, 'static');
    const outputRoot = path.join(staticRoot, 'data-products');
    const planPath = path.join(root, 'plan.json');
    const contractPath = path.join(root, 'contract.json');
    const sourceByRole = {
      'subcorpus-fiction': '!\t2\nantras\t3\nalpha\t1\nvisos\t7\n',
      'subcorpus-non-fiction': 'kelios\t3\nvisos\t8\n',
      'subcorpus-administrative': 'kelios\t4\nvisos\t9\n',
      'subcorpus-periodicals': 'kelios\t5\nvisos\t10\n',
      'subcorpus-speech': 'kelios\t6\nvisos\t11\n'
    };
    const sourceIds = {
      'subcorpus-fiction': 'fiction',
      'subcorpus-non-fiction': 'non-fiction',
      'subcorpus-administrative': 'administrative',
      'subcorpus-periodicals': 'periodicals',
      'subcorpus-speech': 'speech'
    };
    const tokenTotals = {
      'subcorpus-fiction': 13,
      'subcorpus-non-fiction': 11,
      'subcorpus-administrative': 13,
      'subcorpus-periodicals': 15,
      'subcorpus-speech': 17
    };
    const roles = Object.keys(sourceByRole);
    const fields = [
      { id: 'word', label: 'Word form', type: 'string', sourceColumn: 0 },
      { id: 'count', label: 'Token count', type: 'raw-token-count', unit: 'tokens', sourceColumn: 1 }
    ];
    const contract = {
      schemaVersion: 1,
      contracts: [{
        id: 'ccll-genre-fixture',
        title: 'CCLL genre fixture',
        source: {
          sourceUrl: 'https://example.test/ccll',
          licence: 'CC BY 4.0',
          citation: 'Fixture CCLL citation',
          files: roles.map((role) => {
            const source = sourceByRole[role];
            return {
              artifactId: `fixture-${sourceIds[role]}`,
              role,
              bytes: Buffer.byteLength(source),
              rows: source.trim().split('\n').length,
              sha256: checksum(source),
              columns: 2,
              numericColumns: [1],
              numericTotals: { 1: tokenTotals[role] },
              samples: [source.trim().split('\n')[0]]
            };
          })
        },
        delivery: { constraints: ['Keep aggregate data out of the named-genre profile.'] }
      }]
    };
    const plan = {
      schemaVersion: 1,
      title: 'Fixture data products',
      genericProducts: [],
      contractProducts: [{
        contractId: 'ccll-genre-fixture',
        productType: 'chunked-wordform-list',
        publication: { status: 'published', scope: 'Every fixture row.', access: 'Bounded JSON.' },
        views: roles.map((role) => ({
          id: `${sourceIds[role]}-by-frequency`,
          sourceRole: role,
          title: `${sourceIds[role]} fixture`,
          description: 'Fixture word forms.',
          ordering: { field: 'count', direction: 'descending' },
          chunkBytes: 1024,
          fields
        })),
        analysisProfiles: [{
          id: 'genre-profile',
          type: 'ccll-genre-wordform-lookup',
          title: 'Fixture genre profile',
          description: 'A bounded fixture profile.',
          summaryMaxBytes: 8192,
          sources: [
            { id: 'fiction', label: 'Fiction', sourceRole: 'subcorpus-fiction' },
            { id: 'non-fiction', label: 'Non-fiction', sourceRole: 'subcorpus-non-fiction' },
            { id: 'administrative', label: 'Administration', sourceRole: 'subcorpus-administrative' },
            { id: 'periodicals', label: 'Periodicals', sourceRole: 'subcorpus-periodicals' },
            { id: 'speech', label: 'Spoken language', sourceRole: 'subcorpus-speech' }
          ],
          rate: { targetTokens: 1000000, unit: 'tokens per million source tokens', formula: 'rawCount * 1000000 / sourceTokens' },
          lookup: { normalization: 'trim-nfc-preserve-case', maxRoutingNodeBytes: 4096, maxBucketBytes: 4096 },
          policies: {
            aggregate: 'excluded',
            punctuation: 'preserve-source-wordforms',
            repeatedTerm: 'reject-duplicate-exact-wordforms-per-source',
            missing: 'not-observed-null',
            threshold: { minimumRawCount: 1, appliesTo: 'exact-lookup-only-no-ranking' },
            ordering: { field: 'word', direction: 'ascending', tieBreak: 'unicode-code-point' }
          }
        }]
      }]
    };

    await mkdir(sourceRoot, { recursive: true });
    await Promise.all([
      ...roles.map((role) => writeFile(path.join(sourceRoot, `${sourceIds[role]}.tsv`), sourceByRole[role])),
      writeJson(planPath, plan),
      writeJson(contractPath, contract)
    ]);

    await buildDataProducts({ sourceRoot, staticRoot, outputRoot, planPath, contractPath });
    await expect(verifyDataProducts({ outputRoot, staticRoot })).resolves.toMatchObject({
      products: 1,
      chunkedViews: 5,
      records: 12
    });

    const profileDirectory = path.join(outputRoot, 'ccll-genre-fixture', 'analysis', 'genre-profile');
    const profile = JSON.parse(await readFile(path.join(profileDirectory, 'manifest.json'), 'utf8'));
    expect(profile.lookup).not.toHaveProperty('buckets');
    expect(profile.summary).toEqual({
      joinedWordforms: 5,
      totalSourceRows: 12,
      sourceRows: { fiction: 4, 'non-fiction': 2, administrative: 2, periodicals: 2, speech: 2 },
      sourceTokenTotals: { fiction: 13, 'non-fiction': 11, administrative: 13, periodicals: 15, speech: 17 },
      observedGenreCounts: { 1: 3, 2: 0, 3: 0, 4: 1, 5: 1 },
      routingNodeCount: 1,
      lookupBucketCount: 1
    });
    const rootNode = JSON.parse(await readFile(path.join(profileDirectory, profile.lookup.root), 'utf8'));
    const punctuation = rootNode.transitions.find(([character]) => character === '!')[1].bucket;
    const punctuationRecords = JSON.parse(await readFile(path.join(profileDirectory, punctuation.file), 'utf8')).records;
    expect(punctuationRecords.filter((record) => record[0] === '!')).toEqual([['!', 2, null, null, null, null, 1]]);
    const aBucket = rootNode.transitions.find(([character]) => character === 'a')[1].bucket;
    const aRecords = JSON.parse(await readFile(path.join(profileDirectory, aBucket.file), 'utf8')).records;
    expect(aRecords.filter((record) => record[0].startsWith('a')).map((record) => record[0])).toEqual(['alpha', 'antras']);
    const kBucket = rootNode.transitions.find(([character]) => character === 'k')[1].bucket;
    const kRecords = JSON.parse(await readFile(path.join(profileDirectory, kBucket.file), 'utf8')).records;
    expect(kRecords.filter((record) => record[0] === 'kelios')).toEqual([['kelios', null, 3, 4, 5, 6, 4]]);
  });
});
