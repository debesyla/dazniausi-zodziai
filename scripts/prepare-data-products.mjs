import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseDelimitedLine } from './prepare-dataset.mjs';
import { verifySourceContracts } from './verify-source-contracts.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPlanPath = path.join(repositoryRoot, 'data', 'products', 'publication-plan.json');
const defaultContractPath = path.join(repositoryRoot, 'data', 'contracts', 'deferred-sources.json');
const defaultStaticRoot = path.join(repositoryRoot, 'static');
const defaultOutputRoot = path.join(defaultStaticRoot, 'data-products');

const FIELD_TYPES = new Set([
  'string',
  'source-pos-code',
  'raw-token-count',
  'normalized-token-count',
  'normalized-document-count',
  'coverage-code'
]);
const NUMERIC_FIELD_TYPES = new Set([
  'raw-token-count',
  'normalized-token-count',
  'normalized-document-count',
  'coverage-code'
]);
const SUMMARIZED_FIELD_TYPES = new Set([
  'raw-token-count',
  'normalized-token-count',
  'normalized-document-count'
]);
const CHUNKED_PRODUCT_TYPES = new Set([
  'chunked-wordform-list',
  'chunked-comparison',
  'chunked-frequency-list',
  'chunked-derived-frequency-list'
]);
const ANALYSIS_PROFILE_TYPES = new Set(['frequency-band-coverage']);

function fail(message) {
  throw new Error(`Data-product preparation failed: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isSafeFieldId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
}

function isSafeRelativePath(value) {
  if (!normalizeString(value) || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) return false;
  return !value.split('/').includes('..');
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveInside(root, relativePath, description) {
  if (!isSafeRelativePath(relativePath)) fail(`${description} must be a safe relative path`);
  const resolved = path.resolve(root, relativePath);
  if (!isPathInside(root, resolved)) fail(`${description} escapes its configured root`);
  return resolved;
}

function asSafeInteger(value, description) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${description} must be a non-negative safe integer`);
  return value;
}

function parseJson(text, description) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${description} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

async function readJson(filename, description) {
  return parseJson(await readFile(filename, 'utf8'), description);
}

