import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseDelimitedLine } from './prepare-dataset.mjs';
import { createSourceArtifactResolver } from './source-artifacts.mjs';
import { verifySourceContracts } from './verify-source-contracts.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPlanPath = path.join(repositoryRoot, 'data', 'products', 'publication-plan.json');
const defaultContractPath = path.join(repositoryRoot, 'data', 'contracts', 'deferred-sources.json');
const defaultStaticRoot = path.join(repositoryRoot, 'static');
const defaultOutputRoot = path.join(defaultStaticRoot, 'data-products');

const FIELD_TYPES = new Set([
  'string',
  'source-pos-code',
  'lexical-entry-details',
  'raw-token-count',
  'raw-document-count',
  'normalized-token-count',
  'normalized-document-count',
  'coverage-code'
]);
const NUMERIC_FIELD_TYPES = new Set([
  'raw-token-count',
  'raw-document-count',
  'normalized-token-count',
  'normalized-document-count',
  'coverage-code'
]);
const SUMMARIZED_FIELD_TYPES = new Set([
  'raw-token-count',
  'raw-document-count',
  'normalized-token-count',
  'normalized-document-count'
]);
const CHUNKED_PRODUCT_TYPES = new Set([
  'chunked-wordform-list',
  'chunked-comparison',
  'chunked-frequency-list',
  'chunked-derived-frequency-list',
  'chunked-lexical-collection',
  'chunked-syntactic-context'
]);
const ANALYSIS_PROFILE_TYPES = new Set([
  'frequency-band-coverage',
  'normalized-contrast-lookup',
  'ccll-genre-wordform-lookup'
]);
const SYNTACTIC_CONTEXT_PRODUCT_TYPE = 'chunked-syntactic-context';
const CCLL_GENRE_PROFILE_SOURCES = [
  { id: 'fiction', sourceRole: 'subcorpus-fiction' },
  { id: 'non-fiction', sourceRole: 'subcorpus-non-fiction' },
  { id: 'administrative', sourceRole: 'subcorpus-administrative' },
  { id: 'periodicals', sourceRole: 'subcorpus-periodicals' },
  { id: 'speech', sourceRole: 'subcorpus-speech' }
];
const BLKT_PRODUCT_ID = 'vssa-2026-blkt-wordform-profile';
const BLKT_PROVENANCE_LICENCE = 'NewGenLTU OpenRAIL-D v1.0; CC BY-SA 4.0 for BLKT rows labelled Vikipedija';
const RIMKUTE_PRODUCT_ID = 'rimkute-morphemic-dictionary';
const RIMKUTE_RIGHTS = {
  licence: 'Rightsholder permission',
  permission: {
    status: 'rightsholder-permission-confirmed',
    confirmedOn: '2026-08-13',
    scope: 'Extraction and correction of the three 2011 dictionary PDFs; publication and redistribution of the complete derived dataset and derived statistics; and downstream reuse, with normal attribution.',
    privateCorrespondencePublished: false
  },
  attributionNotice: 'Rimkutė, Erika; Kazlauskienė, Asta; Raškinis, Gailius. 2011. Dažninis lietuvių kalbos morfemikos žodynas. Vytauto Didžiojo universitetas.',
  modificationNotice: 'MODIFIED FILE: Deterministically extracted and reviewed by the dazniausi-zodziai Lithuanian word project from the three 2011 dictionary PDFs; this derivative is not an official VDU database export.',
  downstreamRequirements: [
    'Retain the attribution notice and identify the files as a modified derivative when redistributing the dataset or statistics.'
  ]
};
const RIMKUTE_FILE_NOTICE = {
  modificationNotice: RIMKUTE_RIGHTS.modificationNotice,
  attribution: RIMKUTE_RIGHTS.attributionNotice,
  licence: RIMKUTE_RIGHTS.licence
};
const RIMKUTE_COLUMNS = ['wordform', 'frequency', 'morphemic_analysis', 'lemma_and_morphology', 'volume', 'source_page'];
const RIMKUTE_METHOD = {
  id: 'pdf-coordinate-columns-v1',
  normalization: 'Unicode NFC; source text otherwise preserved',
  rowOrder: 'PDF volume order I, II, III; page order; top-to-bottom order',
  columnBoundariesPoints: [0, 145, 180, 285, 612],
  continuationPolicy: "A pure x >= 285 pt line is buffered: it is prepended to the next same-page row only when that row's description lacks a semicolon; otherwise it is appended to the preceding row, including across page boundaries.",
  splitFragmentPolicy: 'A reviewed non-row split line is joined to its adjacent row using source-layout direction; forward joins require the next row on the same page within 17 pt. Every split-line digest must match the manifest set.'
};

function fail(message) {
  throw new Error(`Data-product preparation failed: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sameObject(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isSafeId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isSafeFieldId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
}

function isSafeRelativePath(value) {
  if (!normalizeString(value) || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')) return false;
  return !value.split('/').includes('..');
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveInside(root, relativePath, description) {
  if (!isSafeRelativePath(relativePath)) fail(`${description} must be a safe relative path`);
  const resolved = path.resolve(root, relativePath);
  if (!isPathInside(root, resolved)) fail(`${description} escapes its configured root`);
  return resolved;
}

function asSafeInteger(value, description) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${description} must be a non-negative safe integer`);
  return value;
}

function parseJson(text, description) {
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${description} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

async function readJson(filename, description) {
  return parseJson(await readFile(filename, 'utf8'), description);
}

async function writeJson(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function validateField(field, description) {
  if (!isPlainObject(field) || !isSafeFieldId(field.id) || !normalizeString(field.label) || !FIELD_TYPES.has(field.type)) {
    fail(`${description} must define an id, label, and supported type`);
  }
  if (field.derived !== undefined && typeof field.derived !== 'boolean') {
    fail(`${description}.derived must be true or false when provided`);
  }
  if (field.derived === true) {
    if (field.sourceColumn !== undefined) fail(`${description}.sourceColumn is not valid for a derived field`);
  } else if (!Number.isInteger(field.sourceColumn) || field.sourceColumn < 0) {
    fail(`${description}.sourceColumn must be a non-negative integer`);
  }
  if (field.type === 'lexical-entry-details' && field.derived !== true) {
    fail(`${description}.lexical-entry-details must be a derived field`);
  }
  if (field.nullable !== undefined && typeof field.nullable !== 'boolean') {
    fail(`${description}.nullable must be true or false when provided`);
  }
  if (field.type === 'coverage-code') {
    if (!isPlainObject(field.values) || Object.keys(field.values).length === 0
      || Object.entries(field.values).some(([value, label]) => !/^\d+$/.test(value) || !normalizeString(label))) {
      fail(`${description}.values must label every numeric coverage code`);
    }
  } else if (field.values !== undefined) {
    fail(`${description}.values is only valid for a coverage-code field`);
  }
  if (field.type.startsWith('normalized-')) {
    if (!isPlainObject(field.normalization)
      || !Number.isSafeInteger(field.normalization.sourceTokens) || field.normalization.sourceTokens < 1
      || !Number.isSafeInteger(field.normalization.targetTokens) || field.normalization.targetTokens < 1) {
      fail(`${description}.normalization must contain positive safe source and target token counts`);
    }
  } else if (field.normalization !== undefined) {
    fail(`${description}.normalization is only valid for a normalized metric`);
  }
  if (NUMERIC_FIELD_TYPES.has(field.type) && !normalizeString(field.unit)) {
    fail(`${description}.unit is required for numeric fields`);
  }
}

function validateView(view, description) {
  if (!isPlainObject(view) || !isSafeId(view.id) || !normalizeString(view.sourceRole) || !normalizeString(view.title)
    || !normalizeString(view.description) || !isPlainObject(view.ordering) || !normalizeString(view.ordering.field)
    || !(['ascending', 'descending'].includes(view.ordering.direction)
      || (view.ordering.field === 'source' && view.ordering.direction === 'as-stored'))
    || !Number.isSafeInteger(view.chunkBytes) || view.chunkBytes < 1024) {
    fail(`${description} is missing required metadata`);
  }
  if (!Array.isArray(view.fields) || view.fields.length === 0) fail(`${description}.fields must not be empty`);
  const ids = new Set();
  const sourceColumns = new Set();
  for (const [index, field] of view.fields.entries()) {
    validateField(field, `${description}.fields[${index}]`);
    if (ids.has(field.id) || (field.derived !== true && sourceColumns.has(field.sourceColumn))) {
      fail(`${description}.fields must use unique ids and source columns`);
    }
    ids.add(field.id);
    if (field.derived !== true) sourceColumns.add(field.sourceColumn);
  }
  if (!(view.ordering.field === 'source' && view.ordering.direction === 'as-stored') && !ids.has(view.ordering.field)) {
    fail(`${description}.ordering.field must name a field unless it declares source order`);
  }
  if (view.lookup !== undefined) {
    const lookupField = view.fields.find((field) => field.id === view.lookup?.field);
    if (!isPlainObject(view.lookup) || view.lookup.type !== 'exact-string-range'
      || view.lookup.normalization !== 'trim-nfc-lower'
      || !Number.isSafeInteger(view.lookup.maxIndexBytes) || view.lookup.maxIndexBytes < 8192
      || view.lookup.maxIndexBytes > 65536 || view.ordering.field !== view.lookup.field
      || view.ordering.direction !== 'ascending' || !lookupField || lookupField.type !== 'string') {
      fail(`${description}.lookup must define a bounded exact-string range index over the ascending string field`);
    }
  }
}

const BLKT_TYPE_DIMENSIONS = [
  ['fiction', 'gro'],
  ['non-fiction', 'neg'],
  ['media', 'zin'],
  ['speech', 'sak'],
  ['documents', 'dok']
];
const BLKT_PERIOD_DIMENSIONS = [
  ['1922-1940', '1'],
  ['1941-1990', '2'],
  ['1990-2004', '3'],
  ['2008-2026', '4']
];
const BLKT_EXCLUSIONS = [
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
];
const BLKT_SOURCE_SCOPE_CAVEAT = 'BLKT is not representative of all Lithuanian language use: media and document texts dominate its document and token composition.';
const BLKT_SOURCE_LICENCES = {
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
};
const BLKT_RIGHTS = {
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
};
const BLKT_FILE_NOTICE = {
  modificationNotice: BLKT_RIGHTS.modificationNotice,
  attribution: 'BLKT: Valstybės skaitmeninių sprendimų agentūra (2026); Vikipedija subset: Wikipedia contributors.',
  licenceLocation: 'product-root',
  licences: BLKT_RIGHTS.licences.map(({ name, file }) => ({ name, file }))
};
const BLKT_LICENCE_SOURCE_FILES = [
  ['data/licenses/newgenltu-openrail-d-v1.0.txt', BLKT_RIGHTS.licences[0]],
  ['data/licenses/cc-by-sa-4.0-legalcode.txt', BLKT_RIGHTS.licences[1]]
];

function validateBlktDimension(value, expected, description) {
  if (!isPlainObject(value) || value.id !== expected[0] || value.sourceCode !== expected[1]
    || !normalizeString(value.label) || !isSafeFieldId(value.tokenField)
    || !isSafeFieldId(value.documentField) || value.tokenField === value.documentField) {
    fail(`${description} is invalid`);
  }
  for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens']) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 1) fail(`${description}.${field} is invalid`);
  }
}

function validateBlktWordformProfile(value, description) {
  if (!isPlainObject(value) || value.schemaVersion !== 1 || value.viewId !== 'wordform-scope-metrics'
    || value.sourceScopeCaveat !== BLKT_SOURCE_SCOPE_CAVEAT
    || !sameObject(value.sourceLicences, BLKT_SOURCE_LICENCES)
    || !isPlainObject(value.tokenizer) || value.tokenizer.id !== 'blkt-unicode-letter-lower-v1'
    || value.tokenizer.normalization !== 'trim-nfc-lower' || value.tokenizer.maximumCodePoints !== 64
    || value.tokenizer.caseMapping !== 'duckdb-simple-per-code-point'
    || !isPlainObject(value.disclosure) || value.disclosure.minimumTokenCount !== 100
    || value.disclosure.minimumDocumentSupport !== 20
    || value.disclosure.familyRule !== 'all-positive-siblings-must-pass-or-family-is-null'
    || !isPlainObject(value.rate) || value.rate.targetTokens !== 1000000
    || value.rate.formula !== 'tokenCount * 1000000 / derivedTokens'
    || value.rate.unit !== 'tokens per million derived tokens'
    || !isPlainObject(value.corpus) || value.corpus.id !== 'corpus'
    || value.corpus.sourceCode !== undefined || !normalizeString(value.corpus.label)
    || !isSafeFieldId(value.corpus.tokenField)
    || !isSafeFieldId(value.corpus.documentField) || value.corpus.tokenField === value.corpus.documentField
    || !Array.isArray(value.documentTypes) || value.documentTypes.length !== BLKT_TYPE_DIMENSIONS.length
    || !Array.isArray(value.periods) || value.periods.length !== BLKT_PERIOD_DIMENSIONS.length
    || !isPlainObject(value.validatedSubtypes) || value.validatedSubtypes.count !== 11
    || value.validatedSubtypes.published !== false || !isPlainObject(value.permission)
    || value.permission.status !== 'confirmed-by-project-owner' || value.permission.confirmedOn !== '2026-08-02'
    || !sameObject(value.rights, BLKT_RIGHTS)
    || !sameObject(value.exclusions, BLKT_EXCLUSIONS)) {
    fail(`${description} is invalid`);
  }
  for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens']) {
    if (!Number.isSafeInteger(value.corpus[field]) || value.corpus[field] < 1) fail(`${description}.corpus.${field} is invalid`);
  }
  value.documentTypes.forEach((dimension, index) => validateBlktDimension(dimension, BLKT_TYPE_DIMENSIONS[index], `${description}.documentTypes[${index}]`));
  value.periods.forEach((dimension, index) => validateBlktDimension(dimension, BLKT_PERIOD_DIMENSIONS[index], `${description}.periods[${index}]`));
  for (const dimensions of [value.documentTypes, value.periods]) {
    for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens']) {
      if (dimensions.reduce((total, item) => total + item[field], 0) !== value.corpus[field]) {
        fail(`${description}.${field} does not reconcile with the corpus denominator`);
      }
    }
  }
  if (value.sourceLicences.inventory.reduce((total, item) => total + item.documents, 0) !== value.corpus.documents
    || value.sourceLicences.inventory.reduce((total, item) => total + item.sourceAlphaWords, 0) !== value.corpus.sourceAlphaWords) {
    fail(`${description}.sourceLicences does not reconcile with the corpus denominator`);
  }
}

function validatePublication(publication, description) {
  if (!isPlainObject(publication)
    || !['published', 'metadata-only'].includes(publication.status)
    || !normalizeString(publication.scope)
    || !normalizeString(publication.access)) {
    fail(`${description} must define a recognised status, scope, and access method`);
  }
  if (publication.reason !== undefined && !normalizeString(publication.reason)) {
    fail(`${description}.reason must be a non-empty string when provided`);
  }
}

function validateDerivation(derivation, description) {
  if (derivation === undefined) return;
  if (!isPlainObject(derivation) || !isPlainObject(derivation.expectedSummary)) fail(`${description}.derivation is invalid`);
  if (derivation.type === 'conllu-frequency') {
    if (!['lemma', 'wordform'].includes(derivation.key)
      || !Array.isArray(derivation.excludeUniversalPos)
      || derivation.excludeUniversalPos.some((value) => !normalizeString(value))
      || !normalizeString(derivation.missingUniversalPos)) {
      fail(`${description}.derivation is invalid`);
    }
    for (const field of ['sourceRows', 'recordCount', 'totalFrequency']) {
      asSafeInteger(derivation.expectedSummary[field], `${description}.derivation.expectedSummary.${field}`);
    }
    return;
  }
  if (derivation.type === 'name-transliteration') {
    for (const field of ['sourceRows', 'recordCount', 'totalFrequency']) {
      asSafeInteger(derivation.expectedSummary[field], `${description}.derivation.expectedSummary.${field}`);
    }
    return;
  }
  if (derivation.type === 'nvh-lexicon') {
    asSafeInteger(derivation.recordPageEntryCount, `${description}.derivation.recordPageEntryCount`);
    for (const field of ['sourceRows', 'recordCount', 'senseCount', 'definitionCount', 'exampleCount']) {
      asSafeInteger(derivation.expectedSummary[field], `${description}.derivation.expectedSummary.${field}`);
    }
    return;
  }
  fail(`${description}.derivation type is not supported`);
}

function validateFrequencyBand(band, description, previousBand) {
  if (!isPlainObject(band) || !isSafeId(band.id) || !normalizeString(band.label)
    || !Number.isSafeInteger(band.minimum) || band.minimum < 1
    || (band.maximum !== null && (!Number.isSafeInteger(band.maximum) || band.maximum < band.minimum))) {
    fail(`${description} is invalid`);
  }
  if (previousBand) {
    if (previousBand.maximum === null || band.minimum !== previousBand.maximum + 1) {
      fail(`${description} must begin immediately after the preceding frequency band`);
    }
  } else if (band.minimum !== 1) {
    fail(`${description} must begin at frequency 1`);
  }
  return band;
}

function validateFrequencyBandCoverageProfile(profile, description) {
  if (!Array.isArray(profile.frequencyBands) || profile.frequencyBands.length === 0
    || !isPlainObject(profile.drilldown) || !Number.isSafeInteger(profile.drilldown.limit)
    || profile.drilldown.limit < 1 || profile.drilldown.limit > 100
    || !Number.isSafeInteger(profile.drilldown.maxBytes) || profile.drilldown.maxBytes < 1024
    || !isPlainObject(profile.drilldown.ordering)
    || !normalizeString(profile.drilldown.ordering.field)
    || !['ascending', 'descending'].includes(profile.drilldown.ordering.direction)
    || profile.drilldown.ordering.tieBreak !== 'word-ascending') {
    fail(`${description} is invalid`);
  }
  let previousBand = null;
  const ids = new Set();
  for (const [index, band] of profile.frequencyBands.entries()) {
    validateFrequencyBand(band, `${description}.frequencyBands[${index}]`, previousBand);
    if (ids.has(band.id)) fail(`${description}.frequencyBands uses duplicate ids`);
    ids.add(band.id);
    previousBand = band;
  }
  if (previousBand?.maximum !== null) {
    fail(`${description}.frequencyBands must finish with an open-ended band`);
  }
}

