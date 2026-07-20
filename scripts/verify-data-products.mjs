import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultStaticRoot = path.join(repositoryRoot, 'static');
const defaultOutputRoot = path.join(defaultStaticRoot, 'data-products');

const NUMERIC_FIELD_TYPES = new Set([
  'raw-token-count',
  'normalized-token-count',
  'normalized-document-count',
  'coverage-code'
]);
const FIELD_TYPES = new Set([
  'string',
  'source-pos-code',
  ...NUMERIC_FIELD_TYPES
]);
const SUMMARIZED_FIELD_TYPES = new Set([
  'raw-token-count',
  'normalized-token-count',
  'normalized-document-count'
]);

function fail(message) {
  throw new Error(`Data-product verification failed: ${message}`);
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

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveProductPath(root, relativePath, description) {
  if (!normalizeString(relativePath) || path.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.split('/').includes('..')) {
    fail(`${description} must be a safe relative product path`);
  }
  const resolved = path.resolve(root, relativePath);
  if (!isPathInside(root, resolved)) fail(`${description} escapes the product root`);
  return resolved;
}

function resolveStaticPath(staticRoot, fromDirectory, relativePath, description) {
  if (!normalizeString(relativePath) || path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    fail(`${description} must be a relative static path`);
  }
  const resolved = path.resolve(fromDirectory, relativePath);
  if (!isPathInside(staticRoot, resolved)) fail(`${description} escapes the static root`);
  return resolved;
}

function parseJson(buffer, description) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    fail(`${description} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function assertSafeInteger(value, description) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${description} must be a non-negative safe integer`);
}