async function writeJson(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validateField(field, description) {
  if (!isPlainObject(field) || !isSafeFieldId(field.id) || !normalizeString(field.label) || !FIELD_TYPES.has(field.type)) {
    fail(`${description} must define an id, label, and supported type`);
  }
  if (field.derived !== undefined && typeof field.derived !== 'boolean') {
    fail(`${description}.derived must be true or false when provided`);
  }
  if (field.derived === true) {
    if (field.sourceColumn !== undefined) fail(`${description}.sourceColumn is not valid for a derived field`);
  } else if (!Number.isInteger(field.sourceColumn) || field.sourceColumn < 0) {
    fail(`${description}.sourceColumn must be a non-negative integer`);
  }
  if (field.nullable !== undefined && typeof field.nullable !== 'boolean') {
    fail(`${description}.nullable must be true or false when provided`);
  }
  if (field.type === 'coverage-code') {
    if (!isPlainObject(field.values) || Object.keys(field.values).length === 0
      || Object.entries(field.values).some(([value, label]) => !/^\d+$/.test(value) || !normalizeString(label))) {
      fail(`${description}.values must label every numeric coverage code`);
    }
  } else if (field.values !== undefined) {
    fail(`${description}.values is only valid for a coverage-code field`);
  }
  if (field.type.startsWith('normalized-')) {
    if (!isPlainObject(field.normalization)
      || !Number.isSafeInteger(field.normalization.sourceTokens) || field.normalization.sourceTokens < 1
      || !Number.isSafeInteger(field.normalization.targetTokens) || field.normalization.targetTokens < 1) {
      fail(`${description}.normalization must contain positive safe source and target token counts`);
    }
  } else if (field.normalization !== undefined) {
    fail(`${description}.normalization is only valid for a normalized metric`);
  }
  if (NUMERIC_FIELD_TYPES.has(field.type) && !normalizeString(field.unit)) {
    fail(`${description}.unit is required for numeric fields`);
  }
}

function validateView(view, description) {
  if (!isPlainObject(view) || !isSafeId(view.id) || !normalizeString(view.sourceRole) || !normalizeString(view.title)
    || !normalizeString(view.description) || !isPlainObject(view.ordering) || !normalizeString(view.ordering.field)
    || !['ascending', 'descending'].includes(view.ordering.direction)
    || !Number.isSafeInteger(view.chunkBytes) || view.chunkBytes < 1024) {
    fail(`${description} is missing required metadata`);
  }
  if (!Array.isArray(view.fields) || view.fields.length === 0) fail(`${description}.fields must not be empty`);
  const ids = new Set();
  const sourceColumns = new Set();
  for (const [index, field] of view.fields.entries()) {
    validateField(field, `${description}.fields[${index}]`);
    if (ids.has(field.id) || (field.derived !== true && sourceColumns.has(field.sourceColumn))) {
      fail(`${description}.fields must use unique ids and source columns`);
    }
    ids.add(field.id);
    if (field.derived !== true) sourceColumns.add(field.sourceColumn);
  }
  if (!ids.has(view.ordering.field)) fail(`${description}.ordering.field must name a field`);
}

function validatePublication(publication, description) {
  if (!isPlainObject(publication)
    || !['published', 'metadata-only'].includes(publication.status)
    || !normalizeString(publication.scope)
    || !normalizeString(publication.access)) {
    fail(`${description} must define a recognised status, scope, and access method`);
  }
  if (publication.reason !== undefined && !normalizeString(publication.reason)) {
    fail(`${description}.reason must be a non-empty string when provided`);
  }
}

function validateDerivation(derivation, description) {
  if (derivation === undefined) return;
  if (!isPlainObject(derivation) || derivation.type !== 'conllu-frequency'
    || !['lemma', 'wordform'].includes(derivation.key)
    || !Array.isArray(derivation.excludeUniversalPos)
    || derivation.excludeUniversalPos.some((value) => !normalizeString(value))
    || !normalizeString(derivation.missingUniversalPos)
    || !isPlainObject(derivation.expectedSummary)) {
    fail(`${description}.derivation is invalid`);
  }
  for (const field of ['sourceRows', 'recordCount', 'totalFrequency']) {
    asSafeInteger(derivation.expectedSummary[field], `${description}.derivation.expectedSummary.${field}`);
  }
}

function validateFrequencyBand(band, description, previousBand) {
  if (!isPlainObject(band) || !isSafeId(band.id) || !normalizeString(band.label)
    || !Number.isSafeInteger(band.minimum) || band.minimum < 1
    || (band.maximum !== null && (!Number.isSafeInteger(band.maximum) || band.maximum < band.minimum))) {
    fail(`${description} is invalid`);
  }
  if (previousBand) {
    if (previousBand.maximum === null || band.minimum !== previousBand.maximum + 1) {
      fail(`${description} must begin immediately after the preceding frequency band`);
    }
  } else if (band.minimum !== 1) {
    fail(`${description} must begin at frequency 1`);
  }
  return band;
}

function validateAnalysisProfile(profile, description) {
  if (!isPlainObject(profile) || !isSafeId(profile.id) || !ANALYSIS_PROFILE_TYPES.has(profile.type)
    || !isSafeId(profile.sourceRole) || !normalizeString(profile.title) || !normalizeString(profile.description)
    || !Array.isArray(profile.frequencyBands) || profile.frequencyBands.length === 0
    || !Number.isSafeInteger(profile.summaryMaxBytes) || profile.summaryMaxBytes < 1024
    || !isPlainObject(profile.drilldown) || !Number.isSafeInteger(profile.drilldown.limit)
    || profile.drilldown.limit < 1 || profile.drilldown.limit > 100
    || !Number.isSafeInteger(profile.drilldown.maxBytes) || profile.drilldown.maxBytes < 1024
    || !isPlainObject(profile.drilldown.ordering)
    || !normalizeString(profile.drilldown.ordering.field)
    || !['ascending', 'descending'].includes(profile.drilldown.ordering.direction)
    || profile.drilldown.ordering.tieBreak !== 'word-ascending') {
    fail(`${description} is invalid`);
  }
  let previousBand = null;
  const ids = new Set();
  for (const [index, band] of profile.frequencyBands.entries()) {
    validateFrequencyBand(band, `${description}.frequencyBands[${index}]`, previousBand);
    if (ids.has(band.id)) fail(`${description}.frequencyBands uses duplicate ids`);
    ids.add(band.id);
    previousBand = band;
  }
  if (previousBand?.maximum !== null) {
    fail(`${description}.frequencyBands must finish with an open-ended band`);
  }
}

export function validatePublicationPlan(plan) {
  if (!isPlainObject(plan) || plan.schemaVersion !== 1 || !normalizeString(plan.title)
    || !Array.isArray(plan.genericProducts) || !Array.isArray(plan.contractProducts)) {
    fail('publication plan must use schemaVersion 1 and list generic and contract products');
  }

  for (const [index, product] of plan.genericProducts.entries()) {
    if (!isPlainObject(product) || !isSafeRelativePath(product.datasetFile) || !product.datasetFile.startsWith('datasets/')
      || !normalizeString(product.description)) {
      fail(`genericProducts[${index}] must name a reviewed file under static/datasets and a description`);
    }
  }

  const contractIds = new Set();
  for (const [index, product] of plan.contractProducts.entries()) {
    const description = `contractProducts[${index}]`;
    if (!isPlainObject(product) || !isSafeId(product.contractId)
      || ![...CHUNKED_PRODUCT_TYPES, 'metadata-only'].includes(product.productType)) {
      fail(`${description} must name a contract and supported product type`);
    }
    if (contractIds.has(product.contractId)) fail(`${description}.contractId is duplicated`);
    contractIds.add(product.contractId);
    validatePublication(product.publication, `${description}.publication`);

    if (product.productType === 'metadata-only') {
      if (product.publication.status !== 'metadata-only' || !Array.isArray(product.blockedBy) || product.blockedBy.length === 0
        || product.blockedBy.some((url) => !isHttpUrl(url))) {
        fail(`${description} must declare a metadata-only status and at least one blocking issue URL`);
      }
      if (product.views !== undefined) fail(`${description} must not configure row views`);
      continue;
    }

    if (product.publication.status !== 'published' || !Array.isArray(product.views) || product.views.length === 0) {
      fail(`${description} must publish at least one row view`);
    }
    const viewIds = new Set();
    for (const [viewIndex, view] of product.views.entries()) {
      validateView(view, `${description}.views[${viewIndex}]`);
      validateDerivation(view.derivation, `${description}.views[${viewIndex}]`);
      if (viewIds.has(view.id)) {
        fail(`${description}.views must use unique ids`);
      }
      viewIds.add(view.id);
    }

    if (product.analysisProfiles !== undefined) {
      if (!Array.isArray(product.analysisProfiles)) fail(`${description}.analysisProfiles must be an array when present`);
      const profileIds = new Set();
      for (const [profileIndex, profile] of product.analysisProfiles.entries()) {
        validateAnalysisProfile(profile, `${description}.analysisProfiles[${profileIndex}]`);
        if (profileIds.has(profile.id)) fail(`${description}.analysisProfiles uses duplicate ids`);
        if (!product.views.some((view) => view.sourceRole === profile.sourceRole)) {
          fail(`${description}.analysisProfiles[${profileIndex}] must use a source role exposed by a row view`);
        }
        profileIds.add(profile.id);
      }
    }
  }
  return plan;
}

function validateContractManifest(manifest) {
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.contracts)) {
    fail('source contract manifest must use schemaVersion 1 and contain contracts');
  }
  if (!isPlainObject(manifest.sourceRepository) || !isHttpUrl(manifest.sourceRepository.repositoryUrl)
    || !normalizeString(manifest.sourceRepository.revision)) {
    fail('source contract manifest must identify the reviewed source repository and revision');
  }
  return manifest;
}

