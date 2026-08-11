/** Bounded exact-wordform lookup for the privacy-safe BLKT aggregate product. */

import { base } from '$app/paths';

const PRODUCT_ID = 'vssa-2026-blkt-wordform-profile';
const PRODUCT_ROOT = `${base}/data-products/${PRODUCT_ID}/`;
const MANIFEST_URL = `${PRODUCT_ROOT}manifest.json`;
const EXPECTED_TYPE_IDS = ['fiction', 'non-fiction', 'media', 'speech', 'documents'] as const;
const EXPECTED_TYPE_CODES = ['gro', 'neg', 'zin', 'sak', 'dok'] as const;
const EXPECTED_PERIOD_IDS = ['1922-1940', '1941-1990', '1990-2004', '2008-2026'] as const;
const EXPECTED_PERIOD_CODES = ['1', '2', '3', '4'] as const;
const EXPECTED_EXCLUSIONS = [
  'raw-text',
  'document-rows',
  'document-subtypes',
  'joint-dimensions',
  'titles',
  'authors',
  'urls',
  'source-identifiers',
  'publication-dates',
  'personal-data'
] as const;
const EXPECTED_SOURCE_SCOPE_CAVEAT = 'BLKT is not representative of all Lithuanian language use: media and document texts dominate its document and token composition.';
const EXPECTED_SOURCE_LICENCES = {
  inventory: [
    {
      sourceLabel: 'NewGenLTU OpenRAIL-D',
      name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/',
      documents: 8267437,
      sourceAlphaWords: 3906734476
    },
    {
      sourceLabel: 'CC BY-SA 4.0',
      name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attribution: 'Wikipedia contributors (BLKT source_name: Vikipedija).',
      documents: 170718,
      sourceAlphaWords: 34741743
    }
  ],
  application: 'The combined aggregate retains the notices and conditions of both source licence groups.'
} as const;
const EXPECTED_RIGHTS = {
  licences: [
    {
      id: 'newgenltu-openrail-d-v1.0',
      name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/',
      file: 'LICENSE-NewGenLTU-OpenRAIL-D-1.0.txt',
      sha256: 'abf61fc83225e088c1ed91aae517f0d5c606c2c9b441f3fc245ce821c1c79ab9'
    },
    {
      id: 'cc-by-sa-4.0',
      name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      file: 'LICENSE-CC-BY-SA-4.0.txt',
      sha256: '23ee78c8bae49cf08ea2f0c84945c66b987ebe4520881fb51b3dad4fb43d07c2'
    }
  ],
  modificationNotice: 'MODIFIED FILE: Privacy-thresholded aggregate-only BLKT derivative produced by dazniausi-zodziai; no original text or document-level metadata is distributed.',
  attributionNotices: [
    'Valstybės skaitmeninių sprendimų agentūra. 2026. Bendrasis lietuvių kalbos tekstynas. Hugging Face. https://huggingface.co/datasets/VSSA-SDSA/LT_AI_BLKT.',
    'Wikipedia contributors. The BLKT source rows labelled “Vikipedija” are derived from Lithuanian Wikipedia material licensed under CC BY-SA 4.0. https://lt.wikipedia.org/'
  ],
  downstreamRequirements: [
    'Retain both applicable licence copies, this modification notice, the BLKT attribution, and the Wikipedia-contributor attribution with any redistribution.',
    'Use this derivative only for model training, other language-technology development, or production of datasets for model training.',
    'Do not use this derivative to extract, obtain, reconstruct, or publish personal data.',
    'For material derived from the BLKT rows labelled “Vikipedija”, comply with CC BY-SA 4.0 attribution and ShareAlike requirements.'
  ]
} as const;
const EXPECTED_FILE_NOTICE = {
  modificationNotice: EXPECTED_RIGHTS.modificationNotice,
  attribution: 'BLKT: Valstybės skaitmeninių sprendimų agentūra (2026); Vikipedija subset: Wikipedia contributors.',
  licenceLocation: 'product-root',
  licences: EXPECTED_RIGHTS.licences.map(({ name, file }) => ({ name, file }))
};

