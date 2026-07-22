/** Loader and validation for the small, manifest-led DML6/JCL coverage profile. */

export interface CoverageCategoryDefinition {
  code: number;
  label: string;
}

export interface DrilldownDescriptor {
  file: string;
  records: number;
  bytes: number;
  sha256: string;
}

export interface CoverageCategorySummary {
  coverageCode: number;
  typeCount: number;
  tokenCount: number;
  drilldown: DrilldownDescriptor;
}

export interface FrequencyBandSummary {
  id: string;
  label: string;
  minimum: number;
  maximum: number | null;
  typeCount: number;
  tokenCount: number;
  categories: CoverageCategorySummary[];
}

export interface Dml6CoverageProfile {
  schemaVersion: 1;
  productId: string;
  profileId: string;
  profileType: 'frequency-band-coverage';
  title: string;
  description: string;
  sourceView: {
    id: string;
    sourceRole: string;
    wordField: { id: string; label: string };
    frequencyField: { id: string; label: string; unit: string };
    coverageField: { id: string; label: string; values: Record<string, string> };
  };
  provenance: {
    sourceUrl: string;
    licence: string;
    citation: string;
    sourceFile: { path: string; rows: number; sha256: string };
  };
  delivery: {
    summaryMaxBytes: number;
  };
  drilldown: {
    limit: number;
    maxBytes: number;
    recordEncoding: 'array';
    fields: Array<{ id: string; label: string; type: string; unit?: string }>;
    ordering: { field: string; direction: 'descending'; tieBreak: 'word-ascending' };
  };
  summary: {
    sourceRows: number;
    totalTypeCount: number;
    totalTokenCount: number;
    bands: FrequencyBandSummary[];
  };
}

export interface Dml6CoverageDrilldown {
  schemaVersion: 1;
  productId: string;
  profileId: string;
  bandId: string;
  coverageCode: number;
  recordEncoding: 'array';
  fields: Dml6CoverageProfile['drilldown']['fields'];
  ordering: Dml6CoverageProfile['drilldown']['ordering'];
  records: Array<[string, number]>;
}

const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');
const profileDirectory = `${basePath}/data-products/dadurkevicius-dml6-vs-jcl-comparison/analysis/dml6-jcl-coverage-by-frequency-band/`;
const profileUrl = `${profileDirectory}manifest.json`;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isSafeFieldId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
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

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
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

function fail(message: string): never {
  throw new Error(`Netinkamas žodyno aprėpties profilis: ${message}`);
}

function coverageDefinitions(values: unknown): CoverageCategoryDefinition[] {
  if (!isObject(values)) fail('nėra aprėpties kategorijų');
  const definitions = Object.entries(values).map(([code, label]) => {
    const number = Number(code);
    if (!Number.isSafeInteger(number) || number < 0 || !isNonEmptyString(label)) fail('netinkama aprėpties kategorija');
    return { code: number, label };
  }).sort((left, right) => left.code - right.code);
  if (definitions.length === 0 || new Set(definitions.map((definition) => definition.code)).size !== definitions.length) {
    fail('pasikartojančios arba tuščios aprėpties kategorijos');
  }
  return definitions;
}

function validateDrilldownDescriptor(value: unknown): DrilldownDescriptor {
  if (!isObject(value) || !isSafeRelativePath(value.file) || !isSafeInteger(value.records)
    || !isPositiveInteger(value.bytes) || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    fail('netinkamas pavyzdžių failas');
  }
  return value as unknown as DrilldownDescriptor;
}