function validateNormalizedContrastLookupProfile(profile, description) {
  if (!isPlainObject(profile.lookup) || !Number.isSafeInteger(profile.lookup.maxBucketBytes)
    || profile.lookup.maxBucketBytes < 8192 || profile.lookup.maxBucketBytes > 262144
    || profile.lookup.normalization !== 'trim-nfc-uppercase-lt'
    || !Number.isSafeInteger(profile.lookup.maxSourceRowsPerWord) || profile.lookup.maxSourceRowsPerWord < 1
    || profile.lookup.maxSourceRowsPerWord > 16 || !Array.isArray(profile.sources) || profile.sources.length < 2
    || !Array.isArray(profile.pairs) || profile.pairs.length === 0
    || !Number.isSafeInteger(profile.minimumRate) || profile.minimumRate < 1) {
    fail(`${description} is invalid`);
  }
  const sourceIds = new Set();
  for (const [index, source] of profile.sources.entries()) {
    if (!isPlainObject(source) || !isSafeId(source.id) || !normalizeString(source.label)
      || !isSafeFieldId(source.tokenField) || !isSafeFieldId(source.documentField)
      || source.tokenField === source.documentField || sourceIds.has(source.id)) {
      fail(`${description}.sources[${index}] is invalid`);
    }
    sourceIds.add(source.id);
  }
  const pairIds = new Set();
  for (const [index, pair] of profile.pairs.entries()) {
    if (!isPlainObject(pair) || !isSafeId(pair.id) || !normalizeString(pair.label)
      || !isSafeId(pair.numeratorSource) || !isSafeId(pair.denominatorSource)
      || pair.numeratorSource === pair.denominatorSource || !sourceIds.has(pair.numeratorSource)
      || !sourceIds.has(pair.denominatorSource) || pairIds.has(pair.id)) {
      fail(`${description}.pairs[${index}] is invalid`);
    }
    pairIds.add(pair.id);
  }
}

function validateCcllGenreWordformLookupProfile(profile, description) {
  if (profile.summaryMaxBytes > 65536 || !Array.isArray(profile.sources) || profile.sources.length !== CCLL_GENRE_PROFILE_SOURCES.length
    || !isPlainObject(profile.rate) || profile.rate.targetTokens !== 1000000
    || profile.rate.unit !== 'tokens per million source tokens'
    || profile.rate.formula !== 'rawCount * 1000000 / sourceTokens'
    || !isPlainObject(profile.lookup) || profile.lookup.normalization !== 'trim-nfc-preserve-case'
    || !Number.isSafeInteger(profile.lookup.maxRoutingNodeBytes) || profile.lookup.maxRoutingNodeBytes < 1024
    || profile.lookup.maxRoutingNodeBytes > 65536 || !Number.isSafeInteger(profile.lookup.maxBucketBytes)
    || profile.lookup.maxBucketBytes < 1024 || profile.lookup.maxBucketBytes > 65536
    || !isPlainObject(profile.policies) || profile.policies.aggregate !== 'excluded'
    || profile.policies.punctuation !== 'preserve-source-wordforms'
    || profile.policies.repeatedTerm !== 'reject-duplicate-exact-wordforms-per-source'
    || profile.policies.missing !== 'not-observed-null' || !isPlainObject(profile.policies.threshold)
    || profile.policies.threshold.minimumRawCount !== 1
    || profile.policies.threshold.appliesTo !== 'exact-lookup-only-no-ranking'
    || !isPlainObject(profile.policies.ordering) || profile.policies.ordering.field !== 'word'
    || profile.policies.ordering.direction !== 'ascending'
    || profile.policies.ordering.tieBreak !== 'unicode-code-point') {
    fail(`${description} is invalid`);
  }
  for (const [index, expected] of CCLL_GENRE_PROFILE_SOURCES.entries()) {
    const source = profile.sources[index];
    if (!isPlainObject(source) || source.id !== expected.id || source.sourceRole !== expected.sourceRole
      || !normalizeString(source.label)) {
      fail(`${description}.sources[${index}] must identify the named CCLL subcorpus`);
    }
  }
}

function validateAnalysisProfile(profile, description) {
  if (!isPlainObject(profile) || !isSafeId(profile.id) || !ANALYSIS_PROFILE_TYPES.has(profile.type)
    || !normalizeString(profile.title) || !normalizeString(profile.description)
    || !Number.isSafeInteger(profile.summaryMaxBytes) || profile.summaryMaxBytes < 1024
    || (profile.type !== 'ccll-genre-wordform-lookup' && !isSafeId(profile.sourceRole))) {
    fail(`${description} is invalid`);
  }
  if (profile.type === 'frequency-band-coverage') {
    validateFrequencyBandCoverageProfile(profile, description);
  } else if (profile.type === 'normalized-contrast-lookup') {
    validateNormalizedContrastLookupProfile(profile, description);
  } else if (profile.type === 'ccll-genre-wordform-lookup') {
    validateCcllGenreWordformLookupProfile(profile, description);
  }
}

function validateSyntacticContextConfiguration(configuration, description) {
  if (!isPlainObject(configuration) || !normalizeString(configuration.sourceRole)
    || !Number.isSafeInteger(configuration.maxExamplesPerLemma) || configuration.maxExamplesPerLemma < 1
    || configuration.maxExamplesPerLemma > 50
    || !Number.isSafeInteger(configuration.chunkBytes) || configuration.chunkBytes < 1024
    || !Number.isSafeInteger(configuration.lemmaIndexPrefixCodePoints) || configuration.lemmaIndexPrefixCodePoints < 1
    || configuration.lemmaIndexPrefixCodePoints > 3
    || !Number.isSafeInteger(configuration.contextPrefixCodePoints) || configuration.contextPrefixCodePoints < 1
    || configuration.contextPrefixCodePoints > 3
    || configuration.contextPrefixCodePoints < configuration.lemmaIndexPrefixCodePoints
    || !isPlainObject(configuration.genreLabels) || Object.keys(configuration.genreLabels).length === 0
    || Object.entries(configuration.genreLabels).some(([key, value]) => !isSafeRelativePath(key) || !normalizeString(value))
    || !isPlainObject(configuration.expectedSummary)) {
    fail(`${description}.syntaxContext is invalid`);
  }
  for (const field of [
    'documents', 'sentences', 'integerTokenRows', 'nonPunctuationRows',
    'allRelationLabels', 'nonPunctuationRelationLabels', 'rootRows',
    'nonPunctuationRootRows', 'nonRootDependencyRows', 'lemmaCount', 'contextRecordCount',
    'contextRowsOmittedByLimit', 'lemmaIndexPrefixes', 'contextPrefixes'
  ]) {
    asSafeInteger(configuration.expectedSummary[field], `${description}.syntaxContext.expectedSummary.${field}`);
  }
}

export function validatePublicationPlan(plan) {
  if (!isPlainObject(plan) || plan.schemaVersion !== 1 || !normalizeString(plan.title)
    || !Array.isArray(plan.genericProducts) || !Array.isArray(plan.contractProducts)) {
    fail('publication plan must use schemaVersion 1 and list generic and contract products');
  }

  for (const [index, product] of plan.genericProducts.entries()) {
    if (!isPlainObject(product) || !isSafeRelativePath(product.datasetFile) || !product.datasetFile.startsWith('datasets/')
      || !normalizeString(product.description)) {
      fail(`genericProducts[${index}] must name a reviewed file under static/datasets and a description`);
    }
  }

  const contractIds = new Set();
  for (const [index, product] of plan.contractProducts.entries()) {
    const description = `contractProducts[${index}]`;
    if (!isPlainObject(product) || !isSafeId(product.contractId)
      || ![...CHUNKED_PRODUCT_TYPES, 'metadata-only'].includes(product.productType)) {
      fail(`${description} must name a contract and supported product type`);
    }
    if (contractIds.has(product.contractId)) fail(`${description}.contractId is duplicated`);
    contractIds.add(product.contractId);
    validatePublication(product.publication, `${description}.publication`);

    if (product.productType === 'metadata-only') {
      if (product.publication.status !== 'metadata-only' || !Array.isArray(product.blockedBy) || product.blockedBy.length === 0
        || product.blockedBy.some((url) => !isHttpUrl(url))) {
        fail(`${description} must declare a metadata-only status and at least one blocking issue URL`);
      }
      if (product.views !== undefined) fail(`${description} must not configure row views`);
      continue;
    }

    if (product.productType === SYNTACTIC_CONTEXT_PRODUCT_TYPE) {
      if (product.publication.status !== 'published' || product.views !== undefined) {
        fail(`${description} must publish its syntax context without generic row views`);
      }
      validateSyntacticContextConfiguration(product.syntaxContext, description);
      continue;
    }

    if (product.publication.status !== 'published' || !Array.isArray(product.views) || product.views.length === 0) {
      fail(`${description} must publish at least one row view`);
    }
    const viewIds = new Set();
    for (const [viewIndex, view] of product.views.entries()) {
      validateView(view, `${description}.views[${viewIndex}]`);
      validateDerivation(view.derivation, `${description}.views[${viewIndex}]`);
      if (viewIds.has(view.id)) {
        fail(`${description}.views must use unique ids`);
      }
      viewIds.add(view.id);
    }

    if (product.wordformProfile !== undefined) {
      if (product.contractId !== BLKT_PRODUCT_ID || product.productType !== 'chunked-comparison') {
        fail(`${description}.wordformProfile is only valid for the reviewed BLKT comparison product`);
      }
      validateBlktWordformProfile(product.wordformProfile, `${description}.wordformProfile`);
      if (!viewIds.has(product.wordformProfile.viewId)) {
        fail(`${description}.wordformProfile must reference a published view`);
      }
      const lookupView = product.views.find((view) => view.id === product.wordformProfile.viewId);
      if (lookupView.chunkBytes > 65536) {
        fail(`${description}.wordformProfile view chunks must not exceed 65536 bytes`);
      }
    }

    if (product.analysisProfiles !== undefined) {
      if (!Array.isArray(product.analysisProfiles)) fail(`${description}.analysisProfiles must be an array when present`);
      const profileIds = new Set();
      for (const [profileIndex, profile] of product.analysisProfiles.entries()) {
        validateAnalysisProfile(profile, `${description}.analysisProfiles[${profileIndex}]`);
        if (profileIds.has(profile.id)) fail(`${description}.analysisProfiles uses duplicate ids`);
        if (profile.type === 'ccll-genre-wordform-lookup') {
          for (const source of profile.sources) {
            if (!product.views.some((view) => view.sourceRole === source.sourceRole)) {
              fail(`${description}.analysisProfiles[${profileIndex}] must use only source roles exposed by row views`);
            }
          }
        } else if (!product.views.some((view) => view.sourceRole === profile.sourceRole)) {
          fail(`${description}.analysisProfiles[${profileIndex}] must use a source role exposed by a row view`);
        }
        profileIds.add(profile.id);
      }
    }
  }
  return plan;
}

function validateContractManifest(manifest) {
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 1 || !Array.isArray(manifest.contracts)) {
    fail('source contract manifest must use schemaVersion 1 and contain contracts');
  }
  if (Object.hasOwn(manifest, 'sourceRepository')) {
    fail('source contract manifest must not disclose a source repository');
  }
  return manifest;
}

function publicSourceFile(file) {
  return {
    ...(file.role ? { role: file.role } : {}),
    ...(file.volume ? { volume: file.volume } : {}),
    artifactId: file.artifactId,
    format: file.format ?? 'text',
    bytes: file.bytes,
    sha256: file.sha256,
    ...(file.pages === undefined ? {} : { pages: file.pages }),
    ...(file.rows === undefined ? {} : { rows: file.rows }),
    ...(file.columns === undefined ? {} : { columns: file.columns }),
    ...(file.delimiter === undefined ? {} : { delimiter: file.delimiter }),
    ...(file.hasHeader === undefined ? {} : { hasHeader: file.hasHeader }),
    ...(file.conlluSummary === undefined ? {} : { conlluSummary: file.conlluSummary })
  };
}

function publicProductProvenance(contract) {
  const publicationNotices = contract.id === RIMKUTE_PRODUCT_ID ? {
    permission: contract.source.permission,
    attributionNotice: contract.source.attributionNotice,
    modificationNotice: contract.source.modificationNotice,
    downstreamRequirements: contract.source.downstreamRequirements,
    extraction: contract.source.extraction
  } : {};
  return {
    sourceUrl: contract.source.sourceUrl,
    licence: contract.source.licence,
    citation: contract.source.citation,
    files: contract.source.files.map(publicSourceFile),
    ...publicationNotices
  };
}

function publicFileNotice(productId) {
  if (productId === BLKT_PRODUCT_ID) return BLKT_FILE_NOTICE;
  if (productId === RIMKUTE_PRODUCT_ID) return RIMKUTE_FILE_NOTICE;
  return null;
}

function assertRimkutePublicationContract(contract, contractProduct) {
  if (contract.id !== RIMKUTE_PRODUCT_ID) return;
  const extraction = contract.source.extraction;
  const canonicalSource = contract.source.files.find((file) => file.role === 'morphemic-entries');
  const summaryArtifact = contract.source.files.find((file) => file.artifactId === 'rimkute-morphemic-dictionary-extraction-summary');
  const expectedArtifactIds = [
    'rimkute-morphemic-dictionary-volume-one',
    'rimkute-morphemic-dictionary-volume-two',
    'rimkute-morphemic-dictionary-volume-three',
    'rimkute-morphemic-dictionary-entries',
    'rimkute-morphemic-dictionary-extraction-summary'
  ];
  const extractionIsValid = isPlainObject(extraction)
    && sameObject(extraction.method, RIMKUTE_METHOD)
    && isPlainObject(extraction.runtime) && extraction.runtime.python === '3.12.13'
    && extraction.runtime.popplerPdftotext === '26.05.0'
    && Number.isSafeInteger(extraction.rows) && extraction.rows > 0
    && Number.isSafeInteger(extraction.frequencyTotal) && extraction.frequencyTotal > 0
    && Array.isArray(extraction.volumes) && extraction.volumes.length === 3
    && extraction.volumes.every((volume, index) => isPlainObject(volume)
      && volume.volume === ['I', 'II', 'III'][index]
      && Number.isSafeInteger(volume.rows) && volume.rows > 0
      && Number.isSafeInteger(volume.frequencyTotal) && volume.frequencyTotal > 0)
    && extraction.volumes.reduce((total, volume) => total + volume.rows, 0) === extraction.rows
    && extraction.volumes.reduce((total, volume) => total + volume.frequencyTotal, 0) === extraction.frequencyTotal
    && Array.isArray(extraction.representativeSamples) && extraction.representativeSamples.length >= 3
    && extraction.representativeSamples.every((sample) => isPlainObject(sample)
      && Object.keys(sample).sort().join(',') === [...RIMKUTE_COLUMNS].sort().join(',')
      && normalizeString(sample.wordform) && Number.isSafeInteger(sample.frequency) && sample.frequency > 0
      && normalizeString(sample.morphemic_analysis) && normalizeString(sample.lemma_and_morphology)
      && ['I', 'II', 'III'].includes(sample.volume) && Number.isSafeInteger(sample.source_page) && sample.source_page > 0)
    && isPlainObject(extraction.summaryArtifact)
    && extraction.summaryArtifact.artifactId === 'rimkute-morphemic-dictionary-extraction-summary'
    && extraction.summaryArtifact.format === 'rimkute-extraction-summary'
    && Number.isSafeInteger(extraction.summaryArtifact.bytes) && extraction.summaryArtifact.bytes > 0
    && typeof extraction.summaryArtifact.sha256 === 'string' && /^[a-f0-9]{64}$/.test(extraction.summaryArtifact.sha256);
  if (contract.decision !== 'publish-rightsholder-permission'
    || contractProduct.productType !== 'chunked-lexical-collection'
    || contractProduct.publication.status !== 'published'
    || contract.source.licence !== RIMKUTE_RIGHTS.licence
    || !sameObject(contract.source.permission, RIMKUTE_RIGHTS.permission)
    || contract.source.attributionNotice !== RIMKUTE_RIGHTS.attributionNotice
    || contract.source.modificationNotice !== RIMKUTE_RIGHTS.modificationNotice
    || !sameObject(contract.source.downstreamRequirements, RIMKUTE_RIGHTS.downstreamRequirements)) {
    fail(`${RIMKUTE_PRODUCT_ID} must retain the reviewed rightsholder-permission record and publish as a chunked lexical collection`);
  }
  if (!extractionIsValid || contract.source.files.length !== expectedArtifactIds.length
    || new Set(contract.source.files.map((file) => file.artifactId)).size !== expectedArtifactIds.length
    || expectedArtifactIds.some((artifactId) => !contract.source.files.some((file) => file.artifactId === artifactId))
    || contract.source.files.filter((file) => file.role !== undefined).length !== 1
    || !canonicalSource || !summaryArtifact
    || canonicalSource.artifactId !== 'rimkute-morphemic-dictionary-entries'
    || canonicalSource.format !== 'text' || canonicalSource.rows !== extraction.rows
    || canonicalSource.columns !== RIMKUTE_COLUMNS.length || canonicalSource.delimiter !== '\t'
    || canonicalSource.hasHeader !== true || !sameObject(canonicalSource.header, RIMKUTE_COLUMNS)
    || !sameObject(canonicalSource.numericColumns, [1, 5])
    || canonicalSource.numericTotals?.[1] !== extraction.frequencyTotal
    || !sameObject(canonicalSource.samples, extraction.representativeSamples.map((sample) => RIMKUTE_COLUMNS.map((column) => String(sample[column])).join('\t')))
    || summaryArtifact.format !== 'rimkute-extraction-summary'
    || !sameObject(extraction.summaryArtifact, {
      artifactId: summaryArtifact.artifactId,
      format: summaryArtifact.format,
      bytes: summaryArtifact.bytes,
      sha256: summaryArtifact.sha256
    })) {
    fail(`${RIMKUTE_PRODUCT_ID} must pin a reviewed canonical TSV, extraction summary, totals, and representative samples`);
  }
}

