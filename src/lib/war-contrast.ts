/** Bounded lookup for the CCLL2 / wartime lexical comparison. */

export interface Normalization {
  sourceTokens: number;
  targetTokens: number;
}

export interface SourceField {
  id: string;
  label: string;
  type: string;
  sourceColumn: number;
  unit?: string;
  nullable?: boolean;
  normalization?: Normalization;
}

export interface NormalizedMetricField {
  id: string;
  label: string;
  type: 'normalized-token-count' | 'normalized-document-count';
  unit: string;
  nullable: true;
  normalization: Normalization;
}

export interface ContrastSource {
  id: string;
  label: string;
  tokenField: NormalizedMetricField;
  documentField: NormalizedMetricField;
}

export interface ContrastPair {
  id: string;
  label: string;
  numeratorSource: string;
  denominatorSource: string;
}

export interface LookupBucketDescriptor {
  id: number;
  file: string;
  records: number;
  bytes: number;
  sha256: string;
}

export interface WarContrastProfile {
  schemaVersion: 1;
  productId: 'utka-ccll2-war-ukraine-comparison';
  profileId: 'ccll2-wartime-normalized-contrast';
  profileType: 'normalized-contrast-lookup';
  title: string;
  description: string;
  sourceView: {
    id: string;
    sourceRole: string;
    index: string;
    fields: SourceField[];
    wordField: { id: string; label: string };
    summary: {
      sourceRows: number;
      recordCount: number;
      numericTotals: Record<string, number>;
      nullCounts: Record<string, number>;
    };
  };
  sources: ContrastSource[];
  contrast: {
    minimumRate: number;
    unit: string;
    targetTokens: number;
    formula: 'log2(numeratorRate / denominatorRate)';
    pairs: ContrastPair[];
  };
  provenance: {
    sourceUrl: string;
    licence: string;
    citation: string;
    sourceFile: { path: string; rows: number; sha256: string };
  };
  delivery: {
    summaryMaxBytes: number;
    lookupBucketMaxBytes: number;
    maxSourceRowsPerWord: number;
  };
  lookup: {
    normalization: 'trim-nfc-uppercase-lt';
    recordEncoding: 'array';
    fields: Array<{ id: string; label: string; type: string }>;
    routing: {
      root: 0;
      nodes: Array<{ terminalBucket: number | null; children: Array<[string, number]> }>;
      buckets: LookupBucketDescriptor[];
    };
  };
  summary: {
    lookupRecords: number;
    uniqueNormalizedWordForms: number;
    duplicateNormalizedWordForms: number;
    extraDuplicateRows: number;
    maxSourceRowsPerWord: number;
    sourceRows: number;
  };
}

export interface WarContrastLookupResult {
  word: string;
  normalizedWord: string;
  sourceRows: number[];
  metrics: Record<string, { tokenCount: number | null; documentCount: number | null }>;
}

interface SourceChunkDescriptor {
  file: string;
  records: number;
  bytes: number;
  sha256: string;
}

interface SourceIndex {
  schemaVersion: 1;
  productId: string;
  viewId: string;
  recordEncoding: 'array';
  fields: SourceField[];
  summary: WarContrastProfile['sourceView']['summary'];
  chunks: SourceChunkDescriptor[];
}

const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');
const productDirectory = `${basePath}/data-products/utka-ccll2-war-ukraine-comparison/`;
const profileDirectory = `${productDirectory}analysis/ccll2-wartime-normalized-contrast/`;
const profileUrl = `${profileDirectory}manifest.json`;
const sourceIndexPromises = new Map<string, Promise<SourceIndex>>();
const lookupBucketPromises = new Map<string, Promise<Array<[string, number]>>>();