export interface BlktDimension {
  id: string;
  sourceCode?: string;
  label: string;
  tokenField: string;
  documentField: string;
  documents: number;
  sourceAlphaWords: number;
  derivedTokens: number;
}

export interface BlktWordformProfileMetadata {
  schemaVersion: 1;
  viewId: 'wordform-scope-metrics';
  sourceScopeCaveat: typeof EXPECTED_SOURCE_SCOPE_CAVEAT;
  sourceLicences: typeof EXPECTED_SOURCE_LICENCES;
  tokenizer: {
    id: 'blkt-unicode-letter-lower-v1';
    normalization: 'trim-nfc-lower';
    maximumCodePoints: 64;
    caseMapping: 'duckdb-simple-per-code-point';
  };
  disclosure: {
    minimumTokenCount: 100;
    minimumDocumentSupport: 20;
    familyRule: 'all-positive-siblings-must-pass-or-family-is-null';
  };
  rate: {
    targetTokens: 1000000;
    formula: 'tokenCount * 1000000 / derivedTokens';
    unit: 'tokens per million derived tokens';
  };
  corpus: BlktDimension;
  documentTypes: BlktDimension[];
  periods: BlktDimension[];
  validatedSubtypes: { count: 11; published: false };
  permission: { status: 'confirmed-by-project-owner'; confirmedOn: '2026-08-02' };
  rights: {
    licences: Array<{
      id: string;
      name: string;
      url: string;
      file: string;
      sha256: string;
    }>;
    modificationNotice: typeof EXPECTED_RIGHTS.modificationNotice;
    attributionNotices: string[];
    downstreamRequirements: string[];
  };
  exclusions: string[];
}

interface ProductView {
  id: string;
  index: string;
  title: string;
}

interface BlktProductManifest {
  schemaVersion: 1;
  id: typeof PRODUCT_ID;
  title: string;
  productType: 'chunked-comparison';
  publication: { status: 'published'; scope: string; access: string; reason?: string };
  provenance: { sourceUrl: string; licence: string; citation: string };
  notice: typeof EXPECTED_FILE_NOTICE;
  views: ProductView[];
  wordformProfile: BlktWordformProfileMetadata;
}

interface ViewField {
  id: string;
  label: string;
  type: 'string' | 'raw-token-count' | 'raw-document-count';
  nullable?: boolean;
}

interface ChunkDescriptor {
  file: string;
  records: number;
  bytes: number;
  sha256: string;
  range: [string, string];
}

interface RoutingPageDescriptor {
  file: string;
  chunks: number;
  records: number;
  bytes: number;
  sha256: string;
  range: [string, string];
}

interface BlktRoutingPage {
  schemaVersion: 1;
  productId: typeof PRODUCT_ID;
  viewId: 'wordform-scope-metrics';
  page: number;
  notice: typeof EXPECTED_FILE_NOTICE;
  chunks: ChunkDescriptor[];
}

interface BlktViewIndex {
  schemaVersion: 1;
  productId: typeof PRODUCT_ID;
  viewId: 'wordform-scope-metrics';
  recordEncoding: 'array';
  notice: typeof EXPECTED_FILE_NOTICE;
  fields: ViewField[];
  ordering: { field: 'word'; direction: 'ascending' };
  maxChunkBytes: number;
  lookup: {
    type: 'exact-string-range';
    field: 'word';
    normalization: 'trim-nfc-lower';
    maxIndexBytes: number;
  };
  routing: {
    type: 'range-pages';
    maxPageBytes: number;
    pages: RoutingPageDescriptor[];
  };
  summary: { sourceRows: number; recordCount: number };
}

export interface LoadedBlktWordformProfile {
  manifest: BlktProductManifest;
  metadata: BlktWordformProfileMetadata;
  index: BlktViewIndex;
  viewDirectory: string;
  fieldIndexes: Map<string, number>;
}

export interface BlktScopeResult extends BlktDimension {
  tokenCount: number;
  documentCount: number;
  ratePerMillion: number;
}

export interface BlktWordformResult {
  word: string;
  corpus: BlktScopeResult;
  documentTypes: BlktScopeResult[] | null;
  periods: BlktScopeResult[] | null;
}

export interface BlktEmbeddedLicence {
  id: string;
  name: string;
  url: string;
  file: string;
  sha256: string;
  fullText: string;
}

