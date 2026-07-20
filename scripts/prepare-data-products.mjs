import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
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
  if (!Number.isInteger(field.sourceColumn) || field.sourceColumn < 0) {
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
    if (ids.has(field.id) || sourceColumns.has(field.sourceColumn)) {
      fail(`${description}.fields must use unique ids and source columns`);
    }
    ids.add(field.id);
    sourceColumns.add(field.sourceColumn);
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
      || !['chunked-wordform-list', 'chunked-comparison', 'metadata-only'].includes(product.productType)) {
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
    const sourceRoles = new Set();
    for (const [viewIndex, view] of product.views.entries()) {
      validateView(view, `${description}.views[${viewIndex}]`);
      if (viewIds.has(view.id) || sourceRoles.has(view.sourceRole)) {
        fail(`${description}.views must use unique ids and source roles`);
      }
      viewIds.add(view.id);
      sourceRoles.add(view.sourceRole);
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
    ...(file.columns === undefined ? {} : { columns: file.columns })
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

function parseFieldValue(field, value, sourcePath, lineNumber) {
  if (!NUMERIC_FIELD_TYPES.has(field.type)) {
    if (!normalizeString(value)) fail(`${sourcePath} line ${lineNumber} has an empty ${field.id} value`);
    return value;
  }
  if (value === '' && field.nullable === true) return null;
  if (!/^\d+$/.test(value)) fail(`${sourcePath} line ${lineNumber} has an invalid ${field.id} value: ${JSON.stringify(value)}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    fail(`${sourcePath} line ${lineNumber} has an unsafe ${field.id} value`);
  }
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
  for await (const line of lines) {
    sourceRows += 1;
    const values = line.split(delimiter);
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
  for (const view of contractProduct.views) {
    const sourceFile = filesByRole.get(view.sourceRole);
    if (!sourceFile) fail(`${contract.id} has no source file with role ${view.sourceRole}`);
    views.push(await buildChunkedView({ productId: contract.id, productDirectory, view, sourceFile, sourceRoot }));
  }
  if (views.length !== contract.source.files.length) {
    fail(`${contract.id} must publish exactly one view for every reviewed machine-readable source file`);
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
