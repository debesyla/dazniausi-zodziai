import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const ARTIFACT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(`Source artifact resolution failed: ${message}`);
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isArtifactId(value) {
  return typeof value === 'string' && ARTIFACT_ID_PATTERN.test(value);
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSha256(value) {
  return typeof value === 'string' && SHA_256_PATTERN.test(value);
}

export function validateSourceArtifactDescriptor(value, description = 'source artifact') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${description} must be an object`);
  }
  if (!isArtifactId(value.artifactId)) {
    fail(`${description}.artifactId must use lowercase letters, numbers, and hyphens`);
  }
  if (!isNonNegativeSafeInteger(value.bytes)) {
    fail(`${description}.bytes must be a non-negative safe integer`);
  }
  if (!isSha256(value.sha256)) {
    fail(`${description}.sha256 must be a lowercase SHA-256 checksum`);
  }
  return value;
}

async function collectRegularFiles(directory, filesByBytes) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.name !== '.git')
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      await collectRegularFiles(candidate, filesByBytes);
      continue;
    }
    if (!entry.isFile()) continue;
    const stats = await lstat(candidate);
    if (!stats.isFile() || stats.isSymbolicLink()) continue;
    const matchingSize = filesByBytes.get(stats.size) ?? [];
    matchingSize.push(candidate);
    filesByBytes.set(stats.size, matchingSize);
  }
}

async function sha256(filename) {
  return createHash('sha256').update(await readFile(filename)).digest('hex');
}

/**
 * Finds reviewed artifacts by their public content identity, never by a
 * repository-relative path. Symbolic links are deliberately ignored.
 */
export async function createSourceArtifactResolver(sourceRoot) {
  if (typeof sourceRoot !== 'string' || sourceRoot.length === 0) {
    fail('a source root directory is required');
  }
  const root = await realpath(sourceRoot);
  const rootStats = await lstat(root);
  if (!rootStats.isDirectory()) fail('the source root must resolve to a directory');

  const filesByBytes = new Map();
  await collectRegularFiles(root, filesByBytes);
  const resolvedArtifacts = new Map();

  return {
    async resolve(descriptor) {
      const artifact = validateSourceArtifactDescriptor(descriptor);
      const cacheKey = `${artifact.artifactId}\u0000${artifact.bytes}\u0000${artifact.sha256}`;
      const cached = resolvedArtifacts.get(cacheKey);
      if (cached) return cached;

      const candidates = filesByBytes.get(artifact.bytes) ?? [];
      const matches = [];
      for (const candidate of candidates) {
        const resolved = await realpath(candidate);
        if (!isPathInside(root, resolved)) continue;
        if (await sha256(resolved) === artifact.sha256) matches.push(resolved);
      }

      if (matches.length !== 1) {
        fail(`artifact "${artifact.artifactId}" must resolve to exactly one verified regular file`);
      }
      resolvedArtifacts.set(cacheKey, matches[0]);
      return matches[0];
    }
  };
}