const profilePromiseCache = new Map<string, Promise<LoadedBlktWordformProfile>>();
const routingPromiseCache = new Map<string, Promise<BlktRoutingPage>>();
const chunkPromiseCache = new Map<string, Promise<unknown[][]>>();
const licencePromiseCache = new Map<string, Promise<string>>();

function fail(message: string): never {
  throw new Error(`Netinkamas BLKT žodžių profilio failas: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
}

function isSafeRelativePath(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.startsWith('/') || value.includes('://') || value.includes('\\')
    || value.includes('?') || value.includes('#')) return false;
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
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function compareCodePoints(left: string, right: string) {
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index].codePointAt(0)! - rightPoints[index].codePointAt(0)!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function validateDimension(value: unknown, expectedId: string, expectedSourceCode: string | null, description: string): BlktDimension {
  if (!isObject(value) || value.id !== expectedId || !isNonEmptyString(value.label)
    || (expectedSourceCode === null ? value.sourceCode !== undefined : value.sourceCode !== expectedSourceCode)
    || !isSafeId(value.tokenField) || !isSafeId(value.documentField) || value.tokenField === value.documentField
    || !isPositiveInteger(value.documents) || !isPositiveInteger(value.sourceAlphaWords)
    || !isPositiveInteger(value.derivedTokens)) {
    fail(`netinkamas ${description} vardiklis`);
  }
  return value as unknown as BlktDimension;
}

function validateMetadata(value: unknown): BlktWordformProfileMetadata {
  if (!isObject(value) || value.schemaVersion !== 1 || value.viewId !== 'wordform-scope-metrics'
    || value.sourceScopeCaveat !== EXPECTED_SOURCE_SCOPE_CAVEAT
    || !sameJson(value.sourceLicences, EXPECTED_SOURCE_LICENCES)
    || !sameJson(value.tokenizer, {
      id: 'blkt-unicode-letter-lower-v1',
      normalization: 'trim-nfc-lower',
      maximumCodePoints: 64,
      caseMapping: 'duckdb-simple-per-code-point'
    }) || !sameJson(value.disclosure, {
      minimumTokenCount: 100,
      minimumDocumentSupport: 20,
      familyRule: 'all-positive-siblings-must-pass-or-family-is-null'
    }) || !sameJson(value.rate, {
      targetTokens: 1000000,
      formula: 'tokenCount * 1000000 / derivedTokens',
      unit: 'tokens per million derived tokens'
    }) || !Array.isArray(value.documentTypes) || !Array.isArray(value.periods)
    || !sameJson(value.validatedSubtypes, { count: 11, published: false })
    || !sameJson(value.permission, { status: 'confirmed-by-project-owner', confirmedOn: '2026-08-02' })
    || !sameJson(value.rights, EXPECTED_RIGHTS)
    || !sameJson(value.exclusions, EXPECTED_EXCLUSIONS)) {
    fail('netinkamas metodo aprašas');
  }
  const corpus = validateDimension(value.corpus, 'corpus', null, 'viso tekstyno');
  const documentTypes = value.documentTypes.map((item, index) => validateDimension(
    item, EXPECTED_TYPE_IDS[index] ?? '', EXPECTED_TYPE_CODES[index] ?? '', 'teksto tipo'
  ));
  const periods = value.periods.map((item, index) => validateDimension(
    item, EXPECTED_PERIOD_IDS[index] ?? '', EXPECTED_PERIOD_CODES[index] ?? '', 'laikotarpio'
  ));
  if (documentTypes.length !== EXPECTED_TYPE_IDS.length || periods.length !== EXPECTED_PERIOD_IDS.length) {
    fail('netinkamas viešų pjūvių skaičius');
  }
  for (const dimensions of [documentTypes, periods]) {
    for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens'] as const) {
      if (dimensions.reduce((total, item) => total + item[field], 0) !== corpus[field]) {
        fail('pjūvių vardikliai nesutampa su visu tekstynu');
      }
    }
  }
  return {
    ...(value as unknown as BlktWordformProfileMetadata),
    corpus,
    documentTypes,
    periods
  };
}

function validateManifest(value: unknown): BlktProductManifest {
  if (!isObject(value) || value.schemaVersion !== 1 || value.id !== PRODUCT_ID
    || value.productType !== 'chunked-comparison' || !isNonEmptyString(value.title)
    || !isObject(value.publication) || value.publication.status !== 'published'
    || !isNonEmptyString(value.publication.scope) || !isNonEmptyString(value.publication.access)
    || !isObject(value.provenance) || !isHttpUrl(value.provenance.sourceUrl)
    || !isNonEmptyString(value.provenance.licence) || !isNonEmptyString(value.provenance.citation)
    || !sameJson(value.notice, EXPECTED_FILE_NOTICE)
    || !Array.isArray(value.views)) {
    fail('netinkamas produkto aprašas');
  }
  const metadata = validateMetadata(value.wordformProfile);
  const matchingViews = value.views.filter((view) => isObject(view) && view.id === metadata.viewId
    && isSafeRelativePath(view.index) && isNonEmptyString(view.title));
  if (matchingViews.length !== 1) fail('nerasta vienintelė profilio peržiūra');
  return value as unknown as BlktProductManifest;
}

function expectedFields(metadata: BlktWordformProfileMetadata) {
  return [
    ['word', 'string', false],
    [metadata.corpus.tokenField, 'raw-token-count', false],
    [metadata.corpus.documentField, 'raw-document-count', false],
    ...metadata.documentTypes.flatMap((item) => [
      [item.tokenField, 'raw-token-count', true],
      [item.documentField, 'raw-document-count', true]
    ]),
    ...metadata.periods.flatMap((item) => [
      [item.tokenField, 'raw-token-count', true],
      [item.documentField, 'raw-document-count', true]
    ])
  ] as Array<[string, string, boolean]>;
}

function hasValidRange(value: unknown): value is [string, string] {
  return Array.isArray(value) && value.length === 2
    && value.every((item) => typeof item === 'string' && /^\p{L}{1,64}$/u.test(item)
      && normalizeBlktWordformQuery(item) === item)
    && compareCodePoints(value[0] as string, value[1] as string) <= 0;
}

function validateIndex(value: unknown, metadata: BlktWordformProfileMetadata): BlktViewIndex {
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== PRODUCT_ID
    || value.viewId !== metadata.viewId || value.recordEncoding !== 'array'
    || !sameJson(value.notice, EXPECTED_FILE_NOTICE)
    || !Array.isArray(value.fields)
    || !sameJson(value.ordering, { field: 'word', direction: 'ascending' })
    || !isObject(value.lookup) || value.lookup.type !== 'exact-string-range'
    || value.lookup.field !== 'word' || value.lookup.normalization !== 'trim-nfc-lower'
    || !isPositiveInteger(value.lookup.maxIndexBytes) || value.lookup.maxIndexBytes < 8192
    || value.lookup.maxIndexBytes > 65536
    || !isPositiveInteger(value.maxChunkBytes) || value.maxChunkBytes > 65536
    || !isObject(value.summary) || !isPositiveInteger(value.summary.sourceRows)
    || value.summary.recordCount !== value.summary.sourceRows
    || !isObject(value.routing) || value.routing.type !== 'range-pages'
    || value.routing.maxPageBytes !== value.lookup.maxIndexBytes
    || !Array.isArray(value.routing.pages) || value.routing.pages.length === 0) {
    fail('netinkamas peržiūros indeksas');
  }
  const fields = expectedFields(metadata);
  if (value.fields.length !== fields.length) fail('netinkamas peržiūros laukų skaičius');
  const fieldIndexes = new Set<string>();
  value.fields.forEach((field, index) => {
    const expected = fields[index];
    if (!isObject(field) || field.id !== expected[0] || field.type !== expected[1]
      || (field.nullable === true) !== expected[2] || fieldIndexes.has(field.id as string)) {
      fail('netinkami peržiūros laukai');
    }
    fieldIndexes.add(field.id as string);
  });
  let previousLast: string | null = null;
  let routedRecords = 0;
  for (const [pageIndex, page] of value.routing.pages.entries()) {
    if (!isObject(page) || page.file !== `routing/${String(pageIndex + 1).padStart(6, '0')}.json`
      || !isSafeRelativePath(page.file) || !isPositiveInteger(page.chunks)
      || !isPositiveInteger(page.records) || !isPositiveInteger(page.bytes)
      || page.bytes > value.routing.maxPageBytes
      || typeof page.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(page.sha256)
      || !hasValidRange(page.range)
      || (previousLast !== null && compareCodePoints(previousLast, page.range[0]) >= 0)) {
      fail('netinkamas paieškos maršruto intervalas');
    }
    previousLast = page.range[1];
    routedRecords += page.records;
  }
  if (routedRecords !== value.summary.recordCount) fail('paieškos maršrutai neapima visų profilio eilučių');
  return value as unknown as BlktViewIndex;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nepavyko įkelti ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nepavyko įkelti ${url}: ${response.status} ${response.statusText}`);
  return response.text();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function normalizeBlktWordformQuery(value: string) {
  return Array.from(value.trim().normalize('NFC'), (character) => (
    character === '\u0130' ? 'i' : character.toLowerCase()
  )).join('').normalize('NFC');
}

export async function loadBlktWordformProfile(): Promise<LoadedBlktWordformProfile> {
  const cached = profilePromiseCache.get(MANIFEST_URL);
  if (cached) return cached;
  const loading = (async () => {
    const manifest = validateManifest(await fetchJson(MANIFEST_URL));
    const metadata = validateMetadata(manifest.wordformProfile);
    const view = manifest.views.find((candidate) => candidate.id === metadata.viewId)!;
    const index = validateIndex(await fetchJson(`${PRODUCT_ROOT}${view.index}`), metadata);
    const fieldIndexes = new Map(index.fields.map((field, fieldIndex) => [field.id, fieldIndex]));
    const viewDirectory = `${PRODUCT_ROOT}${view.index.slice(0, view.index.lastIndexOf('/') + 1)}`;
    return { manifest, metadata, index, fieldIndexes, viewDirectory };
  })();
  profilePromiseCache.set(MANIFEST_URL, loading);
  try {
    return await loading;
  } catch (error) {
    profilePromiseCache.delete(MANIFEST_URL);
    throw error;
  }
}

export async function loadBlktLicenceTexts(profile: LoadedBlktWordformProfile): Promise<BlktEmbeddedLicence[]> {
  return Promise.all(profile.metadata.rights.licences.map(async (licence) => {
    const url = `${PRODUCT_ROOT}${licence.file}`;
    let loading = licencePromiseCache.get(url);
    if (!loading) {
      loading = fetchText(url).then((fullText) => {
        const hasExpectedMarkers = licence.id === 'newgenltu-openrail-d-v1.0'
          ? fullText.includes('NewGenLTU openRAIL-D license') && fullText.includes('Attachment A')
          : fullText.includes('Attribution-ShareAlike 4.0 International') && fullText.includes('Section 3 -- License Conditions.');
        if (!hasExpectedMarkers) fail(`nepilnas licencijos tekstas: ${licence.file}`);
        return sha256(fullText).then((checksum) => {
          if (checksum !== licence.sha256) fail(`pakeistas licencijos tekstas: ${licence.file}`);
          return fullText;
        });
      });
      licencePromiseCache.set(url, loading);
    }
    try {
      return { ...licence, fullText: await loading };
    } catch (error) {
      licencePromiseCache.delete(url);
      throw error;
    }
  }));
}

function findRange<T extends { range: [string, string] }>(ranges: T[], word: string) {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = ranges[middle];
    if (compareCodePoints(word, candidate.range[0]) < 0) high = middle - 1;
    else if (compareCodePoints(word, candidate.range[1]) > 0) low = middle + 1;
    else return { descriptor: candidate, index: middle };
  }
  return null;
}

