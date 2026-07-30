/** Bounded exact-wordform lookup across the five named CCLL subcorpora. */

import { base } from '$app/paths';

export interface GenreProfileSource {
  id: 'fiction' | 'non-fiction' | 'administrative' | 'periodicals' | 'speech';
  label: string;
  sourceRole: string;
  sourceRows: number;
  sourceTokens: number;
  sourceFile: { artifactId: string; rows: number; sha256: string };
  view: { id: string; index: string };
}

export interface CcllGenreProfile {
  schemaVersion: 1;
  productId: 'utka-ccll-wordforms';
  profileId: 'ccll-wordform-genre-profile';
  profileType: 'ccll-genre-wordform-lookup';
  title: string;
  description: string;
  provenance: { sourceUrl: string; licence: string; citation: string };
  sources: GenreProfileSource[];
  rate: {
    targetTokens: 1000000;
    unit: 'tokens per million source tokens';
    formula: 'rawCount * 1000000 / sourceTokens';
  };
  policies: {
    aggregate: 'excluded';
    punctuation: 'preserve-source-wordforms';
    repeatedTerm: 'reject-duplicate-exact-wordforms-per-source';
    missing: 'not-observed-null';
    threshold: { minimumRawCount: 1; appliesTo: 'exact-lookup-only-no-ranking' };
    ordering: { field: 'word'; direction: 'ascending'; tieBreak: 'unicode-code-point' };
  };
  delivery: {
    summaryMaxBytes: number;
    routingNodeMaxBytes: number;
    lookupBucketMaxBytes: number;
  };
  lookup: {
    normalization: 'trim-nfc-preserve-case';
    recordEncoding: 'array';
    fields: Array<{ id: string; label: string; type: string; unit?: string; nullable?: boolean }>;
    root: string;
  };
  summary: {
    joinedWordforms: number;
    totalSourceRows: number;
    sourceRows: Record<string, number>;
    sourceTokenTotals: Record<string, number>;
    observedGenreCounts: Record<string, number>;
    routingNodeCount: number;
    lookupBucketCount: number;
  };
}

export interface GenreProfileLookupResult {
  word: string;
  rawCounts: Record<string, number | null>;
  observedGenres: number;
}

interface LookupBucketDescriptor {
  id: number;
  file: string;
  records: number;
  bytes: number;
  sha256: string;
}

interface RoutingNodeTarget {
  node: { id: number; file: string };
}

interface RoutingNode {
  nodeId: number;
  prefix: string;
  terminal: LookupBucketDescriptor | null;
  transitions: Array<[string, LookupBucketDescriptor | RoutingNodeTarget]>;
}

const expectedSources: Array<Pick<GenreProfileSource, 'id' | 'sourceRole'>> = [
  { id: 'fiction', sourceRole: 'subcorpus-fiction' },
  { id: 'non-fiction', sourceRole: 'subcorpus-non-fiction' },
  { id: 'administrative', sourceRole: 'subcorpus-administrative' },
  { id: 'periodicals', sourceRole: 'subcorpus-periodicals' },
  { id: 'speech', sourceRole: 'subcorpus-speech' }
];
const basePath = base;
const profileDirectory = `${basePath}/data-products/utka-ccll-wordforms/analysis/ccll-wordform-genre-profile/`;
const profileUrl = `${profileDirectory}manifest.json`;
const routingNodePromises = new Map<string, Promise<RoutingNode>>();
const bucketTextPromises = new Map<string, Promise<string>>();
const workerRequests = new Map<number, { resolve: (record: unknown[] | null) => void; reject: (cause: Error) => void }>();
let lookupWorker: Worker | null = null;
let nextWorkerRequestId = 0;