function fieldTotals(fields) {
  return Object.fromEntries(fields
    .filter((field) => SUMMARIZED_FIELD_TYPES.has(field.type))
    .map((field) => [field.id, 0]));
}

function fieldNullCounts(fields) {
  return Object.fromEntries(fields
    .filter((field) => field.nullable === true)
    .map((field) => [field.id, 0]));
}

function parseNonNegativeSafeInteger(value, description) {
  const normalized = normalizeString(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(normalized)) {
    fail(`${description} has an invalid integer value: ${JSON.stringify(value)}`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    fail(`${description} has an unsafe integer value: ${JSON.stringify(value)}`);
  }
  return parsed;
}

function parseFieldValue(field, value, sourcePath, lineNumber) {
  if (field.type === 'lexical-entry-details') {
    fail(`${sourcePath} line ${lineNumber} cannot read a structured lexical field directly from a delimited source`);
  }
  if (!NUMERIC_FIELD_TYPES.has(field.type)) {
    if (!normalizeString(value) && field.nullable === true) return null;
    if (!normalizeString(value)) fail(`${sourcePath} line ${lineNumber} has an empty ${field.id} value`);
    return value;
  }
  if (value === '' && field.nullable === true) return null;
  const parsed = parseNonNegativeSafeInteger(value, `${sourcePath} line ${lineNumber} ${field.id}`);
  if (field.type === 'coverage-code' && !Object.hasOwn(field.values, String(parsed))) {
    fail(`${sourcePath} line ${lineNumber} has an unlabelled coverage code: ${parsed}`);
  }
  return parsed;
}

function chunkPrefix(productId, viewId, chunkNumber, notice = null) {
  return `{"schemaVersion":1,"productId":${JSON.stringify(productId)},"viewId":${JSON.stringify(viewId)},"chunk":${chunkNumber}${notice === null ? '' : `,"notice":${JSON.stringify(notice)}`},"records":[`;
}

function rangeRoutingPage(productId, viewId, pageNumber, chunks) {
  return {
    schemaVersion: 1,
    productId,
    viewId,
    page: pageNumber,
    notice: BLKT_FILE_NOTICE,
    chunks
  };
}

async function writeRangeRoutingPages({ productId, viewDirectory, viewId, chunks, maxPageBytes }) {
  const routingDirectory = path.join(viewDirectory, 'routing');
  const pages = [];
  let pageNumber = 0;
  let pageChunks = [];

  async function flushPage() {
    if (pageChunks.length === 0) return;
    const page = rangeRoutingPage(productId, viewId, pageNumber, pageChunks);
    const filename = `${String(pageNumber + 1).padStart(6, '0')}.json`;
    const buffer = await writeCompactJsonWithByteBudget(
      path.join(routingDirectory, filename),
      page,
      maxPageBytes,
      `${productId}/${viewId}/routing/${filename}`
    );
    pages.push({
      file: `routing/${filename}`,
      chunks: pageChunks.length,
      records: pageChunks.reduce((total, chunk) => total + chunk.records, 0),
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      range: [pageChunks[0].range[0], pageChunks.at(-1).range[1]]
    });
    pageNumber += 1;
    pageChunks = [];
  }

  for (const chunk of chunks) {
    const candidate = rangeRoutingPage(productId, viewId, pageNumber, [...pageChunks, chunk]);
    const candidateBytes = Buffer.byteLength(`${JSON.stringify(candidate)}\n`, 'utf8');
    if (candidateBytes > maxPageBytes && pageChunks.length > 0) await flushPage();
    const singleCandidate = rangeRoutingPage(productId, viewId, pageNumber, [...pageChunks, chunk]);
    if (Buffer.byteLength(`${JSON.stringify(singleCandidate)}\n`, 'utf8') > maxPageBytes) {
      fail(`${productId}/${viewId} chunk descriptor cannot fit in the ${maxPageBytes}-byte routing-page budget`);
    }
    pageChunks.push(chunk);
  }
  await flushPage();
  return {
    type: 'range-pages',
    maxPageBytes,
    pages
  };
}

function sourceDisplayName(sourceFile) {
  return `source artifact "${sourceFile.artifactId}"`;
}

function assertContractSummary(sourceFile, fields, summary, sourcePath) {
  const fieldsBySourceColumn = new Map(fields.map((field) => [String(field.sourceColumn), field]));
  for (const [column, expected] of Object.entries(sourceFile.numericTotals ?? {})) {
    const field = fieldsBySourceColumn.get(column);
    if (!field || !SUMMARIZED_FIELD_TYPES.has(field.type)) {
      fail(`${sourcePath} contract total for column ${column} is not represented by a count field`);
    }
    const expectedTotal = Number(expected);
    if (!Number.isSafeInteger(expectedTotal) || summary.numericTotals[field.id] !== expectedTotal) {
      fail(`${sourcePath} total for ${field.id} does not match the source contract`);
    }
  }
  for (const [column, expected] of Object.entries(sourceFile.missingCounts ?? {})) {
    const field = fieldsBySourceColumn.get(column);
    if (!field || field.nullable !== true || summary.nullCounts[field.id] !== expected) {
      fail(`${sourcePath} null count for source column ${column} does not match the source contract`);
    }
  }
  if (summary.sourceRows !== sourceFile.rows) {
    fail(`${sourcePath} row count does not match the source contract`);
  }
}

async function buildChunkedView({ productId, productDirectory, view, sourceFile, sourceResolver }) {
  const sourcePath = await sourceResolver.resolve(sourceFile);
  const sourceDisplayPath = sourceDisplayName(sourceFile);
  const delimiter = sourceFile.delimiter ?? '\t';
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const suffix = ']}\n';
  const chunks = [];
  let chunkNumber = 0;
  let recordJsons = [];
  let recordsBytes = 0;
  let sourceRows = 0;
  const lookupFieldIndex = view.lookup === undefined
    ? -1
    : view.fields.findIndex((field) => field.id === view.lookup.field);
  let previousLookupKey = null;
  let chunkFirstLookupKey = null;
  let chunkLastLookupKey = null;
  const numericTotals = fieldTotals(view.fields);
  const nullCounts = fieldNullCounts(view.fields);
  const fileNotice = publicFileNotice(productId);

  async function flushChunk() {
    if (recordJsons.length === 0) return;
    const serialized = `${chunkPrefix(productId, view.id, chunkNumber, fileNotice)}${recordJsons.join(',')}${suffix}`;
    const buffer = Buffer.from(serialized, 'utf8');
    if (buffer.byteLength > view.chunkBytes) {
      fail(`${productId}/${view.id} chunk ${chunkNumber} exceeds its ${view.chunkBytes}-byte budget`);
    }
    const filename = `${String(chunkNumber + 1).padStart(6, '0')}.json`;
    await writeFile(path.join(chunksDirectory, filename), buffer);
    chunks.push({
      file: `chunks/${filename}`,
      records: recordJsons.length,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      ...(lookupFieldIndex < 0 ? {} : { range: [chunkFirstLookupKey, chunkLastLookupKey] })
    });
    chunkNumber += 1;
    recordJsons = [];
    recordsBytes = 0;
    chunkFirstLookupKey = null;
    chunkLastLookupKey = null;
  }

  const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  let physicalLineNumber = 0;
  for await (const line of lines) {
    physicalLineNumber += 1;
    if (sourceFile.hasHeader === true && physicalLineNumber === 1) continue;
    sourceRows += 1;
    const values = parseDelimitedLine(line, delimiter);
    if (values.length !== sourceFile.columns) {
      fail(`${sourceDisplayPath} line ${sourceRows} has ${values.length} columns; expected ${sourceFile.columns}`);
    }
    const record = view.fields.map((field) => parseFieldValue(field, values[field.sourceColumn], sourceDisplayPath, sourceRows));
    let lookupKey = null;
    if (lookupFieldIndex >= 0) {
      lookupKey = record[lookupFieldIndex];
      if (typeof lookupKey !== 'string' || lookupKey !== lookupKey.trim().normalize('NFC').toLowerCase()
        || !/^\p{L}{1,64}$/u.test(lookupKey)
        || (previousLookupKey !== null && compareUnicodeCodePoints(previousLookupKey, lookupKey) >= 0)) {
        fail(`${sourceDisplayPath} line ${sourceRows} has an invalid or non-ascending exact lookup key`);
      }
      previousLookupKey = lookupKey;
    }
    for (const [index, field] of view.fields.entries()) {
      const value = record[index];
      if (value === null) {
        nullCounts[field.id] += 1;
      } else if (SUMMARIZED_FIELD_TYPES.has(field.type)) {
        numericTotals[field.id] += value;
      }
    }

    const recordJson = JSON.stringify(record);
    const prefix = chunkPrefix(productId, view.id, chunkNumber, fileNotice);
    const candidateBytes = Buffer.byteLength(prefix) + recordsBytes + (recordJsons.length === 0 ? 0 : 1)
      + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (candidateBytes > view.chunkBytes && recordJsons.length > 0) {
      await flushChunk();
    }
    const currentPrefix = chunkPrefix(productId, view.id, chunkNumber, fileNotice);
    const currentBytes = Buffer.byteLength(currentPrefix) + recordsBytes + (recordJsons.length === 0 ? 0 : 1)
      + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (currentBytes > view.chunkBytes) {
      fail(`${sourceDisplayPath} line ${sourceRows} cannot fit in the ${view.chunkBytes}-byte chunk budget`);
    }
    if (lookupFieldIndex >= 0) {
      chunkFirstLookupKey ??= lookupKey;
      chunkLastLookupKey = lookupKey;
    }
    recordJsons.push(recordJson);
    recordsBytes += (recordJsons.length === 1 ? 0 : 1) + Buffer.byteLength(recordJson);
  }
  await flushChunk();

  const summary = {
    sourceRows,
    recordCount: sourceRows,
    numericTotals,
    nullCounts
  };
  assertContractSummary(sourceFile, view.fields, summary, sourceDisplayPath);
  if (chunks.length === 0) fail(`${sourceDisplayPath} produced no records`);

  const baseIndex = {
    schemaVersion: 1,
    productId,
    viewId: view.id,
    recordEncoding: 'array',
    fields: view.fields,
    ordering: view.ordering,
    sourceFile: publicSourceFile(sourceFile),
    maxChunkBytes: view.chunkBytes,
    ...(fileNotice === null ? {} : { notice: fileNotice }),
    ...(view.lookup === undefined ? {} : { lookup: view.lookup }),
    summary
  };
  if (productId === BLKT_PRODUCT_ID && view.lookup !== undefined) {
    const routing = await writeRangeRoutingPages({
      productId,
      viewDirectory,
      viewId: view.id,
      chunks,
      maxPageBytes: view.lookup.maxIndexBytes
    });
    await writeCompactJsonWithByteBudget(
      path.join(viewDirectory, 'index.json'),
      { ...baseIndex, routing },
      view.lookup.maxIndexBytes,
      `${productId}/${view.id}/index.json`
    );
  } else {
    const index = { ...baseIndex, chunks };
    if (view.lookup === undefined) await writeJson(path.join(viewDirectory, 'index.json'), index);
    else {
      await writeCompactJsonWithByteBudget(
        path.join(viewDirectory, 'index.json'),
        index,
        view.lookup.maxIndexBytes,
        `${productId}/${view.id}/index.json`
      );
    }
  }
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    index: `views/${view.id}/index.json`,
    sourceRole: view.sourceRole,
    recordEncoding: 'array',
    summary
  };
}

async function writeRecordsInChunks({ productId, view, chunksDirectory, records, sourceDisplayPath }) {
  const suffix = ']}\n';
  const chunks = [];
  let chunkNumber = 0;
  let recordJsons = [];
  let recordsBytes = 0;

  async function flushChunk() {
    if (recordJsons.length === 0) return;
    const serialized = `${chunkPrefix(productId, view.id, chunkNumber)}${recordJsons.join(',')}${suffix}`;
    const buffer = Buffer.from(serialized, 'utf8');
    if (buffer.byteLength > view.chunkBytes) {
      fail(`${productId}/${view.id} chunk ${chunkNumber} exceeds its ${view.chunkBytes}-byte budget`);
    }
    const filename = `${String(chunkNumber + 1).padStart(6, '0')}.json`;
    await writeFile(path.join(chunksDirectory, filename), buffer);
    chunks.push({
      file: `chunks/${filename}`,
      records: recordJsons.length,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex')
    });
    chunkNumber += 1;
    recordJsons = [];
    recordsBytes = 0;
  }

  for (const record of records) {
    const recordJson = JSON.stringify(record);
    const candidateBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (candidateBytes > view.chunkBytes && recordJsons.length > 0) await flushChunk();
    const currentBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (currentBytes > view.chunkBytes) {
      fail(`${sourceDisplayPath} produced a record that cannot fit in the ${view.chunkBytes}-byte chunk budget`);
    }
    recordJsons.push(recordJson);
    recordsBytes += (recordJsons.length === 1 ? 0 : 1) + Buffer.byteLength(recordJson);
  }
  await flushChunk();
  return chunks;
}

function assertDerivedFieldLayout(view, expectedFields) {
  if (view.fields.length !== expectedFields.length) {
    fail(`${view.id} has an unexpected derived-field layout`);
  }
  for (const [index, expected] of expectedFields.entries()) {
    const field = view.fields[index];
    if (field.id !== expected.id || field.type !== expected.type || field.derived !== true) {
      fail(`${view.id} has an unexpected derived-field layout`);
    }
  }
}

function buildDerivedViewIndex({ productId, view, sourceFile, summary, chunks }) {
  return {
    schemaVersion: 1,
    productId,
    viewId: view.id,
    recordEncoding: 'array',
    fields: view.fields,
    ordering: view.ordering,
    sourceFile: publicSourceFile(sourceFile),
    derivation: view.derivation,
    maxChunkBytes: view.chunkBytes,
    summary,
    chunks
  };
}

function publicViewDescriptor(view, summary) {
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    index: `views/${view.id}/index.json`,
    sourceRole: view.sourceRole,
    recordEncoding: 'array',
    summary
  };
}

async function buildDerivedNameTransliterationView({ productId, productDirectory, view, sourceFile, sourceResolver }) {
  if (view.derivation?.type !== 'name-transliteration' || sourceFile.hasHeader === true || sourceFile.columns !== 1) {
    fail(`${view.id} requires a one-column, headerless name-transliteration source`);
  }
  assertDerivedFieldLayout(view, [
    { id: 'sourceLeftName', type: 'string' },
    { id: 'sourceParenthesizedName', type: 'string' },
    { id: 'sourceMatchCount', type: 'raw-token-count' }
  ]);
  const sourcePath = await sourceResolver.resolve(sourceFile);
  const sourceDisplayPath = sourceDisplayName(sourceFile);
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const records = [];
  const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  let sourceRows = 0;
  let sourceMatchTotal = 0;
  for await (const line of lines) {
    sourceRows += 1;
    const match = line.match(/^\s*(\d+)\s+(.+?)\s+\((.+)\)\s*$/);
    if (!match) fail(`${sourceDisplayPath} line ${sourceRows} does not match the reviewed name-pair pattern`);
    const sourceLeftName = normalizeString(match[2]);
    const sourceParenthesizedName = normalizeString(match[3]);
    const sourceMatchCount = parseNonNegativeSafeInteger(match[1], `${sourceDisplayPath} line ${sourceRows} sourceMatchCount`);
    if (!sourceLeftName || !sourceParenthesizedName) {
      fail(`${sourceDisplayPath} line ${sourceRows} has an empty name string`);
    }
    sourceMatchTotal += sourceMatchCount;
    records.push([sourceLeftName, sourceParenthesizedName, sourceMatchCount]);
  }
  const expected = view.derivation.expectedSummary;
  if (sourceRows !== sourceFile.rows || sourceRows !== expected.sourceRows
    || records.length !== expected.recordCount || sourceMatchTotal !== expected.totalFrequency) {
    fail(`${sourceDisplayPath} ${view.id} does not match its reviewed derived summary`);
  }
  const chunks = await writeRecordsInChunks({ productId, view, chunksDirectory, records, sourceDisplayPath });
  if (chunks.length === 0) fail(`${sourceDisplayPath} produced no records`);
  const summary = {
    sourceRows,
    recordCount: records.length,
    numericTotals: { sourceMatchCount: sourceMatchTotal },
    nullCounts: {}
  };
  await writeJson(path.join(viewDirectory, 'index.json'), buildDerivedViewIndex({ productId, view, sourceFile, summary, chunks }));
  return publicViewDescriptor(view, summary);
}

function decodeUtf8(buffer, description) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`${description} is not valid UTF-8`);
  }
}

function sourceLines(text) {
  const lines = text.split(/\r?\n/);
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines;
}

