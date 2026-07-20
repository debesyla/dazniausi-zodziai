/** Types and loaders for the static, catalog-first dataset delivery model. */

export interface Word {
  word: string;
  type?: string;
  frequency: number;
}

export interface DatasetSummary {
  sourceRows: number;
  entryCount: number;
  totalFrequency: number;
  duplicateEntries: number;
}

export interface PartOfSpeechScheme {
  name: string;
  labels: Record<string, string>;
}

export interface SourceSnapshot {
  repositoryUrl: string;
  revision: string;
  path: string;
  encoding: 'utf-8';
  sha256: string;
}

export interface DatasetProvenance {
  licence: string;
  citation: string;
  sourceUrl: string;
  sourceSnapshot: SourceSnapshot;
  partOfSpeech?: PartOfSpeechScheme;
}

export interface Dataset {
  schemaVersion: number;
  id: string;
  title: string;
  author: string;
  year: number;
  entryKind: 'lemma' | 'wordform';
  duplicatePolicy: 'keep' | 'aggregate-word-type';
  provenance: DatasetProvenance;
  summary: DatasetSummary;
  words: Word[];
}

export interface DatasetCatalogEntry {
  id: string;
  title: string;
  author: string;
  year: number;
  entryKind: 'lemma' | 'wordform';
  file: string;
  records: number;
  totalFrequency: number;
  hasPartOfSpeech: boolean;
  licence: string | null;
  citation: string | null;
}

export interface DatasetCatalog {
  schemaVersion: number;
  defaultDatasetId?: string;
  datasets: DatasetCatalogEntry[];
}

const dataRoot = `${import.meta.env.BASE_URL}datasets/`;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value);
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isEntryKind(value: unknown): value is Dataset['entryKind'] {
  return value === 'lemma' || value === 'wordform';
}

function isDuplicatePolicy(value: unknown): value is Dataset['duplicatePolicy'] {
  return value === 'keep' || value === 'aggregate-word-type';
}

function isSafeRelativePath(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.startsWith('/') || value.includes('://') || value.includes('\\') || value.includes('?') || value.includes('#')) {
    return false;
  }
  try {
    const decoded = decodeURIComponent(value);
    return !decoded.startsWith('/') && !decoded.includes('\\') && !decoded.split('/').includes('..');
  } catch {
    return false;
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validateProvenance(value: unknown): DatasetProvenance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const provenance = value as DatasetProvenance;
  if (!isNonEmptyString(provenance.licence) || !isNonEmptyString(provenance.citation) || !isHttpUrl(provenance.sourceUrl)) {
    return null;
  }
  const snapshot = provenance.sourceSnapshot;
  if (!snapshot || !isHttpUrl(snapshot.repositoryUrl) || !isNonEmptyString(snapshot.revision) || !isSafeRelativePath(snapshot.path) || snapshot.encoding !== 'utf-8' || !isSha256(snapshot.sha256)) {
    return null;
  }
  if (provenance.partOfSpeech !== undefined) {
    if (!isNonEmptyString(provenance.partOfSpeech.name) || !provenance.partOfSpeech.labels || typeof provenance.partOfSpeech.labels !== 'object' || Array.isArray(provenance.partOfSpeech.labels)) {
      return null;
    }
    if (Object.entries(provenance.partOfSpeech.labels).some(([code, label]) => !isNonEmptyString(code) || !isNonEmptyString(label))) {
      return null;
    }
  }
  return provenance;
}