export function clearWarContrastLookupCache() {
  sourceIndexPromises.clear();
  lookupBucketPromises.clear();
}

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

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
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
  throw new Error(`Netinkamas karo laikotarpio palyginimo profilis: ${message}`);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function metricDescriptor(field: SourceField): NormalizedMetricField {
  if ((field.type !== 'normalized-token-count' && field.type !== 'normalized-document-count')
    || field.nullable !== true || !isNonEmptyString(field.unit) || !isObject(field.normalization)
    || !isPositiveInteger(field.normalization.sourceTokens) || !isPositiveInteger(field.normalization.targetTokens)) {
    fail(`netinkamas normalizuotas laukas ${field.id}`);
  }
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    unit: field.unit,
    nullable: true,
    normalization: {
      sourceTokens: field.normalization.sourceTokens,
      targetTokens: field.normalization.targetTokens
    }
  };
}

function validateSourceField(value: unknown): SourceField {
  if (!isObject(value) || !isSafeFieldId(value.id) || !isNonEmptyString(value.label) || !isNonEmptyString(value.type)
    || !isSafeInteger(value.sourceColumn) || (value.unit !== undefined && !isNonEmptyString(value.unit))
    || (value.nullable !== undefined && typeof value.nullable !== 'boolean')) {
    fail('netinkamas šaltinio laukas');
  }
  if (value.normalization !== undefined && (!isObject(value.normalization) || !isPositiveInteger(value.normalization.sourceTokens)
    || !isPositiveInteger(value.normalization.targetTokens))) {
    fail(`netinkamas lauko ${value.id} normalizavimas`);
  }
  return value as unknown as SourceField;
}

function validateBucketDescriptor(value: unknown, maxBytes: number): LookupBucketDescriptor {
  if (!isObject(value) || !isSafeInteger(value.id) || !isSafeRelativePath(value.file) || !isPositiveInteger(value.records)
    || !isPositiveInteger(value.bytes) || value.bytes > maxBytes || typeof value.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    fail('netinkamas žodžių paieškos failas');
  }
  return value as unknown as LookupBucketDescriptor;
}

function validateRouting(value: unknown, bucketCount: number): WarContrastProfile['lookup']['routing'] {
  if (!isObject(value) || value.root !== 0 || !Array.isArray(value.nodes) || value.nodes.length === 0 || !Array.isArray(value.buckets)) {
    fail('netinkamas paieškos maršrutas');
  }
  const nodes: Array<{ terminalBucket: number | null; children: Array<[string, number]> }> = [];
  for (const node of value.nodes) {
    if (!isObject(node) || (node.terminalBucket !== null && !isSafeInteger(node.terminalBucket)) || !Array.isArray(node.children)) {
      fail('netinkamas paieškos maršruto mazgas');
    }
    const seenCharacters = new Set<string>();
    const children: Array<[string, number]> = [];
    for (const child of node.children) {
      if (!Array.isArray(child) || child.length !== 2 || typeof child[0] !== 'string' || child[0].length === 0
        || Array.from(child[0]).length !== 1 || !Number.isSafeInteger(child[1]) || seenCharacters.has(child[0])) {
        fail('netinkama paieškos maršruto šaka');
      }
      seenCharacters.add(child[0]);
      children.push([child[0], child[1]]);
    }
    nodes.push({ terminalBucket: node.terminalBucket, children });
  }
  const validTarget = (target: number) => (target >= 0 ? target < bucketCount : -target - 1 < nodes.length);
  for (const node of nodes) {
    if ((node.terminalBucket !== null && (!validTarget(node.terminalBucket) || node.terminalBucket < 0))
      || node.children.some(([, target]) => !validTarget(target))) {
      fail('paieškos maršrutas nurodo neegzistuojantį duomenų failą');
    }
  }
  return { root: 0, nodes, buckets: value.buckets as LookupBucketDescriptor[] };
}

export function normalizeWarContrastQuery(value: string) {
  return value.trim().normalize('NFC').toLocaleUpperCase('lt-LT');
}