async function buildDerivedNvhLexiconView({ productId, productDirectory, view, sourceFile, sourceResolver }) {
  if (view.derivation?.type !== 'nvh-lexicon' || sourceFile.format !== 'nvh') {
    fail(`${view.id} requires an NVH lexical-database source`);
  }
  assertDerivedFieldLayout(view, [
    { id: 'entry', type: 'string' },
    { id: 'details', type: 'lexical-entry-details' }
  ]);
  const sourcePath = await sourceResolver.resolve(sourceFile);
  const sourceDisplayPath = sourceDisplayName(sourceFile);
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const lines = sourceLines(decodeUtf8(await readFile(sourcePath), sourceDisplayPath));
  const records = [];
  let current = null;
  let currentSense = null;
  let senseCount = 0;
  let definitionCount = 0;
  let exampleCount = 0;

  function finishEntry() {
    if (!current) return;
    if (!current.source || current.senses.length === 0 || current.entryCompilers.length === 0) {
      fail(`${sourceDisplayPath} entry ${JSON.stringify(current.entry)} is missing reviewed lexical metadata`);
    }
    const source = {
      name: current.source.name || null,
      date: current.source.date || null,
      url: current.source.url || null
    };
    const details = {
      source,
      senses: current.senses,
      userGroups: current.userGroups,
      variants: current.variants,
      entryCompilers: current.entryCompilers
    };
    senseCount += details.senses.length;
    definitionCount += details.senses.reduce((total, sense) => total + sense.definitions.length, 0);
    exampleCount += details.senses.reduce((total, sense) => total + sense.examples.length, 0);
    records.push([current.entry, details]);
    current = null;
    currentSense = null;
  }

  for (const [lineIndex, line] of lines.entries()) {
    const lineNumber = lineIndex + 1;
    const match = line.match(/^( *)([A-Za-z_]+):(.*)$/);
    if (!match) fail(`${sourceDisplayPath} line ${lineNumber} has an unsupported NVH structure`);
    const indentation = match[1].length;
    const key = match[2];
    const value = normalizeString(match[3]);
    if (indentation === 0) {
      if (key !== 'entry' || !value) fail(`${sourceDisplayPath} line ${lineNumber} has an invalid entry`);
      finishEntry();
      current = {
        entry: value,
        source: null,
        senses: [],
        userGroups: [],
        variants: [],
        entryCompilers: []
      };
      continue;
    }
    if (!current) fail(`${sourceDisplayPath} line ${lineNumber} appears before an entry`);
    if (indentation === 2) {
      if (key === 'source_name') {
        if (current.source) fail(`${sourceDisplayPath} line ${lineNumber} has an invalid source name`);
        current.source = { name: value, date: '', url: '', dateSeen: false, urlSeen: false };
      } else if (key === 'sense') {
        currentSense = { label: value || null, definitions: [], examples: [] };
        current.senses.push(currentSense);
      } else if (key === 'user_group') {
        if (value) current.userGroups.push(value);
      } else if (key === 'variant') {
        if (value) current.variants.push(value);
      } else if (key === 'entry_compiler') {
        if (value) current.entryCompilers.push(value);
      } else {
        fail(`${sourceDisplayPath} line ${lineNumber} has an unsupported entry field ${key}`);
      }
      continue;
    }
    if (indentation === 4) {
      if (key === 'source_date') {
        if (!current.source || current.source.dateSeen) fail(`${sourceDisplayPath} line ${lineNumber} has an invalid source date`);
        current.source.date = value;
        current.source.dateSeen = true;
      } else if (key === 'source_URL') {
        if (!current.source || current.source.urlSeen) fail(`${sourceDisplayPath} line ${lineNumber} has an invalid source URL`);
        current.source.url = value;
        current.source.urlSeen = true;
      } else if (key === 'definition') {
        if (!currentSense || !value) fail(`${sourceDisplayPath} line ${lineNumber} has an invalid definition`);
        currentSense.definitions.push(value);
      } else if (key === 'example') {
        if (!currentSense) fail(`${sourceDisplayPath} line ${lineNumber} has an invalid example`);
        currentSense.examples.push(value || null);
      } else {
        fail(`${sourceDisplayPath} line ${lineNumber} has an unsupported nested field ${key}`);
      }
      continue;
    }
    fail(`${sourceDisplayPath} line ${lineNumber} has unsupported indentation`);
  }
  finishEntry();

  const expected = view.derivation.expectedSummary;
  if (lines.length !== sourceFile.rows || lines.length !== expected.sourceRows || records.length !== expected.recordCount
    || senseCount !== expected.senseCount || definitionCount !== expected.definitionCount || exampleCount !== expected.exampleCount) {
    fail(`${sourceDisplayPath} ${view.id} does not match its reviewed derived summary`);
  }
  const chunks = await writeRecordsInChunks({ productId, view, chunksDirectory, records, sourceDisplayPath });
  if (chunks.length === 0) fail(`${sourceDisplayPath} produced no records`);
  const summary = {
    sourceRows: lines.length,
    recordCount: records.length,
    numericTotals: {},
    nullCounts: {}
  };
  await writeJson(path.join(viewDirectory, 'index.json'), buildDerivedViewIndex({ productId, view, sourceFile, summary, chunks }));
  return publicViewDescriptor(view, summary);
}

function assertDerivedConlluView(view, sourceFile) {
  if (sourceFile.format !== 'zip-conllu' || !isPlainObject(sourceFile.conlluSummary)) {
    fail(`${view.id} requires a zip-conllu source file and reviewed summary`);
  }
  for (const field of ['integerTokenRows', 'nonPunctuationRows', 'sentences', 'uncompressedBytes']) {
    asSafeInteger(sourceFile.conlluSummary[field], `${view.id} source ${field}`);
  }
  if (!/^[a-f0-9]{64}$/.test(sourceFile.conlluSummary.sha256)) {
    fail(`${view.id} source conlluSummary.sha256 must be a SHA-256 checksum`);
  }
  if (!view.derivation || view.derivation.type !== 'conllu-frequency') {
    fail(`${view.id} requires a conllu-frequency derivation`);
  }
  const countField = view.fields.at(-1);
  if (view.fields.length !== 3 || countField?.derived !== true || !SUMMARIZED_FIELD_TYPES.has(countField.type)) {
    fail(`${view.id} must expose lexical value, Universal POS, and one derived count`);
  }
}

function compareFrequencyEntries(left, right) {
  if (left.count !== right.count) return right.count - left.count;
  if (left.key !== right.key) return left.key < right.key ? -1 : 1;
  return left.universalPos < right.universalPos ? -1 : left.universalPos > right.universalPos ? 1 : 0;
}

async function buildDerivedConlluFrequencyView({ productId, productDirectory, view, sourceFile, sourceResolver }) {
  assertDerivedConlluView(view, sourceFile);
  const sourcePath = await sourceResolver.resolve(sourceFile);
  const sourceDisplayPath = sourceDisplayName(sourceFile);
  const archiveMember = await onlyArchiveMemberWithSuffix(sourcePath, sourceDisplayPath, '.conllu');
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const child = spawn('unzip', ['-p', sourcePath, archiveMember], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const childExit = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  let unzipError = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { unzipError += chunk; });

  const archiveHash = createHash('sha256');
  let archiveBytes = 0;
  child.stdout.on('data', (chunk) => {
    archiveHash.update(chunk);
    archiveBytes += chunk.byteLength;
  });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const excludedUniversalPos = new Set(view.derivation.excludeUniversalPos);
  const entries = new Map();
  let integerTokenRows = 0;
  let nonPunctuationRows = 0;
  let sentences = 0;

  for await (const line of lines) {
    if (line.startsWith('# sent_id = ')) {
      sentences += 1;
      continue;
    }
    if (line === '' || line.startsWith('#')) continue;
    const values = line.split('\t');
    if (values.length !== 10) fail(`${sourceDisplayPath} has a malformed CoNLL-U row`);
    if (!/^\d+$/.test(values[0])) continue;
    integerTokenRows += 1;
    const universalPos = normalizeString(values[3]) || view.derivation.missingUniversalPos;
    if (excludedUniversalPos.has(universalPos)) continue;
    const key = normalizeString(view.derivation.key === 'lemma' ? values[2] : values[1]);
    if (!key) fail(`${sourceDisplayPath} has an empty ${view.derivation.key} at token row ${integerTokenRows}`);
    nonPunctuationRows += 1;
    const aggregateKey = `${key}\u0000${universalPos}`;
    entries.set(aggregateKey, {
      key,
      universalPos,
      count: (entries.get(aggregateKey)?.count ?? 0) + 1
    });
  }
  const exitCode = await childExit;
  if (exitCode !== 0) fail(`could not read a reviewed CoNLL-U member from ${sourceDisplayPath}: ${unzipError.trim()}`);

  const conlluSummary = sourceFile.conlluSummary;
  if (archiveBytes !== conlluSummary.uncompressedBytes || archiveHash.digest('hex') !== conlluSummary.sha256
    || integerTokenRows !== conlluSummary.integerTokenRows || sentences !== conlluSummary.sentences
    || nonPunctuationRows !== conlluSummary.nonPunctuationRows) {
    fail(`${sourceDisplayPath} CoNLL-U archive member does not match its reviewed summary`);
  }

  const records = [...entries.values()].sort(compareFrequencyEntries)
    .map((entry) => [entry.key, entry.universalPos, entry.count]);
  const expected = view.derivation.expectedSummary;
  const totalFrequency = records.reduce((total, record) => total + record.at(-1), 0);
  if (nonPunctuationRows !== expected.sourceRows || records.length !== expected.recordCount || totalFrequency !== expected.totalFrequency) {
    fail(`${sourceDisplayPath} ${view.id} does not match its reviewed derived summary`);
  }

  const suffix = ']}\n';
  const chunks = [];
  let chunkNumber = 0;
  let recordJsons = [];
  let recordsBytes = 0;
  async function flushChunk() {
    if (recordJsons.length === 0) return;
    const serialized = `${chunkPrefix(productId, view.id, chunkNumber)}${recordJsons.join(',')}${suffix}`;
    const buffer = Buffer.from(serialized, 'utf8');
    if (buffer.byteLength > view.chunkBytes) fail(`${productId}/${view.id} chunk ${chunkNumber} exceeds its ${view.chunkBytes}-byte budget`);
    const filename = `${String(chunkNumber + 1).padStart(6, '0')}.json`;
    await writeFile(path.join(chunksDirectory, filename), buffer);
    chunks.push({
      file: `chunks/${filename}`,
      records: recordJsons.length,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex')
    });
    chunkNumber += 1;
    recordJsons = [];
    recordsBytes = 0;
  }
  for (const record of records) {
    const recordJson = JSON.stringify(record);
    const candidateBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (candidateBytes > view.chunkBytes && recordJsons.length > 0) await flushChunk();
    const currentBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (currentBytes > view.chunkBytes) fail(`${sourceDisplayPath} ${view.id} produced an oversize record`);
    recordJsons.push(recordJson);
    recordsBytes += (recordJsons.length === 1 ? 0 : 1) + Buffer.byteLength(recordJson);
  }
  await flushChunk();
  if (chunks.length === 0) fail(`${sourceDisplayPath} ${view.id} produced no records`);

  const numericTotals = fieldTotals(view.fields);
  numericTotals[view.fields.at(-1).id] = totalFrequency;
  const summary = {
    sourceRows: nonPunctuationRows,
    recordCount: records.length,
    numericTotals,
    nullCounts: fieldNullCounts(view.fields)
  };
  const index = {
    schemaVersion: 1,
    productId,
    viewId: view.id,
    recordEncoding: 'array',
    fields: view.fields,
    ordering: view.ordering,
    sourceFile: publicSourceFile(sourceFile),
    derivation: view.derivation,
    maxChunkBytes: view.chunkBytes,
    summary,
    chunks
  };
  await writeJson(path.join(viewDirectory, 'index.json'), index);
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    index: `views/${view.id}/index.json`,
    sourceRole: view.sourceRole,
    recordEncoding: 'array',
    summary
  };
}

function findFrequencyBandCoverageFields(profile, views) {
  const matchingViews = views.filter((view) => view.sourceRole === profile.sourceRole);
  if (matchingViews.length !== 1) {
    fail(`${profile.id} requires exactly one row view for source role ${profile.sourceRole}`);
  }
  const sourceView = matchingViews[0];
  const wordFields = sourceView.fields.filter((field) => field.type === 'string');
  const frequencyFields = sourceView.fields.filter((field) => field.type === 'raw-token-count' && field.nullable !== true);
  const coverageFields = sourceView.fields.filter((field) => field.type === 'coverage-code');
  if (wordFields.length !== 1 || frequencyFields.length !== 1 || coverageFields.length !== 1) {
    fail(`${profile.id} requires one word, non-null raw-token-count, and coverage-code field`);
  }
  if (profile.drilldown.ordering.field !== frequencyFields[0].id || profile.drilldown.ordering.direction !== 'descending') {
    fail(`${profile.id} drill-down ordering must use its raw token count in descending order`);
  }
  return {
    sourceView,
    wordField: wordFields[0],
    frequencyField: frequencyFields[0],
    coverageField: coverageFields[0]
  };
}

function findFrequencyBand(bands, frequency) {
  return bands.find((band) => frequency >= band.minimum && (band.maximum === null || frequency <= band.maximum));
}

function compareDrilldownRecords(left, right) {
  if (left.frequency !== right.frequency) return right.frequency - left.frequency;
  return left.word < right.word ? -1 : left.word > right.word ? 1 : 0;
}

function insertDrilldownRecord(records, record, limit) {
  let index = records.findIndex((existing) => compareDrilldownRecords(record, existing) < 0);
  if (index === -1) index = records.length;
  records.splice(index, 0, record);
  if (records.length > limit) records.pop();
}

async function writeJsonWithByteBudget(filename, value, maxBytes, description) {
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
  if (buffer.byteLength > maxBytes) fail(`${description} exceeds its ${maxBytes}-byte budget`);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, buffer);
  return buffer;
}

async function buildFrequencyBandCoverageProfile({ contract, productId, productDirectory, profile, views, sourceResolver }) {
  const { sourceView, wordField, frequencyField, coverageField } = findFrequencyBandCoverageFields(profile, views);
  const filesByRole = new Map(contract.source.files.map((file) => [file.role, file]));
  const sourceFile = filesByRole.get(profile.sourceRole);
  if (!sourceFile) fail(`${profile.id} has no source file with role ${profile.sourceRole}`);
  const sourcePath = await sourceResolver.resolve(sourceFile);
  const sourceDisplayPath = sourceDisplayName(sourceFile);
  const coverageCodes = Object.keys(coverageField.values).map(Number).sort((left, right) => left - right);
  const bands = profile.frequencyBands.map((band) => ({
    ...band,
    typeCount: 0,
    tokenCount: 0,
    categories: new Map(coverageCodes.map((coverageCode) => [coverageCode, {
      coverageCode,
      typeCount: 0,
      tokenCount: 0,
      records: []
    }]))
  }));
  const delimiter = sourceFile.delimiter ?? '\t';
  const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  let physicalLineNumber = 0;
  let sourceRows = 0;
  let totalTokenCount = 0;

  for await (const line of lines) {
    physicalLineNumber += 1;
    if (sourceFile.hasHeader === true && physicalLineNumber === 1) continue;
    sourceRows += 1;
    const values = parseDelimitedLine(line, delimiter);
    if (values.length !== sourceFile.columns) {
      fail(`${sourceDisplayPath} line ${sourceRows} has ${values.length} columns; expected ${sourceFile.columns}`);
    }
    const word = normalizeString(values[wordField.sourceColumn]);
    if (!word) fail(`${sourceDisplayPath} line ${sourceRows} has an empty ${wordField.id} value`);
    const frequency = parseFieldValue(frequencyField, values[frequencyField.sourceColumn], sourceDisplayPath, sourceRows);
    const coverageCode = parseFieldValue(coverageField, values[coverageField.sourceColumn], sourceDisplayPath, sourceRows);
    if (!Number.isSafeInteger(frequency) || frequency < 1 || !Number.isSafeInteger(coverageCode)) {
      fail(`${sourceDisplayPath} line ${sourceRows} has an invalid frequency-band profile record`);
    }
    const band = findFrequencyBand(bands, frequency);
    if (!band) fail(`${sourceDisplayPath} line ${sourceRows} has a frequency outside the configured bands`);
    const category = band.categories.get(coverageCode);
    if (!category) fail(`${sourceDisplayPath} line ${sourceRows} has an unlabelled coverage code`);
    band.typeCount += 1;
    band.tokenCount += frequency;
    category.typeCount += 1;
    category.tokenCount += frequency;
    totalTokenCount += frequency;
    insertDrilldownRecord(category.records, { word, frequency }, profile.drilldown.limit);
  }

  const expectedTokenTotal = Number(sourceFile.numericTotals?.[frequencyField.sourceColumn]);
  if (sourceRows !== sourceFile.rows || !Number.isSafeInteger(expectedTokenTotal) || totalTokenCount !== expectedTokenTotal) {
    fail(`${profile.id} does not reconcile with ${sourceDisplayPath}`);
  }

  const profileDirectory = path.join(productDirectory, 'analysis', profile.id);
  const drilldownDirectory = path.join(profileDirectory, 'drilldowns');
  const drilldownFields = [
    { id: wordField.id, label: wordField.label, type: 'string' },
    { id: frequencyField.id, label: frequencyField.label, type: 'raw-token-count', unit: frequencyField.unit }
  ];
  const summaryBands = [];
  for (const band of bands) {
    const categories = [];
    for (const coverageCode of coverageCodes) {
      const category = band.categories.get(coverageCode);
      const filename = `${band.id}-${coverageCode}.json`;
      const drilldown = {
        schemaVersion: 1,
        productId,
        profileId: profile.id,
        bandId: band.id,
        coverageCode,
        recordEncoding: 'array',
        fields: drilldownFields,
        ordering: profile.drilldown.ordering,
        records: category.records.map((record) => [record.word, record.frequency])
      };
      const buffer = await writeJsonWithByteBudget(
        path.join(drilldownDirectory, filename),
        drilldown,
        profile.drilldown.maxBytes,
        `${productId}/${profile.id}/${filename}`
      );
      categories.push({
        coverageCode,
        typeCount: category.typeCount,
        tokenCount: category.tokenCount,
        drilldown: {
          file: `drilldowns/${filename}`,
          records: category.records.length,
          bytes: buffer.byteLength,
          sha256: createHash('sha256').update(buffer).digest('hex')
        }
      });
    }
    summaryBands.push({
      id: band.id,
      label: band.label,
      minimum: band.minimum,
      maximum: band.maximum,
      typeCount: band.typeCount,
      tokenCount: band.tokenCount,
      categories
    });
  }

  const manifest = {
    schemaVersion: 1,
    productId,
    profileId: profile.id,
    profileType: profile.type,
    title: profile.title,
    description: profile.description,
    sourceView: {
      id: sourceView.id,
      sourceRole: profile.sourceRole,
      wordField: { id: wordField.id, label: wordField.label },
      frequencyField: { id: frequencyField.id, label: frequencyField.label, unit: frequencyField.unit },
      coverageField: { id: coverageField.id, label: coverageField.label, values: coverageField.values }
    },
    provenance: {
      sourceUrl: contract.source.sourceUrl,
      licence: contract.source.licence,
      citation: contract.source.citation,
      sourceFile: publicSourceFile(sourceFile)
    },
    drilldown: {
      limit: profile.drilldown.limit,
      maxBytes: profile.drilldown.maxBytes,
      recordEncoding: 'array',
      fields: drilldownFields,
      ordering: profile.drilldown.ordering
    },
    delivery: {
      summaryMaxBytes: profile.summaryMaxBytes
    },
    summary: {
      sourceRows,
      totalTypeCount: sourceRows,
      totalTokenCount,
      bands: summaryBands
    }
  };
  await writeJsonWithByteBudget(
    path.join(profileDirectory, 'manifest.json'),
    manifest,
    profile.summaryMaxBytes,
    `${productId}/${profile.id}/manifest.json`
  );
  return {
    id: profile.id,
    type: profile.type,
    title: profile.title,
    description: profile.description,
    manifest: `analysis/${profile.id}/manifest.json`
  };
}

