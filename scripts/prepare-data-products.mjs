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
  'chunked-derived-frequency-list',
  'chunked-syntactic-context'
]);
const SYNTACTIC_CONTEXT_PRODUCT_TYPE = 'chunked-syntactic-context';

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

function validateSyntacticContextConfiguration(configuration, description) {
  if (!isPlainObject(configuration) || !normalizeString(configuration.sourceRole)
    || !Number.isSafeInteger(configuration.maxExamplesPerLemma) || configuration.maxExamplesPerLemma < 1
    || configuration.maxExamplesPerLemma > 50
    || !Number.isSafeInteger(configuration.chunkBytes) || configuration.chunkBytes < 1024
    || !Number.isSafeInteger(configuration.lemmaIndexPrefixCodePoints) || configuration.lemmaIndexPrefixCodePoints < 1
    || configuration.lemmaIndexPrefixCodePoints > 3
    || !Number.isSafeInteger(configuration.contextPrefixCodePoints) || configuration.contextPrefixCodePoints < 1
    || configuration.contextPrefixCodePoints > 3
    || configuration.contextPrefixCodePoints < configuration.lemmaIndexPrefixCodePoints
    || !isPlainObject(configuration.genreLabels) || Object.keys(configuration.genreLabels).length === 0
    || Object.entries(configuration.genreLabels).some(([key, value]) => !isSafeRelativePath(key) || !normalizeString(value))
    || !isPlainObject(configuration.expectedSummary)) {
    fail(`${description}.syntaxContext is invalid`);
  }
  for (const field of [
    'documents', 'sentences', 'integerTokenRows', 'nonPunctuationRows',
    'allRelationLabels', 'nonPunctuationRelationLabels', 'rootRows',
    'nonPunctuationRootRows', 'nonRootDependencyRows', 'lemmaCount', 'contextRecordCount',
    'contextRowsOmittedByLimit', 'lemmaIndexPrefixes', 'contextPrefixes'
  ]) {
    asSafeInteger(configuration.expectedSummary[field], `${description}.syntaxContext.expectedSummary.${field}`);
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

    if (product.productType === SYNTACTIC_CONTEXT_PRODUCT_TYPE) {
      if (product.publication.status !== 'published' || product.views !== undefined) {
        fail(`${description} must publish its syntax context without generic row views`);
      }
      validateSyntacticContextConfiguration(product.syntaxContext, description);
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
    ...(file.archiveMember === undefined ? {} : { archiveMember: file.archiveMember }),
    ...(file.archiveDirectory === undefined ? {} : { archiveDirectory: file.archiveDirectory }),
    ...(file.conlluSummary === undefined ? {} : { conlluSummary: file.conlluSummary })
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

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function prefixFor(value, codePoints) {
  const prefix = Array.from(value.toLocaleLowerCase('lt')).slice(0, codePoints).join('');
  return prefix || '_';
}

async function runUnzip(args, description) {
  const child = spawn('unzip', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = [];
  let stderr = '';
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (exitCode !== 0) fail(`could not read ${description}: ${stderr.trim()}`);
  return Buffer.concat(stdout);
}

function decodeUtf8(buffer, description) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`${description} is not valid UTF-8`);
  }
}

function assertTreebankSourceFile(sourceFile, configuration) {
  if (sourceFile.format !== 'zip-conllu-treebank' || !isSafeRelativePath(sourceFile.archiveDirectory)
    || !isPlainObject(sourceFile.conlluSummary)) {
    fail(`${configuration.sourceRole} requires a zip-conllu-treebank source file and reviewed summary`);
  }
  for (const field of [
    'documents', 'sentences', 'repositorySentenceClaim', 'integerTokenRows',
    'nonPunctuationRows', 'allRelationLabels', 'nonPunctuationRelationLabels',
    'rootRows', 'nonPunctuationRootRows', 'nonRootDependencyRows', 'uncompressedBytes'
  ]) {
    asSafeInteger(sourceFile.conlluSummary[field], `${configuration.sourceRole} source ${field}`);
  }
  if (!/^[a-f0-9]{64}$/.test(sourceFile.conlluSummary.membersSha256)) {
    fail(`${configuration.sourceRole} source conlluSummary.membersSha256 must be a SHA-256 checksum`);
  }
}

function parseConlluDocument({ text, sourceDisplayPath, member, onSentence }) {
  let comments = [];
  let rows = [];
  let sentenceNumber = 0;
  const finishSentence = () => {
    if (rows.length === 0) {
      comments = [];
      return;
    }
    sentenceNumber += 1;
    const sourceSentenceId = normalizeString(comments.find((line) => line.startsWith('# sent_id = '))?.slice('# sent_id = '.length));
    if (!sourceSentenceId) fail(`${sourceDisplayPath} archive member ${member} sentence ${sentenceNumber} has no sent_id`);
    const tokens = new Map();
    for (const row of rows) {
      const values = row.split('\t');
      if (values.length !== 10) fail(`${sourceDisplayPath} archive member ${member} has a malformed CoNLL-U row`);
      if (!/^\d+$/.test(values[0])) continue;
      const [id, form, lemma, universalPos, , , head, relation] = values;
      if (!normalizeString(form) || !normalizeString(lemma) || !normalizeString(universalPos)
        || !normalizeString(head) || !normalizeString(relation) || !/^(?:0|[1-9]\d*)$/.test(head)) {
        fail(`${sourceDisplayPath} archive member ${member} has an incomplete CoNLL-U token row`);
      }
      tokens.set(Number(id), {
        id: Number(id),
        form: form.trim(),
        lemma: lemma.trim(),
        universalPos: universalPos.trim(),
        head: Number(head),
        relation: relation.trim()
      });
    }
    if (tokens.size === 0) fail(`${sourceDisplayPath} archive member ${member} sentence ${sourceSentenceId} has no integer-ID tokens`);
    const suppliedText = normalizeString(comments.find((line) => line.startsWith('# text = '))?.slice('# text = '.length));
    const sentenceText = suppliedText || [...tokens.values()].sort((left, right) => left.id - right.id).map((token) => token.form).join(' ');
    onSentence({ sourceSentenceId, tokens, sentenceText });
    comments = [];
    rows = [];
  };

  for (const line of text.split(/\r?\n/)) {
    if (line === '') {
      finishSentence();
    } else if (line.startsWith('#')) {
      comments.push(line);
    } else {
      rows.push(line);
    }
  }
  finishSentence();
}

async function buildDerivedRecordsView({
  productId, productDirectory, sourceFile, view, records, sourceRows, selection
}) {
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const suffix = ']}\n';
  const chunks = [];
  const numericTotals = fieldTotals(view.fields);
  const nullCounts = fieldNullCounts(view.fields);
  let chunkNumber = 0;
  let recordJsons = [];
  let recordsBytes = 0;
  let chunkSelectionPrefixes = [];

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
      sha256: createHash('sha256').update(buffer).digest('hex'),
      ...(chunkSelectionPrefixes.length === 0 ? {} : { selectionPrefixes: chunkSelectionPrefixes })
    });
    chunkNumber += 1;
    recordJsons = [];
    recordsBytes = 0;
    chunkSelectionPrefixes = [];
  }

  for (const record of records) {
    if (!Array.isArray(record) || record.length !== view.fields.length) {
      fail(`${productId}/${view.id} produced an invalid record shape`);
    }
    for (const [index, field] of view.fields.entries()) {
      const value = record[index];
      if (NUMERIC_FIELD_TYPES.has(field.type)) {
        if (!Number.isSafeInteger(value) || value < 0) fail(`${productId}/${view.id} produced an invalid ${field.id} value`);
        if (SUMMARIZED_FIELD_TYPES.has(field.type)) numericTotals[field.id] += value;
      } else if (!normalizeString(value)) {
        fail(`${productId}/${view.id} produced an empty ${field.id} value`);
      }
    }
    const recordSelectionPrefix = selection?.prefixForRecord(record);
    if (selection && !normalizeString(recordSelectionPrefix)) {
      fail(`${productId}/${view.id} produced an empty selection prefix`);
    }
    if (recordJsons.length > 0 && selection?.packPrefixes !== true
      && recordSelectionPrefix !== chunkSelectionPrefixes[0]) await flushChunk();
    const recordJson = JSON.stringify(record);
    const candidateBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (candidateBytes > view.chunkBytes && recordJsons.length > 0) await flushChunk();
    const currentBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (currentBytes > view.chunkBytes) fail(`${productId}/${view.id} produced an oversize record`);
    if (selection && !chunkSelectionPrefixes.includes(recordSelectionPrefix)) {
      chunkSelectionPrefixes.push(recordSelectionPrefix);
    }
    recordJsons.push(recordJson);
    recordsBytes += (recordJsons.length === 1 ? 0 : 1) + Buffer.byteLength(recordJson);
  }
  await flushChunk();
  if (chunks.length === 0) fail(`${productId}/${view.id} produced no records`);

  const summary = {
    sourceRows,
    recordCount: records.length,
    numericTotals,
    nullCounts
  };
  const index = {
    schemaVersion: 1,
    productId,
    viewId: view.id,
    recordEncoding: 'array',
    fields: view.fields,
    ordering: view.ordering,
    sourceFile: publicSourceFile(sourceFile),
    derivation: {
      type: 'conllu-treebank-syntax-context',
      expectedSummary: { sourceRows, recordCount: records.length }
    },
    ...(selection === undefined ? {} : {
      selection: {
        type: 'lemma-prefix',
        field: selection.field,
        codePoints: selection.codePoints
      }
    }),
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

function derivedField(id, label, type, unit) {
  return { id, label, type, ...(unit === undefined ? {} : { unit }), derived: true };
}

async function buildSyntacticContextProduct({ contract, contractProduct, sourceRepository, sourceRoot, outputRoot }) {
  const configuration = contractProduct.syntaxContext;
  const sourceFiles = contract.source.files.filter((file) => file.role === configuration.sourceRole);
  if (sourceFiles.length !== 1 || contract.source.files.length !== 1) {
    fail(`${contract.id} syntax context must use exactly one reviewed source archive`);
  }
  const sourceFile = sourceFiles[0];
  assertTreebankSourceFile(sourceFile, configuration);
  const { realRoot, sourcePath } = await resolveSourcePath(sourceRoot, sourceFile.path);
  const sourceDisplayPath = sourceRelativePath(realRoot, sourcePath);
  const archiveListing = decodeUtf8(await runUnzip(['-Z1', sourcePath], sourceDisplayPath), `${sourceDisplayPath} archive listing`);
  const archivePrefix = `${sourceFile.archiveDirectory}/`;
  const members = archiveListing.split(/\r?\n/)
    .filter((member) => member.endsWith('.conllu'))
    .sort(compareStrings);
  if (members.length === 0 || members.some((member) => !member.startsWith(archivePrefix))) {
    fail(`${sourceDisplayPath} has no reviewed CoNLL-U members under ${sourceFile.archiveDirectory}`);
  }

  const sourceSummary = sourceFile.conlluSummary;
  const expectedGenres = new Map(Object.entries(configuration.genreLabels));
  const observedGenres = new Map();
  const relationCounts = new Map();
  const allRelationLabels = new Set();
  const lemmaStats = new Map();
  const contextRecordsByLemma = new Map();
  const membersHash = createHash('sha256');
  let uncompressedBytes = 0;
  let sentences = 0;
  let integerTokenRows = 0;
  let nonPunctuationRows = 0;
  let rootRows = 0;
  let nonPunctuationRootRows = 0;
  let nonRootDependencyRows = 0;
  let contextRowsOmittedByLimit = 0;
  let contextSequence = 0;

  function lemmaEntry(lemma) {
    const existing = lemmaStats.get(lemma);
    if (existing) return existing;
    const created = { lemma, tokenCount: 0, headEdgeCount: 0, dependentEdgeCount: 0, rootEdgeCount: 0 };
    lemmaStats.set(lemma, created);
    return created;
  }

  function addContext(lemma, record) {
    const entries = contextRecordsByLemma.get(lemma) ?? [];
    if (entries.length >= configuration.maxExamplesPerLemma) {
      contextRowsOmittedByLimit += 1;
      return;
    }
    entries.push({ record, sequence: contextSequence });
    contextSequence += 1;
    contextRecordsByLemma.set(lemma, entries);
  }

  for (const member of members) {
    const relativeMember = member.slice(archivePrefix.length);
    const segments = relativeMember.split('/');
    const genreId = segments.slice(0, -1).join('/');
    const document = relativeMember;
    const genre = expectedGenres.get(genreId);
    if (!genre || segments.length < 2) fail(`${sourceDisplayPath} archive member ${member} has an unreviewed genre`);
    const genreSummary = observedGenres.get(genreId) ?? {
      genreId,
      genre,
      documents: 0,
      sentences: 0,
      integerTokenRows: 0,
      nonPunctuationRows: 0,
      relationshipRows: 0
    };
    genreSummary.documents += 1;
    observedGenres.set(genreId, genreSummary);

    const buffer = await runUnzip(['-p', sourcePath, member], `${sourceDisplayPath} archive member ${member}`);
    membersHash.update(Buffer.from(member, 'utf8'));
    membersHash.update(Buffer.from([0]));
    membersHash.update(buffer);
    membersHash.update(Buffer.from([0]));
    uncompressedBytes += buffer.byteLength;
    parseConlluDocument({
      text: decodeUtf8(buffer, `${sourceDisplayPath} archive member ${member}`),
      sourceDisplayPath,
      member,
      onSentence: ({ sourceSentenceId, tokens, sentenceText }) => {
        sentences += 1;
        genreSummary.sentences += 1;
        for (const token of tokens.values()) {
          integerTokenRows += 1;
          genreSummary.integerTokenRows += 1;
          allRelationLabels.add(token.relation);
          if (token.head === 0) rootRows += 1;
        }
        for (const dependent of tokens.values()) {
          if (dependent.universalPos === 'PUNCT') continue;
          nonPunctuationRows += 1;
          genreSummary.nonPunctuationRows += 1;
          genreSummary.relationshipRows += 1;
          relationCounts.set(dependent.relation, (relationCounts.get(dependent.relation) ?? 0) + 1);
          const dependentEntry = lemmaEntry(dependent.lemma);
          dependentEntry.tokenCount += 1;
          dependentEntry.dependentEdgeCount += 1;
          const baseRecord = {
            relation: dependent.relation,
            dependentLemma: dependent.lemma,
            dependentForm: dependent.form,
            genreId,
            genre,
            document,
            sourceSentenceId,
            sentenceText
          };
          if (dependent.head === 0) {
            nonPunctuationRootRows += 1;
            dependentEntry.rootEdgeCount += 1;
            addContext(dependent.lemma, [
              dependent.lemma, 'root', baseRecord.relation, baseRecord.dependentLemma, baseRecord.dependentForm,
              'ROOT', 'ROOT', baseRecord.genreId, baseRecord.genre, baseRecord.document,
              baseRecord.sourceSentenceId, baseRecord.sentenceText
            ]);
            continue;
          }
          nonRootDependencyRows += 1;
          const head = tokens.get(dependent.head);
          if (!head) fail(`${sourceDisplayPath} archive member ${member} sentence ${sourceSentenceId} has a missing dependency head`);
          const contextRecord = [
            dependent.lemma, 'dependent', baseRecord.relation, baseRecord.dependentLemma, baseRecord.dependentForm,
            head.lemma, head.form, baseRecord.genreId, baseRecord.genre, baseRecord.document,
            baseRecord.sourceSentenceId, baseRecord.sentenceText
          ];
          addContext(dependent.lemma, contextRecord);
          if (head.universalPos !== 'PUNCT') {
            const headEntry = lemmaEntry(head.lemma);
            headEntry.headEdgeCount += 1;
            addContext(head.lemma, [
              head.lemma, 'head', baseRecord.relation, baseRecord.dependentLemma, baseRecord.dependentForm,
              head.lemma, head.form, baseRecord.genreId, baseRecord.genre, baseRecord.document,
              baseRecord.sourceSentenceId, baseRecord.sentenceText
            ]);
          }
        }
      }
    });
  }

  const nonPunctuationRelationLabels = relationCounts.size;
  const observedSourceSummary = {
    documents: members.length,
    sentences,
    repositorySentenceClaim: sourceSummary.repositorySentenceClaim,
    integerTokenRows,
    nonPunctuationRows,
    allRelationLabels: allRelationLabels.size,
    nonPunctuationRelationLabels,
    rootRows,
    nonPunctuationRootRows,
    nonRootDependencyRows,
    uncompressedBytes
  };
  for (const [field, actual] of Object.entries(observedSourceSummary)) {
    if (sourceSummary[field] !== actual) fail(`${sourceDisplayPath} reviewed treebank ${field} does not match the source archive`);
  }
  if (membersHash.digest('hex') !== sourceSummary.membersSha256) {
    fail(`${sourceDisplayPath} reviewed treebank members do not match the source archive`);
  }
  if (observedGenres.size !== expectedGenres.size || [...expectedGenres.keys()].some((genreId) => !observedGenres.has(genreId))) {
    fail(`${sourceDisplayPath} treebank genres do not match the publication plan`);
  }

  const lemmaRecords = [...lemmaStats.values()]
    .sort((left, right) => compareStrings(left.lemma, right.lemma))
    .map((entry) => [
      entry.lemma, entry.tokenCount, entry.headEdgeCount, entry.dependentEdgeCount,
      entry.rootEdgeCount
    ]);
  const relationRecords = [...relationCounts.entries()]
    .map(([relation, count]) => [relation, count])
    .sort((left, right) => right[1] - left[1] || compareStrings(left[0], right[0]));
  const genreRecords = [...observedGenres.values()]
    .sort((left, right) => compareStrings(left.genreId, right.genreId))
    .map((entry) => [
      entry.genreId, entry.genre, entry.documents, entry.sentences, entry.integerTokenRows,
      entry.nonPunctuationRows, entry.relationshipRows
    ]);
  const contextRecords = [...contextRecordsByLemma.entries()]
    .flatMap(([lemma, entries]) => entries.map(({ record, sequence }) => ({ lemma, record, sequence })))
    .sort((left, right) => compareStrings(prefixFor(left.lemma, configuration.contextPrefixCodePoints), prefixFor(right.lemma, configuration.contextPrefixCodePoints))
      || compareStrings(left.lemma, right.lemma) || left.sequence - right.sequence)
    .map((entry) => entry.record);
  const expectedSummary = configuration.expectedSummary;
  const observedProductSummary = {
    documents: members.length,
    sentences,
    integerTokenRows,
    nonPunctuationRows,
    allRelationLabels: allRelationLabels.size,
    nonPunctuationRelationLabels,
    rootRows,
    nonPunctuationRootRows,
    nonRootDependencyRows,
    lemmaCount: lemmaRecords.length,
    contextRecordCount: contextRecords.length,
    contextRowsOmittedByLimit,
    lemmaIndexPrefixes: new Set(lemmaRecords.map((record) => prefixFor(record[0], configuration.lemmaIndexPrefixCodePoints))).size,
    contextPrefixes: new Set(contextRecords.map((record) => prefixFor(record[0], configuration.contextPrefixCodePoints))).size
  };
  for (const [field, actual] of Object.entries(observedProductSummary)) {
    if (expectedSummary[field] !== actual) fail(`${sourceDisplayPath} syntax context ${field} does not match the publication plan`);
  }

  const productDirectory = path.join(outputRoot, contract.id);
  const chunkBytes = configuration.chunkBytes;
  const views = await Promise.all([
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: nonPunctuationRows,
      view: {
        id: 'relations-by-frequency', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS dependency relations',
        description: 'Frequency of source dependency-relation labels across non-punctuation token rows, including source roots.',
        ordering: { field: 'count', direction: 'descending' }, chunkBytes,
        fields: [
          derivedField('relation', 'Source dependency relation', 'string'),
          derivedField('count', 'Annotated non-punctuation token rows', 'raw-token-count', 'tokens')
        ]
      },
      records: relationRecords
    }),
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: members.length,
      view: {
        id: 'genres-by-source-order', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS source genres',
        description: 'Document, sentence, token, and non-punctuation relation totals for each source genre.',
        ordering: { field: 'genreId', direction: 'ascending' }, chunkBytes,
        fields: [
          derivedField('genreId', 'Source genre identifier', 'string'),
          derivedField('genre', 'Source genre', 'string'),
          derivedField('documents', 'Documents', 'raw-token-count', 'documents'),
          derivedField('sentences', 'Sentence IDs', 'raw-token-count', 'sentences'),
          derivedField('integerTokenRows', 'Integer-ID token rows', 'raw-token-count', 'tokens'),
          derivedField('nonPunctuationRows', 'Non-punctuation token rows', 'raw-token-count', 'tokens'),
          derivedField('relationshipRows', 'Annotated relationship rows', 'raw-token-count', 'tokens')
        ]
      },
      records: genreRecords
    }),
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: nonPunctuationRows,
      selection: {
        field: 'lemma', codePoints: configuration.lemmaIndexPrefixCodePoints,
        prefixForRecord: (record) => prefixFor(record[0], configuration.lemmaIndexPrefixCodePoints),
        packPrefixes: true
      },
      view: {
        id: 'lemmas-by-source-order', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS lemma context index',
        description: 'Every non-punctuation source lemma, with its annotated token count and the number of retained dependency roles.',
        ordering: { field: 'lemma', direction: 'ascending' }, chunkBytes,
        fields: [
          derivedField('lemma', 'Source lemma', 'string'),
          derivedField('tokenCount', 'Non-punctuation token rows', 'raw-token-count', 'tokens'),
          derivedField('headEdgeCount', 'Rows where the lemma is a non-punctuation head', 'raw-token-count', 'relationships'),
          derivedField('dependentEdgeCount', 'Rows where the lemma is the dependent', 'raw-token-count', 'relationships'),
          derivedField('rootEdgeCount', 'Rows where the lemma has source head 0', 'raw-token-count', 'relationships')
        ]
      },
      records: lemmaRecords
    }),
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: contextRecords.length,
      selection: {
        field: 'lemma', codePoints: configuration.contextPrefixCodePoints,
        prefixForRecord: (record) => prefixFor(record[0], configuration.contextPrefixCodePoints),
        packPrefixes: true
      },
      view: {
        id: 'sentence-contexts-by-lemma', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS sentence contexts',
        description: 'Up to the reviewed source-order limit of dependency contexts per non-punctuation lemma; fetch by selected lemma prefix.',
        ordering: { field: 'lemma', direction: 'ascending' }, chunkBytes,
        fields: [
          derivedField('lemma', 'Selected source lemma', 'string'),
          derivedField('direction', 'Selected lemma role', 'string'),
          derivedField('relation', 'Source dependency relation', 'string'),
          derivedField('dependentLemma', 'Dependent source lemma', 'string'),
          derivedField('dependentForm', 'Dependent source form', 'string'),
          derivedField('headLemma', 'Head source lemma or ROOT', 'string'),
          derivedField('headForm', 'Head source form or ROOT', 'string'),
          derivedField('genreId', 'Source genre identifier', 'string'),
          derivedField('genre', 'Source genre', 'string'),
          derivedField('document', 'Source CoNLL-U document', 'string'),
          derivedField('sourceSentenceId', 'Source sentence identifier', 'string'),
          derivedField('sentenceText', 'Source sentence text', 'string')
        ]
      },
      records: contextRecords
    })
  ]);

  const manifest = {
    schemaVersion: 1,
    id: contract.id,
    title: contract.title,
    productType: SYNTACTIC_CONTEXT_PRODUCT_TYPE,
    publication: contractProduct.publication,
    provenance: {
      sourceRepository,
      sourceUrl: contract.source.sourceUrl,
      licence: contract.source.licence,
      citation: contract.source.citation,
      files: contract.source.files.map(publicSourceFile)
    },
    delivery: {
      mode: 'static-prefix-chunked-syntax-context-json',
      constraints: contract.delivery?.constraints ?? []
    },
    syntaxContext: {
      overview: {
        repositorySentenceClaim: sourceSummary.repositorySentenceClaim,
        deliveredSentenceIds: sentences,
        documents: members.length,
        integerTokenRows,
        nonPunctuationRows,
        allRelationLabels: allRelationLabels.size,
        nonPunctuationRelationLabels,
        rootRows,
        nonPunctuationRootRows,
        nonRootDependencyRows
      },
      exclusions: ['UPOS=PUNCT is excluded from the lemma index, relation summary, and contexts.'],
      exampleSelection: {
        maxExamplesPerLemma: configuration.maxExamplesPerLemma,
        order: 'Archive member, sentence, and token source order.',
        omittedRows: contextRowsOmittedByLimit
      },
      lookup: {
        lemmaIndexView: 'lemmas-by-source-order',
        lemmaIndexPrefixCodePoints: configuration.lemmaIndexPrefixCodePoints,
        contextView: 'sentence-contexts-by-lemma',
        contextPrefixCodePoints: configuration.contextPrefixCodePoints,
        directions: ['dependent', 'head', 'root']
      }
    },
    views
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

  if (contractProduct.productType === SYNTACTIC_CONTEXT_PRODUCT_TYPE) {
    return buildSyntacticContextProduct({ contract, contractProduct, sourceRepository, sourceRoot, outputRoot });
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
    views
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