function validateBand(
  value: unknown,
  definitions: CoverageCategoryDefinition[],
  previousMaximum: number | null,
  drilldownLimit: number,
  drilldownMaxBytes: number
): FrequencyBandSummary {
  if (!isObject(value) || !isSafeId(value.id) || !isNonEmptyString(value.label) || !isPositiveInteger(value.minimum)
    || (value.maximum !== null && (!isPositiveInteger(value.maximum) || value.maximum < value.minimum))
    || previousMaximum === null || value.minimum !== previousMaximum + 1
    || !isSafeInteger(value.typeCount) || !isSafeInteger(value.tokenCount) || !Array.isArray(value.categories)
    || value.categories.length !== definitions.length) {
    fail('netinkamas dažnumo intervalas');
  }
  const categories: CoverageCategorySummary[] = [];
  const seenCodes = new Set<number>();
  let categoryTypes = 0;
  let categoryTokens = 0;
  for (const category of value.categories) {
    if (!isObject(category) || !isSafeInteger(category.coverageCode) || !definitions.some((definition) => definition.code === category.coverageCode)
      || seenCodes.has(category.coverageCode) || !isSafeInteger(category.typeCount) || !isSafeInteger(category.tokenCount)) {
      fail('netinkama intervalo aprėpties suvestinė');
    }
    const drilldown = validateDrilldownDescriptor(category.drilldown);
    if (drilldown.records > drilldownLimit || drilldown.bytes > drilldownMaxBytes) {
      fail('pavyzdžių failas viršija paskelbtą ribą');
    }
    categories.push({
      coverageCode: category.coverageCode,
      typeCount: category.typeCount,
      tokenCount: category.tokenCount,
      drilldown
    });
    seenCodes.add(category.coverageCode);
    categoryTypes += category.typeCount;
    categoryTokens += category.tokenCount;
  }
  if (categoryTypes !== value.typeCount || categoryTokens !== value.tokenCount) {
    fail('intervalo suvestinės sumos nesutampa');
  }
  return {
    id: value.id,
    label: value.label,
    minimum: value.minimum,
    maximum: value.maximum,
    typeCount: value.typeCount,
    tokenCount: value.tokenCount,
    categories
  };
}

export function validateDml6CoverageProfile(value: unknown): Dml6CoverageProfile {
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== 'dadurkevicius-dml6-vs-jcl-comparison'
    || value.profileId !== 'dml6-jcl-coverage-by-frequency-band' || value.profileType !== 'frequency-band-coverage'
    || !isNonEmptyString(value.title) || !isNonEmptyString(value.description) || !isObject(value.sourceView)
    || !isObject(value.provenance) || !isObject(value.delivery) || !isObject(value.drilldown) || !isObject(value.summary)) {
    fail('trūksta pagrindinių laukų');
  }
  const sourceView = value.sourceView;
  if (!isSafeId(sourceView.id) || !isSafeId(sourceView.sourceRole) || !isObject(sourceView.wordField)
    || !isSafeFieldId(sourceView.wordField.id) || !isNonEmptyString(sourceView.wordField.label)
    || !isObject(sourceView.frequencyField) || !isSafeFieldId(sourceView.frequencyField.id)
    || !isNonEmptyString(sourceView.frequencyField.label) || !isNonEmptyString(sourceView.frequencyField.unit)
    || !isObject(sourceView.coverageField) || !isSafeFieldId(sourceView.coverageField.id)
    || !isNonEmptyString(sourceView.coverageField.label)) {
    fail('netinkami šaltinio laukų aprašai');
  }
  const definitions = coverageDefinitions(sourceView.coverageField.values);
  const provenance = value.provenance;
  if (!isHttpUrl(provenance.sourceUrl) || !isNonEmptyString(provenance.licence) || !isNonEmptyString(provenance.citation)
    || !isObject(provenance.sourceFile) || !isSafeRelativePath(provenance.sourceFile.path)
    || !isPositiveInteger(provenance.sourceFile.rows) || typeof provenance.sourceFile.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(provenance.sourceFile.sha256)) {
    fail('netinkama kilmės informacija');
  }
  if (!isPositiveInteger(value.delivery.summaryMaxBytes)) {
    fail('netinkamas suvestinės pristatymo biudžetas');
  }
  const drilldown = value.drilldown;
  if (!isPositiveInteger(drilldown.limit) || drilldown.limit > 100 || !isPositiveInteger(drilldown.maxBytes)
    || drilldown.recordEncoding !== 'array' || !Array.isArray(drilldown.fields) || drilldown.fields.length !== 2
    || !isObject(drilldown.fields[0]) || drilldown.fields[0].type !== 'string'
    || !isObject(drilldown.fields[1]) || drilldown.fields[1].type !== 'raw-token-count'
    || !isNonEmptyString(drilldown.fields[0].id) || !isNonEmptyString(drilldown.fields[0].label)
    || !isNonEmptyString(drilldown.fields[1].id) || !isNonEmptyString(drilldown.fields[1].label)
    || !isNonEmptyString(drilldown.fields[1].unit) || !isObject(drilldown.ordering)
    || drilldown.ordering.field !== sourceView.frequencyField.id || drilldown.ordering.direction !== 'descending'
    || drilldown.ordering.tieBreak !== 'word-ascending') {
    fail('netinkami pavyzdžių nustatymai');
  }
  const summary = value.summary;
  if (!isPositiveInteger(summary.sourceRows) || summary.totalTypeCount !== summary.sourceRows
    || !isPositiveInteger(summary.totalTokenCount) || summary.sourceRows !== provenance.sourceFile.rows
    || !Array.isArray(summary.bands) || summary.bands.length === 0) {
    fail('netinkama suvestinė');
  }
  const bands: FrequencyBandSummary[] = [];
  let previousMaximum: number | null = 0;
  let typeTotal = 0;
  let tokenTotal = 0;
  for (const band of summary.bands) {
    const validated = validateBand(band, definitions, previousMaximum, drilldown.limit, drilldown.maxBytes);
    bands.push(validated);
    previousMaximum = validated.maximum;
    typeTotal += validated.typeCount;
    tokenTotal += validated.tokenCount;
  }
  if (previousMaximum !== null || typeTotal !== summary.totalTypeCount || tokenTotal !== summary.totalTokenCount) {
    fail('nesutampa suvestinės sumos');
  }
  return {
    ...(value as Omit<Dml6CoverageProfile, 'summary'>),
    sourceView: value.sourceView as Dml6CoverageProfile['sourceView'],
    provenance: value.provenance as Dml6CoverageProfile['provenance'],
    delivery: value.delivery as Dml6CoverageProfile['delivery'],
    drilldown: value.drilldown as Dml6CoverageProfile['drilldown'],
    summary: {
      sourceRows: summary.sourceRows,
      totalTypeCount: summary.totalTypeCount,
      totalTokenCount: summary.totalTokenCount,
      bands
    }
  };
}

