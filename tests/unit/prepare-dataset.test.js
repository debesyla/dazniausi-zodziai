import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDataset } from '../../src/lib/data';
import { buildDataset, parseDelimitedLine } from '../../scripts/prepare-dataset.mjs';

const temporaryDirectories = [];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function makeWorkspace() {
  const directory = await mkdtemp(path.join(tmpdir(), 'dazniausi-zodziai-'));
  temporaryDirectories.push(directory);
  return directory;
}

function baseConfig(overrides = {}) {
  return {
    id: 'test-dataset',
    title: 'Test dataset',
    author: 'Test author',
    year: 2024,
    entryKind: 'lemma',
    duplicatePolicy: 'keep',
    input: {
      path: 'source.tsv',
      delimiter: '\t',
      hasHeader: true,
      encoding: 'utf-8',
      snapshot: {
        repositoryUrl: 'https://example.test/datasets',
        revision: 'test-fixture',
        sha256: sha256('')
      },
      columns: { word: 'lemma', type: 'pos', frequency: 'count' }
    },
    provenance: {
      licence: 'Test licence',
      citation: 'Test citation',
      sourceUrl: 'https://example.test/source',
      partOfSpeech: {
        name: 'Test POS',
        labels: { C: 'Conjunction', V: 'Verb' }
      }
    },
    validation: {
      summary: { sourceRows: 2, entryCount: 2, totalFrequency: 15, duplicateEntries: 0 },
      samples: [
        { word: 'ir', type: 'C', frequency: 10 },
        { word: 'būti', type: 'V', frequency: 5 }
      ]
    },
    ...overrides
  };
}