export function validateWarContrastProfile(value: unknown): WarContrastProfile {
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== 'utka-ccll2-war-ukraine-comparison'
    || value.profileId !== 'ccll2-wartime-normalized-contrast' || value.profileType !== 'normalized-contrast-lookup'
    || !isNonEmptyString(value.title) || !isNonEmptyString(value.description) || !isObject(value.sourceView)
    || !Array.isArray(value.sources) || !isObject(value.contrast) || !isObject(value.provenance)
    || !isObject(value.delivery) || !isObject(value.lookup) || !isObject(value.summary)) {
    fail('trūksta pagrindinių laukų');
  }
  const sourceView = value.sourceView;
  if (!isSafeId(sourceView.id) || !isSafeId(sourceView.sourceRole) || !isSafeRelativePath(sourceView.index)
    || !Array.isArray(sourceView.fields) || sourceView.fields.length === 0 || !isObject(sourceView.wordField)
    || !isSafeFieldId(sourceView.wordField.id) || !isNonEmptyString(sourceView.wordField.label)
    || !isObject(sourceView.summary) || !isPositiveInteger(sourceView.summary.sourceRows)
    || sourceView.summary.recordCount !== sourceView.summary.sourceRows || !isObject(sourceView.summary.numericTotals)
    || !isObject(sourceView.summary.nullCounts)) {
    fail('netinkama šaltinio rodinio informacija');
  }
  const sourceWordField = sourceView.wordField as Record<string, unknown>;
  const fields = sourceView.fields.map(validateSourceField);
  const fieldIds = new Set<string>();
  for (const field of fields) {
    if (fieldIds.has(field.id)) fail('šaltinio laukai kartojasi');
    fieldIds.add(field.id);
  }
  const wordField = fields.find((field) => field.id === sourceWordField.id && field.type === 'string');
  if (!wordField || wordField.label !== sourceWordField.label) fail('nerastas žodžio formos laukas');
  if (!isPositiveInteger(value.delivery.summaryMaxBytes) || !isPositiveInteger(value.delivery.lookupBucketMaxBytes)
    || value.delivery.lookupBucketMaxBytes > 262144 || !isPositiveInteger(value.delivery.maxSourceRowsPerWord)
    || value.delivery.maxSourceRowsPerWord > 16) {
    fail('netinkami pristatymo apribojimai');
  }
  const delivery = value.delivery as WarContrastProfile['delivery'];
  const provenance = value.provenance;
  if (!isHttpUrl(provenance.sourceUrl) || !isNonEmptyString(provenance.licence) || !isNonEmptyString(provenance.citation)
    || !isObject(provenance.sourceFile) || !isSafeRelativePath(provenance.sourceFile.path)
    || !isPositiveInteger(provenance.sourceFile.rows) || typeof provenance.sourceFile.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(provenance.sourceFile.sha256) || provenance.sourceFile.rows !== sourceView.summary.sourceRows) {
    fail('netinkama kilmės informacija');
  }
  const sources: ContrastSource[] = [];
  const sourceIds = new Set<string>();
  const usedMetricFields = new Set<string>();
  let targetTokens: number | null = null;
  let tokenUnit: string | null = null;
  for (const source of value.sources) {
    if (!isObject(source) || !isSafeId(source.id) || !isNonEmptyString(source.label) || !isObject(source.tokenField)
      || !isObject(source.documentField) || sourceIds.has(source.id)) {
      fail('netinkamas lyginamas šaltinis');
    }
    const sourceTokenField = source.tokenField as Record<string, unknown>;
    const sourceDocumentField = source.documentField as Record<string, unknown>;
    const tokenField = fields.find((field) => field.id === sourceTokenField.id);
    const documentField = fields.find((field) => field.id === sourceDocumentField.id);
    if (!tokenField || !documentField || usedMetricFields.has(tokenField.id) || usedMetricFields.has(documentField.id)) {
      fail('lyginamas šaltinis nurodo pasikartojantį lauką');
    }
    const tokenDescriptor = metricDescriptor(tokenField);
    const documentDescriptor = metricDescriptor(documentField);
    if (tokenDescriptor.type !== 'normalized-token-count' || documentDescriptor.type !== 'normalized-document-count'
      || tokenDescriptor.normalization.sourceTokens !== documentDescriptor.normalization.sourceTokens
      || tokenDescriptor.normalization.targetTokens !== documentDescriptor.normalization.targetTokens
      || !sameJson(sourceTokenField, tokenDescriptor) || !sameJson(sourceDocumentField, documentDescriptor)) {
      fail('lyginamo šaltinio metrikos nesutampa su šaltinio rodiniu');
    }
    if (targetTokens === null) targetTokens = tokenDescriptor.normalization.targetTokens;
    if (tokenUnit === null) tokenUnit = tokenDescriptor.unit;
    if (targetTokens !== tokenDescriptor.normalization.targetTokens || tokenUnit !== tokenDescriptor.unit) {
      fail('lyginamos metrikos turi nesuderinamus vardiklius');
    }
    sourceIds.add(source.id);
    usedMetricFields.add(tokenField.id);
    usedMetricFields.add(documentField.id);
    sources.push({ id: source.id, label: source.label, tokenField: tokenDescriptor, documentField: documentDescriptor });
  }
  const contrast = value.contrast;
  if (sources.length < 2 || !isPositiveInteger(contrast.minimumRate) || contrast.unit !== tokenUnit
    || contrast.targetTokens !== targetTokens || contrast.formula !== 'log2(numeratorRate / denominatorRate)'
    || !Array.isArray(contrast.pairs) || contrast.pairs.length === 0) {
    fail('netinkama kontrasto informacija');
  }
  const pairIds = new Set<string>();
  const pairs: ContrastPair[] = [];
  for (const pair of contrast.pairs) {
    if (!isObject(pair) || !isSafeId(pair.id) || !isNonEmptyString(pair.label)
      || !isSafeId(pair.numeratorSource) || !isSafeId(pair.denominatorSource)
      || pair.numeratorSource === pair.denominatorSource || !sourceIds.has(pair.numeratorSource)
      || !sourceIds.has(pair.denominatorSource) || pairIds.has(pair.id)) {
      fail('netinkama kontrasto pora');
    }
    pairIds.add(pair.id);
    pairs.push(pair as unknown as ContrastPair);
  }
  const lookup = value.lookup;
  if (lookup.normalization !== 'trim-nfc-uppercase-lt' || lookup.recordEncoding !== 'array'
    || !Array.isArray(lookup.fields) || !sameJson(lookup.fields, [
      { id: 'normalizedWord', label: 'Normalized lookup word form', type: 'string' },
      { id: 'sourceRow', label: 'Zero-based source row', type: 'source-row' }
    ]) || !isObject(lookup.routing) || !Array.isArray(lookup.routing.buckets)) {
    fail('netinkama žodžių paieškos informacija');
  }
  const buckets = lookup.routing.buckets.map((bucket, index) => {
    const descriptor = validateBucketDescriptor(bucket, delivery.lookupBucketMaxBytes);
    if (descriptor.id !== index) fail('paieškos failų numeriai nesutampa');
    return descriptor;
  });
  const routing = validateRouting(lookup.routing, buckets.length);
  const summary = value.summary;
  if (!isPositiveInteger(summary.lookupRecords) || summary.lookupRecords !== sourceView.summary.recordCount
    || !isPositiveInteger(summary.uniqueNormalizedWordForms) || !isSafeInteger(summary.duplicateNormalizedWordForms)
    || !isSafeInteger(summary.extraDuplicateRows) || !isPositiveInteger(summary.maxSourceRowsPerWord)
    || summary.maxSourceRowsPerWord > delivery.maxSourceRowsPerWord || summary.sourceRows !== sourceView.summary.sourceRows
    || summary.lookupRecords !== summary.uniqueNormalizedWordForms + summary.extraDuplicateRows) {
    fail('netinkama paieškos suvestinė');
  }
  return {
    schemaVersion: 1,
    productId: value.productId,
    profileId: value.profileId,
    profileType: value.profileType,
    title: value.title,
    description: value.description,
    sourceView: {
      id: sourceView.id,
      sourceRole: sourceView.sourceRole,
      index: sourceView.index,
      fields,
      wordField: { id: wordField.id, label: wordField.label },
      summary: sourceView.summary as WarContrastProfile['sourceView']['summary']
    },
    sources,
    contrast: {
      minimumRate: contrast.minimumRate as number,
      unit: contrast.unit as string,
      targetTokens: contrast.targetTokens as number,
      formula: contrast.formula as 'log2(numeratorRate / denominatorRate)',
      pairs
    },
    provenance: provenance as WarContrastProfile['provenance'],
    delivery,
    lookup: {
      normalization: lookup.normalization,
      recordEncoding: 'array',
      fields: lookup.fields as WarContrastProfile['lookup']['fields'],
      routing: { ...routing, buckets }
    },
    summary: summary as WarContrastProfile['summary']
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nepavyko įkelti ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function loadWarContrastProfile(): Promise<WarContrastProfile> {
  return validateWarContrastProfile(await fetchJson(profileUrl));
}

function lookupBucketId(profile: WarContrastProfile, normalizedWord: string): number | null {
  let nodeIndex = profile.lookup.routing.root;
  const characters = Array.from(normalizedWord);
  let characterIndex = 0;
  for (let steps = 0; steps <= characters.length + profile.lookup.routing.nodes.length; steps += 1) {
    const node = profile.lookup.routing.nodes[nodeIndex];
    if (!node) fail('paieškos maršrutas nurodo neegzistuojantį mazgą');
    if (characterIndex === characters.length) return node.terminalBucket;
    const target = node.children.find(([character]) => character === characters[characterIndex])?.[1];
    if (target === undefined) return null;
    if (target >= 0) return target;
    nodeIndex = -target - 1;
    characterIndex += 1;
  }
  fail('paieškos maršrutas cikliškas');
}

async function loadLookupBucket(profile: WarContrastProfile, bucket: LookupBucketDescriptor): Promise<Array<[string, number]>> {
  const url = `${profileDirectory}${bucket.file}`;
  const cached = lookupBucketPromises.get(url);
  if (cached) return cached;
  const loading = fetchJson(url).then((value) => {
    if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== profile.productId
      || value.profileId !== profile.profileId || value.bucketId !== bucket.id || value.recordEncoding !== 'array'
      || !Array.isArray(value.records) || value.records.length !== bucket.records) {
      fail('netinkamas paieškos failo turinys');
    }
    const records: Array<[string, number]> = [];
    for (const record of value.records) {
      if (!Array.isArray(record) || record.length !== 2 || !isNonEmptyString(record[0])
        || normalizeWarContrastQuery(record[0]) !== record[0] || !isSafeInteger(record[1])
        || record[1] >= profile.sourceView.summary.recordCount || lookupBucketId(profile, record[0]) !== bucket.id) {
        fail('netinkamas paieškos įrašas');
      }
      records.push([record[0], record[1]]);
    }
    return records;
  });
  lookupBucketPromises.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    lookupBucketPromises.delete(url);
    throw error;
  }
}

