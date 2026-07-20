import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildDataset, parseDelimitedLine } from '../../scripts/prepare-dataset.mjs';

const temporaryDirectories = [];

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
      columns: { word: 'lemma', type: 'pos', frequency: 'count' }
    },
    provenance: { licence: 'Test licence', citation: 'Test citation' },
    ...overrides
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
    await writeFile(path.join(workspace, 'source.tsv'), '\uFEFFlemma\tpos\tcount\r\nir\tC\t10\r\nbūti\tV\t5\r\n');
    const outputPath = path.join(workspace, 'published', 'test.json');
    const catalogPath = path.join(workspace, 'published', 'catalog.json');

    const result = await buildDataset({
      config: baseConfig(),
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

    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
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
    await writeFile(path.join(workspace, 'source.csv'), 'ir,jng,5\r\nir,jng,3\r\nir,dll,2\r\n');
    const outputPath = path.join(workspace, 'dataset.json');

    const result = await buildDataset({
      config: baseConfig({
        entryKind: 'wordform',
        duplicatePolicy: 'aggregate-word-type',
        input: {
          path: 'source.csv',
          delimiter: ',',
          hasHeader: false,
          columns: { word: 0, type: 1, frequency: 2 }
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
  });

  it('fails with source-line diagnostics for invalid frequencies', async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace, 'source.tsv'), 'lemma\tpos\tcount\nlabas\tN\tnot-a-number\n');

    await expect(buildDataset({
      config: baseConfig(),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('invalid frequency at source line 2');
  });

  it('rejects a source path outside the configured source root', async () => {
    const workspace = await makeWorkspace();

    await expect(buildDataset({
      config: baseConfig({ input: { ...baseConfig().input, path: '../outside.tsv' } }),
      sourceRoot: workspace,
      outputPath: path.join(workspace, 'dataset.json')
    })).rejects.toThrow('must stay inside "sourceRoot"');
  });
});
