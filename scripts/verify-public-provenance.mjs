import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;
const FORBIDDEN_KEYS = new Set([
  'repositoryUrl',
  'sourceRepository',
  'revision',
  'path',
  'archiveMember',
  'archiveDirectory'
]);
const FORBIDDEN_TEXT = ['source-repository-redacted', '/Volumes/'];

function fail(message) {
  throw new Error(`Public provenance verification failed: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafeArtifactId(value) {
  return typeof value === 'string' && ARTIFACT_ID_PATTERN.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && SHA_256_PATTERN.test(value);
}

function relativeName(filename) {
  return path.relative(repositoryRoot, filename).split(path.sep).join('/');
}

function validateArtifactDescriptor(value, description) {
  if (!isPlainObject(value) || !isSafeArtifactId(value.artifactId)
    || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || !isSha256(value.sha256)) {
    fail(`${description} must contain a safe artifactId, byte count, and SHA-256 checksum`);
  }
}

function validateSourceSnapshot(value, description) {
  validateArtifactDescriptor(value, description);
  if (value.encoding !== 'utf-8') fail(`${description} must declare UTF-8 encoding`);
}

function inspectJson(value, filename, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectJson(item, filename, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      fail(`${relativeName(filename)} ${location} discloses forbidden ${key} metadata`);
    }
  }
  if (Object.hasOwn(value, 'sourceSnapshot')) {
    validateSourceSnapshot(value.sourceSnapshot, `${relativeName(filename)} ${location}.sourceSnapshot`);
  }
  if (Object.hasOwn(value, 'sourceFile')) {
    validateArtifactDescriptor(value.sourceFile, `${relativeName(filename)} ${location}.sourceFile`);
  }
  if (Object.hasOwn(value, 'files') && Array.isArray(value.files)
    && (Object.hasOwn(value, 'sourceUrl') || Object.hasOwn(value, 'licence'))) {
    value.files.forEach((file, index) => validateArtifactDescriptor(file, `${relativeName(filename)} ${location}.files[${index}]`));
  }
  if (Object.hasOwn(value, 'input') && isPlainObject(value.input)) {
    const input = value.input;
    if (!isSafeArtifactId(input.artifactId) || !isPlainObject(input.snapshot)) {
      fail(`${relativeName(filename)} ${location}.input must use an artifactId and snapshot`);
    }
    validateArtifactDescriptor({ artifactId: input.artifactId, ...input.snapshot }, `${relativeName(filename)} ${location}.input`);
  }

  for (const [key, child] of Object.entries(value)) {
    inspectJson(child, filename, `${location}.${key}`);
  }
}

async function walkFiles(directory, predicate = () => true) {
  const files = [];
  const entries = (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(filename, predicate));
    else if (entry.isFile() && predicate(filename)) files.push(filename);
  }
  return files;
}

async function inspectJsonFile(filename) {
  let value;
  try {
    value = JSON.parse(await readFile(filename, 'utf8'));
  } catch (error) {
    fail(`${relativeName(filename)} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
  inspectJson(value, filename);
}

async function inspectTextFile(filename) {
  const text = await readFile(filename, 'utf8');
  for (const forbidden of FORBIDDEN_TEXT) {
    if (text.includes(forbidden)) fail(`${relativeName(filename)} contains forbidden public provenance text`);
  }
}

export async function verifyPublicProvenance({ root = repositoryRoot } = {}) {
  const resolvedRoot = path.resolve(root);
  const jsonDirectories = [
    path.join(resolvedRoot, 'data', 'contracts'),
    path.join(resolvedRoot, 'data', 'datasets'),
    path.join(resolvedRoot, 'data', 'policies'),
    path.join(resolvedRoot, 'data', 'products'),
    path.join(resolvedRoot, 'static', 'datasets')
  ];
  const jsonFiles = (await Promise.all(jsonDirectories.map((directory) => walkFiles(directory, (filename) => filename.endsWith('.json'))))).flat();
  const productJsonFiles = await walkFiles(
    path.join(resolvedRoot, 'static', 'data-products'),
    (filename) => filename.endsWith('.json')
  );
  const textTargets = [
    path.join(resolvedRoot, 'README.md'),
    ...await walkFiles(path.join(resolvedRoot, 'docs')),
    ...await walkFiles(path.join(resolvedRoot, '.github'))
  ];

  await Promise.all([...jsonFiles, ...productJsonFiles].map(inspectJsonFile));
  await Promise.all(textTargets.map(inspectTextFile));
  return { jsonFiles: jsonFiles.length + productJsonFiles.length, textFiles: textTargets.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await verifyPublicProvenance(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