function normalizeLookupWord(value) {
  const word = normalizeString(value);
  return word ? word.normalize('NFC').toLocaleUpperCase('lt-LT') : '';
}

function publicNormalizedMetricField(field) {
  return {
    id: field.id,
    label: field.label,
    type: field.type,
    unit: field.unit,
    nullable: field.nullable === true,
    normalization: field.normalization
  };
}

function findNormalizedContrastLookupFields(profile, views) {
  const matchingViews = views.filter((view) => view.sourceRole === profile.sourceRole);
  if (matchingViews.length !== 1) {
    fail(`${profile.id} requires exactly one row view for source role ${profile.sourceRole}`);
  }
  const sourceView = matchingViews[0];
  const wordFields = sourceView.fields.filter((field) => field.type === 'string');
  if (wordFields.length !== 1) fail(`${profile.id} requires exactly one word field`);
  const fieldsById = new Map(sourceView.fields.map((field) => [field.id, field]));
  const usedFields = new Set();
  const sources = profile.sources.map((source) => {
    const tokenField = fieldsById.get(source.tokenField);
    const documentField = fieldsById.get(source.documentField);
    if (!tokenField || !documentField || tokenField.type !== 'normalized-token-count'
      || documentField.type !== 'normalized-document-count' || tokenField.nullable !== true
      || documentField.nullable !== true || tokenField.normalization.sourceTokens !== documentField.normalization.sourceTokens
      || tokenField.normalization.targetTokens !== documentField.normalization.targetTokens
      || usedFields.has(tokenField.id) || usedFields.has(documentField.id)) {
      fail(`${profile.id} sources must name distinct nullable normalized token and document fields`);
    }
    usedFields.add(tokenField.id);
    usedFields.add(documentField.id);
    return {
      id: source.id,
      label: source.label,
      tokenField,
      documentField
    };
  });
  const targetTokens = sources[0].tokenField.normalization.targetTokens;
  if (sources.some((source) => source.tokenField.normalization.targetTokens !== targetTokens)) {
    fail(`${profile.id} source token measures must share a target denominator`);
  }
  return { sourceView, wordField: wordFields[0], sources, targetTokens };
}

function createLookupNode(id, prefix) {
  return {
    id,
    prefix,
    depth: Array.from(prefix).length,
    childStats: new Map(),
    transitions: new Map(),
    terminalStats: null,
    terminalGroup: null
  };
}

function addLookupStats(existing, payloadBytes) {
  if (!existing) return { records: 1, payloadBytes };
  existing.records += 1;
  existing.payloadBytes += payloadBytes;
  return existing;
}

function lookupPayloadBytes(normalizedWord, sourceRow) {
  return Buffer.byteLength(JSON.stringify([normalizedWord, sourceRow]), 'utf8') + 1;
}

async function scanLookupRoutingNodes({ sourceFile, sourcePath, sourceDisplayPath, wordField, pendingNodes }) {
  const nodesByDepth = new Map();
  for (const node of pendingNodes) {
    const entries = nodesByDepth.get(node.depth) ?? new Map();
    if (entries.has(node.prefix)) fail(`lookup routing has a duplicate pending prefix ${node.prefix}`);
    entries.set(node.prefix, node);
    nodesByDepth.set(node.depth, entries);
  }
  const lines = createInterface({
    input: createReadStream(sourcePath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });
  const delimiter = sourceFile.delimiter ?? '\t';
  let physicalLineNumber = 0;
  let sourceRows = 0;
  for await (const line of lines) {
    physicalLineNumber += 1;
    if (sourceFile.hasHeader === true && physicalLineNumber === 1) continue;
    const values = parseDelimitedLine(line, delimiter);
    if (values.length !== sourceFile.columns) {
      fail(`${sourceDisplayPath} line ${sourceRows + 1} has ${values.length} columns; expected ${sourceFile.columns}`);
    }
    const normalizedWord = normalizeLookupWord(values[wordField.sourceColumn]);
    if (!normalizedWord) fail(`${sourceDisplayPath} line ${sourceRows + 1} has an empty ${wordField.id} value`);
    const characters = Array.from(normalizedWord);
    for (const [depth, nodes] of nodesByDepth) {
      if (characters.length < depth) continue;
      const node = nodes.get(characters.slice(0, depth).join(''));
      if (!node) continue;
      const payloadBytes = lookupPayloadBytes(normalizedWord, sourceRows);
      if (characters.length === depth) {
        node.terminalStats = addLookupStats(node.terminalStats, payloadBytes);
      } else {
        const character = characters[depth];
        node.childStats.set(character, addLookupStats(node.childStats.get(character), payloadBytes));
      }
      break;
    }
    sourceRows += 1;
  }
  if (sourceRows !== sourceFile.rows) {
    fail(`${sourceDisplayPath} row count does not match the source contract while building lookup routing`);
  }
}

function routeLookupBucket(root, normalizedWord) {
  let node = root;
  const characters = Array.from(normalizedWord);
  let index = 0;
  while (true) {
    if (index === characters.length) return node.terminalGroup?.bucket ?? null;
    const transition = node.transitions.get(characters[index]);
    if (!transition) return null;
    if (transition.kind === 'bucket') return transition.bucket;
    node = transition.node;
    index += 1;
  }
}

async function buildLookupRouting({ sourceFile, sourcePath, sourceDisplayPath, wordField, profile }) {
  const payloadBudget = profile.lookup.maxBucketBytes - 2048;
  if (payloadBudget < 1024) fail(`${profile.id} lookup bucket budget leaves no usable payload`);
  const root = createLookupNode(0, '');
  const nodes = [root];
  const leafGroups = [];
  let pendingNodes = [root];

  while (pendingNodes.length > 0) {
    await scanLookupRoutingNodes({ sourceFile, sourcePath, sourceDisplayPath, wordField, pendingNodes });
    const nextNodes = [];
    for (const node of pendingNodes) {
      if (node.terminalStats) {
        if (node.terminalStats.payloadBytes > payloadBudget) {
          fail(`${profile.id} cannot bound the exact lookup bucket for ${node.prefix}`);
        }
        const group = { node, type: 'terminal', character: null, stats: node.terminalStats, bucket: null };
        node.terminalGroup = group;
        leafGroups.push(group);
      }
      for (const [character, stats] of [...node.childStats.entries()].sort(([left], [right]) => left.localeCompare(right, 'lt'))) {
        if (stats.payloadBytes <= payloadBudget) {
          const group = { node, type: 'child', character, stats, bucket: null };
          node.transitions.set(character, { kind: 'bucket', bucket: null, group });
          leafGroups.push(group);
          continue;
        }
        const child = createLookupNode(nodes.length, `${node.prefix}${character}`);
        nodes.push(child);
        node.transitions.set(character, { kind: 'node', node: child });
        nextNodes.push(child);
      }
      node.childStats.clear();
    }
    pendingNodes = nextNodes;
  }

  const buckets = [];
  for (const group of [...leafGroups].sort((left, right) => right.stats.payloadBytes - left.stats.payloadBytes || left.node.prefix.localeCompare(right.node.prefix, 'lt'))) {
    let bucket = buckets.find((candidate) => candidate.payloadBytes + group.stats.payloadBytes <= payloadBudget);
    if (!bucket) {
      bucket = { id: buckets.length, groups: [], payloadBytes: 0, records: 0 };
      buckets.push(bucket);
    }
    bucket.groups.push(group);
    bucket.payloadBytes += group.stats.payloadBytes;
    bucket.records += group.stats.records;
    group.bucket = bucket;
    if (group.type === 'terminal') {
      group.node.terminalGroup = group;
    } else {
      const transition = group.node.transitions.get(group.character);
      transition.bucket = bucket;
    }
  }

  if (buckets.length === 0) fail(`${profile.id} lookup produced no buckets`);
  return { root, nodes, buckets };
}

async function writeCompactJsonWithByteBudget(filename, value, maxBytes, description) {
  const buffer = Buffer.from(`${JSON.stringify(value)}\n`, 'utf8');
  if (buffer.byteLength > maxBytes) fail(`${description} exceeds its ${maxBytes}-byte budget`);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, buffer);
  return buffer;
}