function validateChunkDescriptor(value: unknown, profile: LoadedBlktWordformProfile, chunkIndex: number): ChunkDescriptor {
  if (!isObject(value) || value.file !== `chunks/${String(chunkIndex + 1).padStart(6, '0')}.json`
    || !isSafeRelativePath(value.file) || !isPositiveInteger(value.records)
    || !isPositiveInteger(value.bytes) || value.bytes > profile.index.maxChunkBytes
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)
    || !hasValidRange(value.range)) {
    fail('netinkamas duomenų dalies intervalas');
  }
  return value as unknown as ChunkDescriptor;
}

async function loadRoutingPage(
  profile: LoadedBlktWordformProfile,
  descriptor: RoutingPageDescriptor,
  pageIndex: number
) {
  const url = `${profile.viewDirectory}${descriptor.file}`;
  const cached = routingPromiseCache.get(url);
  if (cached) return cached;
  const loading = (async () => {
    const value = await fetchJson(url);
    if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== PRODUCT_ID
      || value.viewId !== profile.metadata.viewId || value.page !== pageIndex
      || !sameJson(value.notice, EXPECTED_FILE_NOTICE)
      || !Array.isArray(value.chunks) || value.chunks.length !== descriptor.chunks) {
      fail('netinkamas paieškos maršruto puslapis');
    }
    const firstChunkIndex = profile.index.routing.pages
      .slice(0, pageIndex)
      .reduce((total, page) => total + page.chunks, 0);
    const chunks = value.chunks.map((chunk, index) => (
      validateChunkDescriptor(chunk, profile, firstChunkIndex + index)
    ));
    let previousLast: string | null = null;
    for (const chunk of chunks) {
      if (previousLast !== null && compareCodePoints(previousLast, chunk.range[0]) >= 0) {
        fail('paieškos maršruto duomenų dalys persidengia');
      }
      previousLast = chunk.range[1];
    }
    if (chunks[0].range[0] !== descriptor.range[0]
      || chunks.at(-1)!.range[1] !== descriptor.range[1]
      || chunks.reduce((total, chunk) => total + chunk.records, 0) !== descriptor.records) {
      fail('paieškos maršruto puslapis neatitinka savo aprašo');
    }
    return { ...(value as unknown as BlktRoutingPage), chunks };
  })();
  routingPromiseCache.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    routingPromiseCache.delete(url);
    throw error;
  }
}