function publicSourceFile(file) {
  return {
    ...(file.role ? { role: file.role } : {}),
    path: file.path,
    format: file.format ?? 'text',
    bytes: file.bytes,
    sha256: file.sha256,
    ...(file.rows === undefined ? {} : { rows: file.rows }),
    ...(file.columns === undefined ? {} : { columns: file.columns }),
    ...(file.delimiter === undefined ? {} : { delimiter: file.delimiter }),
    ...(file.hasHeader === undefined ? {} : { hasHeader: file.hasHeader }),
    ...(file.archiveMember === undefined ? {} : { archiveMember: file.archiveMember })
  };
}

function fieldTotals(fields) {
  return Object.fromEntries(fields
    .filter((field) => SUMMARIZED_FIELD_TYPES.has(field.type))
    .map((field) => [field.id, 0]));
}

function fieldNullCounts(fields) {
  return Object.fromEntries(fields
    .filter((field) => field.nullable === true)
    .map((field) => [field.id, 0]));
}

function parseNonNegativeSafeInteger(value, description) {
  const normalized = normalizeString(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(normalized)) {
    fail(`${description} has an invalid integer value: ${JSON.stringify(value)}`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    fail(`${description} has an unsafe integer value: ${JSON.stringify(value)}`);
  }
  return parsed;
}

function parseFieldValue(field, value, sourcePath, lineNumber) {
  if (!NUMERIC_FIELD_TYPES.has(field.type)) {
    if (!normalizeString(value)) fail(`${sourcePath} line ${lineNumber} has an empty ${field.id} value`);
    return value;
  }
  if (value === '' && field.nullable === true) return null;
  const parsed = parseNonNegativeSafeInteger(value, `${sourcePath} line ${lineNumber} ${field.id}`);
  if (field.type === 'coverage-code' && !Object.hasOwn(field.values, String(parsed))) {
    fail(`${sourcePath} line ${lineNumber} has an unlabelled coverage code: ${parsed}`);
  }
  return parsed;
}

function chunkPrefix(productId, viewId, chunkNumber) {
  return `{"schemaVersion":1,"productId":${JSON.stringify(productId)},"viewId":${JSON.stringify(viewId)},"chunk":${chunkNumber},"records":[`;
}

function sourceRelativePath(sourceRoot, sourcePath) {
  return path.relative(sourceRoot, sourcePath).split(path.sep).join('/');
}

async function resolveSourcePath(sourceRoot, sourceRelativePathValue) {
  const realRoot = await realpath(sourceRoot);
  const candidate = resolveInside(realRoot, sourceRelativePathValue, 'source file path');
  const resolved = await realpath(candidate);
  if (!isPathInside(realRoot, resolved)) fail(`source file escapes the supplied source root: ${sourceRelativePathValue}`);
  return { realRoot, sourcePath: resolved };
}

function assertContractSummary(sourceFile, fields, summary, sourcePath) {
  const fieldsBySourceColumn = new Map(fields.map((field) => [String(field.sourceColumn), field]));
  for (const [column, expected] of Object.entries(sourceFile.numericTotals ?? {})) {
    const field = fieldsBySourceColumn.get(column);
    if (!field || !SUMMARIZED_FIELD_TYPES.has(field.type)) {
      fail(`${sourcePath} contract total for column ${column} is not represented by a count field`);
    }
    const expectedTotal = Number(expected);
    if (!Number.isSafeInteger(expectedTotal) || summary.numericTotals[field.id] !== expectedTotal) {
      fail(`${sourcePath} total for ${field.id} does not match the source contract`);
    }
  }
  for (const [column, expected] of Object.entries(sourceFile.missingCounts ?? {})) {
    const field = fieldsBySourceColumn.get(column);
    if (!field || field.nullable !== true || summary.nullCounts[field.id] !== expected) {
      fail(`${sourcePath} null count for source column ${column} does not match the source contract`);
    }
  }
  if (summary.sourceRows !== sourceFile.rows) {
    fail(`${sourcePath} row count does not match the source contract`);
  }
}

async function buildChunkedView({ productId, productDirectory, view, sourceFile, sourceRoot }) {
  const { realRoot, sourcePath } = await resolveSourcePath(sourceRoot, sourceFile.path);
  const sourceDisplayPath = sourceRelativePath(realRoot, sourcePath);
  const delimiter = sourceFile.delimiter ?? '\t';
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const suffix = ']}\n';
  const chunks = [];
  let chunkNumber = 0;
  let recordJsons = [];
  let recordsBytes = 0;
  let sourceRows = 0;
  const numericTotals = fieldTotals(view.fields);
  const nullCounts = fieldNullCounts(view.fields);

  async function flushChunk() {
    if (recordJsons.length === 0) return;
    const serialized = `${chunkPrefix(productId, view.id, chunkNumber)}${recordJsons.join(',')}${suffix}`;
    const buffer = Buffer.from(serialized, 'utf8');
    if (buffer.byteLength > view.chunkBytes) {
      fail(`${productId}/${view.id} chunk ${chunkNumber} exceeds its ${view.chunkBytes}-byte budget`);
    }
    const filename = `${String(chunkNumber + 1).padStart(6, '0')}.json`;
    await writeFile(path.join(chunksDirectory, filename), buffer);
    chunks.push({
      file: `chunks/${filename}`,
      records: recordJsons.length,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex')
    });
    chunkNumber += 1;
    recordJsons = [];
    recordsBytes = 0;
  }

  const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  let physicalLineNumber = 0;
  for await (const line of lines) {
    physicalLineNumber += 1;
    if (sourceFile.hasHeader === true && physicalLineNumber === 1) continue;
    sourceRows += 1;
    const values = parseDelimitedLine(line, delimiter);
    if (values.length !== sourceFile.columns) {
      fail(`${sourceDisplayPath} line ${sourceRows} has ${values.length} columns; expected ${sourceFile.columns}`);
    }
    const record = view.fields.map((field) => parseFieldValue(field, values[field.sourceColumn], sourceDisplayPath, sourceRows));
    for (const [index, field] of view.fields.entries()) {
      const value = record[index];
      if (value === null) {
        nullCounts[field.id] += 1;
      } else if (SUMMARIZED_FIELD_TYPES.has(field.type)) {
        numericTotals[field.id] += value;
      }
    }

    const recordJson = JSON.stringify(record);
    const prefix = chunkPrefix(productId, view.id, chunkNumber);
    const candidateBytes = Buffer.byteLength(prefix) + recordsBytes + (recordJsons.length === 0 ? 0 : 1)
      + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (candidateBytes > view.chunkBytes && recordJsons.length > 0) {
      await flushChunk();
    }
    const currentPrefix = chunkPrefix(productId, view.id, chunkNumber);
    const currentBytes = Buffer.byteLength(currentPrefix) + recordsBytes + (recordJsons.length === 0 ? 0 : 1)
      + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (currentBytes > view.chunkBytes) {
      fail(`${sourceDisplayPath} line ${sourceRows} cannot fit in the ${view.chunkBytes}-byte chunk budget`);
    }
    recordJsons.push(recordJson);
    recordsBytes += (recordJsons.length === 1 ? 0 : 1) + Buffer.byteLength(recordJson);
  }
  await flushChunk();

  const summary = {
    sourceRows,
    recordCount: sourceRows,
    numericTotals,
    nullCounts
  };
  assertContractSummary(sourceFile, view.fields, summary, sourceDisplayPath);
  if (chunks.length === 0) fail(`${sourceDisplayPath} produced no records`);

  const index = {
    schemaVersion: 1,
    productId,
    viewId: view.id,
    recordEncoding: 'array',
    fields: view.fields,
    ordering: view.ordering,
    sourceFile: publicSourceFile(sourceFile),
    maxChunkBytes: view.chunkBytes,
    summary,
    chunks
  };
  await writeJson(path.join(viewDirectory, 'index.json'), index);
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    index: `views/${view.id}/index.json`,
    sourceRole: view.sourceRole,
    recordEncoding: 'array',
    summary
  };
}

