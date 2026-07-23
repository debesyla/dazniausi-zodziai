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
      path: 'comparison.tsv',
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
      path: 'comparison.tsv',
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
      path: 'onegrams.csv',
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
      path: 'homoforms.tsv',
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

  it('rejects a source symlink that escapes the configured root', async () => {
    const sourceRoot = await makeDirectory();
    const outsideRoot = await makeDirectory();
    await writeFile(path.join(outsideRoot, 'outside.tsv'), 'word\tcount\nir\t1\n');
    await symlink(path.join(outsideRoot, 'outside.tsv'), path.join(sourceRoot, 'linked.tsv'));
    const contractPath = path.join(sourceRoot, 'contract.json');
    await writeFile(contractPath, JSON.stringify(manifestFor({
      path: 'linked.tsv',
      bytes: 18,
      rows: 2,
      sha256: checksum('word\tcount\nir\t1\n'),
      columns: 2,
      numericColumns: [1]
    })));

    await expect(verifySourceContracts({ contractPath, sourceRoot })).rejects.toThrow('escapes the configured root');
  });
});