async function writeNormalizedContrastLookupBuckets({
  productId,
  productDirectory,
  profile,
  sourceFile,
  sourcePath,
  sourceDisplayPath,
  sourceView,
  wordField,
  routing
}) {
  const profileDirectory = path.join(productDirectory, 'analysis', profile.id);
  const bucketDirectory = path.join(profileDirectory, 'buckets');
  const temporaryDirectory = path.join(productDirectory, `.lookup-staging-${profile.id}`);
  const delimiter = sourceFile.delimiter ?? '\t';
  const bucketBuffers = new Map();
  const bufferLimit = 32768;
  const temporaryFile = (bucket) => path.join(temporaryDirectory, `${String(bucket.id + 1).padStart(6, '0')}.jsonl`);

  async function flushBucket(bucket) {
    const buffered = bucketBuffers.get(bucket.id);
    if (!buffered?.text) return;
    await appendFile(temporaryFile(bucket), buffered.text, 'utf8');
    bucketBuffers.delete(bucket.id);
  }

  await rm(temporaryDirectory, { recursive: true, force: true });
  await mkdir(temporaryDirectory, { recursive: true });
  const numericTotals = fieldTotals(sourceView.fields);
  const nullCounts = fieldNullCounts(sourceView.fields);
  let sourceRows = 0;
  try {
    const lines = createInterface({
      input: createReadStream(sourcePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    let physicalLineNumber = 0;
    for await (const line of lines) {
      physicalLineNumber += 1;
      if (sourceFile.hasHeader === true && physicalLineNumber === 1) continue;
      const values = parseDelimitedLine(line, delimiter);
      if (values.length !== sourceFile.columns) {
        fail(`${sourceDisplayPath} line ${sourceRows + 1} has ${values.length} columns; expected ${sourceFile.columns}`);
      }
      const record = sourceView.fields.map((field) => parseFieldValue(field, values[field.sourceColumn], sourceDisplayPath, sourceRows + 1));
      for (const [index, field] of sourceView.fields.entries()) {
        const value = record[index];
        if (value === null) {
          nullCounts[field.id] += 1;
        } else if (SUMMARIZED_FIELD_TYPES.has(field.type)) {
          numericTotals[field.id] += value;
        }
      }
      const normalizedWord = normalizeLookupWord(record[sourceView.fields.indexOf(wordField)]);
      if (!normalizedWord) fail(`${sourceDisplayPath} line ${sourceRows + 1} has an empty ${wordField.id} value`);
      const bucket = routeLookupBucket(routing.root, normalizedWord);
      if (!bucket) fail(`${profile.id} has no lookup route for ${normalizedWord}`);
      const recordJson = JSON.stringify([normalizedWord, sourceRows]);
      const appended = `${recordJson}\n`;
      const bytes = Buffer.byteLength(appended, 'utf8');
      const buffered = bucketBuffers.get(bucket.id) ?? { text: '', bytes: 0 };
      if (buffered.bytes + bytes > bufferLimit && buffered.text) {
        bucketBuffers.set(bucket.id, buffered);
        await flushBucket(bucket);
      }
      const next = bucketBuffers.get(bucket.id) ?? { text: '', bytes: 0 };
      next.text += appended;
      next.bytes += bytes;
      bucketBuffers.set(bucket.id, next);
      sourceRows += 1;
    }
    for (const bucket of routing.buckets) await flushBucket(bucket);
    const sourceSummary = { sourceRows, recordCount: sourceRows, numericTotals, nullCounts };
    assertContractSummary(sourceFile, sourceView.fields, sourceSummary, sourceDisplayPath);

    const descriptors = [];
    let uniqueNormalizedWordForms = 0;
    let duplicateNormalizedWordForms = 0;
    let extraDuplicateRows = 0;
    let maxSourceRowsPerWord = 0;
    for (const bucket of routing.buckets) {
      const records = (await readFile(temporaryFile(bucket), 'utf8')).trimEnd().split('\n').map((line) => parseJson(line, `${profile.id} lookup bucket staging record`));
      if (records.length !== bucket.records) {
        fail(`${profile.id} lookup bucket ${bucket.id} does not reconcile with its routing count`);
      }
      const wordOccurrences = new Map();
      for (const record of records) {
        if (!Array.isArray(record) || record.length !== 2 || !normalizeLookupWord(record[0])
          || !Number.isSafeInteger(record[1]) || record[1] < 0 || record[1] >= sourceRows) {
          fail(`${profile.id} lookup bucket ${bucket.id} has an invalid lookup record`);
        }
        const normalizedWord = normalizeLookupWord(record[0]);
        if (normalizedWord !== record[0]) fail(`${profile.id} lookup bucket ${bucket.id} has a non-normalized lookup word`);
        wordOccurrences.set(normalizedWord, (wordOccurrences.get(normalizedWord) ?? 0) + 1);
      }
      for (const occurrences of wordOccurrences.values()) {
        uniqueNormalizedWordForms += 1;
        maxSourceRowsPerWord = Math.max(maxSourceRowsPerWord, occurrences);
        if (occurrences > 1) {
          duplicateNormalizedWordForms += 1;
          extraDuplicateRows += occurrences - 1;
        }
      }
      if (maxSourceRowsPerWord > profile.lookup.maxSourceRowsPerWord) {
        fail(`${profile.id} lookup has more source rows per word than its declared bound`);
      }
      const filename = `${String(bucket.id + 1).padStart(6, '0')}.json`;
      const buffer = await writeCompactJsonWithByteBudget(
        path.join(bucketDirectory, filename),
        {
          schemaVersion: 1,
          productId,
          profileId: profile.id,
          bucketId: bucket.id,
          recordEncoding: 'array',
          records
        },
        profile.lookup.maxBucketBytes,
        `${productId}/${profile.id}/buckets/${filename}`
      );
      descriptors.push({
        id: bucket.id,
        file: `buckets/${filename}`,
        records: records.length,
        bytes: buffer.byteLength,
        sha256: createHash('sha256').update(buffer).digest('hex')
      });
    }
    return {
      sourceSummary,
      lookupSummary: {
        lookupRecords: sourceRows,
        uniqueNormalizedWordForms,
        duplicateNormalizedWordForms,
        extraDuplicateRows,
        maxSourceRowsPerWord
      },
      bucketDescriptors: descriptors
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function buildNormalizedContrastLookupProfile({ contract, productId, productDirectory, profile, views, sourceResolver }) {
  const { sourceView, wordField, sources, targetTokens } = findNormalizedContrastLookupFields(profile, views);
  const filesByRole = new Map(contract.source.files.map((file) => [file.role, file]));
  const sourceFile = filesByRole.get(profile.sourceRole);
  if (!sourceFile) fail(`${profile.id} has no source file with role ${profile.sourceRole}`);
  const sourcePath = await sourceResolver.resolve(sourceFile);
  const sourceDisplayPath = sourceDisplayName(sourceFile);
  const routing = await buildLookupRouting({ sourceFile, sourcePath, sourceDisplayPath, wordField, profile });
  const { sourceSummary, lookupSummary, bucketDescriptors } = await writeNormalizedContrastLookupBuckets({
    productId,
    productDirectory,
    profile,
    sourceFile,
    sourcePath,
    sourceDisplayPath,
    sourceView,
    wordField,
    routing
  });
  const routingNodes = routing.nodes.map((node) => ({
    terminalBucket: node.terminalGroup?.bucket?.id ?? null,
    children: [...node.transitions.entries()]
      .sort(([left], [right]) => left.localeCompare(right, 'lt'))
      .map(([character, transition]) => [character, transition.kind === 'bucket' ? transition.bucket.id : -transition.node.id - 1])
  }));
  const profileDirectory = path.join(productDirectory, 'analysis', profile.id);
  const manifest = {
    schemaVersion: 1,
    productId,
    profileId: profile.id,
    profileType: profile.type,
    title: profile.title,
    description: profile.description,
    sourceView: {
      id: sourceView.id,
      sourceRole: profile.sourceRole,
      index: `views/${sourceView.id}/index.json`,
      fields: sourceView.fields,
      wordField: { id: wordField.id, label: wordField.label },
      summary: sourceSummary
    },
    sources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      tokenField: publicNormalizedMetricField(source.tokenField),
      documentField: publicNormalizedMetricField(source.documentField)
    })),
    contrast: {
      minimumRate: profile.minimumRate,
      unit: sources[0].tokenField.unit,
      targetTokens,
      formula: 'log2(numeratorRate / denominatorRate)',
      pairs: profile.pairs
    },
    provenance: {
      sourceUrl: contract.source.sourceUrl,
      licence: contract.source.licence,
      citation: contract.source.citation,
      sourceFile: publicSourceFile(sourceFile)
    },
    delivery: {
      summaryMaxBytes: profile.summaryMaxBytes,
      lookupBucketMaxBytes: profile.lookup.maxBucketBytes,
      maxSourceRowsPerWord: profile.lookup.maxSourceRowsPerWord
    },
    lookup: {
      normalization: profile.lookup.normalization,
      recordEncoding: 'array',
      fields: [
        { id: 'normalizedWord', label: 'Normalized lookup word form', type: 'string' },
        { id: 'sourceRow', label: 'Zero-based source row', type: 'source-row' }
      ],
      routing: {
        root: 0,
        nodes: routingNodes,
        buckets: bucketDescriptors
      }
    },
    summary: {
      ...lookupSummary,
      sourceRows: sourceSummary.sourceRows
    }
  };
  await writeCompactJsonWithByteBudget(
    path.join(profileDirectory, 'manifest.json'),
    manifest,
    profile.summaryMaxBytes,
    `${productId}/${profile.id}/manifest.json`
  );
  return {
    id: profile.id,
    type: profile.type,
    title: profile.title,
    description: profile.description,
    manifest: `analysis/${profile.id}/manifest.json`
  };
}

function normalizeCcllGenreWordform(value) {
  const word = normalizeString(value);
  return word ? word.normalize('NFC') : '';
}

function ccllGenreRecordPayloadBytes(record) {
  return Buffer.byteLength(JSON.stringify(record), 'utf8') + 1;
}

function compareUnicodeCodePoints(left, right) {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  const length = Math.min(leftCharacters.length, rightCharacters.length);
  for (let index = 0; index < length; index += 1) {
    if (leftCharacters[index] === rightCharacters[index]) continue;
    return leftCharacters[index].codePointAt(0) - rightCharacters[index].codePointAt(0);
  }
  return leftCharacters.length - rightCharacters.length;
}

function findCcllGenreProfileSources(profile, views, contract) {
  const filesByRole = new Map(contract.source.files.map((file) => [file.role, file]));
  return profile.sources.map((source) => {
    const matchingViews = views.filter((view) => view.sourceRole === source.sourceRole);
    if (matchingViews.length !== 1) {
      fail(`${profile.id} requires exactly one row view for source role ${source.sourceRole}`);
    }
    const view = matchingViews[0];
    const wordFields = view.fields.filter((field) => field.type === 'string');
    const countFields = view.fields.filter((field) => field.type === 'raw-token-count');
    if (wordFields.length !== 1 || countFields.length !== 1) {
      fail(`${profile.id} requires one word and one raw token count field for ${source.sourceRole}`);
    }
    const sourceFile = filesByRole.get(source.sourceRole);
    const sourceTokens = Number(sourceFile?.numericTotals?.[String(countFields[0].sourceColumn)]);
    if (!sourceFile || !Number.isSafeInteger(sourceFile.rows) || sourceFile.rows < 1
      || !Number.isSafeInteger(sourceTokens) || sourceTokens < 1) {
      fail(`${profile.id} source ${source.sourceRole} is missing reviewed rows or token totals`);
    }
    return {
      ...source,
      view,
      wordField: wordFields[0],
      countField: countFields[0],
      sourceFile,
      sourceTokens
    };
  });
}

async function collectCcllGenreLookupRecords({ profile, sources, sourceResolver }) {
  const recordsByWord = new Map();
  const sourceRows = {};
  const sourceTokenTotals = {};
  let totalSourceRows = 0;

  for (const [sourceIndex, source] of sources.entries()) {
    const sourcePath = await sourceResolver.resolve(source.sourceFile);
    const sourceDisplayPath = sourceDisplayName(source.sourceFile);
    const delimiter = source.sourceFile.delimiter ?? '\t';
    const lines = createInterface({
      input: createReadStream(sourcePath, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });
    let physicalLineNumber = 0;
    let rows = 0;
    let tokenTotal = 0;
    for await (const line of lines) {
      physicalLineNumber += 1;
      if (source.sourceFile.hasHeader === true && physicalLineNumber === 1) continue;
      rows += 1;
      const values = parseDelimitedLine(line, delimiter);
      if (values.length !== source.sourceFile.columns) {
        fail(`${sourceDisplayPath} line ${rows} has ${values.length} columns; expected ${source.sourceFile.columns}`);
      }
      const word = normalizeCcllGenreWordform(values[source.wordField.sourceColumn]);
      if (!word) fail(`${sourceDisplayPath} line ${rows} has an empty ${source.wordField.id} value`);
      const rawCount = parseFieldValue(source.countField, values[source.countField.sourceColumn], sourceDisplayPath, rows);
      if (!Number.isSafeInteger(rawCount) || rawCount < 1) {
        fail(`${sourceDisplayPath} line ${rows} has a non-positive ${source.countField.id} value`);
      }
      let record = recordsByWord.get(word);
      if (!record) {
        record = [word, ...Array(sources.length).fill(null), 0];
        recordsByWord.set(word, record);
      }
      const countIndex = sourceIndex + 1;
      if (record[countIndex] !== null) {
        fail(`${sourceDisplayPath} repeats the exact normalized wordform ${JSON.stringify(word)}`);
      }
      record[countIndex] = rawCount;
      record[record.length - 1] += 1;
      tokenTotal += rawCount;
    }
    if (rows !== source.sourceFile.rows || tokenTotal !== source.sourceTokens) {
      fail(`${sourceDisplayPath} does not reconcile with its reviewed row or token total`);
    }
    sourceRows[source.id] = rows;
    sourceTokenTotals[source.id] = tokenTotal;
    totalSourceRows += rows;
  }

  const observedGenreCounts = Object.fromEntries(sources.map((_, index) => [String(index + 1), 0]));
  const records = [...recordsByWord.values()];
  for (const record of records) observedGenreCounts[String(record[record.length - 1])] += 1;
  return { records, sourceRows, sourceTokenTotals, totalSourceRows, observedGenreCounts };
}

function createCcllGenreRoutingNode(id, prefix) {
  return { id, prefix, terminal: null, transitions: new Map() };
}

function ccllGenreGroupPayloadBytes(records) {
  return records.reduce((total, record) => total + ccllGenreRecordPayloadBytes(record), 0);
}

function buildCcllGenreLookupRouting({ profile, records }) {
  const payloadBudget = profile.lookup.maxBucketBytes - 2048;
  if (payloadBudget < 1024) fail(`${profile.id} lookup bucket budget leaves no usable payload`);
  const nodes = [];
  const leafGroups = [];
  const buckets = [];

  function createLeafGroup({ node, type, character, groupRecords }) {
    const group = {
      node,
      type,
      character,
      records: groupRecords,
      payloadBytes: ccllGenreGroupPayloadBytes(groupRecords),
      bucket: null
    };
    if (group.payloadBytes > payloadBudget) {
      fail(`${profile.id} cannot bound exact lookup records for ${JSON.stringify(node.prefix)}`);
    }
    leafGroups.push(group);
    return group;
  }

  function createNode(prefix, nodeRecords) {
    const node = createCcllGenreRoutingNode(nodes.length, prefix);
    nodes.push(node);
    const terminalRecords = [];
    const children = new Map();
    const depth = Array.from(prefix).length;
    for (const record of nodeRecords) {
      const characters = Array.from(record[0]);
      if (characters.length === depth) {
        terminalRecords.push(record);
      } else {
        const character = characters[depth];
        const group = children.get(character) ?? [];
        group.push(record);
        children.set(character, group);
      }
    }
    if (terminalRecords.length > 0) {
      node.terminal = createLeafGroup({ node, type: 'terminal', character: null, groupRecords: terminalRecords });
    }
    for (const [character, group] of [...children.entries()].sort(([left], [right]) => compareUnicodeCodePoints(left, right))) {
      if (ccllGenreGroupPayloadBytes(group) <= payloadBudget) {
        node.transitions.set(character, {
          kind: 'group',
          group: createLeafGroup({ node, type: 'child', character, groupRecords: group })
        });
      } else {
        node.transitions.set(character, { kind: 'node', node: createNode(`${prefix}${character}`, group) });
      }
    }
    return node;
  }

  const root = createNode('', records);
  for (const group of [...leafGroups].sort((left, right) => right.payloadBytes - left.payloadBytes
    || compareUnicodeCodePoints(left.node.prefix, right.node.prefix)
    || compareUnicodeCodePoints(left.character ?? '', right.character ?? ''))) {
    let bucket = buckets.find((candidate) => candidate.payloadBytes + group.payloadBytes <= payloadBudget);
    if (!bucket) {
      bucket = { id: buckets.length, groups: [], payloadBytes: 0, records: [], descriptor: null };
      buckets.push(bucket);
    }
    bucket.groups.push(group);
    bucket.payloadBytes += group.payloadBytes;
    for (const record of group.records) bucket.records.push(record);
    group.bucket = bucket;
  }
  if (buckets.length === 0) fail(`${profile.id} lookup produced no buckets`);
  return { root, nodes, buckets };
}

async function writeCcllGenreLookupRouting({ productId, productDirectory, profile, routing }) {
  const profileDirectory = path.join(productDirectory, 'analysis', profile.id);
  const bucketDirectory = path.join(profileDirectory, 'buckets');
  const nodeDirectory = path.join(profileDirectory, 'routing', 'nodes');
  await mkdir(bucketDirectory, { recursive: true });
  await mkdir(nodeDirectory, { recursive: true });

  for (const bucket of routing.buckets) {
    bucket.records.sort((left, right) => compareUnicodeCodePoints(left[0], right[0]));
    const filename = `${String(bucket.id + 1).padStart(6, '0')}.json`;
    const buffer = await writeCompactJsonWithByteBudget(
      path.join(bucketDirectory, filename),
      {
        schemaVersion: 1,
        productId,
        profileId: profile.id,
        bucketId: bucket.id,
        recordEncoding: 'array',
        records: bucket.records
      },
      profile.lookup.maxBucketBytes,
      `${productId}/${profile.id}/buckets/${filename}`
    );
    bucket.descriptor = {
      id: bucket.id,
      file: `buckets/${filename}`,
      records: bucket.records.length,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex')
    };
  }

  for (const node of routing.nodes) {
    node.file = `routing/nodes/${String(node.id + 1).padStart(6, '0')}.json`;
  }
  for (const node of routing.nodes) {
    const filename = path.basename(node.file);
    await writeCompactJsonWithByteBudget(
      path.join(nodeDirectory, filename),
      {
        schemaVersion: 1,
        productId,
        profileId: profile.id,
        nodeId: node.id,
        prefix: node.prefix,
        terminal: node.terminal?.bucket?.descriptor ?? null,
        transitions: [...node.transitions.entries()]
          .sort(([left], [right]) => compareUnicodeCodePoints(left, right))
          .map(([character, transition]) => [
            character,
            transition.kind === 'group'
              ? { bucket: transition.group.bucket.descriptor }
              : { node: { id: transition.node.id, file: transition.node.file } }
          ])
      },
      profile.lookup.maxRoutingNodeBytes,
      `${productId}/${profile.id}/${node.file}`
    );
  }
  return { root: routing.root.file, routingNodeCount: routing.nodes.length, lookupBucketCount: routing.buckets.length };
}

async function buildCcllGenreWordformLookupProfile({ contract, productId, productDirectory, profile, views, sourceResolver }) {
  const sources = findCcllGenreProfileSources(profile, views, contract);
  const joined = await collectCcllGenreLookupRecords({ profile, sources, sourceResolver });
  const routing = buildCcllGenreLookupRouting({ profile, records: joined.records });
  const writtenRouting = await writeCcllGenreLookupRouting({ productId, productDirectory, profile, routing });
  const profileDirectory = path.join(productDirectory, 'analysis', profile.id);
  const manifest = {
    schemaVersion: 1,
    productId,
    profileId: profile.id,
    profileType: profile.type,
    title: profile.title,
    description: profile.description,
    provenance: {
      sourceUrl: contract.source.sourceUrl,
      licence: contract.source.licence,
      citation: contract.source.citation
    },
    sources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      sourceRole: source.sourceRole,
      sourceRows: source.sourceFile.rows,
      sourceTokens: source.sourceTokens,
      sourceFile: publicSourceFile(source.sourceFile),
      view: { id: source.view.id, index: `views/${source.view.id}/index.json` }
    })),
    rate: profile.rate,
    policies: profile.policies,
    delivery: {
      summaryMaxBytes: profile.summaryMaxBytes,
      routingNodeMaxBytes: profile.lookup.maxRoutingNodeBytes,
      lookupBucketMaxBytes: profile.lookup.maxBucketBytes
    },
    lookup: {
      normalization: profile.lookup.normalization,
      recordEncoding: 'array',
      fields: [
        { id: 'word', label: 'Word form', type: 'string' },
        ...sources.map((source) => ({
          id: `${source.id}RawCount`,
          label: `${source.label} raw token count`,
          type: 'raw-token-count',
          unit: 'tokens',
          nullable: true
        })),
        { id: 'observedGenres', label: 'Observed named subcorpora', type: 'observed-genre-count' }
      ],
      root: writtenRouting.root
    },
    summary: {
      joinedWordforms: joined.records.length,
      totalSourceRows: joined.totalSourceRows,
      sourceRows: joined.sourceRows,
      sourceTokenTotals: joined.sourceTokenTotals,
      observedGenreCounts: joined.observedGenreCounts,
      routingNodeCount: writtenRouting.routingNodeCount,
      lookupBucketCount: writtenRouting.lookupBucketCount
    }
  };
  await writeCompactJsonWithByteBudget(
    path.join(profileDirectory, 'manifest.json'),
    manifest,
    profile.summaryMaxBytes,
    `${productId}/${profile.id}/manifest.json`
  );
  return {
    id: profile.id,
    type: profile.type,
    title: profile.title,
    description: profile.description,
    manifest: `analysis/${profile.id}/manifest.json`
  };
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function prefixFor(value, codePoints) {
  const prefix = Array.from(value.toLocaleLowerCase('lt')).slice(0, codePoints).join('');
  return prefix || '_';
}

async function runUnzip(args, description) {
  const child = spawn('unzip', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = [];
  let stderr = '';
  child.stdout.on('data', (chunk) => stdout.push(chunk));
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  if (exitCode !== 0) fail(`could not read ${description}: ${stderr.trim()}`);
  return Buffer.concat(stdout);
}

async function reviewedArchiveMembers(sourcePath, sourceDisplayPath, suffix) {
  const archiveListing = decodeUtf8(
    await runUnzip(['-Z1', sourcePath], sourceDisplayPath),
    `${sourceDisplayPath} archive listing`
  );
  const members = archiveListing.split(/\r?\n/)
    .filter((member) => member.endsWith(suffix) && isSafeRelativePath(member))
    .sort(compareStrings);
  if (members.length === 0) fail(`${sourceDisplayPath} has no reviewed ${suffix} members`);
  return members;
}

async function onlyArchiveMemberWithSuffix(sourcePath, sourceDisplayPath, suffix) {
  const members = await reviewedArchiveMembers(sourcePath, sourceDisplayPath, suffix);
  if (members.length !== 1) fail(`${sourceDisplayPath} must contain exactly one reviewed ${suffix} member`);
  return members[0];
}

function commonDirectoryPrefix(members) {
  const directories = members.map((member) => member.split('/').slice(0, -1));
  const prefix = [];
  for (let index = 0; ; index += 1) {
    const segment = directories[0]?.[index];
    if (!segment || directories.some((directory) => directory[index] !== segment)) break;
    prefix.push(segment);
  }
  return prefix.length === 0 ? '' : `${prefix.join('/')}/`;
}

function assertTreebankSourceFile(sourceFile, configuration) {
  if (sourceFile.format !== 'zip-conllu-treebank' || !isPlainObject(sourceFile.conlluSummary)) {
    fail(`${configuration.sourceRole} requires a zip-conllu-treebank source file and reviewed summary`);
  }
  for (const field of [
    'documents', 'sentences', 'repositorySentenceClaim', 'integerTokenRows',
    'nonPunctuationRows', 'allRelationLabels', 'nonPunctuationRelationLabels',
    'rootRows', 'nonPunctuationRootRows', 'nonRootDependencyRows', 'uncompressedBytes'
  ]) {
    asSafeInteger(sourceFile.conlluSummary[field], `${configuration.sourceRole} source ${field}`);
  }
  if (!/^[a-f0-9]{64}$/.test(sourceFile.conlluSummary.membersSha256)) {
    fail(`${configuration.sourceRole} source conlluSummary.membersSha256 must be a SHA-256 checksum`);
  }
}

function parseConlluDocument({ text, sourceDisplayPath, memberLabel, onSentence }) {
  let comments = [];
  let rows = [];
  let sentenceNumber = 0;
  const finishSentence = () => {
    if (rows.length === 0) {
      comments = [];
      return;
    }
    sentenceNumber += 1;
    const sourceSentenceId = normalizeString(comments.find((line) => line.startsWith('# sent_id = '))?.slice('# sent_id = '.length));
    if (!sourceSentenceId) fail(`${sourceDisplayPath} ${memberLabel} sentence ${sentenceNumber} has no sent_id`);
    const tokens = new Map();
    for (const row of rows) {
      const values = row.split('\t');
      if (values.length !== 10) fail(`${sourceDisplayPath} ${memberLabel} has a malformed CoNLL-U row`);
      if (!/^\d+$/.test(values[0])) continue;
      const [id, form, lemma, universalPos, , , head, relation] = values;
      if (!normalizeString(form) || !normalizeString(lemma) || !normalizeString(universalPos)
        || !normalizeString(head) || !normalizeString(relation) || !/^(?:0|[1-9]\d*)$/.test(head)) {
        fail(`${sourceDisplayPath} ${memberLabel} has an incomplete CoNLL-U token row`);
      }
      tokens.set(Number(id), {
        id: Number(id),
        form: form.trim(),
        lemma: lemma.trim(),
        universalPos: universalPos.trim(),
        head: Number(head),
        relation: relation.trim()
      });
    }
    if (tokens.size === 0) fail(`${sourceDisplayPath} ${memberLabel} sentence ${sourceSentenceId} has no integer-ID tokens`);
    const suppliedText = normalizeString(comments.find((line) => line.startsWith('# text = '))?.slice('# text = '.length));
    const sentenceText = suppliedText || [...tokens.values()].sort((left, right) => left.id - right.id).map((token) => token.form).join(' ');
    onSentence({ sourceSentenceId, tokens, sentenceText });
    comments = [];
    rows = [];
  };

  for (const line of text.split(/\r?\n/)) {
    if (line === '') {
      finishSentence();
    } else if (line.startsWith('#')) {
      comments.push(line);
    } else {
      rows.push(line);
    }
  }
  finishSentence();
}

async function buildDerivedRecordsView({
  productId, productDirectory, sourceFile, view, records, sourceRows, selection
}) {
  const viewDirectory = path.join(productDirectory, 'views', view.id);
  const chunksDirectory = path.join(viewDirectory, 'chunks');
  await mkdir(chunksDirectory, { recursive: true });

  const suffix = ']}\n';
  const chunks = [];
  const numericTotals = fieldTotals(view.fields);
  const nullCounts = fieldNullCounts(view.fields);
  let chunkNumber = 0;
  let recordJsons = [];
  let recordsBytes = 0;
  let chunkSelectionPrefixes = [];

  async function flushChunk() {
    if (recordJsons.length === 0) return;
    const serialized = `${chunkPrefix(productId, view.id, chunkNumber)}${recordJsons.join(',')}${suffix}`;
    const buffer = Buffer.from(serialized, 'utf8');
    if (buffer.byteLength > view.chunkBytes) {
      fail(`${productId}/${view.id} chunk ${chunkNumber} exceeds its ${view.chunkBytes}-byte budget`);
    }
    const filename = `${String(chunkNumber + 1).padStart(6, '0')}.json`;
    await writeFile(path.join(chunksDirectory, filename), buffer);
    chunks.push({
      file: `chunks/${filename}`,
      records: recordJsons.length,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      ...(chunkSelectionPrefixes.length === 0 ? {} : { selectionPrefixes: chunkSelectionPrefixes })
    });
    chunkNumber += 1;
    recordJsons = [];
    recordsBytes = 0;
    chunkSelectionPrefixes = [];
  }

  for (const record of records) {
    if (!Array.isArray(record) || record.length !== view.fields.length) {
      fail(`${productId}/${view.id} produced an invalid record shape`);
    }
    for (const [index, field] of view.fields.entries()) {
      const value = record[index];
      if (NUMERIC_FIELD_TYPES.has(field.type)) {
        if (!Number.isSafeInteger(value) || value < 0) fail(`${productId}/${view.id} produced an invalid ${field.id} value`);
        if (SUMMARIZED_FIELD_TYPES.has(field.type)) numericTotals[field.id] += value;
      } else if (!normalizeString(value)) {
        fail(`${productId}/${view.id} produced an empty ${field.id} value`);
      }
    }
    const recordSelectionPrefix = selection?.prefixForRecord(record);
    if (selection && !normalizeString(recordSelectionPrefix)) {
      fail(`${productId}/${view.id} produced an empty selection prefix`);
    }
    if (recordJsons.length > 0 && selection?.packPrefixes !== true
      && recordSelectionPrefix !== chunkSelectionPrefixes[0]) await flushChunk();
    const recordJson = JSON.stringify(record);
    const candidateBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (candidateBytes > view.chunkBytes && recordJsons.length > 0) await flushChunk();
    const currentBytes = Buffer.byteLength(chunkPrefix(productId, view.id, chunkNumber)) + recordsBytes
      + (recordJsons.length === 0 ? 0 : 1) + Buffer.byteLength(recordJson) + Buffer.byteLength(suffix);
    if (currentBytes > view.chunkBytes) fail(`${productId}/${view.id} produced an oversize record`);
    if (selection && !chunkSelectionPrefixes.includes(recordSelectionPrefix)) {
      chunkSelectionPrefixes.push(recordSelectionPrefix);
    }
    recordJsons.push(recordJson);
    recordsBytes += (recordJsons.length === 1 ? 0 : 1) + Buffer.byteLength(recordJson);
  }
  await flushChunk();
  if (chunks.length === 0) fail(`${productId}/${view.id} produced no records`);

  const summary = {
    sourceRows,
    recordCount: records.length,
    numericTotals,
    nullCounts
  };
  const index = {
    schemaVersion: 1,
    productId,
    viewId: view.id,
    recordEncoding: 'array',
    fields: view.fields,
    ordering: view.ordering,
    sourceFile: publicSourceFile(sourceFile),
    derivation: {
      type: 'conllu-treebank-syntax-context',
      expectedSummary: { sourceRows, recordCount: records.length }
    },
    ...(selection === undefined ? {} : {
      selection: {
        type: 'lemma-prefix',
        field: selection.field,
        codePoints: selection.codePoints
      }
    }),
    maxChunkBytes: view.chunkBytes,
    summary,
    chunks
  };
  await writeJson(path.join(viewDirectory, 'index.json'), index);
  return {
    id: view.id,
    title: view.title,
    description: view.description,
    index: `views/${view.id}/index.json`,
    sourceRole: view.sourceRole,
    recordEncoding: 'array',
    summary
  };
}

function derivedField(id, label, type, unit) {
  return { id, label, type, ...(unit === undefined ? {} : { unit }), derived: true };
}

async function buildSyntacticContextProduct({ contract, contractProduct, sourceResolver, outputRoot }) {
  const configuration = contractProduct.syntaxContext;
  const sourceFiles = contract.source.files.filter((file) => file.role === configuration.sourceRole);
  if (sourceFiles.length !== 1 || contract.source.files.length !== 1) {
    fail(`${contract.id} syntax context must use exactly one reviewed source archive`);
  }
  const sourceFile = sourceFiles[0];
  assertTreebankSourceFile(sourceFile, configuration);
  const sourcePath = await sourceResolver.resolve(sourceFile);
  const sourceDisplayPath = sourceDisplayName(sourceFile);
  const members = await reviewedArchiveMembers(sourcePath, sourceDisplayPath, '.conllu');
  const archivePrefix = commonDirectoryPrefix(members);
  if (!archivePrefix) fail(`${sourceDisplayPath} has no shared reviewed CoNLL-U archive root`);

  const sourceSummary = sourceFile.conlluSummary;
  const expectedGenres = new Map(Object.entries(configuration.genreLabels));
  const observedGenres = new Map();
  const relationCounts = new Map();
  const allRelationLabels = new Set();
  const lemmaStats = new Map();
  const contextRecordsByLemma = new Map();
  const membersHash = createHash('sha256');
  let uncompressedBytes = 0;
  let sentences = 0;
  let integerTokenRows = 0;
  let nonPunctuationRows = 0;
  let rootRows = 0;
  let nonPunctuationRootRows = 0;
  let nonRootDependencyRows = 0;
  let contextRowsOmittedByLimit = 0;
  let contextSequence = 0;

  function lemmaEntry(lemma) {
    const existing = lemmaStats.get(lemma);
    if (existing) return existing;
    const created = { lemma, tokenCount: 0, headEdgeCount: 0, dependentEdgeCount: 0, rootEdgeCount: 0 };
    lemmaStats.set(lemma, created);
    return created;
  }

  function addContext(lemma, record) {
    const entries = contextRecordsByLemma.get(lemma) ?? [];
    if (entries.length >= configuration.maxExamplesPerLemma) {
      contextRowsOmittedByLimit += 1;
      return;
    }
    entries.push({ record, sequence: contextSequence });
    contextSequence += 1;
    contextRecordsByLemma.set(lemma, entries);
  }

  for (const [memberIndex, member] of members.entries()) {
    const memberLabel = `reviewed CoNLL-U document ${memberIndex + 1}`;
    const relativeMember = member.slice(archivePrefix.length);
    const segments = relativeMember.split('/');
    const genreId = segments.slice(0, -1).join('/');
    const document = relativeMember;
    const genre = expectedGenres.get(genreId);
    if (!genre || segments.length < 2) fail(`${sourceDisplayPath} ${memberLabel} has an unreviewed genre`);
    const genreSummary = observedGenres.get(genreId) ?? {
      genreId,
      genre,
      documents: 0,
      sentences: 0,
      integerTokenRows: 0,
      nonPunctuationRows: 0,
      relationshipRows: 0
    };
    genreSummary.documents += 1;
    observedGenres.set(genreId, genreSummary);

    const buffer = await runUnzip(['-p', sourcePath, member], `${sourceDisplayPath} ${memberLabel}`);
    membersHash.update(Buffer.from(member, 'utf8'));
    membersHash.update(Buffer.from([0]));
    membersHash.update(buffer);
    membersHash.update(Buffer.from([0]));
    uncompressedBytes += buffer.byteLength;
    parseConlluDocument({
      text: decodeUtf8(buffer, `${sourceDisplayPath} ${memberLabel}`),
      sourceDisplayPath,
      memberLabel,
      onSentence: ({ sourceSentenceId, tokens, sentenceText }) => {
        sentences += 1;
        genreSummary.sentences += 1;
        for (const token of tokens.values()) {
          integerTokenRows += 1;
          genreSummary.integerTokenRows += 1;
          allRelationLabels.add(token.relation);
          if (token.head === 0) rootRows += 1;
        }
        for (const dependent of tokens.values()) {
          if (dependent.universalPos === 'PUNCT') continue;
          nonPunctuationRows += 1;
          genreSummary.nonPunctuationRows += 1;
          genreSummary.relationshipRows += 1;
          relationCounts.set(dependent.relation, (relationCounts.get(dependent.relation) ?? 0) + 1);
          const dependentEntry = lemmaEntry(dependent.lemma);
          dependentEntry.tokenCount += 1;
          dependentEntry.dependentEdgeCount += 1;
          const baseRecord = {
            relation: dependent.relation,
            dependentLemma: dependent.lemma,
            dependentForm: dependent.form,
            genreId,
            genre,
            document,
            sourceSentenceId,
            sentenceText
          };
          if (dependent.head === 0) {
            nonPunctuationRootRows += 1;
            dependentEntry.rootEdgeCount += 1;
            addContext(dependent.lemma, [
              dependent.lemma, 'root', baseRecord.relation, baseRecord.dependentLemma, baseRecord.dependentForm,
              'ROOT', 'ROOT', baseRecord.genreId, baseRecord.genre, baseRecord.document,
              baseRecord.sourceSentenceId, baseRecord.sentenceText
            ]);
            continue;
          }
          nonRootDependencyRows += 1;
          const head = tokens.get(dependent.head);
          if (!head) fail(`${sourceDisplayPath} ${memberLabel} sentence ${sourceSentenceId} has a missing dependency head`);
          const contextRecord = [
            dependent.lemma, 'dependent', baseRecord.relation, baseRecord.dependentLemma, baseRecord.dependentForm,
            head.lemma, head.form, baseRecord.genreId, baseRecord.genre, baseRecord.document,
            baseRecord.sourceSentenceId, baseRecord.sentenceText
          ];
          addContext(dependent.lemma, contextRecord);
          if (head.universalPos !== 'PUNCT') {
            const headEntry = lemmaEntry(head.lemma);
            headEntry.headEdgeCount += 1;
            addContext(head.lemma, [
              head.lemma, 'head', baseRecord.relation, baseRecord.dependentLemma, baseRecord.dependentForm,
              head.lemma, head.form, baseRecord.genreId, baseRecord.genre, baseRecord.document,
              baseRecord.sourceSentenceId, baseRecord.sentenceText
            ]);
          }
        }
      }
    });
  }

  const nonPunctuationRelationLabels = relationCounts.size;
  const observedSourceSummary = {
    documents: members.length,
    sentences,
    repositorySentenceClaim: sourceSummary.repositorySentenceClaim,
    integerTokenRows,
    nonPunctuationRows,
    allRelationLabels: allRelationLabels.size,
    nonPunctuationRelationLabels,
    rootRows,
    nonPunctuationRootRows,
    nonRootDependencyRows,
    uncompressedBytes
  };
  for (const [field, actual] of Object.entries(observedSourceSummary)) {
    if (sourceSummary[field] !== actual) fail(`${sourceDisplayPath} reviewed treebank ${field} does not match the source archive`);
  }
  if (membersHash.digest('hex') !== sourceSummary.membersSha256) {
    fail(`${sourceDisplayPath} reviewed treebank members do not match the source archive`);
  }
  if (observedGenres.size !== expectedGenres.size || [...expectedGenres.keys()].some((genreId) => !observedGenres.has(genreId))) {
    fail(`${sourceDisplayPath} treebank genres do not match the publication plan`);
  }

  const lemmaRecords = [...lemmaStats.values()]
    .sort((left, right) => compareStrings(left.lemma, right.lemma))
    .map((entry) => [
      entry.lemma, entry.tokenCount, entry.headEdgeCount, entry.dependentEdgeCount,
      entry.rootEdgeCount
    ]);
  const relationRecords = [...relationCounts.entries()]
    .map(([relation, count]) => [relation, count])
    .sort((left, right) => right[1] - left[1] || compareStrings(left[0], right[0]));
  const genreRecords = [...observedGenres.values()]
    .sort((left, right) => compareStrings(left.genreId, right.genreId))
    .map((entry) => [
      entry.genreId, entry.genre, entry.documents, entry.sentences, entry.integerTokenRows,
      entry.nonPunctuationRows, entry.relationshipRows
    ]);
  const contextRecords = [...contextRecordsByLemma.entries()]
    .flatMap(([lemma, entries]) => entries.map(({ record, sequence }) => ({ lemma, record, sequence })))
    .sort((left, right) => compareStrings(prefixFor(left.lemma, configuration.contextPrefixCodePoints), prefixFor(right.lemma, configuration.contextPrefixCodePoints))
      || compareStrings(left.lemma, right.lemma) || left.sequence - right.sequence)
    .map((entry) => entry.record);
  const expectedSummary = configuration.expectedSummary;
  const observedProductSummary = {
    documents: members.length,
    sentences,
    integerTokenRows,
    nonPunctuationRows,
    allRelationLabels: allRelationLabels.size,
    nonPunctuationRelationLabels,
    rootRows,
    nonPunctuationRootRows,
    nonRootDependencyRows,
    lemmaCount: lemmaRecords.length,
    contextRecordCount: contextRecords.length,
    contextRowsOmittedByLimit,
    lemmaIndexPrefixes: new Set(lemmaRecords.map((record) => prefixFor(record[0], configuration.lemmaIndexPrefixCodePoints))).size,
    contextPrefixes: new Set(contextRecords.map((record) => prefixFor(record[0], configuration.contextPrefixCodePoints))).size
  };
  for (const [field, actual] of Object.entries(observedProductSummary)) {
    if (expectedSummary[field] !== actual) fail(`${sourceDisplayPath} syntax context ${field} does not match the publication plan`);
  }

  const productDirectory = path.join(outputRoot, contract.id);
  const chunkBytes = configuration.chunkBytes;
  const views = await Promise.all([
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: nonPunctuationRows,
      view: {
        id: 'relations-by-frequency', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS dependency relations',
        description: 'Frequency of source dependency-relation labels across non-punctuation token rows, including source roots.',
        ordering: { field: 'count', direction: 'descending' }, chunkBytes,
        fields: [
          derivedField('relation', 'Source dependency relation', 'string'),
          derivedField('count', 'Annotated non-punctuation token rows', 'raw-token-count', 'tokens')
        ]
      },
      records: relationRecords
    }),
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: members.length,
      view: {
        id: 'genres-by-source-order', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS source genres',
        description: 'Document, sentence, token, and non-punctuation relation totals for each source genre.',
        ordering: { field: 'genreId', direction: 'ascending' }, chunkBytes,
        fields: [
          derivedField('genreId', 'Source genre identifier', 'string'),
          derivedField('genre', 'Source genre', 'string'),
          derivedField('documents', 'Documents', 'raw-token-count', 'documents'),
          derivedField('sentences', 'Sentence IDs', 'raw-token-count', 'sentences'),
          derivedField('integerTokenRows', 'Integer-ID token rows', 'raw-token-count', 'tokens'),
          derivedField('nonPunctuationRows', 'Non-punctuation token rows', 'raw-token-count', 'tokens'),
          derivedField('relationshipRows', 'Annotated relationship rows', 'raw-token-count', 'tokens')
        ]
      },
      records: genreRecords
    }),
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: nonPunctuationRows,
      selection: {
        field: 'lemma', codePoints: configuration.lemmaIndexPrefixCodePoints,
        prefixForRecord: (record) => prefixFor(record[0], configuration.lemmaIndexPrefixCodePoints),
        packPrefixes: true
      },
      view: {
        id: 'lemmas-by-source-order', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS lemma context index',
        description: 'Every non-punctuation source lemma, with its annotated token count and the number of retained dependency roles.',
        ordering: { field: 'lemma', direction: 'ascending' }, chunkBytes,
        fields: [
          derivedField('lemma', 'Source lemma', 'string'),
          derivedField('tokenCount', 'Non-punctuation token rows', 'raw-token-count', 'tokens'),
          derivedField('headEdgeCount', 'Rows where the lemma is a non-punctuation head', 'raw-token-count', 'relationships'),
          derivedField('dependentEdgeCount', 'Rows where the lemma is the dependent', 'raw-token-count', 'relationships'),
          derivedField('rootEdgeCount', 'Rows where the lemma has source head 0', 'raw-token-count', 'relationships')
        ]
      },
      records: lemmaRecords
    }),
    buildDerivedRecordsView({
      productId: contract.id,
      productDirectory,
      sourceFile,
      sourceRows: contextRecords.length,
      selection: {
        field: 'lemma', codePoints: configuration.contextPrefixCodePoints,
        prefixForRecord: (record) => prefixFor(record[0], configuration.contextPrefixCodePoints),
        packPrefixes: true
      },
      view: {
        id: 'sentence-contexts-by-lemma', sourceRole: configuration.sourceRole,
        title: 'ALKSNIS sentence contexts',
        description: 'Up to the reviewed source-order limit of dependency contexts per non-punctuation lemma; fetch by selected lemma prefix.',
        ordering: { field: 'lemma', direction: 'ascending' }, chunkBytes,
        fields: [
          derivedField('lemma', 'Selected source lemma', 'string'),
          derivedField('direction', 'Selected lemma role', 'string'),
          derivedField('relation', 'Source dependency relation', 'string'),
          derivedField('dependentLemma', 'Dependent source lemma', 'string'),
          derivedField('dependentForm', 'Dependent source form', 'string'),
          derivedField('headLemma', 'Head source lemma or ROOT', 'string'),
          derivedField('headForm', 'Head source form or ROOT', 'string'),
          derivedField('genreId', 'Source genre identifier', 'string'),
          derivedField('genre', 'Source genre', 'string'),
          derivedField('document', 'Source CoNLL-U document', 'string'),
          derivedField('sourceSentenceId', 'Source sentence identifier', 'string'),
          derivedField('sentenceText', 'Source sentence text', 'string')
        ]
      },
      records: contextRecords
    })
  ]);

  const manifest = {
    schemaVersion: 1,
    id: contract.id,
    title: contract.title,
    productType: SYNTACTIC_CONTEXT_PRODUCT_TYPE,
    publication: contractProduct.publication,
    provenance: publicProductProvenance(contract),
    delivery: {
      mode: 'static-prefix-chunked-syntax-context-json',
      constraints: contract.delivery?.constraints ?? []
    },
    syntaxContext: {
      overview: {
        repositorySentenceClaim: sourceSummary.repositorySentenceClaim,
        deliveredSentenceIds: sentences,
        documents: members.length,
        integerTokenRows,
        nonPunctuationRows,
        allRelationLabels: allRelationLabels.size,
        nonPunctuationRelationLabels,
        rootRows,
        nonPunctuationRootRows,
        nonRootDependencyRows
      },
      exclusions: ['UPOS=PUNCT is excluded from the lemma index, relation summary, and contexts.'],
      exampleSelection: {
        maxExamplesPerLemma: configuration.maxExamplesPerLemma,
        order: 'Archive member, sentence, and token source order.',
        omittedRows: contextRowsOmittedByLimit
      },
      lookup: {
        lemmaIndexView: 'lemmas-by-source-order',
        lemmaIndexPrefixCodePoints: configuration.lemmaIndexPrefixCodePoints,
        contextView: 'sentence-contexts-by-lemma',
        contextPrefixCodePoints: configuration.contextPrefixCodePoints,
        directions: ['dependent', 'head', 'root']
      }
    },
    views
  };
  await writeJson(path.join(productDirectory, 'manifest.json'), manifest);
  return {
    id: contract.id,
    title: contract.title,
    productType: manifest.productType,
    publicationStatus: 'published',
    manifest: `${contract.id}/manifest.json`,
    licence: contract.source.licence,
    viewCount: views.length,
    recordCount: null
  };
}