function assertDerivedConlluView(view, sourceFile) {
  if (sourceFile.format !== 'zip-conllu' || !isSafeRelativePath(sourceFile.archiveMember)
    || !isPlainObject(sourceFile.conlluSummary)) {
    fail(`${view.id} requires a zip-conllu source file with an archive member and summary`);
  }
  for (const field of ['integerTokenRows', 'nonPunctuationRows', 'sentences', 'uncompressedBytes']) {
    asSafeInteger(sourceFile.conlluSummary[field], `${view.id} source ${field}`);
  }
  if (!/^[a-f0-9]{64}$/.test(sourceFile.conlluSummary.sha256)) {
    fail(`${view.id} source conlluSummary.sha256 must be a SHA-256 checksum`);
  }
  if (!view.derivation || view.derivation.type !== 'conllu-frequency') {
    fail(`${view.id} requires a conllu-frequency derivation`);
  }
  const countField = view.fields.at(-1);
  if (view.fields.length !== 3 || countField?.derived !== true || !SUMMARIZED_FIELD_TYPES.has(countField.type)) {
    fail(`${view.id} must expose lexical value, Universal POS, and one derived count`);
  }
}

function compareFrequencyEntries(left, right) {
  if (left.count !== right.count) return right.count - left.count;
  if (left.key !== right.key) return left.key < right.key ? -1 : 1;
  return left.universalPos < right.universalPos ? -1 : left.universalPos > right.universalPos ? 1 : 0;
}