function validateCount(value: unknown, nullable: boolean) {
  return (nullable && value === null) || isSafeInteger(value);
}

function validateRecord(profile: LoadedBlktWordformProfile, value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length !== profile.index.fields.length
    || typeof value[0] !== 'string' || normalizeBlktWordformQuery(value[0]) !== value[0]
    || !/^\p{L}{1,64}$/u.test(value[0])) {
    fail('netinkama žodžio profilio eilutė');
  }
  for (let index = 1; index < value.length; index += 1) {
    if (!validateCount(value[index], profile.index.fields[index].nullable === true)) {
      fail('netinkama žodžio profilio reikšmė');
    }
  }
  return value;
}

async function loadChunk(profile: LoadedBlktWordformProfile, descriptor: ChunkDescriptor, chunkIndex: number) {
  const url = `${profile.viewDirectory}${descriptor.file}`;
  const cached = chunkPromiseCache.get(url);
  if (cached) return cached;
  const loading = (async () => {
    const value = await fetchJson(url);
    if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== PRODUCT_ID
      || value.viewId !== profile.metadata.viewId || value.chunk !== chunkIndex
      || !sameJson(value.notice, EXPECTED_FILE_NOTICE)
      || !Array.isArray(value.records) || value.records.length !== descriptor.records) {
      fail('netinkama duomenų dalis');
    }
    const records = value.records.map((record) => validateRecord(profile, record));
    for (let index = 1; index < records.length; index += 1) {
      if (compareCodePoints(records[index - 1][0] as string, records[index][0] as string) >= 0) {
        fail('duomenų dalies žodžiai nėra griežtai surikiuoti');
      }
    }
    if (records[0][0] !== descriptor.range[0] || records.at(-1)![0] !== descriptor.range[1]) {
      fail('duomenų dalis neatitinka savo intervalo');
    }
    return records;
  })();
  chunkPromiseCache.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    chunkPromiseCache.delete(url);
    throw error;
  }
}