export function coverageCategoryDefinitions(profile: Dml6CoverageProfile): CoverageCategoryDefinition[] {
  return coverageDefinitions(profile.sourceView.coverageField.values);
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nepavyko įkelti ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function loadDml6CoverageProfile(): Promise<Dml6CoverageProfile> {
  return validateDml6CoverageProfile(await fetchJson(profileUrl));
}

export async function loadDml6CoverageDrilldown(profile: Dml6CoverageProfile, bandId: string, coverageCode: number): Promise<Dml6CoverageDrilldown> {
  const band = profile.summary.bands.find((candidate) => candidate.id === bandId);
  const category = band?.categories.find((candidate) => candidate.coverageCode === coverageCode);
  if (!band || !category || !isSafeRelativePath(category.drilldown.file)) fail('nerastas prašomas pavyzdžių failas');
  const value = await fetchJson(`${profileDirectory}${category.drilldown.file}`);
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== profile.productId || value.profileId !== profile.profileId
    || value.bandId !== bandId || value.coverageCode !== coverageCode || value.recordEncoding !== 'array'
    || !Array.isArray(value.records) || value.records.length !== category.drilldown.records
    || !Array.isArray(value.fields) || !Array.isArray(profile.drilldown.fields)
    || JSON.stringify(value.fields) !== JSON.stringify(profile.drilldown.fields)
    || JSON.stringify(value.ordering) !== JSON.stringify(profile.drilldown.ordering)) {
    fail('netinkamas pavyzdžių failo turinys');
  }
  let previous: [string, number] | null = null;
  const records: Array<[string, number]> = [];
  for (const record of value.records) {
    if (!Array.isArray(record) || record.length !== 2 || !isNonEmptyString(record[0]) || !isPositiveInteger(record[1])
      || record[1] < band.minimum || (band.maximum !== null && record[1] > band.maximum)
      || (previous && (previous[1] < record[1] || (previous[1] === record[1] && previous[0] > record[0])))) {
      fail('netinkamas pavyzdžių įrašas');
    }
    const normalized: [string, number] = [record[0], record[1]];
    records.push(normalized);
    previous = normalized;
  }
  return {
    schemaVersion: 1,
    productId: profile.productId,
    profileId: profile.profileId,
    bandId,
    coverageCode,
    recordEncoding: 'array',
    fields: profile.drilldown.fields,
    ordering: profile.drilldown.ordering,
    records
  };
}
