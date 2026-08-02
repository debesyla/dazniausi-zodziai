import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPolicyPath = path.join(repositoryRoot, 'data', 'policies', 'parliament-disclosure.json');
const PARLIAMENT_PRODUCT_ID = 'kapociute-dzikiene-2017-parliament-frequency-aggregates';

const REQUIRED_APPROVED_VIEWS = {
  'wordforms-by-frequency': ['word', 'count'],
  'lemmas-by-frequency': ['lemma', 'count']
};

const REQUIRED_FORBIDDEN_KEYS = [
  'rawText',
  'text',
  'document',
  'documentId',
  'sampleId',
  'sourceId',
  'sourceGroup',
  'speaker',
  'speakerId',
  'speakerName',
  'author',
  'authorId',
  'authorName',
  'person',
  'personId',
  'date',
  'speechDate',
  'calendarYear',
  'session',
  'sessionId',
  'period',
  'rank',
  'ranking'
];

const APPROVED_METADATA_KEYS = new Set([
  'schemaVersion',
  'id',
  'title',
  'productType',
  'publication',
  'status',
  'scope',
  'access',
  'reason',
  'provenance',
  'sourceUrl',
  'licence',
  'citation',
  'files',
  'role',
  'artifactId',
  'format',
  'bytes',
  'sha256',
  'rows',
  'columns',
  'hasHeader',
  'delivery',
  'mode',
  'constraints',
  'views',
  'description',
  'index',
  'sourceRole',
  'recordEncoding',
  'summary',
  'sourceRows',
  'recordCount',
  'numericTotals',
  'count',
  'nullCounts',
  'productId',
  'viewId',
  'fields',
  'label',
  'type',
  'sourceColumn',
  'unit',
  'ordering',
  'field',
  'direction',
  'sourceFile',
  'maxChunkBytes',
  'chunks',
  'file',
  'records',
  'chunk'
]);

function fail(message) {
  throw new Error(`Parliament disclosure verification failed: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(filename, description) {
  try {
    return JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    fail(`${description} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function normalizedKey(value) {
  return value.normalize('NFKC').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase('en-US');
}

function normalizedKeys(values) {
  return new Set(values.map(normalizedKey));
}

export function assertNoForbiddenKeys(value, forbiddenKeys, location = '$') {
  const forbidden = forbiddenKeys instanceof Set ? forbiddenKeys : normalizedKeys(forbiddenKeys);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, forbidden, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(normalizedKey(key))) {
      fail(`${location} contains forbidden identity or granularity key ${key}`);
    }
    assertNoForbiddenKeys(child, forbidden, `${location}.${key}`);
  }
}

export function assertOnlyApprovedMetadataKeys(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertOnlyApprovedMetadataKeys(item, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (!APPROVED_METADATA_KEYS.has(key)) {
      fail(`${location} contains unapproved metadata key ${key}`);
    }
    assertOnlyApprovedMetadataKeys(child, `${location}.${key}`);
  }
}

export function assertAggregateRecord(record, location = '$') {
  if (!Array.isArray(record) || record.length !== 2
    || typeof record[0] !== 'string' || !/^\p{L}{1,64}$/u.test(record[0])
    || !Number.isSafeInteger(record[1]) || record[1] < 1) {
    fail(`${location} must be exactly [1-64 Unicode letters, positive integer count]`);
  }
}

function validatePolicy(policy) {
  if (!isPlainObject(policy) || policy.schemaVersion !== 1
    || policy.productId !== PARLIAMENT_PRODUCT_ID || policy.status !== 'aggregate-only'
    || policy.approvedGranularity !== 'corpus' || !isPlainObject(policy.approvedViews)
    || policy.tokenPolicy?.kind !== 'unicode-letter-sequence' || policy.tokenPolicy.maxCodePoints !== 64
    || !Array.isArray(policy.forbiddenObjectKeys)) {
    fail('policy must declare one aggregate-only corpus product with approved views and forbidden keys');
  }

  const approvedViews = Object.entries(policy.approvedViews);
  const requiredViews = Object.entries(REQUIRED_APPROVED_VIEWS);
  if (!sameValues(approvedViews.map(([viewId]) => viewId), requiredViews.map(([viewId]) => viewId))) {
    fail('policy must approve exactly the wordform and lemma aggregate views');
  }
  for (const [viewId, view] of approvedViews) {
    if (!isPlainObject(view) || !Array.isArray(view.recordFields)
      || !sameValues(view.recordFields, REQUIRED_APPROVED_VIEWS[viewId])) {
      fail(`policy view ${viewId} must declare its approved two record fields`);
    }
  }

  const forbidden = normalizedKeys(policy.forbiddenObjectKeys);
  for (const required of REQUIRED_FORBIDDEN_KEYS) {
    if (!forbidden.has(normalizedKey(required))) {
      fail(`policy does not quarantine required key ${required}`);
    }
  }
  if (policy.blockedExpansions?.temporal?.status !== 'blocked'
    || policy.blockedExpansions.temporal.minimumCellPolicy?.status !== 'pending-disclosure-review'
    || policy.blockedExpansions.temporal.minimumCellPolicy?.threshold !== null) {
    fail('temporal policy must remain blocked with no invented minimum-cell threshold');
  }
  if (policy.blockedExpansions?.person?.status !== 'prohibited') {
    fail('person-level expansion must remain prohibited');
  }
  return forbidden;
}