function fail(message: string): never {
  throw new Error(`Netinkamas CCLL žanrų profilio failas: ${message}`);
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

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isSafeInteger(value) && value > 0;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
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

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function lookupFields(sources: GenreProfileSource[]) {
  return [
    { id: 'word', label: 'Word form', type: 'string' },
    ...sources.map((source) => ({
      id: `${source.id}RawCount`,
      label: `${source.label} raw token count`,
      type: 'raw-token-count',
      unit: 'tokens',
      nullable: true
    })),
    { id: 'observedGenres', label: 'Observed named subcorpora', type: 'observed-genre-count' }
  ];
}

function validateBucketDescriptor(value: unknown, profile: CcllGenreProfile): LookupBucketDescriptor {
  if (!isObject(value) || !isSafeInteger(value.id) || !isSafeRelativePath(value.file) || !value.file.startsWith('buckets/')
    || !isPositiveInteger(value.records) || !isPositiveInteger(value.bytes)
    || value.bytes > profile.delivery.lookupBucketMaxBytes || !isSha256(value.sha256)) {
    fail('netinkamas paieškos duomenų failas');
  }
  return value as unknown as LookupBucketDescriptor;
}

function validateSource(value: unknown, expected: Pick<GenreProfileSource, 'id' | 'sourceRole'>): GenreProfileSource {
  if (!isObject(value) || value.id !== expected.id || value.sourceRole !== expected.sourceRole
    || !isNonEmptyString(value.label) || !isPositiveInteger(value.sourceRows) || !isPositiveInteger(value.sourceTokens)
    || !isObject(value.sourceFile) || !isSafeId(value.sourceFile.artifactId)
    || value.sourceFile.rows !== value.sourceRows || !isSha256(value.sourceFile.sha256)
    || !isObject(value.view) || !isSafeId(value.view.id) || !isSafeRelativePath(value.view.index)) {
    fail('netinkamas pavadinto subkorpuso aprašas');
  }
  return value as unknown as GenreProfileSource;
}

export function normalizeCcllGenreQuery(value: string) {
  return value.trim().normalize('NFC');
}

export function validateCcllGenreProfile(value: unknown): CcllGenreProfile {
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== 'utka-ccll-wordforms'
    || value.profileId !== 'ccll-wordform-genre-profile' || value.profileType !== 'ccll-genre-wordform-lookup'
    || !isNonEmptyString(value.title) || !isNonEmptyString(value.description) || !isObject(value.provenance)
    || !Array.isArray(value.sources) || !isObject(value.rate) || !isObject(value.policies)
    || !isObject(value.delivery) || !isObject(value.lookup) || !isObject(value.summary)) {
    fail('trūksta pagrindinių laukų');
  }
  if (!isHttpUrl(value.provenance.sourceUrl) || !isNonEmptyString(value.provenance.licence)
    || !isNonEmptyString(value.provenance.citation)) {
    fail('netinkama kilmės informacija');
  }
  if (value.sources.length !== expectedSources.length) fail('turi būti penki pavadinti subkorpusai');
  const sources = value.sources.map((source, index) => validateSource(source, expectedSources[index]));
  if (!sameJson(value.rate, {
    targetTokens: 1000000,
    unit: 'tokens per million source tokens',
    formula: 'rawCount * 1000000 / sourceTokens'
  }) || !sameJson(value.policies, {
    aggregate: 'excluded',
    punctuation: 'preserve-source-wordforms',
    repeatedTerm: 'reject-duplicate-exact-wordforms-per-source',
    missing: 'not-observed-null',
    threshold: { minimumRawCount: 1, appliesTo: 'exact-lookup-only-no-ranking' },
    ordering: { field: 'word', direction: 'ascending', tieBreak: 'unicode-code-point' }
  })) {
    fail('netinkama metodo politika');
  }
  if (!isPositiveInteger(value.delivery.summaryMaxBytes) || value.delivery.summaryMaxBytes > 65536
    || !isPositiveInteger(value.delivery.routingNodeMaxBytes) || value.delivery.routingNodeMaxBytes > 65536
    || !isPositiveInteger(value.delivery.lookupBucketMaxBytes) || value.delivery.lookupBucketMaxBytes > 65536
    || value.lookup.normalization !== 'trim-nfc-preserve-case' || value.lookup.recordEncoding !== 'array'
    || !isSafeRelativePath(value.lookup.root) || !value.lookup.root.startsWith('routing/nodes/')
    || !sameJson(value.lookup.fields, lookupFields(sources))) {
    fail('netinkamas pristatymo arba paieškos aprašas');
  }
  const summary = value.summary;
  const sourceRows = Object.fromEntries(sources.map((source) => [source.id, source.sourceRows]));
  const sourceTokenTotals = Object.fromEntries(sources.map((source) => [source.id, source.sourceTokens]));
  const totalSourceRows = sources.reduce((total, source) => total + source.sourceRows, 0);
  if (!isPositiveInteger(summary.joinedWordforms) || summary.totalSourceRows !== totalSourceRows
    || !sameJson(summary.sourceRows, sourceRows) || !sameJson(summary.sourceTokenTotals, sourceTokenTotals)
    || !isPositiveInteger(summary.routingNodeCount) || !isPositiveInteger(summary.lookupBucketCount)
    || !isObject(summary.observedGenreCounts)) {
    fail('netinkama paieškos suvestinė');
  }
  let observedTotal = 0;
  for (let genreCount = 1; genreCount <= sources.length; genreCount += 1) {
    const valueForGenreCount = summary.observedGenreCounts[String(genreCount)];
    if (!isSafeInteger(valueForGenreCount)) fail('netinkamas pastebėtų žanrų skaičius');
    observedTotal += valueForGenreCount;
  }
  if (observedTotal !== summary.joinedWordforms) fail('paieškos suvestinė nesusideda');
  return {
    schemaVersion: 1,
    productId: value.productId,
    profileId: value.profileId,
    profileType: value.profileType,
    title: value.title,
    description: value.description,
    provenance: value.provenance as CcllGenreProfile['provenance'],
    sources,
    rate: value.rate as CcllGenreProfile['rate'],
    policies: value.policies as CcllGenreProfile['policies'],
    delivery: value.delivery as CcllGenreProfile['delivery'],
    lookup: value.lookup as CcllGenreProfile['lookup'],
    summary: summary as CcllGenreProfile['summary']
  };
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

export async function loadCcllGenreProfile(): Promise<CcllGenreProfile> {
  return validateCcllGenreProfile(await fetchJson(profileUrl));
}

function validateRoutingNode(value: unknown, profile: CcllGenreProfile, expected: { prefix: string; nodeId: number | null }): RoutingNode {
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== profile.productId
    || value.profileId !== profile.profileId || !isSafeInteger(value.nodeId)
    || (expected.nodeId !== null && value.nodeId !== expected.nodeId) || value.prefix !== expected.prefix
    || (value.terminal !== null && !isObject(value.terminal)) || !Array.isArray(value.transitions)) {
    fail('netinkamas paieškos maršruto mazgas');
  }
  const terminal = value.terminal === null ? null : validateBucketDescriptor(value.terminal, profile);
  const transitions: RoutingNode['transitions'] = [];
  const seenCharacters = new Set<string>();
  for (const transition of value.transitions) {
    if (!Array.isArray(transition) || transition.length !== 2 || typeof transition[0] !== 'string'
      || Array.from(transition[0]).length !== 1 || seenCharacters.has(transition[0]) || !isObject(transition[1])) {
      fail('netinkama paieškos maršruto šaka');
    }
    seenCharacters.add(transition[0]);
    const target = transition[1];
    if (Object.hasOwn(target, 'bucket') === Object.hasOwn(target, 'node')) {
      fail('netinkamas paieškos maršruto tikslas');
    }
    if (Object.hasOwn(target, 'bucket')) {
      transitions.push([transition[0], validateBucketDescriptor(target.bucket, profile)]);
    } else if (!isObject(target.node) || !isSafeInteger(target.node.id) || !isSafeRelativePath(target.node.file)
      || !target.node.file.startsWith('routing/nodes/')) {
      fail('netinkamas paieškos maršruto mazgo tikslas');
    } else {
      transitions.push([transition[0], { node: { id: target.node.id, file: target.node.file } }]);
    }
  }
  if (terminal === null && transitions.length === 0) fail('tuščias paieškos maršruto mazgas');
  return { nodeId: value.nodeId, prefix: value.prefix, terminal, transitions };
}