export function validateDataset(data: unknown): Dataset {
  const dataset = data as Partial<Dataset>;
  if (!isNonNegativeInteger(dataset.schemaVersion)) {
    throw new Error('Invalid dataset: missing or invalid "schemaVersion" field');
  }
  if (!isNonEmptyString(dataset.id)) {
    throw new Error('Invalid dataset: missing or invalid "id" field');
  }
  if (!isNonEmptyString(dataset.title)) {
    throw new Error('Invalid dataset: missing or invalid "title" field');
  }
  if (!isNonEmptyString(dataset.author)) {
    throw new Error('Invalid dataset: missing or invalid "author" field');
  }
  if (!isPositiveInteger(dataset.year)) {
    throw new Error('Invalid dataset: missing or invalid "year" field');
  }
  if (!isEntryKind(dataset.entryKind)) {
    throw new Error('Invalid dataset: missing or invalid "entryKind" field');
  }
  const provenance = validateProvenance(dataset.provenance);
  if (!provenance) {
    throw new Error('Invalid dataset: missing or invalid "provenance" field');
  }
  if (!isDuplicatePolicy(dataset.duplicatePolicy)) {
    throw new Error('Invalid dataset: missing or invalid "duplicatePolicy" field');
  }
  if (!dataset.summary || !isNonNegativeInteger(dataset.summary.sourceRows) || !isNonNegativeInteger(dataset.summary.entryCount) || !isNonNegativeInteger(dataset.summary.totalFrequency) || !isNonNegativeInteger(dataset.summary.duplicateEntries)) {
    throw new Error('Invalid dataset: missing or invalid "summary" field');
  }
  if (!Array.isArray(dataset.words)) {
    throw new Error('Invalid dataset: "words" must be an array');
  }
  let totalFrequency = 0;
  const seenKeys = new Set<string>();
  const duplicateKeys = new Set<string>();
  const observedTypes = new Set<string>();
  for (const word of dataset.words) {
    if (!isNonEmptyString(word.word)) {
      throw new Error('Invalid word entry: missing or invalid "word" field');
    }
    if (!isPositiveInteger(word.frequency)) {
      throw new Error('Invalid word entry: missing or invalid "frequency" field');
    }
    if (word.type !== undefined && !isNonEmptyString(word.type)) {
      throw new Error('Invalid word entry: invalid "type" field');
    }
    if (word.type !== undefined) observedTypes.add(word.type);
    const key = `${word.word}\u0000${word.type ?? ''}`;
    if (seenKeys.has(key)) duplicateKeys.add(key);
    seenKeys.add(key);
    totalFrequency += word.frequency;
  }
  if (dataset.words.length !== dataset.summary.entryCount || totalFrequency !== dataset.summary.totalFrequency || dataset.summary.sourceRows < dataset.summary.entryCount) {
    throw new Error('Invalid dataset: summary does not match word entries');
  }
  if (dataset.duplicatePolicy === 'keep' && (dataset.summary.sourceRows !== dataset.summary.entryCount || duplicateKeys.size !== dataset.summary.duplicateEntries)) {
    throw new Error('Invalid dataset: duplicate summary does not match kept word entries');
  }
  if (dataset.duplicatePolicy === 'aggregate-word-type' && (duplicateKeys.size !== 0 || (dataset.summary.sourceRows === dataset.summary.entryCount && dataset.summary.duplicateEntries !== 0) || (dataset.summary.sourceRows > dataset.summary.entryCount && dataset.summary.duplicateEntries === 0))) {
    throw new Error('Invalid dataset: duplicate summary does not match aggregated word entries');
  }

  const labels = provenance.partOfSpeech?.labels;
  if (observedTypes.size > 0 && !labels) {
    throw new Error('Invalid dataset: typed word entries require part-of-speech labels');
  }
  if (observedTypes.size === 0 && labels) {
    throw new Error('Invalid dataset: part-of-speech labels require typed word entries');
  }
  if (labels) {
    const missingCodes = [...observedTypes].filter((code) => labels[code] === undefined);
    const unusedCodes = Object.keys(labels).filter((code) => !observedTypes.has(code));
    if (missingCodes.length > 0 || unusedCodes.length > 0) {
      throw new Error('Invalid dataset: part-of-speech labels do not match word entries');
    }
  }
  return dataset as Dataset;
}

export function validateCatalog(data: unknown): DatasetCatalog {
  const catalog = data as Partial<DatasetCatalog>;
  if (!isNonNegativeInteger(catalog.schemaVersion) || !Array.isArray(catalog.datasets)) {
    throw new Error('Invalid dataset catalog');
  }
  for (const dataset of catalog.datasets) {
    if (!isNonEmptyString(dataset.id) || !isNonEmptyString(dataset.title) || !isNonEmptyString(dataset.author) || !isPositiveInteger(dataset.year) || !isEntryKind(dataset.entryKind) || !isSafeRelativePath(dataset.file) || !isNonNegativeInteger(dataset.records) || !isNonNegativeInteger(dataset.totalFrequency) || typeof dataset.hasPartOfSpeech !== 'boolean' || !isNullableString(dataset.licence) || !isNullableString(dataset.citation)) {
      throw new Error('Invalid dataset catalog entry');
    }
  }
  if (catalog.defaultDatasetId !== undefined && (!isNonEmptyString(catalog.defaultDatasetId) || !catalog.datasets.some((dataset) => dataset.id === catalog.defaultDatasetId))) {
    throw new Error('Invalid dataset catalog default dataset');
  }
  return catalog as DatasetCatalog;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** Loads the compact catalog without loading any word-list rows. */
export async function loadCatalog(): Promise<DatasetCatalog> {
  return validateCatalog(await fetchJson(`${dataRoot}catalog.json`));
}

/** Loads exactly one dataset after the user selects its catalog entry. */
export async function loadDataset(file: string): Promise<Dataset> {
  if (!isSafeRelativePath(file)) {
    throw new Error('Invalid dataset file path');
  }
  return validateDataset(await fetchJson(`${dataRoot}${file}`));
}