function sameValues(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function sameMembers(actual, expected) {
  return actual.length === expected.length && expected.every((value) => actual.includes(value));
}

function safeChunkPath(value) {
  return typeof value === 'string' && /^chunks\/\d{6}\.json$/.test(value);
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(filename));
    else if (entry.isFile()) files.push(filename);
    else fail(`${path.relative(repositoryRoot, filename)} is not a regular public product file`);
  }
  return files;
}

export async function verifyParliamentDisclosure({ root = repositoryRoot, policyPath = null } = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedPolicyPath = policyPath ? path.resolve(policyPath) : path.join(resolvedRoot, path.relative(repositoryRoot, defaultPolicyPath));
  const policy = await readJson(resolvedPolicyPath, 'Parliament disclosure policy');
  const forbiddenKeys = validatePolicy(policy);
  const productBase = path.join(resolvedRoot, 'static', 'data-products');
  const productRoot = path.resolve(productBase, policy.productId);
  if (path.dirname(productRoot) !== productBase) fail('policy product ID resolves outside the public product directory');
  const manifestPath = path.join(productRoot, 'manifest.json');
  const manifest = await readJson(manifestPath, 'Parliament product manifest');
  assertNoForbiddenKeys(manifest, forbiddenKeys, 'manifest');
  assertOnlyApprovedMetadataKeys(manifest, 'manifest');

  if (manifest.id !== policy.productId || manifest.productType !== 'chunked-frequency-list'
    || manifest.publication?.status !== 'published') {
    fail('manifest does not describe the approved published frequency product');
  }

  const approvedViewEntries = Object.entries(policy.approvedViews);
  const approvedViewIds = approvedViewEntries.map(([viewId]) => viewId);
  const manifestViewIds = Array.isArray(manifest.views) ? manifest.views.map((view) => view.id) : [];
  if (!sameValues(manifestViewIds, approvedViewIds)) {
    fail(`manifest views must remain exactly ${approvedViewIds.join(', ')}`);
  }
  for (const view of manifest.views) {
    if (view.index !== `views/${view.id}/index.json` || view.recordEncoding !== 'array') {
      fail(`manifest view ${view.id} does not point to its approved array-encoded index`);
    }
  }

  const expectedFiles = new Set([manifestPath]);
  let chunks = 0;
  let records = 0;
  for (const [viewId, viewPolicy] of approvedViewEntries) {
    const indexPath = path.join(productRoot, 'views', viewId, 'index.json');
    const index = await readJson(indexPath, `Parliament ${viewId} index`);
    expectedFiles.add(indexPath);
    assertNoForbiddenKeys(index, forbiddenKeys, `views.${viewId}.index`);
    assertOnlyApprovedMetadataKeys(index, `views.${viewId}.index`);

    const fieldIds = Array.isArray(index.fields) ? index.fields.map((field) => field.id) : [];
    if (index.productId !== policy.productId || index.viewId !== viewId || index.recordEncoding !== 'array'
      || !sameValues(fieldIds, viewPolicy.recordFields)
      || index.ordering?.field !== 'count' || index.ordering?.direction !== 'descending'
      || !Array.isArray(index.chunks)) {
      fail(`${viewId} index is not the approved two-field corpus aggregate`);
    }

    let viewRecords = 0;
    for (const [chunkIndex, chunkDescriptor] of index.chunks.entries()) {
      if (!isPlainObject(chunkDescriptor) || !safeChunkPath(chunkDescriptor.file)
        || !Number.isSafeInteger(chunkDescriptor.records) || chunkDescriptor.records < 1) {
        fail(`${viewId} chunk ${chunkIndex} has an unsafe path`);
      }
      const chunkPath = path.join(productRoot, 'views', viewId, chunkDescriptor.file);
      const chunk = await readJson(chunkPath, `Parliament ${viewId} chunk ${chunkIndex}`);
      expectedFiles.add(chunkPath);
      assertNoForbiddenKeys(chunk, forbiddenKeys, `views.${viewId}.chunks[${chunkIndex}]`);
      assertOnlyApprovedMetadataKeys(chunk, `views.${viewId}.chunks[${chunkIndex}]`);

      const chunkKeys = Object.keys(chunk);
      if (!sameMembers(chunkKeys, ['schemaVersion', 'productId', 'viewId', 'chunk', 'records'])
        || chunk.schemaVersion !== 1 || chunk.productId !== policy.productId
        || chunk.viewId !== viewId || chunk.chunk !== chunkIndex || !Array.isArray(chunk.records)
        || chunk.records.length !== chunkDescriptor.records) {
        fail(`${viewId} chunk ${chunkIndex} has unexpected metadata or record count`);
      }
      chunk.records.forEach((record, recordIndex) => {
        assertAggregateRecord(record, `views.${viewId}.chunks[${chunkIndex}].records[${recordIndex}]`);
      });
      viewRecords += chunk.records.length;
      chunks += 1;
    }
    if (viewRecords !== index.summary?.recordCount) {
      fail(`${viewId} chunks contain ${viewRecords} records; index declares ${index.summary?.recordCount}`);
    }
    records += viewRecords;
  }

  const actualFiles = await listFiles(productRoot);
  const unapprovedFiles = actualFiles.filter((filename) => !expectedFiles.has(filename));
  if (unapprovedFiles.length > 0 || actualFiles.length !== expectedFiles.size) {
    fail(`product contains unapproved files: ${unapprovedFiles.map((filename) => path.relative(productRoot, filename)).join(', ')}`);
  }

  return { productId: policy.productId, views: approvedViewEntries.length, chunks, records };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await verifyParliamentDisclosure(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