function validateGenericDataset(dataset, filename) {
  if (!isPlainObject(dataset) || dataset.schemaVersion !== 1 || !isSafeId(dataset.id)
    || !normalizeString(dataset.title) || !normalizeString(dataset.author)
    || !Number.isSafeInteger(dataset.year) || dataset.year < 1
    || !['lemma', 'wordform'].includes(dataset.entryKind)
    || !isPlainObject(dataset.provenance) || !normalizeString(dataset.provenance.licence)
    || !normalizeString(dataset.provenance.citation) || !isHttpUrl(dataset.provenance.sourceUrl)
    || !isPlainObject(dataset.summary) || !Array.isArray(dataset.words)) {
    fail(`${filename} is not a reviewed generic dataset`);
  }
  for (const field of ['sourceRows', 'entryCount', 'totalFrequency', 'duplicateEntries']) {
    asSafeInteger(dataset.summary[field], `${filename} summary.${field}`);
  }
  if (dataset.words.length !== dataset.summary.entryCount) {
    fail(`${filename} word entries do not match its published summary`);
  }
  return dataset;
}

async function buildGenericProduct({ genericProduct, staticRoot, outputRoot }) {
  const datasetPath = resolveInside(staticRoot, genericProduct.datasetFile, 'generic dataset file');
  const dataset = validateGenericDataset(await readJson(datasetPath, genericProduct.datasetFile), genericProduct.datasetFile);
  const productDirectory = path.join(outputRoot, dataset.id);
  const relativeDataFile = path.relative(productDirectory, datasetPath).split(path.sep).join('/');
  const manifest = {
    schemaVersion: 1,
    id: dataset.id,
    title: dataset.title,
    productType: 'generic-frequency-dataset',
    publication: {
      status: 'published',
      scope: `Every public entry in ${dataset.id}.`,
      access: 'The complete reviewed JSON dataset is available directly and is also selectable in the browser explorer.'
    },
    description: genericProduct.description,
    provenance: dataset.provenance,
    content: {
      format: 'dazniausi-zodziai-dataset-v1',
      file: relativeDataFile,
      entryKind: dataset.entryKind,
      recordEncoding: 'object',
      summary: dataset.summary
    }
  };
  await writeJson(path.join(productDirectory, 'manifest.json'), manifest);
  return {
    id: dataset.id,
    title: dataset.title,
    productType: manifest.productType,
    publicationStatus: 'published',
    manifest: `${dataset.id}/manifest.json`,
    licence: dataset.provenance.licence,
    viewCount: 1,
    recordCount: dataset.summary.entryCount
  };
}