async function buildDerivedConlluFrequencyView({ productId, productDirectory, view, sourceFile, sourceRoot }) {
  assertDerivedConlluView(view, sourceFile);
  const { realRoot, sourcePath } = await resolveSourcePath(sourceRoot, sourceFile.path);
  const sourceDisplayPath = sourceRelativePath(realRoot, sourcePath);
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const child = spawn('unzip', ['-p', sourcePath, sourceFile.archiveMember], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const childExit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  let unzipError = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { unzipError += chunk; });

  const archiveHash = createHash('sha256');
  let archiveBytes = 0;
  child.stdout.on('data', (chunk) => {
    archiveHash.update(chunk);
    archiveBytes += chunk.byteLength;
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const excludedUniversalPos = new Set(view.derivation.excludeUniversalPos);
  const entries = new Map();
  let integerTokenRows = 0;
  let nonPunctuationRows = 0;
  let sentences = 0;

  for await (const line of lines) {
    if (line.startsWith('# sent_id = ')) {
      sentences += 1;
      continue;
    }
    if (line === '' || line.startsWith('#')) continue;
    const values = line.split('\t');
    if (values.length !== 10) fail(`${sourceDisplayPath} has a malformed CoNLL-U row`);
    if (!/^\d+$/.test(values[0])) continue;
    integerTokenRows += 1;
    const universalPos = normalizeString(values[3]) || view.derivation.missingUniversalPos;
    if (excludedUniversalPos.has(universalPos)) continue;
    const key = normalizeString(view.derivation.key === 'lemma' ? values[2] : values[1]);
    if (!key) fail(`${sourceDisplayPath} has an empty ${view.derivation.key} at token row ${integerTokenRows}`);
    nonPunctuationRows += 1;
    const aggregateKey = `${key}\u0000${universalPos}`;
    entries.set(aggregateKey, {
      key,
      universalPos,
      count: (entries.get(aggregateKey)?.count ?? 0) + 1
    });
  }
  const exitCode = await childExit;
  if (exitCode !== 0) fail(`could not read ${sourceDisplayPath} archive member ${sourceFile.archiveMember}: ${unzipError.trim()}`);

  const conlluSummary = sourceFile.conlluSummary;
  if (archiveBytes !== conlluSummary.uncompressedBytes || archiveHash.digest('hex') !== conlluSummary.sha256
    || integerTokenRows !== conlluSummary.integerTokenRows || sentences !== conlluSummary.sentences
    || nonPunctuationRows !== conlluSummary.nonPunctuationRows) {
    fail(`${sourceDisplayPath} CoNLL-U archive member does not match its reviewed summary`);
  }

  const records = [...entries.values()].sort(compareFrequencyEntries)
    .map((entry) => [entry.key, entry.universalPos, entry.count]);
  const expected = view.derivation.expectedSummary;
  const totalFrequency = records.reduce((total, record) => total + record.at(-1), 0);
  if (nonPunctuationRows !== expected.sourceRows || records.length !== expected.recordCount || totalFrequency !== expected.totalFrequency) {
    fail(`${sourceDisplayPath} ${view.id} does not match its reviewed derived summary`);
  }

  const suffix = ']}\n';
  const chunks = [];
  let chunkNumber = 0;
  let recordJsons = [];
  let recordsBytes = 0;
  async function flushChunk() {
    if (recordJsons.length === 0) return;
    const serialized = `${chunkPrefix(productId, view.id, chunkNumber)}${recordJsons.join(',')}${suffix}`;
    const buffer = Buffer.from(serialized, 'utf8');
    if (buffer.byteLength > view.chunkBytes) fail(`${productId}/${view.id} chunk ${chunkNumber} exceeds its ${view.chunkBytes}-byte budget`);
    const filename = `${String(chunkNumber + 1).padStart(6, '0')}.json`;
    await writeFile(path.join(chunksDirectory, filename), buffer);
    chunks.push({
      file: `chunks/${filename}`,
      records: recordJsons.length,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex')
    });
    chunkNumber += 1;
    recordJsons = [];
    recordsBytes = 0;
  }
  for (const record of records) {
    const recordJson = JSON.stringify(record);
    const candidateBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (candidateBytes > view.chunkBytes && recordJsons.length > 0) await flushChunk();
    const currentBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (currentBytes > view.chunkBytes) fail(`${sourceDisplayPath} ${view.id} produced an oversize record`);
    recordJsons.push(recordJson);
    recordsBytes += (recordJsons.length === 1 ? 0 : 1) + Buffer.byteLength(recordJson);
  }
  await flushChunk();
  if (chunks.length === 0) fail(`${sourceDisplayPath} ${view.id} produced no records`);

  const numericTotals = fieldTotals(view.fields);
  numericTotals[view.fields.at(-1).id] = totalFrequency;
  const summary = {
    sourceRows: nonPunctuationRows,
    recordCount: records.length,
    numericTotals,
    nullCounts: fieldNullCounts(view.fields)
  };
  const index = {
    schemaVersion: 1,
    productId,
    viewId: view.id,
    recordEncoding: 'array',
    fields: view.fields,
    ordering: view.ordering,
    sourceFile: publicSourceFile(sourceFile),
    derivation: view.derivation,
    maxChunkBytes: view.chunkBytes,
    summary,
    chunks
  };
  await writeJson(path.join(viewDirectory, 'index.json'), index);
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    index: `views/${view.id}/index.json`,
    sourceRole: view.sourceRole,
    recordEncoding: 'array',
    summary
  };
}

function findFrequencyBandCoverageFields(profile, views) {
  const matchingViews = views.filter((view) => view.sourceRole === profile.sourceRole);
  if (matchingViews.length !== 1) {
    fail(`${profile.id} requires exactly one row view for source role ${profile.sourceRole}`);
  }
  const sourceView = matchingViews[0];
  const wordFields = sourceView.fields.filter((field) => field.type === 'string');
  const frequencyFields = sourceView.fields.filter((field) => field.type === 'raw-token-count' && field.nullable !== true);
  const coverageFields = sourceView.fields.filter((field) => field.type === 'coverage-code');
  if (wordFields.length !== 1 || frequencyFields.length !== 1 || coverageFields.length !== 1) {
    fail(`${profile.id} requires one word, non-null raw-token-count, and coverage-code field`);
  }
  if (profile.drilldown.ordering.field !== frequencyFields[0].id || profile.drilldown.ordering.direction !== 'descending') {
    fail(`${profile.id} drill-down ordering must use its raw token count in descending order`);
  }
  return {
    sourceView,
    wordField: wordFields[0],
    frequencyField: frequencyFields[0],
    coverageField: coverageFields[0]
  };
}

function findFrequencyBand(bands, frequency) {
  return bands.find((band) => frequency >= band.minimum && (band.maximum === null || frequency <= band.maximum));
}

function compareDrilldownRecords(left, right) {
  if (left.frequency !== right.frequency) return right.frequency - left.frequency;
  return left.word < right.word ? -1 : left.word > right.word ? 1 : 0;
}

function insertDrilldownRecord(records, record, limit) {
  let index = records.findIndex((existing) => compareDrilldownRecords(record, existing) < 0);
  if (index === -1) index = records.length;
  records.splice(index, 0, record);
  if (records.length > limit) records.pop();
}

async function writeJsonWithByteBudget(filename, value, maxBytes, description) {
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (buffer.byteLength > maxBytes) fail(`${description} exceeds its ${maxBytes}-byte budget`);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, buffer);
  return buffer;
}