function validateSourceIndex(value: unknown, profile: WarContrastProfile): SourceIndex {
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== profile.productId || value.viewId !== profile.sourceView.id
    || value.recordEncoding !== 'array' || !Array.isArray(value.fields) || !Array.isArray(value.chunks)
    || !isObject(value.summary) || !sameJson(value.fields, profile.sourceView.fields)
    || !sameJson(value.summary, profile.sourceView.summary)) {
    fail('netinkamas pagrindinio šaltinio indeksas');
  }
  const chunks: SourceChunkDescriptor[] = [];
  for (const descriptor of value.chunks) {
    if (!isObject(descriptor) || !isSafeRelativePath(descriptor.file) || !isPositiveInteger(descriptor.records)
      || !isPositiveInteger(descriptor.bytes) || typeof descriptor.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
      fail('netinkamas pagrindinio šaltinio dalies aprašas');
    }
    chunks.push(descriptor as unknown as SourceChunkDescriptor);
  }
  if (chunks.length === 0 || chunks.reduce((total, chunk) => total + chunk.records, 0) !== profile.sourceView.summary.recordCount) {
    fail('pagrindinio šaltinio dalių sumos nesutampa');
  }
  return {
    schemaVersion: 1,
    productId: value.productId,
    viewId: value.viewId,
    recordEncoding: 'array',
    fields: profile.sourceView.fields,
    summary: profile.sourceView.summary,
    chunks
  };
}

