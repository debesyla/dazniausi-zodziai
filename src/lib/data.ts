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

export interface DatasetProvenance {
  licence?: string;
  citation?: string;
  sourceUrl?: string;
  partOfSpeech?: PartOfSpeechScheme;
}

export interface Dataset {
  schemaVersion: number;
  id: string;
  title: string;
  author: string;
  year: number;
  entryKind: 'lemma' | 'wordform';
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

function isEntryKind(value: unknown): value is Dataset['entryKind'] {
  return value === 'lemma' || value === 'wordform';
}

function isSafeDatasetFile(value: unknown): value is string {
  return isNonEmptyString(value) && !value.startsWith('/') && !value.includes('://') && !value.split('/').includes('..');
}

function validateProvenance(value: unknown): DatasetProvenance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const provenance = value as DatasetProvenance;
  for (const field of ['licence', 'citation', 'sourceUrl'] as const) {
    if (provenance[field] !== undefined && !isNonEmptyString(provenance[field])) {
      return null;
    }
  }
  if (provenance.partOfSpeech !== undefined) {
    if (!isNonEmptyString(provenance.partOfSpeech.name) || !provenance.partOfSpeech.labels || typeof provenance.partOfSpeech.labels !== 'object' || Array.isArray(provenance.partOfSpeech.labels)) {
      return null;
    }
    if (Object.values(provenance.partOfSpeech.labels).some((label) => !isNonEmptyString(label))) {
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
  if (!validateProvenance(dataset.provenance)) {
    throw new Error('Invalid dataset: missing or invalid "provenance" field');
  }
  if (!dataset.summary || !isNonNegativeInteger(dataset.summary.sourceRows) || !isNonNegativeInteger(dataset.summary.entryCount) || !isNonNegativeInteger(dataset.summary.totalFrequency) || !isNonNegativeInteger(dataset.summary.duplicateEntries)) {
    throw new Error('Invalid dataset: missing or invalid "summary" field');
  }
  if (!Array.isArray(dataset.words)) {
    throw new Error('Invalid dataset: "words" must be an array');
  }
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
  }
  return dataset as Dataset;
}

export function validateCatalog(data: unknown): DatasetCatalog {
  const catalog = data as Partial<DatasetCatalog>;
  if (!isNonNegativeInteger(catalog.schemaVersion) || !Array.isArray(catalog.datasets)) {
    throw new Error('Invalid dataset catalog');
  }
  for (const dataset of catalog.datasets) {
    if (!isNonEmptyString(dataset.id) || !isNonEmptyString(dataset.title) || !isNonEmptyString(dataset.author) || !isPositiveInteger(dataset.year) || !isEntryKind(dataset.entryKind) || !isSafeDatasetFile(dataset.file) || !isNonNegativeInteger(dataset.records) || !isNonNegativeInteger(dataset.totalFrequency) || typeof dataset.hasPartOfSpeech !== 'boolean' || !isNullableString(dataset.licence) || !isNullableString(dataset.citation)) {
      throw new Error('Invalid dataset catalog entry');
    }
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
  if (!isSafeDatasetFile(file)) {
    throw new Error('Invalid dataset file path');
  }
  return validateDataset(await fetchJson(`${dataRoot}${file}`));
}