async function loadRoutingNode(profile: CcllGenreProfile, file: string, expected: { prefix: string; nodeId: number | null }) {
  if (!isSafeRelativePath(file) || !file.startsWith('routing/nodes/')) fail('nesaugus paieškos maršruto kelias');
  const url = `${profileDirectory}${file}`;
  const cached = routingNodePromises.get(url);
  if (cached) return cached;
  const loading = fetchJson(url).then((value) => validateRoutingNode(value, profile, expected));
  routingNodePromises.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    routingNodePromises.delete(url);
    throw error;
  }
}

function validLookupRecord(value: unknown, profile: CcllGenreProfile): value is unknown[] {
  if (!Array.isArray(value) || value.length !== profile.sources.length + 2 || !isNonEmptyString(value[0])
    || normalizeCcllGenreQuery(value[0]) !== value[0]) return false;
  let observedGenres = 0;
  for (let index = 0; index < profile.sources.length; index += 1) {
    const rawCount = value[index + 1];
    if (rawCount === null) continue;
    if (!isPositiveInteger(rawCount)) return false;
    observedGenres += 1;
  }
  return isSafeInteger(value[value.length - 1]) && value[value.length - 1] === observedGenres
    && observedGenres > 0 && observedGenres <= profile.sources.length;
}

async function loadLookupBucketText(descriptor: LookupBucketDescriptor) {
  if (!isSafeRelativePath(descriptor.file) || !descriptor.file.startsWith('buckets/')) fail('nesaugus paieškos duomenų kelias');
  const url = `${profileDirectory}${descriptor.file}`;
  const cached = bucketTextPromises.get(url);
  if (cached) return cached;
  const loading = fetchText(url);
  bucketTextPromises.set(url, loading);
  try {
    return await loading;
  } catch (error) {
    bucketTextPromises.delete(url);
    throw error;
  }
}