function validatePublishedPair(
  profile: LoadedBlktWordformProfile,
  tokenCount: unknown,
  documentCount: unknown,
  dimension: BlktDimension,
  { allowZero }: { allowZero: boolean }
) {
  if (!isSafeInteger(tokenCount) || !isSafeInteger(documentCount) || documentCount > tokenCount
    || tokenCount > dimension.derivedTokens || documentCount > dimension.documents) {
    fail('žodžio skaitikliai viršija savo vardiklius arba tarpusavyje nesutampa');
  }
  if (tokenCount === 0 || documentCount === 0) {
    if (tokenCount !== 0 || documentCount !== 0 || !allowZero) {
      fail('žodžio skaitikliai nepasiekia saugos slenksčio');
    }
    return { tokenCount, documentCount };
  }
  if (tokenCount < profile.metadata.disclosure.minimumTokenCount
    || documentCount < profile.metadata.disclosure.minimumDocumentSupport) {
    fail('žodžio skaitikliai nepasiekia saugos slenksčio');
  }
  return { tokenCount, documentCount };
}

function pairFromRecord(
  profile: LoadedBlktWordformProfile,
  record: unknown[],
  dimension: BlktDimension,
  { allowZero }: { allowZero: boolean }
) {
  const tokenCount = record[profile.fieldIndexes.get(dimension.tokenField)!];
  const documentCount = record[profile.fieldIndexes.get(dimension.documentField)!];
  if (tokenCount === null && documentCount === null) return null;
  const pair = validatePublishedPair(profile, tokenCount, documentCount, dimension, { allowZero });
  return {
    ...dimension,
    ...pair,
    ratePerMillion: pair.tokenCount * profile.metadata.rate.targetTokens / dimension.derivedTokens
  } satisfies BlktScopeResult;
}

