import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRY_KINDS = new Set(['lemma', 'wordform']);
const DUPLICATE_POLICIES = new Set(['keep', 'aggregate-word-type']);

function fail(message) {
  throw new Error(`Dataset preparation failed: ${message}`);
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateConfig(config) {
  for (const field of ['id', 'title', 'author', 'year', 'entryKind', 'input', 'duplicatePolicy']) {
    if (config?.[field] === undefined || config?.[field] === null || config?.[field] === '') {
      fail(`missing required config field "${field}"`);
    }
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(config.id)) {
    fail('"id" must use lowercase letters, numbers, and hyphens');
  }
  if (!Number.isInteger(config.year) || config.year < 1) {
    fail('"year" must be a positive integer');
  }
  if (!ENTRY_KINDS.has(config.entryKind)) {
    fail(`"entryKind" must be one of: ${[...ENTRY_KINDS].join(', ')}`);
  }
  if (!DUPLICATE_POLICIES.has(config.duplicatePolicy)) {
    fail(`"duplicatePolicy" must be one of: ${[...DUPLICATE_POLICIES].join(', ')}`);
  }

  const { input } = config;
  if (!input || typeof input !== 'object') {
    fail('"input" must be an object');
  }
  if (!normalizeString(input.path)) {
    fail('"input.path" is required');
  }
  if (!['\t', ','].includes(input.delimiter)) {
    fail('"input.delimiter" must be "\\t" or ","');
  }
  if (typeof input.hasHeader !== 'boolean') {
    fail('"input.hasHeader" must be true or false');
  }
  if (!input.columns || typeof input.columns !== 'object') {
    fail('"input.columns" is required');
  }
  for (const field of ['word', 'frequency']) {
    if (input.columns[field] === undefined) {
      fail(`"input.columns.${field}" is required`);
    }
  }

  return config;
}

export function parseDelimitedLine(line, delimiter) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) {
    fail('found an unclosed quoted field');
  }

  values.push(value);
  return values;
}

function resolveColumnIndexes(columns, header) {
  const indexes = {};
  for (const [field, column] of Object.entries(columns)) {
    if (typeof column === 'number' && Number.isInteger(column) && column >= 0) {
      indexes[field] = column;
      continue;
    }
    if (typeof column === 'string' && header) {
      const index = header.indexOf(column);
      if (index >= 0) {
        indexes[field] = index;
        continue;
      }
      fail(`header does not contain column "${column}" for "${field}"`);
    }
    fail(`column "${field}" must be a zero-based number${header ? ' or an existing header name' : ''}`);
  }
  return indexes;
}

function parseFrequency(value, lineNumber) {
  const normalized = normalizeString(value);
  if (!/^\d+$/.test(normalized)) {
    fail(`invalid frequency at source line ${lineNumber}: "${value}"`);
  }
  const frequency = Number(normalized);
  if (!Number.isSafeInteger(frequency) || frequency < 1) {
    fail(`frequency at source line ${lineNumber} must be a positive safe integer`);
  }
  return frequency;
}

function aggregateWords(words, duplicatePolicy) {
  const duplicateKeys = new Set();
  const seenKeys = new Set();
  const keyFor = (word) => `${word.word}\u0000${word.type ?? ''}`;

  for (const word of words) {
    const key = keyFor(word);
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
  }

  if (duplicatePolicy === 'keep') {
    return { words, duplicateEntries: duplicateKeys.size };
  }

  const grouped = new Map();
  for (const word of words) {
    const key = keyFor(word);
    const existing = grouped.get(key);
    if (existing) {
      existing.frequency += word.frequency;
    } else {
      grouped.set(key, { ...word });
    }
  }
  return { words: [...grouped.values()], duplicateEntries: duplicateKeys.size };
}

function toCatalogEntry(dataset, outputPath, catalogPath) {
  return {
    id: dataset.id,
    title: dataset.title,
    author: dataset.author,
    year: dataset.year,
    entryKind: dataset.entryKind,
    file: path.relative(path.dirname(catalogPath), outputPath).split(path.sep).join('/'),
    records: dataset.summary.entryCount,
    totalFrequency: dataset.summary.totalFrequency,
    hasPartOfSpeech: dataset.words.some((word) => Boolean(word.type)),
    licence: dataset.provenance?.licence ?? null,
    citation: dataset.provenance?.citation ?? null
  };
}