function fallbackLookupRecord(profile: CcllGenreProfile, descriptor: LookupBucketDescriptor, text: string, word: string) {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    fail('netinkamas paieškos duomenų failo turinys');
  }
  if (!isObject(value) || value.schemaVersion !== 1 || value.productId !== profile.productId
    || value.profileId !== profile.profileId || value.bucketId !== descriptor.id
    || value.recordEncoding !== 'array' || !Array.isArray(value.records)
    || value.records.length !== descriptor.records || value.records.some((record) => !validLookupRecord(record, profile))) {
    fail('netinkamas paieškos duomenų failo turinys');
  }
  return value.records.find((candidate) => candidate[0] === word) as unknown[] | undefined;
}

function activeLookupWorker() {
  if (typeof Worker === 'undefined') return null;
  if (lookupWorker) return lookupWorker;
  const worker = new Worker(new URL('./ccll-genre-profile-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<{ requestId: number; record?: unknown; error?: string }>) => {
    const pending = workerRequests.get(event.data.requestId);
    if (!pending) return;
    workerRequests.delete(event.data.requestId);
    if (event.data.error) {
      pending.reject(new Error(event.data.error));
      return;
    }
    pending.resolve(Array.isArray(event.data.record) ? event.data.record : null);
  };
  worker.onerror = () => {
    for (const pending of workerRequests.values()) pending.reject(new Error('Nepavyko vykdyti paieškos fono užduotyje'));
    workerRequests.clear();
    worker.terminate();
    if (lookupWorker === worker) lookupWorker = null;
  };
  lookupWorker = worker;
  return worker;
}

async function lookupRecordInBucket(profile: CcllGenreProfile, descriptor: LookupBucketDescriptor, word: string) {
  const text = await loadLookupBucketText(descriptor);
  const worker = activeLookupWorker();
  if (!worker) return fallbackLookupRecord(profile, descriptor, text, word) ?? null;
  const requestId = ++nextWorkerRequestId;
  const record = await new Promise<unknown[] | null>((resolve, reject) => {
    workerRequests.set(requestId, { resolve, reject });
    worker.postMessage({
      requestId,
      text,
      productId: profile.productId,
      profileId: profile.profileId,
      bucketId: descriptor.id,
      recordLength: profile.sources.length + 2,
      word
    });
  });
  if (record !== null && !validLookupRecord(record, profile)) fail('netinkamas paieškos įrašas');
  return record;
}

function isBucketTarget(target: LookupBucketDescriptor | RoutingNodeTarget): target is LookupBucketDescriptor {
  return Object.hasOwn(target, 'file');
}

function resultFromRecord(profile: CcllGenreProfile, record: unknown[]): GenreProfileLookupResult {
  const rawCounts: Record<string, number | null> = {};
  for (const [index, source] of profile.sources.entries()) {
    rawCounts[source.id] = record[index + 1] === null ? null : record[index + 1] as number;
  }
  return {
    word: record[0] as string,
    rawCounts,
    observedGenres: record[record.length - 1] as number
  };
}

export async function lookupCcllGenreWord(profile: CcllGenreProfile, value: string): Promise<GenreProfileLookupResult | null> {
  const word = normalizeCcllGenreQuery(value);
  if (!word) return null;
  const characters = Array.from(word);
  let nodeFile = profile.lookup.root;
  let expectedNode = { prefix: '', nodeId: null as number | null };
  let characterIndex = 0;
  for (let steps = 0; steps <= characters.length + profile.summary.routingNodeCount; steps += 1) {
    const node = await loadRoutingNode(profile, nodeFile, expectedNode);
    let descriptor: LookupBucketDescriptor | null = null;
    if (characterIndex === characters.length) {
      descriptor = node.terminal;
    } else {
      const target = node.transitions.find(([character]) => character === characters[characterIndex])?.[1];
      if (!target) return null;
      if (isBucketTarget(target)) {
        descriptor = target;
      } else {
        nodeFile = target.node.file;
        expectedNode = { prefix: `${node.prefix}${characters[characterIndex]}`, nodeId: target.node.id };
        characterIndex += 1;
        continue;
      }
    }
    if (!descriptor) return null;
    const record = await lookupRecordInBucket(profile, descriptor, word);
    return record ? resultFromRecord(profile, record) : null;
  }
  fail('paieškos maršrutas cikliškas');
}

export function ratePerMillion(profile: CcllGenreProfile, result: GenreProfileLookupResult, sourceId: string): number | null {
  const source = profile.sources.find((candidate) => candidate.id === sourceId);
  const rawCount = result.rawCounts[sourceId];
  if (!source || rawCount === null || rawCount === undefined) return null;
  return rawCount * profile.rate.targetTokens / source.sourceTokens;
}

export function clearCcllGenreProfileCache() {
  routingNodePromises.clear();
  bucketTextPromises.clear();
  lookupWorker?.terminate();
  lookupWorker = null;
  workerRequests.clear();
}