function buildMetadataOnlyManifest({ contract, contractProduct }) {
  return {
    schemaVersion: 1,
    id: contract.id,
    title: contract.title,
    productType: 'metadata-only',
    publication: contractProduct.publication,
    blockedBy: contractProduct.blockedBy,
    provenance: publicProductProvenance(contract)
  };
}

async function writeBlktLicenceFiles(productDirectory) {
  for (const [sourceRelativePath, licence] of BLKT_LICENCE_SOURCE_FILES) {
    const buffer = await readFile(path.join(repositoryRoot, sourceRelativePath));
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const text = buffer.toString('utf8');
    const hasCompleteTerms = licence.id === 'newgenltu-openrail-d-v1.0'
      ? ['Section I: PREAMBLE', 'Section IV: OTHER PROVISIONS', 'Attachment A', '10. Other restrictions']
        .every((marker) => text.includes(marker))
      : ['Attribution-ShareAlike 4.0 International', 'Section 3 -- License Conditions.', 'b. ShareAlike.', 'Section 8 -- Interpretation.']
        .every((marker) => text.includes(marker));
    if (checksum !== licence.sha256 || buffer.byteLength > 65536 || !hasCompleteTerms) {
      fail(`${licence.name} bundled licence text is missing, changed, or exceeds 65536 bytes`);
    }
    await writeFile(path.join(productDirectory, licence.file), buffer);
  }
}

async function buildContractProduct({ contract, contractProduct, sourceResolver, outputRoot }) {
  assertRimkutePublicationContract(contract, contractProduct);
  const productDirectory = path.join(outputRoot, contract.id);
  if (contractProduct.productType === 'metadata-only') {
    const manifest = buildMetadataOnlyManifest({ contract, contractProduct });
    await writeJson(path.join(productDirectory, 'manifest.json'), manifest);
    return {
      id: contract.id,
      title: contract.title,
      productType: manifest.productType,
      publicationStatus: 'metadata-only',
      manifest: `${contract.id}/manifest.json`,
      licence: contract.source.licence,
      viewCount: 0,
      recordCount: null
    };
  }

  if (contractProduct.productType === SYNTACTIC_CONTEXT_PRODUCT_TYPE) {
    return buildSyntacticContextProduct({ contract, contractProduct, sourceResolver, outputRoot });
  }

  const sourceFilesWithRoles = contract.source.files.filter((file) => normalizeString(file.role));
  const filesByRole = new Map(sourceFilesWithRoles.map((file) => [file.role, file]));
  if (filesByRole.size !== sourceFilesWithRoles.length) {
    fail(`${contract.id} assigns the same source role to more than one file`);
  }
  const views = [];
  const usedSourceRoles = new Set();
  for (const view of contractProduct.views) {
    const sourceFile = filesByRole.get(view.sourceRole);
    if (!sourceFile) fail(`${contract.id} has no source file with role ${view.sourceRole}`);
    usedSourceRoles.add(view.sourceRole);
    if (view.derivation?.type === 'conllu-frequency') {
      views.push(await buildDerivedConlluFrequencyView({ productId: contract.id, productDirectory, view, sourceFile, sourceResolver }));
    } else if (view.derivation?.type === 'name-transliteration') {
      views.push(await buildDerivedNameTransliterationView({ productId: contract.id, productDirectory, view, sourceFile, sourceResolver }));
    } else if (view.derivation?.type === 'nvh-lexicon') {
      views.push(await buildDerivedNvhLexiconView({ productId: contract.id, productDirectory, view, sourceFile, sourceResolver }));
    } else {
      views.push(await buildChunkedView({ productId: contract.id, productDirectory, view, sourceFile, sourceResolver }));
    }
  }
  if (usedSourceRoles.size !== sourceFilesWithRoles.length
    || sourceFilesWithRoles.some((file) => !usedSourceRoles.has(file.role))) {
    fail(`${contract.id} must publish at least one view for every reviewed machine-readable source file`);
  }

  const analysisProfiles = [];
  for (const profile of contractProduct.analysisProfiles ?? []) {
    if (profile.type === 'frequency-band-coverage') {
      analysisProfiles.push(await buildFrequencyBandCoverageProfile({
        contract,
        productId: contract.id,
        productDirectory,
        profile,
        views: contractProduct.views,
        sourceResolver
      }));
    } else if (profile.type === 'normalized-contrast-lookup') {
      analysisProfiles.push(await buildNormalizedContrastLookupProfile({
        contract,
        productId: contract.id,
        productDirectory,
        profile,
        views: contractProduct.views,
        sourceResolver
      }));
    } else if (profile.type === 'ccll-genre-wordform-lookup') {
      analysisProfiles.push(await buildCcllGenreWordformLookupProfile({
        contract,
        productId: contract.id,
        productDirectory,
        profile,
        views: contractProduct.views,
        sourceResolver
      }));
    } else {
      fail(`${contract.id} has an unsupported analysis profile type: ${profile.type}`);
    }
  }

  if (contractProduct.wordformProfile !== undefined) {
    const profile = contractProduct.wordformProfile;
    const view = contractProduct.views.find((candidate) => candidate.id === profile.viewId);
    const fields = new Map(view?.fields.map((field) => [field.id, field]));
    const pairs = [profile.corpus, ...profile.documentTypes, ...profile.periods];
    const expectedFields = [
      ['word', 'string', false],
      [profile.corpus.tokenField, 'raw-token-count', false],
      [profile.corpus.documentField, 'raw-document-count', false],
      ...profile.documentTypes.flatMap((item) => [
        [item.tokenField, 'raw-token-count', true],
        [item.documentField, 'raw-document-count', true]
      ]),
      ...profile.periods.flatMap((item) => [
        [item.tokenField, 'raw-token-count', true],
        [item.documentField, 'raw-document-count', true]
      ])
    ];
    if (contract.source.licence !== BLKT_PROVENANCE_LICENCE
      || !sameObject(contract.source.sourceLicences, profile.sourceLicences)
      || !sameObject(contract.source.rights, profile.rights)
      || contract.schema?.sourceScopeCaveat !== profile.sourceScopeCaveat) {
      fail(`${contract.id} contract licence and source-scope metadata do not match its public wordform profile`);
    }
    if (!view || view.lookup?.field !== 'word' || view.fields.length !== expectedFields.length
      || view.fields.some((field, index) => field.id !== expectedFields[index][0]
        || field.type !== expectedFields[index][1]
        || (field.nullable === true) !== expectedFields[index][2]
        || field.sourceColumn !== index)
      || pairs.some((item) => fields.get(item.tokenField)?.type !== 'raw-token-count'
        || fields.get(item.documentField)?.type !== 'raw-document-count')) {
      fail(`${contract.id} wordform profile fields do not match its published range-indexed view`);
    }
    await writeBlktLicenceFiles(productDirectory);
  }

  const manifest = {
    schemaVersion: 1,
    id: contract.id,
    title: contract.title,
    productType: contractProduct.productType,
    publication: contractProduct.publication,
    provenance: publicProductProvenance(contract),
    delivery: {
      mode: 'static-chunked-json',
      constraints: contract.delivery?.constraints ?? []
    },
    views,
    ...(publicFileNotice(contract.id) === null ? {} : { notice: publicFileNotice(contract.id) }),
    ...(contractProduct.wordformProfile === undefined ? {} : { wordformProfile: contractProduct.wordformProfile }),
    ...(analysisProfiles.length === 0 ? {} : { analysisProfiles })
  };
  await writeJson(path.join(productDirectory, 'manifest.json'), manifest);
  return {
    id: contract.id,
    title: contract.title,
    productType: manifest.productType,
    publicationStatus: 'published',
    manifest: `${contract.id}/manifest.json`,
    licence: contract.source.licence,
    viewCount: views.length,
    recordCount: null
  };
}

function assertSafeOutputRoot(outputRoot) {
  const resolved = path.resolve(outputRoot);
  if ([path.parse(resolved).root, repositoryRoot, defaultStaticRoot].includes(resolved)) {
    fail(`refusing to replace unsafe output directory: ${resolved}`);
  }
  return resolved;
}

export async function buildDataProducts({
  sourceRoot,
  outputRoot = defaultOutputRoot,
  staticRoot = defaultStaticRoot,
  planPath = defaultPlanPath,
  contractPath = defaultContractPath
}) {
  if (!sourceRoot) fail('a --source-root directory is required');
  const resolvedOutputRoot = assertSafeOutputRoot(outputRoot);
  const resolvedStaticRoot = path.resolve(staticRoot);
  const plan = validatePublicationPlan(await readJson(path.resolve(planPath), 'publication plan'));
  const contracts = validateContractManifest(await readJson(path.resolve(contractPath), 'source contract manifest'));
  const contractsById = new Map(contracts.contracts.map((contract) => [contract.id, contract]));

  if (contractsById.size !== contracts.contracts.length) fail('source contract ids must be unique');
  if (plan.contractProducts.length !== contracts.contracts.length
    || plan.contractProducts.some((product) => !contractsById.has(product.contractId))) {
    fail('the publication plan must account for every source contract exactly once');
  }

  const sourceResolver = await createSourceArtifactResolver(sourceRoot);
  await verifySourceContracts({ contractPath: path.resolve(contractPath), sourceRoot, sourceResolver });
  await rm(resolvedOutputRoot, { recursive: true, force: true });
  await mkdir(resolvedOutputRoot, { recursive: true });

  const products = [];
  for (const genericProduct of plan.genericProducts) {
    products.push(await buildGenericProduct({ genericProduct, staticRoot: resolvedStaticRoot, outputRoot: resolvedOutputRoot }));
  }
  for (const contractProduct of plan.contractProducts) {
    const contract = contractsById.get(contractProduct.contractId);
    products.push(await buildContractProduct({
      contract,
      contractProduct,
      sourceResolver,
      outputRoot: resolvedOutputRoot
    }));
  }

  const productIds = new Set();
  for (const product of products) {
    if (productIds.has(product.id)) fail(`publication plan produces duplicate product id ${product.id}`);
    productIds.add(product.id);
  }
  const catalog = {
    schemaVersion: 1,
    title: plan.title,
    products
  };
  await writeJson(path.join(resolvedOutputRoot, 'catalog.json'), catalog);
  return {
    outputRoot: resolvedOutputRoot,
    products: products.length,
    publishedProducts: products.filter((product) => product.publicationStatus === 'published').length,
    metadataOnlyProducts: products.filter((product) => product.publicationStatus === 'metadata-only').length
  };
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help' || option === '-h') return { help: true };
    if (!['--source-root', '--output', '--static-root', '--plan', '--contract'].includes(option)) {
      fail(`unknown option: ${option}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`option ${option} requires a value`);
    const key = option === '--output' ? 'outputRoot'
      : option === '--static-root' ? 'staticRoot'
        : option.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[key] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return 'Usage: npm run products:build -- --source-root <raw-data-dir> [--output <static-data-products-dir>] [--static-root <static-dir>] [--plan <publication-plan.json>] [--contract <source-contracts.json>]';
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else if (!options.sourceRoot) {
      fail(`option --source-root is required\n${usage()}`);
    } else {
      console.log(JSON.stringify(await buildDataProducts(options), null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