async function loadSourceIndex(profile: WarContrastProfile): Promise<SourceIndex> {
  const url = `${productDirectory}${profile.sourceView.index}`;
  const cached = sourceIndexPromises.get(url);
  if (cached) return cached;
  const loading = fetchJson(url).then((value) => validateSourceIndex(value, profile));
  sourceIndexPromises.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    sourceIndexPromises.delete(url);
    throw error;
  }
}

function sourceChunkForRow(index: SourceIndex, sourceRow: number) {
  let start = 0;
  for (const [chunkIndex, chunk] of index.chunks.entries()) {
    const end = start + chunk.records;
    if (sourceRow < end) return { chunkIndex, recordIndex: sourceRow - start };
    start = end;
  }
  fail('paieškos įrašas nurodo neegzistuojančią šaltinio eilutę');
}

function sourceIndexDirectory(indexPath: string) {
  const slash = indexPath.lastIndexOf('/');
  return slash === -1 ? '' : `${indexPath.slice(0, slash + 1)}`;
}

async function loadSourceChunk(profile: WarContrastProfile, index: SourceIndex, chunkIndex: number): Promise<unknown[][]> {
  const descriptor = index.chunks[chunkIndex];
  if (!descriptor) fail('nerasta prašoma šaltinio dalis');
  const url = `${productDirectory}${sourceIndexDirectory(profile.sourceView.index)}${descriptor.file}`;
  const value = await fetchJson(url);
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== profile.productId || value.viewId !== profile.sourceView.id
    || value.chunk !== chunkIndex || !Array.isArray(value.records) || value.records.length !== descriptor.records) {
    fail('netinkamas pagrindinio šaltinio dalies turinys');
  }
  return value.records as unknown[][];
}