async function buildFrequencyBandCoverageProfile({ contract, productId, productDirectory, profile, views, sourceRoot }) {
  const { sourceView, wordField, frequencyField, coverageField } = findFrequencyBandCoverageFields(profile, views);
  const filesByRole = new Map(contract.source.files.map((file) => [file.role, file]));
  const sourceFile = filesByRole.get(profile.sourceRole);
  if (!sourceFile) fail(`${profile.id} has no source file with role ${profile.sourceRole}`);
  const { realRoot, sourcePath } = await resolveSourcePath(sourceRoot, sourceFile.path);
  const sourceDisplayPath = sourceRelativePath(realRoot, sourcePath);
  const coverageCodes = Object.keys(coverageField.values).map(Number).sort((left, right) => left - right);
  const bands = profile.frequencyBands.map((band) => ({
    ...band,
    typeCount: 0,
    tokenCount: 0,
    categories: new Map(coverageCodes.map((coverageCode) => [coverageCode, {
      coverageCode,
      typeCount: 0,
      tokenCount: 0,
      records: []
    }]))
  }));
  const delimiter = sourceFile.delimiter ?? '\t';
  const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  let physicalLineNumber = 0;
  let sourceRows = 0;
  let totalTokenCount = 0;

  for await (const line of lines) {
    physicalLineNumber += 1;
    if (sourceFile.hasHeader === true && physicalLineNumber === 1) continue;
    sourceRows += 1;
    const values = parseDelimitedLine(line, delimiter);
    if (values.length !== sourceFile.columns) {
      fail(`${sourceDisplayPath} line ${sourceRows} has ${values.length} columns; expected ${sourceFile.columns}`);
    }
    const word = normalizeString(values[wordField.sourceColumn]);
    if (!word) fail(`${sourceDisplayPath} line ${sourceRows} has an empty ${wordField.id} value`);
    const frequency = parseFieldValue(frequencyField, values[frequencyField.sourceColumn], sourceDisplayPath, sourceRows);
    const coverageCode = parseFieldValue(coverageField, values[coverageField.sourceColumn], sourceDisplayPath, sourceRows);
    if (!Number.isSafeInteger(frequency) || frequency < 1 || !Number.isSafeInteger(coverageCode)) {
      fail(`${sourceDisplayPath} line ${sourceRows} has an invalid frequency-band profile record`);
    }
    const band = findFrequencyBand(bands, frequency);
    if (!band) fail(`${sourceDisplayPath} line ${sourceRows} has a frequency outside the configured bands`);
    const category = band.categories.get(coverageCode);
    if (!category) fail(`${sourceDisplayPath} line ${sourceRows} has an unlabelled coverage code`);
    band.typeCount += 1;
    band.tokenCount += frequency;
    category.typeCount += 1;
    category.tokenCount += frequency;
    totalTokenCount += frequency;
    insertDrilldownRecord(category.records, { word, frequency }, profile.drilldown.limit);
  }

  const expectedTokenTotal = Number(sourceFile.numericTotals?.[frequencyField.sourceColumn]);
  if (sourceRows !== sourceFile.rows || !Number.isSafeInteger(expectedTokenTotal) || totalTokenCount !== expectedTokenTotal) {
    fail(`${profile.id} does not reconcile with ${sourceDisplayPath}`);
  }

  const profileDirectory = path.join(productDirectory, 'analysis', profile.id);
  const drilldownDirectory = path.join(profileDirectory, 'drilldowns');
  const drilldownFields = [
    { id: wordField.id, label: wordField.label, type: 'string' },
    { id: frequencyField.id, label: frequencyField.label, type: 'raw-token-count', unit: frequencyField.unit }
  ];
  const summaryBands = [];
  for (const band of bands) {
    const categories = [];
    for (const coverageCode of coverageCodes) {
      const category = band.categories.get(coverageCode);
      const filename = `${band.id}-${coverageCode}.json`;
      const drilldown = {
        schemaVersion: 1,
        productId,
        profileId: profile.id,
        bandId: band.id,
        coverageCode,
        recordEncoding: 'array',
        fields: drilldownFields,
        ordering: profile.drilldown.ordering,
        records: category.records.map((record) => [record.word, record.frequency])
      };
      const buffer = await writeJsonWithByteBudget(
        path.join(drilldownDirectory, filename),
        drilldown,
        profile.drilldown.maxBytes,
        `${productId}/${profile.id}/${filename}`
      );
      categories.push({
        coverageCode,
        typeCount: category.typeCount,
        tokenCount: category.tokenCount,
        drilldown: {
          file: `drilldowns/${filename}`,
          records: category.records.length,
          bytes: buffer.byteLength,
          sha256: createHash('sha256').update(buffer).digest('hex')
        }
      });
    }
    summaryBands.push({
      id: band.id,
      label: band.label,
      minimum: band.minimum,
      maximum: band.maximum,
      typeCount: band.typeCount,
      tokenCount: band.tokenCount,
      categories
    });
  }

  const manifest = {
    schemaVersion: 1,
    productId,
    profileId: profile.id,
    profileType: profile.type,
    title: profile.title,
    description: profile.description,
    sourceView: {
      id: sourceView.id,
      sourceRole: profile.sourceRole,
      wordField: { id: wordField.id, label: wordField.label },
      frequencyField: { id: frequencyField.id, label: frequencyField.label, unit: frequencyField.unit },
      coverageField: { id: coverageField.id, label: coverageField.label, values: coverageField.values }
    },
    provenance: {
      sourceUrl: contract.source.sourceUrl,
      licence: contract.source.licence,
      citation: contract.source.citation,
      sourceFile: publicSourceFile(sourceFile)
    },
    drilldown: {
      limit: profile.drilldown.limit,
      maxBytes: profile.drilldown.maxBytes,
      recordEncoding: 'array',
      fields: drilldownFields,
      ordering: profile.drilldown.ordering
    },
    delivery: {
      summaryMaxBytes: profile.summaryMaxBytes
    },
    summary: {
      sourceRows,
      totalTypeCount: sourceRows,
      totalTokenCount,
      bands: summaryBands
    }
  };
  await writeJsonWithByteBudget(
    path.join(profileDirectory, 'manifest.json'),
    manifest,
    profile.summaryMaxBytes,
    `${productId}/${profile.id}/manifest.json`
  );
  return {
    id: profile.id,
    type: profile.type,
    title: profile.title,
    description: profile.description,
    manifest: `analysis/${profile.id}/manifest.json`
  };
}

