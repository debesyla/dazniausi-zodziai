import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import { parseDelimitedLine } from './prepare-dataset.mjs';
import { createSourceArtifactResolver } from './source-artifacts.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContractPath = path.join(repositoryRoot, 'data', 'contracts', 'deferred-sources.json');
const RIMKUTE_CONTRACT_ID = 'rimkute-morphemic-dictionary';
const RIMKUTE_SUMMARY_ARTIFACT_ID = 'rimkute-morphemic-dictionary-extraction-summary';
const RIMKUTE_SUMMARY_FORMAT = 'rimkute-extraction-summary';
const RIMKUTE_TSV_ARTIFACT_ID = 'rimkute-morphemic-dictionary-entries';
const RIMKUTE_COLUMNS = ['wordform', 'frequency', 'morphemic_analysis', 'lemma_and_morphology', 'volume', 'source_page'];
const RIMKUTE_PDF_ARTIFACTS = [
  { volume: 'I', artifactId: 'rimkute-morphemic-dictionary-volume-one' },
  { volume: 'II', artifactId: 'rimkute-morphemic-dictionary-volume-two' },
  { volume: 'III', artifactId: 'rimkute-morphemic-dictionary-volume-three' }
];
const RIMKUTE_METHOD = {
  id: 'pdf-coordinate-columns-v1',
  normalization: 'Unicode NFC; source text otherwise preserved',
  rowOrder: 'PDF volume order I, II, III; page order; top-to-bottom order',
  columnBoundariesPoints: [0, 145, 180, 285, 612],
  continuationPolicy: "A pure x >= 285 pt line is buffered: it is prepended to the next same-page row only when that row's description lacks a semicolon; otherwise it is appended to the preceding row, including across page boundaries.",
  splitFragmentPolicy: 'A reviewed non-row split line is joined to its adjacent row using source-layout direction; forward joins require the next row on the same page within 17 pt. Every split-line digest must match the manifest set.'
};