function sourceConfig(source, overrides = {}) {
  const config = baseConfig();
  return {
    ...config,
    ...overrides,
    input: {
      ...config.input,
      ...overrides.input,
      snapshot: {
        ...config.input.snapshot,
        sha256: sha256(source),
        ...overrides.input?.snapshot
      }
    },
    provenance: {
      ...config.provenance,
      ...overrides.provenance
    },
    validation: {
      ...config.validation,
      ...overrides.validation
    }
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('parseDelimitedLine', () => {
  it('handles quoted delimiters and escaped quotes', () => {
    expect(parseDelimitedLine('"a,b",c,"d""e"', ',')).toEqual(['a,b', 'c', 'd"e']);
  });

  it('rejects an unclosed quoted field', () => {
    expect(() => parseDelimitedLine('"a,b', ',')).toThrow('unclosed quoted field');
  });
});

describe('buildDataset', () => {
  it('normalizes BOM and CRLF input and writes a catalog record', async () => {
    const workspace = await makeWorkspace();
    const source = '\uFEFFlemma\tpos\tcount\r\nir\tC\t10\r\nbūti\tV\t5\r\n';
    await writeFile(path.join(workspace, 'source.tsv'), source);
    const outputPath = path.join(workspace, 'published', 'test.json');
    const catalogPath = path.join(workspace, 'published', 'catalog.json');

    const result = await buildDataset({
      config: sourceConfig(source),
      sourceRoot: workspace,
      outputPath,
      catalogPath
    });

    expect(result.dataset.summary).toEqual({
      sourceRows: 2,
      entryCount: 2,
      totalFrequency: 15,
      duplicateEntries: 0
    });
    expect(result.dataset.words).toEqual([
      { word: 'ir', type: 'C', frequency: 10 },
      { word: 'būti', type: 'V', frequency: 5 }
    ]);
    expect(result.dataset.provenance.sourceSnapshot).toEqual({
      repositoryUrl: 'https://example.test/datasets',
      revision: 'test-fixture',
      path: 'source.tsv',
      encoding: 'utf-8',
      sha256: sha256(source)
    });

    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    expect(catalog.defaultDatasetId).toBe('test-dataset');
    expect(catalog.datasets[0]).toMatchObject({
      id: 'test-dataset',
      file: 'test.json',
      records: 2,
      totalFrequency: 15,
      hasPartOfSpeech: true
    });
  });

  it('aggregates duplicate word and POS entries only when configured', async () => {
    const workspace = await makeWorkspace();
    const source = 'ir,jng,5\r\nir,jng,3\r\nir,dll,2\r\n';
    await writeFile(path.join(workspace, 'source.csv'), source);
    const outputPath = path.join(workspace, 'dataset.json');

    const result = await buildDataset({
      config: sourceConfig(source, {
        entryKind: 'wordform',
        duplicatePolicy: 'aggregate-word-type',
        input: {
          path: 'source.csv',
          delimiter: ',',
          hasHeader: false,
          columns: { word: 0, type: 1, frequency: 2 }
        },
        provenance: {
          partOfSpeech: {
            name: 'Test POS',
            labels: { jng: 'Conjunction', dll: 'Particle' }
          }
        },
        validation: {
          summary: { sourceRows: 3, entryCount: 2, totalFrequency: 10, duplicateEntries: 1 },
          samples: [
            { word: 'ir', type: 'jng', frequency: 8 },
            { word: 'ir', type: 'dll', frequency: 2 }
          ]
        }
      }),
      sourceRoot: workspace,
      outputPath
    });

    expect(result.dataset.summary).toEqual({
      sourceRows: 3,
      entryCount: 2,
      totalFrequency: 10,
      duplicateEntries: 1
    });
    expect(result.dataset.words).toEqual([
      { word: 'ir', type: 'jng', frequency: 8 },
      { word: 'ir', type: 'dll', frequency: 2 }
    ]);
    expect(validateDataset(result.dataset)).toEqual(result.dataset);
  });

  it('preserves the catalog default when a new title sorts before it', async () => {
    const workspace = await makeWorkspace();
    const source = 'lemma\tpos\tcount\nir\tC\t10\nbūti\tV\t5\n';
    await writeFile(path.join(workspace, 'source.tsv'), source);
    const catalogPath = path.join(workspace, 'catalog.json');
    await writeFile(catalogPath, `${JSON.stringify({
      schemaVersion: 1,
      defaultDatasetId: 'existing-dataset',
      datasets: [{
        id: 'existing-dataset', title: 'Žinoma kolekcija', author: 'Existing author', year: 2020,
        entryKind: 'lemma', file: 'existing.json', records: 1, totalFrequency: 1,
        hasPartOfSpeech: false, licence: 'CC BY 4.0', citation: 'Existing citation'
      }]
    })}\n`);

    await buildDataset({
      config: sourceConfig(source),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'test.json'),
      catalogPath
    });

    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    expect(catalog.datasets[0].id).toBe('test-dataset');
    expect(catalog.defaultDatasetId).toBe('existing-dataset');
  });

  it('fails with source-line diagnostics for invalid frequencies', async () => {
    const workspace = await makeWorkspace();
    const source = 'lemma\tpos\tcount\nlabas\tN\tnot-a-number\n';
    await writeFile(path.join(workspace, 'source.tsv'), source);

    await expect(buildDataset({
      config: sourceConfig(source),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('invalid frequency at source line 2');
  });

  it('fails before parsing when the source checksum differs from its reviewed snapshot', async () => {
    const workspace = await makeWorkspace();
    const source = 'lemma\tpos\tcount\nir\tC\t10\nbūti\tV\t5\n';
    await writeFile(path.join(workspace, 'source.tsv'), source);

    await expect(buildDataset({
      config: sourceConfig(source, { input: { snapshot: { sha256: '0'.repeat(64) } } }),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('source checksum mismatch');
  });

  it('fails when reviewed summary totals expose an incorrect duplicate policy', async () => {
    const workspace = await makeWorkspace();
    const source = 'ir,jng,5\nir,jng,3\nir,dll,2\n';
    await writeFile(path.join(workspace, 'source.csv'), source);

    await expect(buildDataset({
      config: sourceConfig(source, {
        input: {
          path: 'source.csv',
          delimiter: ',',
          hasHeader: false,
          columns: { word: 0, type: 1, frequency: 2 }
        },
        provenance: {
          partOfSpeech: {
            name: 'Test POS',
            labels: { jng: 'Conjunction', dll: 'Particle' }
          }
        },
        validation: {
          summary: { sourceRows: 3, entryCount: 2, totalFrequency: 10, duplicateEntries: 1 },
          samples: [
            { word: 'ir', type: 'jng', frequency: 8 },
            { word: 'ir', type: 'dll', frequency: 2 }
          ]
        }
      }),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('summary mismatch for "entryCount"');
  });

  it('rejects source part-of-speech codes that are not mapped in provenance', async () => {
    const workspace = await makeWorkspace();
    const source = 'lemma\tpos\tcount\nlabas\tN\t10\n';
    await writeFile(path.join(workspace, 'source.tsv'), source);

    await expect(buildDataset({
      config: sourceConfig(source, {
        validation: {
          summary: { sourceRows: 1, entryCount: 1, totalFrequency: 10, duplicateEntries: 0 },
          samples: [{ word: 'labas', type: 'N', frequency: 10 }]
        }
      }),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('part-of-speech labels do not cover source code(s): N');
  });

  it('rejects source path traversal before reading the source root', async () => {
    const workspace = await makeWorkspace();

    await expect(buildDataset({
      config: sourceConfig('', { input: { path: '../outside.tsv' } }),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('must be a safe relative path');
  });

  it('rejects a symbolic link that resolves outside the configured source root', async () => {
    const workspace = await makeWorkspace();
    const outside = await makeWorkspace();
    const source = 'lemma\tpos\tcount\nir\tC\t10\nbūti\tV\t5\n';
    const outsidePath = path.join(outside, 'outside.tsv');
    await writeFile(outsidePath, source);
    await symlink(outsidePath, path.join(workspace, 'linked.tsv'));

    await expect(buildDataset({
      config: sourceConfig(source, { input: { path: 'linked.tsv' } }),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('after resolving symbolic links');
  });
});