function sameObject(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateField(field, description) {
  if (!isPlainObject(field) || !isSafeFieldId(field.id) || !normalizeString(field.label) || !FIELD_TYPES.has(field.type)
    || !Number.isInteger(field.sourceColumn) || field.sourceColumn < 0) {
    fail(`${description} is invalid`);
  }
  if (field.nullable !== undefined && typeof field.nullable !== 'boolean') fail(`${description}.nullable is invalid`);
  if (NUMERIC_FIELD_TYPES.has(field.type) && !normalizeString(field.unit)) fail(`${description}.unit is invalid`);
  if (field.type === 'coverage-code') {
    if (!isPlainObject(field.values) || Object.entries(field.values).some(([key, value]) => !/^\d+$/.test(key) || !normalizeString(value))) {
      fail(`${description}.values is invalid`);
    }
  } else if (field.values !== undefined) {
    fail(`${description}.values is only valid for a coverage code`);
  }
  if (field.type.startsWith('normalized-')) {
    if (!isPlainObject(field.normalization) || !Number.isSafeInteger(field.normalization.sourceTokens)
      || field.normalization.sourceTokens < 1 || !Number.isSafeInteger(field.normalization.targetTokens)
      || field.normalization.targetTokens < 1) {
      fail(`${description}.normalization is invalid`);
    }
  } else if (field.normalization !== undefined) {
    fail(`${description}.normalization is only valid for a normalized metric`);
  }
}

function validateRecord(record, fields, description, totals, nullCounts) {
  if (!Array.isArray(record) || record.length !== fields.length) fail(`${description} has the wrong record shape`);
  for (const [index, field] of fields.entries()) {
    const value = record[index];
    if (!NUMERIC_FIELD_TYPES.has(field.type)) {
      if (!normalizeString(value)) fail(`${description} has an empty ${field.id} field`);
      continue;
    }
    if (value === null) {
      if (field.nullable !== true) fail(`${description} has a null non-nullable ${field.id} metric`);
      nullCounts[field.id] += 1;
      continue;
    }
    if (!Number.isSafeInteger(value) || value < 0) fail(`${description} has an invalid ${field.id} metric`);
    if (field.type === 'coverage-code' && !Object.hasOwn(field.values, String(value))) {
      fail(`${description} has an unlabelled coverage code`);
    }
    if (SUMMARIZED_FIELD_TYPES.has(field.type)) totals[field.id] += value;
  }
}

function expectedTotals(fields) {
  return Object.fromEntries(fields.filter((field) => SUMMARIZED_FIELD_TYPES.has(field.type)).map((field) => [field.id, 0]));
}

function expectedNullCounts(fields) {
  return Object.fromEntries(fields.filter((field) => field.nullable === true).map((field) => [field.id, 0]));
}

async function verifyGenericProduct({ manifest, productDirectory, staticRoot }) {
  if (!isPlainObject(manifest.content) || manifest.content.format !== 'dazniausi-zodziai-dataset-v1'
    || !normalizeString(manifest.content.file) || !isPlainObject(manifest.content.summary)) {
    fail(`${manifest.id} generic product content is invalid`);
  }
  const datasetPath = resolveStaticPath(staticRoot, productDirectory, manifest.content.file, `${manifest.id} generic content file`);
  const dataset = parseJson(await readFile(datasetPath), `${manifest.id} generic content file`);
  if (!isPlainObject(dataset) || dataset.id !== manifest.id || !Array.isArray(dataset.words) || !isPlainObject(dataset.summary)
    || !sameObject(dataset.summary, manifest.content.summary) || dataset.words.length !== dataset.summary.entryCount) {
    fail(`${manifest.id} generic content does not match its manifest`);
  }
  return { chunkedViews: 0, chunks: 0, records: dataset.words.length, viewCount: 1 };
}

async function verifyChunkedProduct({ manifest, productDirectory }) {
  if (!Array.isArray(manifest.views) || manifest.views.length === 0) fail(`${manifest.id} has no chunked views`);
  let chunkedViews = 0;
  let chunks = 0;
  let records = 0;
  const viewIds = new Set();
  for (const view of manifest.views) {
    if (!isPlainObject(view) || !isSafeId(view.id) || !normalizeString(view.index) || view.recordEncoding !== 'array') {
      fail(`${manifest.id} has an invalid view`);
    }
    if (viewIds.has(view.id)) fail(`${manifest.id} has duplicate view id ${view.id}`);
    viewIds.add(view.id);

    const indexPath = resolveProductPath(productDirectory, view.index, `${manifest.id}/${view.id} index`);
    const index = parseJson(await readFile(indexPath), `${manifest.id}/${view.id} index`);
    if (!isPlainObject(index) || index.schemaVersion !== 1 || index.productId !== manifest.id || index.viewId !== view.id
      || index.recordEncoding !== 'array' || !Array.isArray(index.fields) || index.fields.length === 0
      || !Array.isArray(index.chunks) || index.chunks.length === 0 || !isPlainObject(index.summary)
      || !Number.isSafeInteger(index.maxChunkBytes) || index.maxChunkBytes < 1024) {
      fail(`${manifest.id}/${view.id} index is invalid`);
    }
    const fields = index.fields;
    const fieldIds = new Set();
    for (const [fieldIndex, field] of fields.entries()) {
      validateField(field, `${manifest.id}/${view.id}.fields[${fieldIndex}]`);
      if (fieldIds.has(field.id)) fail(`${manifest.id}/${view.id} has duplicate field id ${field.id}`);
      fieldIds.add(field.id);
    }
    const totals = expectedTotals(fields);
    const nullCounts = expectedNullCounts(fields);
    let viewRecords = 0;

    for (const [chunkIndex, descriptor] of index.chunks.entries()) {
      if (!isPlainObject(descriptor) || !normalizeString(descriptor.file) || !Number.isSafeInteger(descriptor.records)
        || descriptor.records < 1 || !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1
        || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
        fail(`${manifest.id}/${view.id} has an invalid chunk descriptor`);
      }
      const chunkPath = resolveProductPath(path.dirname(indexPath), descriptor.file, `${manifest.id}/${view.id} chunk`);
      const buffer = await readFile(chunkPath);
      if (buffer.byteLength !== descriptor.bytes || buffer.byteLength > index.maxChunkBytes) {
        fail(`${manifest.id}/${view.id} chunk ${chunkIndex} byte count is invalid`);
      }
      const checksum = createHash('sha256').update(buffer).digest('hex');
      if (checksum !== descriptor.sha256) fail(`${manifest.id}/${view.id} chunk ${chunkIndex} checksum is invalid`);
      const chunk = parseJson(buffer, `${manifest.id}/${view.id} chunk ${chunkIndex}`);
      if (!isPlainObject(chunk) || chunk.schemaVersion !== 1 || chunk.productId !== manifest.id || chunk.viewId !== view.id
        || chunk.chunk !== chunkIndex || !Array.isArray(chunk.records) || chunk.records.length !== descriptor.records) {
        fail(`${manifest.id}/${view.id} chunk ${chunkIndex} content is invalid`);
      }
      for (const [recordIndex, record] of chunk.records.entries()) {
        validateRecord(record, fields, `${manifest.id}/${view.id} chunk ${chunkIndex} record ${recordIndex}`, totals, nullCounts);
      }
      viewRecords += chunk.records.length;
    }

    const expectedSummary = {
      sourceRows: viewRecords,
      recordCount: viewRecords,
      numericTotals: totals,
      nullCounts
    };
    if (!sameObject(index.summary, expectedSummary) || !sameObject(view.summary, expectedSummary)) {
      fail(`${manifest.id}/${view.id} summary does not match its chunks`);
    }
    chunkedViews += 1;
    chunks += index.chunks.length;
    records += viewRecords;
  }
  return { chunkedViews, chunks, records, viewCount: manifest.views.length };
}

function validateManifest(manifest, catalogEntry) {
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 1 || !isSafeId(manifest.id)
    || !normalizeString(manifest.title) || !normalizeString(manifest.productType)
    || !isPlainObject(manifest.publication) || !['published', 'metadata-only'].includes(manifest.publication.status)) {
    fail('product manifest is invalid');
  }
  if (manifest.id !== catalogEntry.id || manifest.productType !== catalogEntry.productType
    || manifest.publication.status !== catalogEntry.publicationStatus) {
    fail(`${catalogEntry.id} manifest does not match the catalog`);
  }
}