function validateSourceRecord(profile: WarContrastProfile, value: unknown): Array<string | number | null> {
  if (!Array.isArray(value) || value.length !== profile.sourceView.fields.length) fail('netinkama pagrindinio šaltinio eilutė');
  const record: Array<string | number | null> = [];
  for (const [index, field] of profile.sourceView.fields.entries()) {
    const metric = value[index];
    if (field.type === 'string' || field.type === 'source-pos-code') {
      if (!isNonEmptyString(metric)) fail(`tuščias pagrindinio šaltinio laukas ${field.id}`);
      record.push(metric);
    } else if (metric === null) {
      if (field.nullable !== true) fail(`netikėta tuščia reikšmė ${field.id}`);
      record.push(null);
    } else {
      if (!isSafeInteger(metric)) fail(`netinkama skaitinė reikšmė ${field.id}`);
      record.push(metric);
    }
  }
  return record;
}

function mergeSourceRecords(profile: WarContrastProfile, normalizedWord: string, records: Array<Array<string | number | null>>): WarContrastLookupResult {
  if (records.length === 0) fail('nėra jungiamų šaltinio eilučių');
  const wordIndex = profile.sourceView.fields.findIndex((field) => field.id === profile.sourceView.wordField.id);
  const merged = [...records[0]];
  for (const record of records) {
    const word = record[wordIndex];
    if (typeof word !== 'string' || normalizeWarContrastQuery(word) !== normalizedWord) {
      fail('pagrindinio šaltinio eilutė nesutampa su paieškos žodžiu');
    }
    for (let index = 0; index < record.length; index += 1) {
      if (index === wordIndex || record[index] === null) continue;
      if (merged[index] === null) merged[index] = record[index];
      else if (merged[index] !== record[index]) fail('pasikartojančios šaltinio eilutės turi nesuderinamas reikšmes');
    }
  }
  const metrics: WarContrastLookupResult['metrics'] = {};
  for (const source of profile.sources) {
    const tokenIndex = profile.sourceView.fields.findIndex((field) => field.id === source.tokenField.id);
    const documentIndex = profile.sourceView.fields.findIndex((field) => field.id === source.documentField.id);
    const tokenCount = merged[tokenIndex];
    const documentCount = merged[documentIndex];
    metrics[source.id] = {
      tokenCount: tokenCount === null ? null : tokenCount as number,
      documentCount: documentCount === null ? null : documentCount as number
    };
  }
  return {
    word: merged[wordIndex] as string,
    normalizedWord,
    sourceRows: [],
    metrics
  };
}

