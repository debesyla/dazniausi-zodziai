import { createHash } from 'node:crypto';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifySourceContracts } from '../../scripts/verify-source-contracts.mjs';

const temporaryDirectories = [];

async function makeDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dazniausi-zodziai-contract-'));
  temporaryDirectories.push(directory);
  return directory;
}

function checksum(source) {
  return createHash('sha256').update(source).digest('hex');
}

function manifestFor(file) {
  return {
    schemaVersion: 1,
    contracts: [{
      id: 'fixture',
      source: { files: [file] }
    }]
  };
}

async function makeRimkuteFixture({ unresolvedRows = 0 } = {}) {
  const sourceRoot = await makeDirectory();
  const columns = ['wordform', 'frequency', 'morphemic_analysis', 'lemma_and_morphology', 'volume', 'source_page'];
  const samples = [
    { wordform: 'darbo', frequency: 1, morphemic_analysis: 'darb-o', lemma_and_morphology: 'darbas; dkt.', volume: 'I', source_page: 9 },
    { wordform: 'aišku', frequency: 2, morphemic_analysis: 'aišk-u', lemma_and_morphology: 'aiškus; bdv.', volume: 'II', source_page: 5 },
    { wordform: 'būti', frequency: 3, morphemic_analysis: 'bū-ti', lemma_and_morphology: 'būti; vksm.', volume: 'III', source_page: 5 }
  ];
  const tsv = `${columns.join('\t')}\n${samples.map((sample) => columns.map((column) => sample[column]).join('\t')).join('\n')}\n`;
  const pdfs = [
    { volume: 'I', artifactId: 'rimkute-morphemic-dictionary-volume-one', name: 'I.pdf', pages: 801, content: 'volume-one-pdf' },
    { volume: 'II', artifactId: 'rimkute-morphemic-dictionary-volume-two', name: 'II.pdf', pages: 357, content: 'volume-two-pdf-longer' },
    { volume: 'III', artifactId: 'rimkute-morphemic-dictionary-volume-three', name: 'III.pdf', pages: 961, content: 'volume-three-pdf-longest' }
  ];
  const method = {
    id: 'pdf-coordinate-columns-v1',
    normalization: 'Unicode NFC; source text otherwise preserved',
    rowOrder: 'PDF volume order I, II, III; page order; top-to-bottom order',
    columnBoundariesPoints: [0, 145, 180, 285, 612],
    continuationPolicy: "A pure x >= 285 pt line is buffered: it is prepended to the next same-page row only when that row's description lacks a semicolon; otherwise it is appended to the preceding row, including across page boundaries.",
    splitFragmentPolicy: 'A reviewed non-row split line is joined to its adjacent row using source-layout direction; forward joins require the next row on the same page within 17 pt. Every split-line digest must match the manifest set.'
  };
  const volumes = samples.map((sample) => ({
    volume: sample.volume,
    rows: 1,
    frequencyTotal: sample.frequency,
    continuationLines: 0,
    reviewedSplitLines: 0,
    sectionHeadings: [{ page: sample.source_page, text: `Volume ${sample.volume}` }]
  }));
  const summaryObject = {
    schemaVersion: 1,
    id: 'rimkute-2011-dazninis-morfemikos-zodynas',
    source: {
      scope: 'the three reviewed 2011 PDF volumes only; the live Morfema database was not accessed',
      files: pdfs.map(({ volume, name, pages, content }) => ({
        volume,
        name,
        pages,
        bytes: Buffer.byteLength(content),
        sha256: checksum(content)
      }))
    },
    method,
    runtime: { python: '3.12.13', popplerPdftotext: '26.05.0', dependencyLock: 'extraction-runtime.json' },
    volumes,
    output: {
      file: 'morphemic-entries.tsv',
      format: 'UTF-8 TSV with LF line endings',
      columns,
      rows: 3,
      frequencyTotal: 6,
      rowsByVolume: { I: 1, II: 1, III: 1 },
      bytes: Buffer.byteLength(tsv),
      sha256: checksum(tsv)
    },
    manualReview: {
      unresolvedRows,
      corrections: 0,
      note: 'All reviewed.'
    },
    representativeSamples: samples
  };
  const summary = `${JSON.stringify(summaryObject, null, 2)}\n`;
  const summaryDescriptor = {
    artifactId: 'rimkute-morphemic-dictionary-extraction-summary',
    format: 'rimkute-extraction-summary',
    bytes: Buffer.byteLength(summary),
    sha256: checksum(summary)
  };
  const canonicalDescriptor = {
    artifactId: 'rimkute-morphemic-dictionary-entries',
    role: 'morphemic-entries',
    format: 'text',
    bytes: Buffer.byteLength(tsv),
    sha256: checksum(tsv),
    rows: 3,
    columns: 6,
    delimiter: '\t',
    hasHeader: true,
    header: columns,
    numericColumns: [1, 5],
    numericTotals: { 1: 6 },
    samples: samples.map((sample) => columns.map((column) => String(sample[column])).join('\t'))
  };
  const contract = {
    schemaVersion: 1,
    contracts: [{
      id: 'rimkute-morphemic-dictionary',
      source: {
        files: [
          ...pdfs.map(({ volume, artifactId, name, pages, content }) => ({
            volume,
            artifactId,
            name,
            pages,
            format: 'binary',
            bytes: Buffer.byteLength(content),
            sha256: checksum(content)
          })),
          canonicalDescriptor,
          summaryDescriptor
        ],
        extraction: {
          method,
          runtime: { python: '3.12.13', popplerPdftotext: '26.05.0' },
          rows: 3,
          frequencyTotal: 6,
          volumes: volumes.map(({ volume, rows, frequencyTotal }) => ({ volume, rows, frequencyTotal })),
          representativeSamples: samples,
          summaryArtifact: {
            artifactId: summaryDescriptor.artifactId,
            format: summaryDescriptor.format,
            bytes: summaryDescriptor.bytes,
            sha256: summaryDescriptor.sha256
          }
        }
      }
    }]
  };
  await Promise.all([
    ...pdfs.map((pdf) => writeFile(path.join(sourceRoot, `${pdf.volume}.pdf`), pdf.content)),
    writeFile(path.join(sourceRoot, 'morphemic-entries.tsv'), tsv),
    writeFile(path.join(sourceRoot, 'extraction-summary.json'), summary)
  ]);
  const contractPath = path.join(sourceRoot, 'contract.json');
  await writeFile(contractPath, JSON.stringify(contract));
  return { contractPath, sourceRoot };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('verifySourceContracts', () => {
  it('validates bytes, rows, metrics, nullable values, and representative samples', async () => {
    const sourceRoot = await makeDirectory();
    const source = 'IR\t10\t2\nHRS\t\t4\n';
    await writeFile(path.join(sourceRoot, 'comparison.tsv'), source);
    const contractPath = path.join(sourceRoot, 'contract.json');
    await writeFile(contractPath, JSON.stringify(manifestFor({
      artifactId: 'fixture-comparison',
      bytes: Buffer.byteLength(source),
      rows: 2,
      sha256: checksum(source),
      columns: 3,
      numericColumns: [1, 2],
      nullableColumns: [1],
      numericTotals: { 1: 10, 2: 6 },
      missingCounts: { 1: 1 },
      samples: ['IR\t10\t2', 'HRS\t\t4']
    })));

    await expect(verifySourceContracts({ contractPath, sourceRoot })).resolves.toEqual({ contracts: 1, files: 1 });
  });

  it('rejects a changed categorical value instead of accepting it as a frequency', async () => {
    const sourceRoot = await makeDirectory();
    const source = 'ir\t10\t4\n';
    await writeFile(path.join(sourceRoot, 'comparison.tsv'), source);
    const contractPath = path.join(sourceRoot, 'contract.json');
    await writeFile(contractPath, JSON.stringify(manifestFor({
      artifactId: 'fixture-comparison',
      bytes: Buffer.byteLength(source),
      rows: 1,
      sha256: checksum(source),
      columns: 3,
      numericColumns: [1],
      allowedValues: { 2: [0, 1, 2, 3] }
    })));

    await expect(verifySourceContracts({ contractPath, sourceRoot })).rejects.toThrow('unexpected value');
  });

  it('validates a quoted CSV header and integer-valued scientific notation', async () => {
    const sourceRoot = await makeDirectory();
    const source = '_id,frequency\n"ir,",2.5e1\nkad,5\n';
    await writeFile(path.join(sourceRoot, 'onegrams.csv'), source);
    const contractPath = path.join(sourceRoot, 'contract.json');
    await writeFile(contractPath, JSON.stringify(manifestFor({
      artifactId: 'fixture-onegrams',
      bytes: Buffer.byteLength(source),
      rows: 2,
      sha256: checksum(source),
      delimiter: ',',
      hasHeader: true,
      columns: 2,
      numericColumns: [1],
      numericTotals: { 1: 30 },
      samples: ['"ir,",2.5e1', 'kad,5']
    })));

    await expect(verifySourceContracts({ contractPath, sourceRoot })).resolves.toEqual({ contracts: 1, files: 1 });
  });

  it('preserves an explicitly missing nullable string field', async () => {
    const sourceRoot = await makeDirectory();
    const source = 'homoform\tlemma\tmorphology\nbūti\tbūti\t\natlikti\tatlikti\tvksm.\n';
    await writeFile(path.join(sourceRoot, 'homoforms.tsv'), source);
    const contractPath = path.join(sourceRoot, 'contract.json');
    await writeFile(contractPath, JSON.stringify(manifestFor({
      artifactId: 'fixture-homoforms',
      bytes: Buffer.byteLength(source),
      rows: 2,
      sha256: checksum(source),
      hasHeader: true,
      columns: 3,
      nullableColumns: [2],
      missingCounts: { 2: 1 }
    })));

    await expect(verifySourceContracts({ contractPath, sourceRoot })).resolves.toEqual({ contracts: 1, files: 1 });
  });

  it('ignores a source symlink that escapes the configured root', async () => {
    const sourceRoot = await makeDirectory();
    const outsideRoot = await makeDirectory();
    await writeFile(path.join(outsideRoot, 'outside.tsv'), 'word\tcount\nir\t1\n');
    await symlink(path.join(outsideRoot, 'outside.tsv'), path.join(sourceRoot, 'linked.tsv'));
    const contractPath = path.join(sourceRoot, 'contract.json');
    await writeFile(contractPath, JSON.stringify(manifestFor({
      artifactId: 'fixture-linked',
      bytes: 18,
      rows: 2,
      sha256: checksum('word\tcount\nir\t1\n'),
      columns: 2,
      numericColumns: [1]
    })));

    await expect(verifySourceContracts({ contractPath, sourceRoot })).rejects.toThrow('must resolve to exactly one verified regular file');
  });

  it('semantically verifies the reviewed Rimkute extraction summary against the PDFs and canonical TSV', async () => {
    const fixture = await makeRimkuteFixture();

    await expect(verifySourceContracts(fixture)).resolves.toEqual({ contracts: 1, files: 5 });
  });

  it('rejects a checksummed Rimkute summary with unresolved extraction rows', async () => {
    const fixture = await makeRimkuteFixture({ unresolvedRows: 1 });

    await expect(verifySourceContracts(fixture)).rejects.toThrow('zero unresolved rows');
  });
});