function familyFromRecord(
  profile: LoadedBlktWordformProfile,
  record: unknown[],
  dimensions: BlktDimension[],
  corpus: BlktScopeResult
) {
  const values = dimensions.map((dimension) => pairFromRecord(profile, record, dimension, { allowZero: true }));
  if (values.every((value) => value === null)) return null;
  if (values.some((value) => value === null)) fail('žodžio pjūvis paskelbtas tik iš dalies');
  const published = values as BlktScopeResult[];
  if (published.reduce((total, value) => total + value.tokenCount, 0) !== corpus.tokenCount
    || published.reduce((total, value) => total + value.documentCount, 0) !== corpus.documentCount) {
    fail('žodžio pjūvis nesutampa su viso tekstyno skaitikliais');
  }
  return published;
}

function resultFromRecord(profile: LoadedBlktWordformProfile, record: unknown[]): BlktWordformResult {
  const corpus = pairFromRecord(profile, record, profile.metadata.corpus, { allowZero: false });
  if (!corpus) fail('žodis neturi viso tekstyno skaitiklių');
  return {
    word: record[0] as string,
    corpus,
    documentTypes: familyFromRecord(profile, record, profile.metadata.documentTypes, corpus),
    periods: familyFromRecord(profile, record, profile.metadata.periods, corpus)
  };
}

export async function lookupBlktWordform(profile: LoadedBlktWordformProfile, query: string) {
  const word = normalizeBlktWordformQuery(query);
  if (!word) return null;
  if (!/^\p{L}{1,64}$/u.test(word)) {
    throw new Error('Įveskite vieną 1–64 raidžių žodį be skaitmenų ar skyrybos ženklų.');
  }
  const routedPage = findRange(profile.index.routing.pages, word);
  if (!routedPage) return null;
  const page = await loadRoutingPage(profile, routedPage.descriptor, routedPage.index);
  const target = findRange(page.chunks, word);
  if (!target) return null;
  const firstChunkIndex = profile.index.routing.pages
    .slice(0, routedPage.index)
    .reduce((total, item) => total + item.chunks, 0);
  const records = await loadChunk(profile, target.descriptor, firstChunkIndex + target.index);
  let low = 0;
  let high = records.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const difference = compareCodePoints(records[middle][0] as string, word);
    if (difference < 0) low = middle + 1;
    else if (difference > 0) high = middle - 1;
    else return resultFromRecord(profile, records[middle]);
  }
  return null;
}

export function clearBlktWordformProfileCache() {
  profilePromiseCache.clear();
  routingPromiseCache.clear();
  chunkPromiseCache.clear();
  licencePromiseCache.clear();
}