export async function verifyDataProducts({ outputRoot = defaultOutputRoot, staticRoot = defaultStaticRoot } = {}) {
  const resolvedOutputRoot = await realpath(outputRoot);
  const resolvedStaticRoot = await realpath(staticRoot);
  const catalog = parseJson(await readFile(path.join(resolvedOutputRoot, 'catalog.json')), 'product catalog');
  if (!isPlainObject(catalog) || catalog.schemaVersion !== 1 || !normalizeString(catalog.title) || !Array.isArray(catalog.products)) {
    fail('product catalog is invalid');
  }
  const ids = new Set();
  const result = { products: 0, chunkedViews: 0, chunks: 0, records: 0, metadataOnlyProducts: 0 };
  for (const entry of catalog.products) {
    if (!isPlainObject(entry) || !isSafeId(entry.id) || !normalizeString(entry.title) || !normalizeString(entry.productType)
      || !['published', 'metadata-only'].includes(entry.publicationStatus) || !normalizeString(entry.manifest)
      || !normalizeString(entry.licence) || !Number.isSafeInteger(entry.viewCount) || entry.viewCount < 0
      || (entry.recordCount !== null && (!Number.isSafeInteger(entry.recordCount) || entry.recordCount < 0))) {
      fail('product catalog has an invalid entry');
    }
    if (ids.has(entry.id)) fail(`product catalog repeats ${entry.id}`);
    ids.add(entry.id);
    const manifestPath = resolveProductPath(resolvedOutputRoot, entry.manifest, `${entry.id} manifest`);
    const manifest = parseJson(await readFile(manifestPath), `${entry.id} manifest`);
    validateManifest(manifest, entry);
    const productDirectory = path.dirname(manifestPath);
    if (manifest.publication.status === 'metadata-only') {
      if (manifest.productType !== 'metadata-only' || !Array.isArray(manifest.blockedBy) || manifest.blockedBy.length === 0
        || manifest.views !== undefined || manifest.content !== undefined) {
        fail(`${entry.id} metadata-only product leaks data rows or lacks its blocker`);
      }
      if (entry.viewCount !== 0 || entry.recordCount !== null) fail(`${entry.id} metadata-only catalog counts are invalid`);
      result.metadataOnlyProducts += 1;
    } else if (manifest.productType === 'generic-frequency-dataset') {
      const genericResult = await verifyGenericProduct({ manifest, productDirectory, staticRoot: resolvedStaticRoot });
      if (entry.viewCount !== genericResult.viewCount || entry.recordCount !== genericResult.records) {
        fail(`${entry.id} generic catalog counts do not match its content`);
      }
      result.chunkedViews += genericResult.chunkedViews;
      result.chunks += genericResult.chunks;
      result.records += genericResult.records;
    } else if (manifest.productType === 'chunked-wordform-list' || manifest.productType === 'chunked-comparison') {
      const chunkedResult = await verifyChunkedProduct({ manifest, productDirectory });
      if (entry.viewCount !== chunkedResult.viewCount || entry.recordCount !== null) {
        fail(`${entry.id} chunked catalog counts are invalid`);
      }
      result.chunkedViews += chunkedResult.chunkedViews;
      result.chunks += chunkedResult.chunks;
      result.records += chunkedResult.records;
    } else {
      fail(`${entry.id} has an unknown published product type`);
    }
    result.products += 1;
  }
  return result;
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help' || option === '-h') return { help: true };
    if (!['--output', '--static-root'].includes(option)) fail(`unknown option: ${option}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`option ${option} requires a value`);
    options[option === '--output' ? 'outputRoot' : 'staticRoot'] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return 'Usage: npm run products:verify -- [--output <static-data-products-dir>] [--static-root <static-dir>]';
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log(usage());
    else console.log(JSON.stringify(await verifyDataProducts(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