function validateGenericDataset(dataset, filename) {
  if (!isPlainObject(dataset) || dataset.schemaVersion !== 1 || !isSafeId(dataset.id)
    || !normalizeString(dataset.title) || !normalizeString(dataset.author)
    || !Number.isSafeInteger(dataset.year) || dataset.year < 1
    || !['lemma', 'wordform'].includes(dataset.entryKind)
    || !isPlainObject(dataset.provenance) || !normalizeString(dataset.provenance.licence)
    || !normalizeString(dataset.provenance.citation) || !isHttpUrl(dataset.provenance.sourceUrl)
    || !isPlainObject(dataset.summary) || !Array.isArray(dataset.words)) {
    fail(`${filename} is not a reviewed generic dataset`);
  }
  for (const field of ['sourceRows', 'entryCount', 'totalFrequency', 'duplicateEntries']) {
    asSafeInteger(dataset.summary[field], `${filename} summary.${field}`);
  }
  if (dataset.words.length !== dataset.summary.entryCount) {
    fail(`${filename} word entries do not match its published summary`);
  }
  return dataset;
}

async function buildGenericProduct({ genericProduct, staticRoot, outputRoot }) {
  const datasetPath = resolveInside(staticRoot, genericProduct.datasetFile, 'generic dataset file');
  const dataset = validateGenericDataset(await readJson(datasetPath, genericProduct.datasetFile), genericProduct.datasetFile);
  const productDirectory = path.join(outputRoot, dataset.id);
  const relativeDataFile = path.relative(productDirectory, datasetPath).split(path.sep).join('/');
  const manifest = {
    schemaVersion: 1,
    id: dataset.id,
    title: dataset.title,
    productType: 'generic-frequency-dataset',
    publication: {
      status: 'published',
      scope: `Every public entry in ${dataset.id}.`,
      access: 'The complete reviewed JSON dataset is available directly and is also selectable in the browser explorer.'
    },
    description: genericProduct.description,
    provenance: dataset.provenance,
    content: {
      format: 'dazniausi-zodziai-dataset-v1',
      file: relativeDataFile,
      entryKind: dataset.entryKind,
      recordEncoding: 'object',
      summary: dataset.summary
    }
  };
  await writeJson(path.join(productDirectory, 'manifest.json'), manifest);
  return {
    id: dataset.id,
    title: dataset.title,
    productType: manifest.productType,
    publicationStatus: 'published',
    manifest: `${dataset.id}/manifest.json`,
    licence: dataset.provenance.licence,
    viewCount: 1,
    recordCount: dataset.summary.entryCount
  };
}

function buildMetadataOnlyManifest({ contract, contractProduct, sourceRepository }) {
  return {
    schemaVersion: 1,
    id: contract.id,
    title: contract.title,
    productType: 'metadata-only',
    publication: contractProduct.publication,
    blockedBy: contractProduct.blockedBy,
    provenance: {
      sourceRepository,
      sourceUrl: contract.source.sourceUrl,
      licence: contract.source.licence,
      citation: contract.source.citation,
      files: contract.source.files.map(publicSourceFile)
    }
  };
}