function fail(message) {
  throw new Error(`Source contract verification failed: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value)
    && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
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

function sourceLabel(file) {
  return `source artifact "${file.artifactId}"`;
}

function verifyTextFile(file, buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`${sourceLabel(file)} is not valid UTF-8`);
  }

  const physicalLines = countLines(text);
  const lines = file.hasHeader === true ? physicalLines.slice(1) : physicalLines;
  if (file.hasHeader === true && physicalLines.length === 0) fail(`${sourceLabel(file)} is missing its header`);
  if (file.header !== undefined) {
    if (file.hasHeader !== true || !Array.isArray(file.header)) {
      fail(`${sourceLabel(file)} can pin a header only when hasHeader is true`);
    }
    const actualHeader = parseDelimitedLine(physicalLines[0], file.delimiter ?? '\t');
    if (!isDeepStrictEqual(actualHeader, file.header)) {
      fail(`${sourceLabel(file)} header mismatch: expected ${JSON.stringify(file.header)}, received ${JSON.stringify(actualHeader)}`);
    }
  }
  if (lines.length !== file.rows) fail(`${sourceLabel(file)} row count mismatch: expected ${file.rows}, received ${lines.length}`);

  const delimiter = file.delimiter ?? '\t';
  const totals = new Map((Object.keys(file.numericTotals ?? {})).map((column) => [Number(column), 0n]));
  const counts = new Map();
  const valueCounts = new Map();
  const nullableColumns = new Set(file.nullableColumns ?? []);
  const numericColumns = new Set(file.numericColumns ?? []);
  const allowedValues = file.allowedValues ?? {};

  for (const [lineIndex, line] of lines.entries()) {
    const columns = parseDelimitedLine(line, delimiter);
    if (columns.length !== file.columns) fail(`${sourceLabel(file)} column count mismatch at row ${lineIndex + 1}: expected ${file.columns}, received ${columns.length}`);

    for (const column of nullableColumns) {
      if (columns[column] === '') counts.set(column, (counts.get(column) ?? 0) + 1);
    }

    for (const column of numericColumns) {
      const value = columns[column];
      if (value === '' && nullableColumns.has(column)) {
        continue;
      }
      const parsed = parseInteger(value, `${sourceLabel(file)} row ${lineIndex + 1} column ${column}`);
      if (totals.has(column)) totals.set(column, totals.get(column) + parsed);
    }

    for (const [column, values] of Object.entries(allowedValues)) {
      const index = Number(column);
      if (!values.map(String).includes(columns[index])) fail(`${sourceLabel(file)} has an unexpected value at row ${lineIndex + 1} column ${column}: ${columns[index]}`);
      const key = `${column}\u0000${columns[index]}`;
      valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [column, expected] of Object.entries(file.numericTotals ?? {})) {
    const actual = totals.get(Number(column));
    if (actual !== BigInt(expected)) fail(`${sourceLabel(file)} total mismatch for column ${column}: expected ${expected}, received ${actual}`);
  }
  for (const [column, expected] of Object.entries(file.missingCounts ?? {})) {
    const actual = counts.get(Number(column)) ?? 0;
    if (actual !== expected) fail(`${sourceLabel(file)} missing-value count mismatch for column ${column}: expected ${expected}, received ${actual}`);
  }
  for (const [column, expectedValues] of Object.entries(file.valueCounts ?? {})) {
    for (const [value, expected] of Object.entries(expectedValues)) {
      const actual = valueCounts.get(`${column}\u0000${value}`) ?? 0;
      if (actual !== expected) fail(`${sourceLabel(file)} value count mismatch for column ${column}, value ${value}: expected ${expected}, received ${actual}`);
    }
  }
  for (const sample of file.samples ?? []) {
    if (!lines.includes(sample)) fail(`${sourceLabel(file)} representative sample is missing: ${sample}`);
  }
}

function parseJsonSummary(file, buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`${sourceLabel(file)} is not valid UTF-8`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`${sourceLabel(file)} is not valid JSON`);
  }
}

function validateRimkuteSample(sample, description) {
  if (!hasExactKeys(sample, RIMKUTE_COLUMNS)
    || typeof sample.wordform !== 'string' || sample.wordform.length === 0
    || !isPositiveSafeInteger(sample.frequency)
    || typeof sample.morphemic_analysis !== 'string' || sample.morphemic_analysis.length === 0
    || typeof sample.lemma_and_morphology !== 'string' || sample.lemma_and_morphology.length === 0
    || !['I', 'II', 'III'].includes(sample.volume)
    || !isPositiveSafeInteger(sample.source_page)) {
    fail(`${description} is invalid`);
  }
  for (const key of ['wordform', 'morphemic_analysis', 'lemma_and_morphology', 'volume']) {
    if (sample[key] !== sample[key].normalize('NFC') || /[\t\r\n]/.test(sample[key])) {
      fail(`${description}.${key} is not NFC text safe for the canonical TSV`);
    }
  }
}

function validateRimkuteSummaryVolume(volume, expectedVolume, description) {
  if (!hasExactKeys(volume, ['volume', 'rows', 'frequencyTotal', 'continuationLines', 'reviewedSplitLines', 'sectionHeadings'])
    || volume.volume !== expectedVolume
    || !isPositiveSafeInteger(volume.rows)
    || !isPositiveSafeInteger(volume.frequencyTotal)
    || !Number.isSafeInteger(volume.continuationLines) || volume.continuationLines < 0
    || !Number.isSafeInteger(volume.reviewedSplitLines) || volume.reviewedSplitLines < 0
    || !Array.isArray(volume.sectionHeadings) || volume.sectionHeadings.length === 0
    || volume.sectionHeadings.some((heading) => !hasExactKeys(heading, ['page', 'text'])
      || !isPositiveSafeInteger(heading.page) || typeof heading.text !== 'string' || heading.text.length === 0)) {
    fail(`${description} is invalid`);
  }
}

function verifyRimkuteContractShape(contract) {
  if (contract.id !== RIMKUTE_CONTRACT_ID) return;
  const expectedArtifactIds = [
    ...RIMKUTE_PDF_ARTIFACTS.map(({ artifactId }) => artifactId),
    RIMKUTE_TSV_ARTIFACT_ID,
    RIMKUTE_SUMMARY_ARTIFACT_ID
  ];
  const files = contract.source?.files;
  if (!Array.isArray(files) || files.length !== expectedArtifactIds.length
    || new Set(files.map((file) => file.artifactId)).size !== expectedArtifactIds.length
    || expectedArtifactIds.some((artifactId) => !files.some((file) => file.artifactId === artifactId))
    || files.filter((file) => file.role !== undefined).length !== 1
    || files.find((file) => file.role !== undefined)?.role !== 'morphemic-entries') {
    fail(`${RIMKUTE_CONTRACT_ID} must contain exactly the three pinned PDFs, canonical TSV, and extraction summary`);
  }
  const summary = contract.source?.files?.find((file) => file.artifactId === RIMKUTE_SUMMARY_ARTIFACT_ID);
  if (!summary || summary.format !== RIMKUTE_SUMMARY_FORMAT) {
    fail(`${RIMKUTE_CONTRACT_ID} must describe its reviewed extraction summary as ${RIMKUTE_SUMMARY_FORMAT}`);
  }
}

function verifyRimkuteExtractionSummary(contract, file, buffer) {
  if (contract.id !== RIMKUTE_CONTRACT_ID || file.artifactId !== RIMKUTE_SUMMARY_ARTIFACT_ID) {
    fail(`${sourceLabel(file)} uses the ${RIMKUTE_SUMMARY_FORMAT} format outside its reviewed contract`);
  }
  const summary = parseJsonSummary(file, buffer);
  if (!hasExactKeys(summary, ['schemaVersion', 'id', 'source', 'method', 'runtime', 'volumes', 'output', 'manualReview', 'representativeSamples'])
    || summary.schemaVersion !== 1
    || summary.id !== 'rimkute-2011-dazninis-morfemikos-zodynas') {
    fail(`${sourceLabel(file)} has an unexpected schema or identity`);
  }

  const expectedPdfFiles = RIMKUTE_PDF_ARTIFACTS.map(({ volume, artifactId }) => {
    const descriptor = contract.source.files.find((candidate) => candidate.artifactId === artifactId);
    if (!descriptor || descriptor.format !== 'binary' || descriptor.volume !== volume
      || typeof descriptor.name !== 'string' || descriptor.name.length === 0
      || !isPositiveSafeInteger(descriptor.pages)) {
      fail(`${RIMKUTE_CONTRACT_ID} must pin volume ${volume} PDF identity, name, and page count`);
    }
    return {
      volume,
      name: descriptor.name,
      pages: descriptor.pages,
      bytes: descriptor.bytes,
      sha256: descriptor.sha256
    };
  });
  if (!hasExactKeys(summary.source, ['scope', 'files'])
    || summary.source.scope !== 'the three reviewed 2011 PDF volumes only; the live Morfema database was not accessed'
    || !isDeepStrictEqual(summary.source.files, expectedPdfFiles)) {
    fail(`${sourceLabel(file)} must identify exactly the three pinned PDFs and exclude the live Morfema database`);
  }
  if (!isDeepStrictEqual(summary.method, RIMKUTE_METHOD)) {
    fail(`${sourceLabel(file)} extraction method does not match the reviewed pdf-coordinate-columns-v1 method`);
  }
  if (!hasExactKeys(summary.runtime, ['python', 'popplerPdftotext', 'dependencyLock'])
    || summary.runtime.python !== '3.12.13'
    || summary.runtime.popplerPdftotext !== '26.05.0'
    || summary.runtime.dependencyLock !== 'extraction-runtime.json') {
    fail(`${sourceLabel(file)} runtime does not match the reviewed extraction lock`);
  }
  if (!Array.isArray(summary.volumes) || summary.volumes.length !== 3) {
    fail(`${sourceLabel(file)} must contain volume summaries for I, II, and III`);
  }
  summary.volumes.forEach((volume, index) => validateRimkuteSummaryVolume(
    volume,
    RIMKUTE_PDF_ARTIFACTS[index].volume,
    `${sourceLabel(file)}.volumes[${index}]`
  ));

  const canonical = contract.source.files.find((candidate) => candidate.artifactId === RIMKUTE_TSV_ARTIFACT_ID);
  if (!canonical || canonical.role !== 'morphemic-entries' || canonical.format !== 'text'
    || canonical.hasHeader !== true || canonical.delimiter !== '\t' || canonical.columns !== RIMKUTE_COLUMNS.length
    || !isDeepStrictEqual(canonical.header, RIMKUTE_COLUMNS)
    || !isDeepStrictEqual(canonical.numericColumns, [1, 5])
    || !isPlainObject(canonical.numericTotals) || !isPositiveSafeInteger(canonical.numericTotals[1])) {
    fail(`${RIMKUTE_CONTRACT_ID} must pin the canonical six-column TSV schema and frequency total`);
  }
  const rowsByVolume = Object.fromEntries(summary.volumes.map((volume) => [volume.volume, volume.rows]));
  const rows = summary.volumes.reduce((total, volume) => total + volume.rows, 0);
  const frequencyTotal = summary.volumes.reduce((total, volume) => total + volume.frequencyTotal, 0);
  if (!hasExactKeys(summary.output, ['file', 'format', 'columns', 'rows', 'frequencyTotal', 'rowsByVolume', 'bytes', 'sha256'])
    || summary.output.file !== 'morphemic-entries.tsv'
    || summary.output.format !== 'UTF-8 TSV with LF line endings'
    || !isDeepStrictEqual(summary.output.columns, RIMKUTE_COLUMNS)
    || summary.output.rows !== rows || summary.output.rows !== canonical.rows
    || summary.output.frequencyTotal !== frequencyTotal || summary.output.frequencyTotal !== canonical.numericTotals[1]
    || !isDeepStrictEqual(summary.output.rowsByVolume, rowsByVolume)
    || summary.output.bytes !== canonical.bytes || summary.output.sha256 !== canonical.sha256) {
    fail(`${sourceLabel(file)} output identity and totals do not match the canonical TSV descriptor`);
  }
  if (!hasExactKeys(summary.manualReview, ['unresolvedRows', 'corrections', 'note'])
    || summary.manualReview.unresolvedRows !== 0
    || summary.manualReview.corrections !== 0
    || typeof summary.manualReview.note !== 'string' || summary.manualReview.note.length === 0) {
    fail(`${sourceLabel(file)} must record a completed review with zero unresolved rows`);
  }
  if (!Array.isArray(summary.representativeSamples) || summary.representativeSamples.length < 3) {
    fail(`${sourceLabel(file)} must contain representative samples`);
  }
  summary.representativeSamples.forEach((sample, index) => validateRimkuteSample(
    sample,
    `${sourceLabel(file)}.representativeSamples[${index}]`
  ));
  const sampleLines = summary.representativeSamples.map((sample) => RIMKUTE_COLUMNS.map((column) => String(sample[column])).join('\t'));
  if (!isDeepStrictEqual(canonical.samples, sampleLines)) {
    fail(`${sourceLabel(file)} representative samples do not match the canonical TSV contract`);
  }

  const publicExtraction = contract.source.extraction;
  const expectedPublicExtraction = {
    method: summary.method,
    runtime: {
      python: summary.runtime.python,
      popplerPdftotext: summary.runtime.popplerPdftotext
    },
    rows,
    frequencyTotal,
    volumes: summary.volumes.map(({ volume, rows: volumeRows, frequencyTotal: volumeFrequencyTotal }) => ({
      volume,
      rows: volumeRows,
      frequencyTotal: volumeFrequencyTotal
    })),
    representativeSamples: summary.representativeSamples,
    summaryArtifact: {
      artifactId: file.artifactId,
      format: file.format,
      bytes: file.bytes,
      sha256: file.sha256
    }
  };
  if (!isDeepStrictEqual(publicExtraction, expectedPublicExtraction)) {
    fail(`${RIMKUTE_CONTRACT_ID} public extraction provenance does not match the reviewed summary`);
  }
}

function verifyNvhFile(file, buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`${sourceLabel(file)} is not valid UTF-8`);
  }
  const lines = countLines(text);
  if (lines.length !== file.rows) {
    fail(`${sourceLabel(file)} row count mismatch: expected ${file.rows}, received ${lines.length}`);
  }
}

export async function verifySourceContracts({ contractPath = defaultContractPath, sourceRoot, sourceResolver }) {
  if (!sourceRoot) fail('a --source-root directory is required');
  const manifest = JSON.parse(await readFile(contractPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.contracts)) fail('contract manifest must use schemaVersion 1 and contain contracts');
  const resolver = sourceResolver ?? await createSourceArtifactResolver(sourceRoot);

  let verifiedFiles = 0;
  for (const contract of manifest.contracts) {
    verifyRimkuteContractShape(contract);
    for (const file of contract.source.files ?? []) {
      const sourcePath = await resolver.resolve(file);
      const buffer = await readFile(sourcePath);
      const checksum = createHash('sha256').update(buffer).digest('hex');
      if (buffer.byteLength !== file.bytes) fail(`${sourceLabel(file)} byte count mismatch: expected ${file.bytes}, received ${buffer.byteLength}`);
      if (checksum !== file.sha256) fail(`${sourceLabel(file)} checksum mismatch: expected ${file.sha256}, received ${checksum}`);
      if (file.format === RIMKUTE_SUMMARY_FORMAT) verifyRimkuteExtractionSummary(contract, file, buffer);
      else if (file.format === 'nvh') verifyNvhFile(file, buffer);
      else if (!['binary', 'zip-conllu', 'zip-conllu-treebank'].includes(file.format)) verifyTextFile(file, buffer);
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
