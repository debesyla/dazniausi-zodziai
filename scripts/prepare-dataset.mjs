import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENTRY_KINDS = new Set(['lemma', 'wordform']);
const DUPLICATE_POLICIES = new Set(['keep', 'aggregate-word-type']);
const SUMMARY_FIELDS = ['sourceRows', 'entryCount', 'totalFrequency', 'duplicateEntries'];
const SHA_256_PATTERN = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(`Dataset preparation failed: ${message}`);
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function isSafeRelativeSourcePath(value) {
  return normalizeString(value).length > 0 && !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').includes('..');
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function validateSourceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    fail('"input.snapshot" is required');
  }
  if (!isHttpUrl(snapshot.repositoryUrl)) {
    fail('"input.snapshot.repositoryUrl" must be an HTTP(S) URL');
  }
  if (!normalizeString(snapshot.revision)) {
    fail('"input.snapshot.revision" is required');
  }
  if (typeof snapshot.sha256 !== 'string' || !SHA_256_PATTERN.test(snapshot.sha256)) {
    fail('"input.snapshot.sha256" must be a lowercase SHA-256 checksum');
  }
}

function validatePartOfSpeechScheme(scheme) {
  if (!scheme || typeof scheme !== 'object' || Array.isArray(scheme)) {
    fail('"provenance.partOfSpeech" is required when an input type column is configured');
  }
  if (!normalizeString(scheme.name)) {
    fail('"provenance.partOfSpeech.name" is required');
  }
  if (!scheme.labels || typeof scheme.labels !== 'object' || Array.isArray(scheme.labels) || Object.keys(scheme.labels).length === 0) {
    fail('"provenance.partOfSpeech.labels" must be a non-empty object');
  }
  for (const [code, label] of Object.entries(scheme.labels)) {
    if (!normalizeString(code) || !normalizeString(label)) {
      fail('"provenance.partOfSpeech.labels" must contain non-empty codes and labels');
    }
  }
}

function validateExpectedSummary(summary) {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    fail('"validation.summary" is required');
  }
  for (const field of SUMMARY_FIELDS) {
    if (!isNonNegativeSafeInteger(summary[field])) {
      fail(`"validation.summary.${field}" must be a non-negative safe integer`);
    }
  }
}

function validateSamples(samples, requiresType) {
  if (!Array.isArray(samples) || samples.length === 0) {
    fail('"validation.samples" must contain at least one representative sample');
  }
  for (const sample of samples) {
    if (!sample || typeof sample !== 'object' || Array.isArray(sample) || !normalizeString(sample.word) || !isPositiveSafeInteger(sample.frequency)) {
      fail('each "validation.samples" entry needs a non-empty word and positive frequency');
    }
    if (requiresType && !normalizeString(sample.type)) {
      fail('each "validation.samples" entry needs a non-empty type for a typed dataset');
    }
    if (!requiresType && sample.type !== undefined) {
      fail('"validation.samples.type" is only allowed for a typed dataset');
    }
  }
}