export async function lookupWarContrastWord(profile: WarContrastProfile, value: string): Promise<WarContrastLookupResult | null> {
  const normalizedWord = normalizeWarContrastQuery(value);
  if (!normalizedWord) return null;
  const bucketId = lookupBucketId(profile, normalizedWord);
  if (bucketId === null) return null;
  const bucket = profile.lookup.routing.buckets[bucketId];
  if (!bucket) fail('paieškos maršrutas nurodo neegzistuojantį failą');
  const matches = (await loadLookupBucket(profile, bucket))
    .filter(([word]) => word === normalizedWord)
    .map(([, sourceRow]) => sourceRow);
  if (matches.length === 0) return null;
  if (matches.length > profile.delivery.maxSourceRowsPerWord) fail('paieškos žodis viršija paskelbtą šaltinio eilučių ribą');
  const sourceIndex = await loadSourceIndex(profile);
  const requestedRecords = new Map<number, Array<{ sourceRow: number; recordIndex: number }>>();
  for (const sourceRow of matches) {
    const location = sourceChunkForRow(sourceIndex, sourceRow);
    const rows = requestedRecords.get(location.chunkIndex) ?? [];
    rows.push({ sourceRow, recordIndex: location.recordIndex });
    requestedRecords.set(location.chunkIndex, rows);
  }
  const chunks = await Promise.all([...requestedRecords.keys()].map(async (chunkIndex) => [chunkIndex, await loadSourceChunk(profile, sourceIndex, chunkIndex)] as const));
  const chunksByIndex = new Map(chunks);
  const records = matches.map((sourceRow) => {
    const location = sourceChunkForRow(sourceIndex, sourceRow);
    const chunk = chunksByIndex.get(location.chunkIndex);
    return validateSourceRecord(profile, chunk?.[location.recordIndex]);
  });
  const merged = mergeSourceRecords(profile, normalizedWord, records);
  return { ...merged, sourceRows: matches };
}

export function contrastPair(profile: WarContrastProfile, pairId: string): ContrastPair | null {
  return profile.contrast.pairs.find((pair) => pair.id === pairId) ?? null;
}

export function logRatioForPair(profile: WarContrastProfile, result: WarContrastLookupResult, pairId: string): number | null {
  const pair = contrastPair(profile, pairId);
  if (!pair) return null;
  const numerator = result.metrics[pair.numeratorSource]?.tokenCount;
  const denominator = result.metrics[pair.denominatorSource]?.tokenCount;
  if (numerator === null || denominator === null || numerator === undefined || denominator === undefined
    || numerator < profile.contrast.minimumRate || denominator < profile.contrast.minimumRate) {
    return null;
  }
  return Math.log2(numerator / denominator);
}