async function buildContractProduct({ contract, contractProduct, sourceRepository, sourceRoot, outputRoot }) {
  const productDirectory = path.join(outputRoot, contract.id);
  if (contractProduct.productType === 'metadata-only') {
    const manifest = buildMetadataOnlyManifest({ contract, contractProduct, sourceRepository });
    await writeJson(path.join(productDirectory, 'manifest.json'), manifest);
    return {
      id: contract.id,
      title: contract.title,
      productType: manifest.productType,
      publicationStatus: 'metadata-only',
      manifest: `${contract.id}/manifest.json`,
      licence: contract.source.licence,
      viewCount: 0,
      recordCount: null
    };
  }

  const filesByRole = new Map(contract.source.files.map((file) => [file.role, file]));
  const views = [];
  const usedSourceRoles = new Set();
  for (const view of contractProduct.views) {
    const sourceFile = filesByRole.get(view.sourceRole);
    if (!sourceFile) fail(`${contract.id} has no source file with role ${view.sourceRole}`);
    usedSourceRoles.add(view.sourceRole);
    if (view.derivation !== undefined) {
      views.push(await buildDerivedConlluFrequencyView({ productId: contract.id, productDirectory, view, sourceFile, sourceRoot }));
    } else {
      views.push(await buildChunkedView({ productId: contract.id, productDirectory, view, sourceFile, sourceRoot }));
    }
  }
  if (usedSourceRoles.size !== contract.source.files.length
    || contract.source.files.some((file) => !usedSourceRoles.has(file.role))) {
    fail(`${contract.id} must publish at least one view for every reviewed machine-readable source file`);
  }

  const analysisProfiles = [];
  for (const profile of contractProduct.analysisProfiles ?? []) {
    if (profile.type === 'frequency-band-coverage') {
      analysisProfiles.push(await buildFrequencyBandCoverageProfile({
        contract,
        productId: contract.id,
        productDirectory,
        profile,
        views: contractProduct.views,
        sourceRoot
      }));
    } else {
      fail(`${contract.id} has an unsupported analysis profile type: ${profile.type}`);
    }
  }

  const manifest = {
    schemaVersion: 1,
    id: contract.id,
    title: contract.title,
    productType: contractProduct.productType,
    publication: contractProduct.publication,
    provenance: {
      sourceRepository,
      sourceUrl: contract.source.sourceUrl,
      licence: contract.source.licence,
      citation: contract.source.citation,
      files: contract.source.files.map(publicSourceFile)
    },
    delivery: {
      mode: 'static-chunked-json',
      constraints: contract.delivery?.constraints ?? []
    },
    views,
    ...(analysisProfiles.length === 0 ? {} : { analysisProfiles })
  };
  await writeJson(path.join(productDirectory, 'manifest.json'), manifest);
  return {
    id: contract.id,
    title: contract.title,
    productType: manifest.productType,
    publicationStatus: 'published',
    manifest: `${contract.id}/manifest.json`,
    licence: contract.source.licence,
    viewCount: views.length,
    recordCount: null
  };
}

function assertSafeOutputRoot(outputRoot) {
  const resolved = path.resolve(outputRoot);
  if ([path.parse(resolved).root, repositoryRoot, defaultStaticRoot].includes(resolved)) {
    fail(`refusing to replace unsafe output directory: ${resolved}`);
  }
  return resolved;
}

export async function buildDataProducts({
  sourceRoot,
  outputRoot = defaultOutputRoot,
  staticRoot = defaultStaticRoot,
  planPath = defaultPlanPath,
  contractPath = defaultContractPath
}) {
  if (!sourceRoot) fail('a --source-root directory is required');
  const resolvedOutputRoot = assertSafeOutputRoot(outputRoot);
  const resolvedStaticRoot = path.resolve(staticRoot);
  const plan = validatePublicationPlan(await readJson(path.resolve(planPath), 'publication plan'));
  const contracts = validateContractManifest(await readJson(path.resolve(contractPath), 'source contract manifest'));
  const contractsById = new Map(contracts.contracts.map((contract) => [contract.id, contract]));

  if (contractsById.size !== contracts.contracts.length) fail('source contract ids must be unique');
  if (plan.contractProducts.length !== contracts.contracts.length
    || plan.contractProducts.some((product) => !contractsById.has(product.contractId))) {
    fail('the publication plan must account for every source contract exactly once');
  }

  await verifySourceContracts({ contractPath: path.resolve(contractPath), sourceRoot });
  await rm(resolvedOutputRoot, { recursive: true, force: true });
  await mkdir(resolvedOutputRoot, { recursive: true });

  const products = [];
  for (const genericProduct of plan.genericProducts) {
    products.push(await buildGenericProduct({ genericProduct, staticRoot: resolvedStaticRoot, outputRoot: resolvedOutputRoot }));
  }
  for (const contractProduct of plan.contractProducts) {
    const contract = contractsById.get(contractProduct.contractId);
    products.push(await buildContractProduct({
      contract,
      contractProduct,
      sourceRepository: contracts.sourceRepository,
      sourceRoot,
      outputRoot: resolvedOutputRoot
    }));
  }

  const productIds = new Set();
  for (const product of products) {
    if (productIds.has(product.id)) fail(`publication plan produces duplicate product id ${product.id}`);
    productIds.add(product.id);
  }
  const catalog = {
    schemaVersion: 1,
    title: plan.title,
    products
  };
  await writeJson(path.join(resolvedOutputRoot, 'catalog.json'), catalog);
  return {
    outputRoot: resolvedOutputRoot,
    products: products.length,
    publishedProducts: products.filter((product) => product.publicationStatus === 'published').length,
    metadataOnlyProducts: products.filter((product) => product.publicationStatus === 'metadata-only').length
  };
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help' || option === '-h') return { help: true };
    if (!['--source-root', '--output', '--static-root', '--plan', '--contract'].includes(option)) {
      fail(`unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`option ${option} requires a value`);
    options[option.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return 'Usage: npm run products:build -- --source-root <raw-data-dir> [--output <static-data-products-dir>] [--static-root <static-dir>] [--plan <publication-plan.json>] [--contract <source-contracts.json>]';
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else if (!options.sourceRoot) {
      fail(`option --source-root is required\n${usage()}`);
    } else {
      console.log(JSON.stringify(await buildDataProducts(options), null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