function validateConfig(config) {
  for (const field of ['id', 'title', 'author', 'year', 'entryKind', 'input', 'duplicatePolicy', 'provenance', 'validation']) {
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
  if (!isSafeRelativeSourcePath(input.path)) {
    fail('"input.path" must be a safe relative path');
  }
  if (input.encoding !== 'utf-8') {
    fail('"input.encoding" must be "utf-8"');
  }
  validateSourceSnapshot(input.snapshot);
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
  for (const field of Object.keys(input.columns)) {
    if (!['word', 'type', 'frequency'].includes(field)) {
      fail(`"input.columns.${field}" is not supported`);
    }
  }

  const { provenance } = config;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    fail('"provenance" must be an object');
  }
  for (const field of ['licence', 'citation', 'sourceUrl']) {
    if (!normalizeString(provenance[field])) {
      fail(`"provenance.${field}" is required`);
    }
  }
  if (!isHttpUrl(provenance.sourceUrl)) {
    fail('"provenance.sourceUrl" must be an HTTP(S) URL');
  }

  const hasTypeColumn = input.columns.type !== undefined;
  if (hasTypeColumn) {
    validatePartOfSpeechScheme(provenance.partOfSpeech);
  } else if (provenance.partOfSpeech !== undefined) {
    fail('"provenance.partOfSpeech" requires an input type column');
  }

  validateExpectedSummary(config.validation.summary);
  validateSamples(config.validation.samples, hasTypeColumn);

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

function validatePartOfSpeechLabels(words, scheme) {
  if (!scheme) return;

  const observedCodes = new Set(words.map((word) => word.type));
  const configuredCodes = new Set(Object.keys(scheme.labels));
  const missingCodes = [...observedCodes].filter((code) => !configuredCodes.has(code));
  if (missingCodes.length > 0) {
    fail(`part-of-speech labels do not cover source code(s): ${missingCodes.join(', ')}`);
  }
  const unusedCodes = [...configuredCodes].filter((code) => !observedCodes.has(code));
  if (unusedCodes.length > 0) {
    fail(`part-of-speech labels include unused source code(s): ${unusedCodes.join(', ')}`);
  }
}

function validateExpectedOutput(dataset, validation) {
  for (const field of SUMMARY_FIELDS) {
    if (dataset.summary[field] !== validation.summary[field]) {
      fail(`summary mismatch for "${field}": expected ${validation.summary[field]}, received ${dataset.summary[field]}`);
    }
  }

  for (const sample of validation.samples) {
    const matchingEntry = dataset.words.some((word) => word.word === sample.word
      && word.frequency === sample.frequency
      && word.type === sample.type);
    if (!matchingEntry) {
      const type = sample.type ? ` (${sample.type})` : '';
      fail(`representative sample "${sample.word}"${type} was not found with frequency ${sample.frequency}`);
    }
  }
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

  const previousDefaultDatasetId = typeof catalog.defaultDatasetId === 'string'
    ? catalog.defaultDatasetId
    : catalog.datasets[0]?.id;
  const record = toCatalogEntry(dataset, outputPath, catalogPath);
  const remaining = catalog.datasets.filter((item) => item.id !== dataset.id);
  const datasets = [...remaining, record].sort((left, right) => left.title.localeCompare(right.title, 'lt'));
  const defaultDatasetId = datasets.some((item) => item.id === previousDefaultDatasetId)
    ? previousDefaultDatasetId
    : datasets[0]?.id;
  catalog = {
    schemaVersion: 1,
    ...(defaultDatasetId ? { defaultDatasetId } : {}),
    datasets
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

  const [realSourceRoot, realSourcePath] = await Promise.all([realpath(resolvedSourceRoot), realpath(sourcePath)]);
  if (!isPathInside(realSourceRoot, realSourcePath)) {
    fail('"input.path" must stay inside "sourceRoot" after resolving symbolic links');
  }

  const sourceBytes = await readFile(realSourcePath);
  const sourceChecksum = createHash('sha256').update(sourceBytes).digest('hex');
  if (sourceChecksum !== validConfig.input.snapshot.sha256) {
    fail(`source checksum mismatch for "${validConfig.input.path}": expected ${validConfig.input.snapshot.sha256}, received ${sourceChecksum}`);
  }

  let source;
  try {
    source = new TextDecoder(validConfig.input.encoding, { fatal: true }).decode(sourceBytes).replace(/^\uFEFF/, '');
  } catch {
    fail(`source "${validConfig.input.path}" is not valid ${validConfig.input.encoding}`);
  }
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

    const type = indexes.type === undefined ? undefined : normalizeString(values[indexes.type]);
    if (indexes.type !== undefined && !type) {
      fail(`missing part-of-speech code at source line ${lineNumber}`);
    }
    return {
      word,
      ...(type ? { type } : {}),
      frequency: parseFrequency(values[indexes.frequency], lineNumber)
    };
  });

  const prepared = aggregateWords(words, validConfig.duplicatePolicy);
  validatePartOfSpeechLabels(prepared.words, validConfig.provenance.partOfSpeech);
  const dataset = {
    schemaVersion: 1,
    id: validConfig.id,
    title: validConfig.title,
    author: validConfig.author,
    year: validConfig.year,
    entryKind: validConfig.entryKind,
    duplicatePolicy: validConfig.duplicatePolicy,
    provenance: {
      ...validConfig.provenance,
      sourceSnapshot: {
        repositoryUrl: validConfig.input.snapshot.repositoryUrl,
        revision: validConfig.input.snapshot.revision,
        path: validConfig.input.path,
        encoding: validConfig.input.encoding,
        sha256: sourceChecksum
      }
    },
    summary: {
      sourceRows: words.length,
      entryCount: prepared.words.length,
      totalFrequency: prepared.words.reduce((total, word) => total + word.frequency, 0),
      duplicateEntries: prepared.duplicateEntries
    },
    words: prepared.words
  };

  validateExpectedOutput(dataset, validConfig.validation);

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
