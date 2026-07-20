import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDelimitedLine } from './prepare-dataset.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContractPath = path.join(repositoryRoot, 'data', 'contracts', 'deferred-sources.json');

function fail(message) {
  throw new Error(`Source contract verification failed: ${message}`);
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value) || value.includes('\\')) return false;
  const parts = value.split('/');
  return !parts.includes('..') && !value.includes('\0');
}

function countLines(text) {
  const lines = text.split(/\r?\n/);
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines;
}

function parseInteger(value, description) {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(normalized)) {
    fail(`${description} must be a non-negative integer, received "${value}"`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    fail(`${description} must be a safe non-negative integer, received "${value}"`);
  }
  return BigInt(parsed);
}

async function resolveSourcePath(sourceRoot, relativePath) {
  if (!isSafeRelativePath(relativePath)) fail(`source path is not safe: ${relativePath}`);
  const root = await import('node:fs/promises').then(({ realpath }) => realpath(sourceRoot));
  const candidate = path.resolve(root, relativePath);
  const resolved = await import('node:fs/promises').then(({ realpath }) => realpath(candidate));
  const relative = path.relative(root, resolved);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    fail(`source path escapes the configured root after resolving symbolic links: ${relativePath}`);
  }
  return resolved;
}

function verifyTextFile(file, buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`source file is not valid UTF-8: ${file.path}`);
  }

  const physicalLines = countLines(text);
  const lines = file.hasHeader === true ? physicalLines.slice(1) : physicalLines;
  if (file.hasHeader === true && physicalLines.length === 0) fail(`${file.path} is missing its header`);
  if (lines.length !== file.rows) fail(`${file.path} row count mismatch: expected ${file.rows}, received ${lines.length}`);

  const delimiter = file.delimiter ?? '\t';
  const totals = new Map((Object.keys(file.numericTotals ?? {})).map((column) => [Number(column), 0n]));
  const counts = new Map();
  const valueCounts = new Map();
  const nullableColumns = new Set(file.nullableColumns ?? []);
  const numericColumns = new Set(file.numericColumns ?? []);
  const allowedValues = file.allowedValues ?? {};

  for (const [lineIndex, line] of lines.entries()) {
    const columns = parseDelimitedLine(line, delimiter);
    if (columns.length !== file.columns) fail(`${file.path} column count mismatch at row ${lineIndex + 1}: expected ${file.columns}, received ${columns.length}`);

    for (const column of numericColumns) {
      const value = columns[column];
      if (value === '' && nullableColumns.has(column)) {
        counts.set(column, (counts.get(column) ?? 0) + 1);
        continue;
      }
      const parsed = parseInteger(value, `${file.path} row ${lineIndex + 1} column ${column}`);
      if (totals.has(column)) totals.set(column, totals.get(column) + parsed);
    }

    for (const [column, values] of Object.entries(allowedValues)) {
      const index = Number(column);
      if (!values.map(String).includes(columns[index])) fail(`${file.path} has an unexpected value at row ${lineIndex + 1} column ${column}: ${columns[index]}`);
      const key = `${column}\u0000${columns[index]}`;
      valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [column, expected] of Object.entries(file.numericTotals ?? {})) {
    const actual = totals.get(Number(column));
    if (actual !== BigInt(expected)) fail(`${file.path} total mismatch for column ${column}: expected ${expected}, received ${actual}`);
  }
  for (const [column, expected] of Object.entries(file.missingCounts ?? {})) {
    const actual = counts.get(Number(column)) ?? 0;
    if (actual !== expected) fail(`${file.path} missing-value count mismatch for column ${column}: expected ${expected}, received ${actual}`);
  }
  for (const [column, expectedValues] of Object.entries(file.valueCounts ?? {})) {
    for (const [value, expected] of Object.entries(expectedValues)) {
      const actual = valueCounts.get(`${column}\u0000${value}`) ?? 0;
      if (actual !== expected) fail(`${file.path} value count mismatch for column ${column}, value ${value}: expected ${expected}, received ${actual}`);
    }
  }
  for (const sample of file.samples ?? []) {
    if (!lines.includes(sample)) fail(`${file.path} representative sample is missing: ${sample}`);
  }
}

export async function verifySourceContracts({ contractPath = defaultContractPath, sourceRoot }) {
  if (!sourceRoot) fail('a --source-root directory is required');
  const manifest = JSON.parse(await readFile(contractPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.contracts)) fail('contract manifest must use schemaVersion 1 and contain contracts');

  let verifiedFiles = 0;
  for (const contract of manifest.contracts) {
    for (const file of contract.source.files ?? []) {
      const sourcePath = await resolveSourcePath(sourceRoot, file.path);
      const buffer = await readFile(sourcePath);
      const checksum = createHash('sha256').update(buffer).digest('hex');
      if (buffer.byteLength !== file.bytes) fail(`${file.path} byte count mismatch: expected ${file.bytes}, received ${buffer.byteLength}`);
      if (checksum !== file.sha256) fail(`${file.path} checksum mismatch: expected ${file.sha256}, received ${checksum}`);
      if (!['binary', 'zip-conllu'].includes(file.format)) verifyTextFile(file, buffer);
      verifiedFiles += 1;
    }
  }
  return { contracts: manifest.contracts.length, files: verifiedFiles };
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--source-root') options.sourceRoot = args[++index];
    else if (args[index] === '--contract') options.contractPath = path.resolve(args[++index]);
    else fail(`unknown argument: ${args[index]}`);
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifySourceContracts(parseArguments(process.argv.slice(2)));
    console.log(`Verified ${result.files} source files across ${result.contracts} contracts.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