async function updateCatalog(catalogPath, dataset, outputPath) {
  let catalog = { schemaVersion: 1, datasets: [] };
  try {
    catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (!Array.isArray(catalog.datasets)) {
    fail(`catalog at ${catalogPath} must contain a "datasets" array`);
  }

  const record = toCatalogEntry(dataset, outputPath, catalogPath);
  const remaining = catalog.datasets.filter((item) => item.id !== dataset.id);
  catalog = {
    schemaVersion: 1,
    datasets: [...remaining, record].sort((left, right) => left.title.localeCompare(right.title, 'lt'))
  };

  await mkdir(path.dirname(catalogPath), { recursive: true });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  return record;
}

export async function buildDataset({ config, sourceRoot, outputPath, catalogPath }) {
  const validConfig = validateConfig(config);
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const sourcePath = path.resolve(resolvedSourceRoot, validConfig.input.path);
  if (!isPathInside(resolvedSourceRoot, sourcePath)) {
    fail('"input.path" must stay inside "sourceRoot"');
  }

  const source = (await readFile(sourcePath, 'utf8')).replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/).filter((line) => line !== '');
  if (lines.length === 0) {
    fail('source file has no data rows');
  }

  const header = validConfig.input.hasHeader
    ? parseDelimitedLine(lines.shift(), validConfig.input.delimiter).map(normalizeString)
    : undefined;
  const indexes = resolveColumnIndexes(validConfig.input.columns, header);
  const words = lines.map((line, index) => {
    const lineNumber = index + (validConfig.input.hasHeader ? 2 : 1);
    const values = parseDelimitedLine(line, validConfig.input.delimiter);
    const word = normalizeString(values[indexes.word]);
    if (!word) {
      fail(`missing word at source line ${lineNumber}`);
    }

    const type = indexes.type === undefined ? undefined : normalizeString(values[indexes.type]) || undefined;
    return {
      word,
      ...(type ? { type } : {}),
      frequency: parseFrequency(values[indexes.frequency], lineNumber)
    };
  });

  const prepared = aggregateWords(words, validConfig.duplicatePolicy);
  const dataset = {
    schemaVersion: 1,
    id: validConfig.id,
    title: validConfig.title,
    author: validConfig.author,
    year: validConfig.year,
    entryKind: validConfig.entryKind,
    provenance: validConfig.provenance ?? {},
    summary: {
      sourceRows: words.length,
      entryCount: prepared.words.length,
      totalFrequency: prepared.words.reduce((total, word) => total + word.frequency, 0),
      duplicateEntries: prepared.duplicateEntries
    },
    words: prepared.words
  };

  const resolvedOutputPath = path.resolve(outputPath);
  await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');

  const catalogRecord = catalogPath
    ? await updateCatalog(path.resolve(catalogPath), dataset, resolvedOutputPath)
    : null;

  return { dataset, outputPath: resolvedOutputPath, catalogRecord };
}

export async function loadConfig(configPath) {
  try {
    return JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail(`config at ${configPath} is not valid JSON`);
    }
    throw error;
  }
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help' || option === '-h') return { help: true };
    if (!['--config', '--source-root', '--output', '--catalog'].includes(option)) {
      fail(`unknown option "${option}"`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`option "${option}" requires a value`);
    }
    options[option.slice(2)] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return `Usage: npm run data:build -- --config <dataset.json> --source-root <raw-data-dir> --output <dataset.json> [--catalog <catalog.json>]`;
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      for (const field of ['config', 'source-root', 'output']) {
        if (!options[field]) fail(`option "--${field}" is required\n${usage()}`);
      }
      const configPath = path.resolve(options.config);
      const result = await buildDataset({
        config: await loadConfig(configPath),
        sourceRoot: options['source-root'],
        outputPath: options.output,
        catalogPath: options.catalog
      });
      console.log(JSON.stringify({
        id: result.dataset.id,
        entries: result.dataset.summary.entryCount,
        totalFrequency: result.dataset.summary.totalFrequency,
        outputPath: result.outputPath
      }, null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
