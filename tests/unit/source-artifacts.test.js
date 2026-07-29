import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSourceArtifactResolver } from '../../scripts/source-artifacts.mjs';

const temporaryDirectories = [];

async function makeDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dazniausi-zodziai-artifact-'));
  temporaryDirectories.push(directory);
  return directory;
}

function descriptor(artifactId, source) {
  return {
    artifactId,
    bytes: Buffer.byteLength(source),
    sha256: createHash('sha256').update(source).digest('hex')
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('source artifact resolver', () => {
  it('resolves one reviewed regular file by its public content identity', async () => {
    const root = await makeDirectory();
    const source = 'word\tcount\nir\t1\n';
    const filename = path.join(root, 'nested', 'source.tsv');
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, source);

    const resolver = await createSourceArtifactResolver(root);
    await expect(resolver.resolve(descriptor('fixture-source', source))).resolves.toBe(await realpath(filename));
  });

  it('rejects an ambiguous content match', async () => {
    const root = await makeDirectory();
    const source = 'word\tcount\nir\t1\n';
    await Promise.all([
      writeFile(path.join(root, 'first.tsv'), source),
      writeFile(path.join(root, 'second.tsv'), source)
    ]);

    const resolver = await createSourceArtifactResolver(root);
    await expect(resolver.resolve(descriptor('fixture-source', source))).rejects.toThrow('must resolve to exactly one verified regular file');
  });

  it('ignores symbolic links outside the reviewed source root', async () => {
    const root = await makeDirectory();
    const outside = await makeDirectory();
    const source = 'word\tcount\nir\t1\n';
    const outsideFile = path.join(outside, 'source.tsv');
    await writeFile(outsideFile, source);
    await symlink(outsideFile, path.join(root, 'linked.tsv'));

    const resolver = await createSourceArtifactResolver(root);
    await expect(resolver.resolve(descriptor('fixture-source', source))).rejects.toThrow('must resolve to exactly one verified regular file');
  });
});
