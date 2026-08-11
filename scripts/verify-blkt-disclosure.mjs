import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPolicyPath = path.join(repositoryRoot, 'data', 'policies', 'blkt-disclosure.json');

const PRODUCT_ID = 'vssa-2026-blkt-wordform-profile';
const VIEW_ID = 'wordform-scope-metrics';
const SOURCE_ROLE = 'wordform-profile';
const MAX_PUBLIC_FILE_BYTES = 65_536;
const MINIMUM_TOKEN_COUNT = 100;
const MINIMUM_DOCUMENT_SUPPORT = 20;

const TYPE_DIMENSIONS = [
  ['fiction', 'gro', 'typeGroTokenCount', 'typeGroDocumentCount'],
  ['non-fiction', 'neg', 'typeNegTokenCount', 'typeNegDocumentCount'],
  ['media', 'zin', 'typeZinTokenCount', 'typeZinDocumentCount'],
  ['speech', 'sak', 'typeSakTokenCount', 'typeSakDocumentCount'],
  ['documents', 'dok', 'typeDokTokenCount', 'typeDokDocumentCount']
];

const PERIOD_DIMENSIONS = [
  ['1922-1940', '1', 'period1TokenCount', 'period1DocumentCount'],
  ['1941-1990', '2', 'period2TokenCount', 'period2DocumentCount'],
  ['1990-2004', '3', 'period3TokenCount', 'period3DocumentCount'],
  ['2008-2026', '4', 'period4TokenCount', 'period4DocumentCount']
];

const RECORD_FIELDS = [
  'word',
  'corpusTokenCount',
  'corpusDocumentCount',
  ...TYPE_DIMENSIONS.flatMap((dimension) => dimension.slice(2)),
  ...PERIOD_DIMENSIONS.flatMap((dimension) => dimension.slice(2))
];

const REQUIRED_EXCLUSIONS = [
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

const EXPECTED_SOURCE_SCOPE_CAVEAT = 'BLKT is not representative of all Lithuanian language use: media and document texts dominate its document and token composition.';
const EXPECTED_SOURCE_LICENCES = {
  inventory: [
    {
      sourceLabel: 'NewGenLTU OpenRAIL-D', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/', documents: 8267437, sourceAlphaWords: 3906734476
    },
    {
      sourceLabel: 'CC BY-SA 4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      attribution: 'Wikipedia contributors (BLKT source_name: Vikipedija).',
      documents: 170718, sourceAlphaWords: 34741743
    }
  ],
  application: 'The combined aggregate retains the notices and conditions of both source licence groups.'
};
const EXPECTED_RIGHTS = {
  licences: [
    {
      id: 'newgenltu-openrail-d-v1.0', name: 'NewGenLTU OpenRAIL-D v1.0',
      url: 'https://sitti.vdu.lt/newgenltu-openrail-d-license/',
      file: 'LICENSE-NewGenLTU-OpenRAIL-D-1.0.txt',
      sha256: 'abf61fc83225e088c1ed91aae517f0d5c606c2c9b441f3fc245ce821c1c79ab9'
    },
    {
      id: 'cc-by-sa-4.0', name: 'Creative Commons Attribution-ShareAlike 4.0 International',
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
const EXPECTED_FILE_NOTICE = {
  modificationNotice: EXPECTED_RIGHTS.modificationNotice,
  attribution: 'BLKT: Valstybės skaitmeninių sprendimų agentūra (2026); Vikipedija subset: Wikipedia contributors.',
  licenceLocation: 'product-root',
  licences: EXPECTED_RIGHTS.licences.map(({ name, file }) => ({ name, file }))
};

const EXPECTED_TITLE = 'BLKT privatumo slenksčiais apsaugotas žodžio profilis';
const EXPECTED_PUBLICATION = {
  status: 'published',
  scope: 'Privatumo slenksčiais apsaugoti vienos tikslios žodžio formos skaitikliai visame BLKT ir atskiruose plačiuose teksto tipo bei laikotarpio pjūviuose.',
  access: 'Kompaktiškas pradinis indeksas nukreipia į vieną riboto dydžio maršruto puslapį ir daugiausia vieną riboto dydžio duomenų dalį.',
  reason: 'Tai yra kalbos technologijų darbui skirtas agreguotas išvestinis duomenų produktas; jis nėra tekstų, dokumentų ar asmenų paieškos priemonė.'
};
const EXPECTED_PROVENANCE = {
  sourceUrl: 'https://clarin-repo.lt/items/2b51a918-55c3-4e62-8e45-e763fc7fc157',
  licence: 'NewGenLTU OpenRAIL-D v1.0; CC BY-SA 4.0 for BLKT rows labelled Vikipedija',
  citation: 'Valstybės skaitmeninių sprendimų agentūra. 2026. Bendrasis lietuvių kalbos tekstynas. Hugging Face. https://huggingface.co/datasets/VSSA-SDSA/LT_AI_BLKT.'
};
const EXPECTED_ARTIFACTS = [
  ['vssa-2026-blkt-source-manifest', 'binary', null],
  ['vssa-2026-blkt-aggregation-summary', 'binary', null],
  ['vssa-2026-blkt-wordform-profile', 'text', SOURCE_ROLE]
];
const EXPECTED_DELIVERY_CONSTRAINTS = [
  'Publish only thresholded corpus, broad document-type, and broad period marginal aggregates for one exact normalized wordform.',
  'Do not publish raw text, document rows, document subtypes, crossed dimensions, titles, authors, URLs, source identifiers, publication dates, or personal data.',
  'Retain the BLKT attribution, NewGenLTU OpenRAIL-D v1.0 licence, modification notice, downstream field-of-use restriction, and personal-data prohibition.',
  'Retain the CC BY-SA 4.0 licence and Wikipedia-contributor attribution for the Vikipedija-labelled source subset, and make both complete licence texts available with the product.',
  'State that BLKT is not representative of all Lithuanian language use because media and document texts dominate its composition.'
];
const EXPECTED_VIEW = {
  title: 'BLKT žodžio rodikliai pagal viešus pjūvius',
  description: 'Privatumo slenksčiais apsaugoti vienos tikslios žodžio formos skaitikliai visame BLKT, penkiuose plačiuose teksto tipuose ir keturiuose laikotarpiuose.'
};
const EXPECTED_DIMENSION_LABELS = {
  corpus: 'Visas BLKT',
  fiction: 'Grožinė literatūra',
  'non-fiction': 'Negrožinė literatūra',
  media: 'Žiniasklaida',
  speech: 'Sakytinė kalba',
  documents: 'Dokumentai',
  '1922-1940': '1922–1940',
  '1941-1990': '1941–1990',
  '1990-2004': '1990–2004',
  '2008-2026': '2008–2026'
};
const EXPECTED_FIELD_LABELS = [
  'Žodžio forma',
  'Visas BLKT: pavartojimai',
  'Visas BLKT: dokumentai su žodžiu',
  ...TYPE_DIMENSIONS.flatMap(([id]) => [
    `${EXPECTED_DIMENSION_LABELS[id]}: pavartojimai`,
    `${EXPECTED_DIMENSION_LABELS[id]}: dokumentai su žodžiu`
  ]),
  ...PERIOD_DIMENSIONS.flatMap(([id]) => [
    `${EXPECTED_DIMENSION_LABELS[id]}: pavartojimai`,
    `${EXPECTED_DIMENSION_LABELS[id]}: dokumentai su žodžiu`
  ])
];

const REQUIRED_FORBIDDEN_KEYS = [
  'rawText', 'text', 'body', 'content', 'excerpt', 'quote', 'sentence', 'context',
  'document', 'documentId', 'documentTitle', 'documentUrl', 'recordId', 'row', 'rowId',
  'sourceRow', 'sourceRowId', 'sampleId', 'archivePath', 'filePath', 'filename',
  'sourceId', 'sourceIdentifier', 'sourceGroup', 'sourceGroupId', 'speaker', 'speakerId',
  'speakerName', 'author', 'authorId', 'authorName', 'person', 'personId', 'date',
  'publicationDate', 'day', 'month', 'year', 'calendarYear', 'session', 'sessionId',
  'period', 'documentSubtype', 'subtype', 'time', 'timestamp', 'rank', 'ranking'
];

const APPROVED_METADATA_KEYS = new Set([
  'schemaVersion', 'id', 'productId', 'title', 'productType', 'publication', 'status', 'scope', 'access', 'reason',
  'provenance', 'sourceUrl', 'licence', 'citation', 'files', 'role', 'artifactId', 'format', 'bytes',
  'sha256', 'rows', 'columns', 'delimiter', 'hasHeader', 'delivery', 'mode', 'constraints', 'views',
  'description', 'index', 'sourceRole', 'recordEncoding', 'summary', 'sourceRows', 'recordCount',
  'numericTotals', 'nullCounts', 'wordformProfile', 'viewId', 'tokenizer', 'normalization',
  'maximumCodePoints', 'caseMapping', 'disclosure', 'minimumTokenCount', 'minimumDocumentSupport', 'familyRule',
  'rate', 'targetTokens', 'formula', 'unit', 'corpus', 'label', 'tokenField', 'documentField',
  'documents', 'sourceAlphaWords', 'derivedTokens', 'documentTypes', 'sourceCode', 'periods',
  'validatedSubtypes', 'count', 'published', 'permission', 'confirmedOn', 'rights', 'licenceUrl',
  'sourceScopeCaveat', 'sourceLicences', 'inventory', 'sourceLabel', 'name', 'url', 'attribution',
  'application', 'licences', 'licenceLocation', 'attributionNotices', 'modificationNotice', 'downstreamRequirements',
  'notice', 'exclusions', 'fields', 'type', 'sourceColumn',
  'nullable', 'ordering', 'field', 'direction', 'sourceFile', 'maxChunkBytes', 'lookup', 'maxIndexBytes',
  'routing', 'maxPageBytes', 'pages', 'page', 'chunks', 'file', 'records', 'range', 'chunk',
  ...RECORD_FIELDS
]);

function fail(message) {
  throw new Error(`BLKT disclosure verification failed: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedKey(value) {
  return value.normalize('NFKC').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase('en-US');
}

function normalizedKeys(values) {
  return new Set(values.map(normalizedKey));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeInteger(value, { positive = false } = {}) {
  return Number.isSafeInteger(value) && (positive ? value > 0 : value >= 0);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function sameValues(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
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

function assertObjectShape(value, requiredKeys, optionalKeys, location) {
  if (!isPlainObject(value)) fail(`${location} must be an object`);
  const required = new Set(requiredKeys);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${location} contains unapproved key ${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(`${location} is missing required key ${key}`);
  }
}

function assertExactObject(value, expected, location) {
  if (!isDeepStrictEqual(value, expected)) fail(`${location} does not match the approved disclosure policy`);
}

export function assertNoForbiddenKeys(value, forbiddenKeys, location = '$') {
  const forbidden = forbiddenKeys instanceof Set ? forbiddenKeys : normalizedKeys(forbiddenKeys);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, forbidden, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(normalizedKey(key))) {
      fail(`${location} contains forbidden raw-text, identity, or source-row key ${key}`);
    }
    assertNoForbiddenKeys(child, forbidden, `${location}.${key}`);
  }
}

export function assertOnlyApprovedMetadataKeys(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertOnlyApprovedMetadataKeys(item, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (!APPROVED_METADATA_KEYS.has(key)) fail(`${location} contains unapproved metadata key ${key}`);
    assertOnlyApprovedMetadataKeys(child, `${location}.${key}`);
  }
}

function validatePolicy(policy) {
  assertObjectShape(policy, [
    'schemaVersion', 'productId', 'status', 'reviewIssue', 'approvedView', 'approvedGranularity',
    'tokenPolicy', 'disclosure', 'lookup', 'sourceScopeCaveat', 'sourceLicences', 'rights',
    'fileNotice', 'requiredExclusions', 'forbiddenObjectKeys'
  ], [], 'policy');
  if (policy.schemaVersion !== 1 || policy.productId !== PRODUCT_ID
    || policy.status !== 'thresholded-marginals-only'
    || policy.reviewIssue !== 'https://github.com/debesyla/dazniausi-zodziai/issues/59') {
    fail('policy must identify the reviewed issue #59 BLKT product');
  }
  assertExactObject(policy.approvedView, {
    id: VIEW_ID,
    productType: 'chunked-comparison',
    recordEncoding: 'array',
    recordFields: RECORD_FIELDS
  }, 'policy.approvedView');
  assertExactObject(policy.approvedGranularity, {
    corpus: { tokenField: 'corpusTokenCount', documentField: 'corpusDocumentCount' },
    documentTypes: TYPE_DIMENSIONS.map(([id, sourceCode, tokenField, documentField]) => ({
      id, sourceCode, tokenField, documentField
    })),
    periods: PERIOD_DIMENSIONS.map(([id, sourceCode, tokenField, documentField]) => ({
      id, sourceCode, tokenField, documentField
    })),
    documentSubtypes: false,
    jointDimensions: false
  }, 'policy.approvedGranularity');
  assertExactObject(policy.tokenPolicy, {
    kind: 'unicode-letter-sequence',
    normalization: 'trim-nfc-lower',
    maxCodePoints: 64,
    caseMapping: 'duckdb-simple-per-code-point'
  }, 'policy.tokenPolicy');
  assertExactObject(policy.disclosure, {
    minimumTokenCount: MINIMUM_TOKEN_COUNT,
    minimumDocumentSupport: MINIMUM_DOCUMENT_SUPPORT,
    familyRule: 'all-positive-siblings-must-pass-or-family-is-null'
  }, 'policy.disclosure');
  assertExactObject(policy.lookup, {
    type: 'exact-string-range',
    field: 'word',
    normalization: 'trim-nfc-lower',
    routing: 'range-pages',
    maximumIndexBytes: MAX_PUBLIC_FILE_BYTES,
    maximumRoutingPageBytes: MAX_PUBLIC_FILE_BYTES,
    maximumChunkBytes: MAX_PUBLIC_FILE_BYTES
  }, 'policy.lookup');
  if (policy.sourceScopeCaveat !== EXPECTED_SOURCE_SCOPE_CAVEAT) {
    fail('policy.sourceScopeCaveat must disclose the reviewed corpus-composition limitation');
  }
  assertExactObject(policy.sourceLicences, EXPECTED_SOURCE_LICENCES, 'policy.sourceLicences');
  assertExactObject(policy.rights, EXPECTED_RIGHTS, 'policy.rights');
  assertExactObject(policy.fileNotice, EXPECTED_FILE_NOTICE, 'policy.fileNotice');
  if (!sameValues(policy.requiredExclusions, REQUIRED_EXCLUSIONS)) {
    fail('policy.requiredExclusions must quarantine every non-marginal expansion');
  }
  if (!Array.isArray(policy.forbiddenObjectKeys)) fail('policy.forbiddenObjectKeys must be an array');
  const forbidden = normalizedKeys(policy.forbiddenObjectKeys);
  for (const required of REQUIRED_FORBIDDEN_KEYS) {
    if (!forbidden.has(normalizedKey(required))) fail(`policy does not quarantine required key ${required}`);
  }
  for (const approved of APPROVED_METADATA_KEYS) {
    if (forbidden.has(normalizedKey(approved))) fail(`policy forbids required public metadata key ${approved}`);
  }
  return forbidden;
}

function decodeJson(buffer, description) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    fail(`${description} is not valid UTF-8`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${description} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

async function readJson(filename, description) {
  let stat;
  try {
    stat = await lstat(filename);
  } catch (error) {
    fail(`${description} cannot be read: ${error instanceof Error ? error.message : error}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${description} must be a regular file`);
  const buffer = await readFile(filename);
  return { buffer, value: decodeJson(buffer, description) };
}

function validatePublicSourceFile(value, expected, location, { primary = false } = {}) {
  assertObjectShape(value, ['artifactId', 'format', 'bytes', 'sha256'], [
    'role', 'rows', 'columns', 'delimiter', 'hasHeader'
  ], location);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value.artifactId) || value.artifactId !== expected[0]
    || value.format !== expected[1]
    || !isSafeInteger(value.bytes, { positive: true }) || !isSha256(value.sha256)) {
    fail(`${location} is invalid`);
  }
  if (primary) {
    if (value.role !== SOURCE_ROLE || value.format !== 'text'
      || !isSafeInteger(value.rows, { positive: true }) || value.columns !== RECORD_FIELDS.length
      || value.delimiter !== '\t' || value.hasHeader !== true) {
      fail(`${location} must describe the approved 21-column aggregate source`);
    }
  } else if (value.role !== undefined || expected[2] !== null) {
    fail(`${location} exposes an unapproved source role`);
  }
  if (value.rows !== undefined && !isSafeInteger(value.rows, { positive: true })) fail(`${location}.rows is invalid`);
  if (value.columns !== undefined && !isSafeInteger(value.columns, { positive: true })) fail(`${location}.columns is invalid`);
  if (value.delimiter !== undefined && typeof value.delimiter !== 'string') fail(`${location}.delimiter is invalid`);
  if (value.hasHeader !== undefined && typeof value.hasHeader !== 'boolean') fail(`${location}.hasHeader is invalid`);
}

function validateSummary(value, location) {
  assertObjectShape(value, ['sourceRows', 'recordCount', 'numericTotals', 'nullCounts'], [], location);
  if (!isSafeInteger(value.sourceRows, { positive: true }) || value.recordCount !== value.sourceRows) {
    fail(`${location} must declare one positive aggregate record count`);
  }
  assertObjectShape(value.numericTotals, RECORD_FIELDS.slice(1), [], `${location}.numericTotals`);
  assertObjectShape(value.nullCounts, RECORD_FIELDS.slice(3), [], `${location}.nullCounts`);
  for (const [field, total] of Object.entries(value.numericTotals)) {
    if (!isSafeInteger(total)) fail(`${location}.numericTotals.${field} is invalid`);
  }
  for (const [field, total] of Object.entries(value.nullCounts)) {
    if (!isSafeInteger(total) || total > value.recordCount) fail(`${location}.nullCounts.${field} is invalid`);
  }
}

function validateDimension(value, expected, location, { corpus = false } = {}) {
  const required = corpus
    ? ['id', 'label', 'tokenField', 'documentField', 'documents', 'sourceAlphaWords', 'derivedTokens']
    : ['id', 'sourceCode', 'label', 'tokenField', 'documentField', 'documents', 'sourceAlphaWords', 'derivedTokens'];
  assertObjectShape(value, required, [], location);
  const [id, sourceCode, tokenField, documentField] = expected;
  if (value.id !== id || (!corpus && value.sourceCode !== sourceCode)
    || value.tokenField !== tokenField || value.documentField !== documentField
    || value.label !== EXPECTED_DIMENSION_LABELS[id]) {
    fail(`${location} does not match the approved marginal dimension`);
  }
  for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens']) {
    if (!isSafeInteger(value[field], { positive: true })) fail(`${location}.${field} is invalid`);
  }
}

function validateWordformProfile(value, policy) {
  assertObjectShape(value, [
    'schemaVersion', 'viewId', 'sourceScopeCaveat', 'sourceLicences', 'tokenizer', 'disclosure',
    'rate', 'corpus', 'documentTypes', 'periods', 'validatedSubtypes', 'permission', 'rights', 'exclusions'
  ], [], 'manifest.wordformProfile');
  if (value.schemaVersion !== 1 || value.viewId !== VIEW_ID) fail('manifest.wordformProfile has the wrong identity');
  if (value.sourceScopeCaveat !== policy.sourceScopeCaveat) {
    fail('manifest.wordformProfile.sourceScopeCaveat does not match the approved disclosure policy');
  }
  assertExactObject(value.sourceLicences, policy.sourceLicences, 'manifest.wordformProfile.sourceLicences');
  assertExactObject(value.tokenizer, {
    id: 'blkt-unicode-letter-lower-v1',
    normalization: 'trim-nfc-lower',
    maximumCodePoints: 64,
    caseMapping: 'duckdb-simple-per-code-point'
  }, 'manifest.wordformProfile.tokenizer');
  assertExactObject(value.disclosure, policy.disclosure, 'manifest.wordformProfile.disclosure');
  assertExactObject(value.rate, {
    targetTokens: 1_000_000,
    formula: 'tokenCount * 1000000 / derivedTokens',
    unit: 'tokens per million derived tokens'
  }, 'manifest.wordformProfile.rate');
  validateDimension(value.corpus, ['corpus', null, 'corpusTokenCount', 'corpusDocumentCount'], 'manifest.wordformProfile.corpus', { corpus: true });
  if (!Array.isArray(value.documentTypes) || value.documentTypes.length !== TYPE_DIMENSIONS.length) {
    fail('manifest.wordformProfile.documentTypes must contain exactly five approved marginal types');
  }
  if (!Array.isArray(value.periods) || value.periods.length !== PERIOD_DIMENSIONS.length) {
    fail('manifest.wordformProfile.periods must contain exactly four approved marginal periods');
  }
  value.documentTypes.forEach((dimension, index) => {
    validateDimension(dimension, TYPE_DIMENSIONS[index], `manifest.wordformProfile.documentTypes[${index}]`);
  });
  value.periods.forEach((dimension, index) => {
    validateDimension(dimension, PERIOD_DIMENSIONS[index], `manifest.wordformProfile.periods[${index}]`);
  });
  for (const dimensions of [value.documentTypes, value.periods]) {
    for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens']) {
      if (dimensions.reduce((sum, dimension) => sum + dimension[field], 0) !== value.corpus[field]) {
        fail(`manifest.wordformProfile ${field} denominators do not reconcile`);
      }
    }
  }
  if (value.sourceLicences.inventory.reduce((sum, item) => sum + item.documents, 0) !== value.corpus.documents
    || value.sourceLicences.inventory.reduce((sum, item) => sum + item.sourceAlphaWords, 0) !== value.corpus.sourceAlphaWords) {
    fail('manifest.wordformProfile source licence inventory does not reconcile with the corpus denominators');
  }
  assertExactObject(value.validatedSubtypes, { count: 11, published: false }, 'manifest.wordformProfile.validatedSubtypes');
  assertExactObject(value.permission, {
    status: 'confirmed-by-project-owner', confirmedOn: '2026-08-02'
  }, 'manifest.wordformProfile.permission');
  assertExactObject(value.rights, policy.rights, 'manifest.wordformProfile.rights');
  if (!sameValues(value.exclusions, policy.requiredExclusions)) {
    fail('manifest.wordformProfile.exclusions must quarantine every non-marginal expansion');
  }
}

function validateManifest(value, policy) {
  assertObjectShape(value, [
    'schemaVersion', 'id', 'title', 'productType', 'publication', 'provenance', 'delivery', 'views',
    'notice', 'wordformProfile'
  ], [], 'manifest');
  if (value.schemaVersion !== 1 || value.id !== PRODUCT_ID || value.productType !== 'chunked-comparison'
    || value.title !== EXPECTED_TITLE) {
    fail('manifest does not describe the approved BLKT product');
  }
  assertObjectShape(value.publication, ['status', 'scope', 'access'], ['reason'], 'manifest.publication');
  if (!isDeepStrictEqual(value.publication, EXPECTED_PUBLICATION)) {
    fail('manifest.publication must describe a published bounded aggregate lookup');
  }
  assertObjectShape(value.provenance, ['sourceUrl', 'licence', 'citation', 'files'], [], 'manifest.provenance');
  if (value.provenance.sourceUrl !== EXPECTED_PROVENANCE.sourceUrl
    || value.provenance.licence !== EXPECTED_PROVENANCE.licence
    || value.provenance.citation !== EXPECTED_PROVENANCE.citation
    || !Array.isArray(value.provenance.files)
    || value.provenance.files.length !== EXPECTED_ARTIFACTS.length) {
    fail('manifest.provenance is invalid');
  }
  const primaryFiles = value.provenance.files.filter((file) => file?.role === SOURCE_ROLE);
  if (primaryFiles.length !== 1) fail('manifest.provenance must expose exactly one approved aggregate source role');
  value.provenance.files.forEach((file, index) => {
    validatePublicSourceFile(file, EXPECTED_ARTIFACTS[index], `manifest.provenance.files[${index}]`, { primary: file === primaryFiles[0] });
  });
  assertObjectShape(value.delivery, ['mode', 'constraints'], [], 'manifest.delivery');
  if (value.delivery.mode !== 'static-chunked-json'
    || !isDeepStrictEqual(value.delivery.constraints, EXPECTED_DELIVERY_CONSTRAINTS)) {
    fail('manifest.delivery is invalid');
  }
  if (!Array.isArray(value.views) || value.views.length !== 1) fail('manifest must expose exactly one approved view');
  const view = value.views[0];
  assertObjectShape(view, [
    'id', 'title', 'description', 'index', 'sourceRole', 'recordEncoding', 'summary'
  ], [], 'manifest.views[0]');
  if (view.id !== VIEW_ID || view.title !== EXPECTED_VIEW.title || view.description !== EXPECTED_VIEW.description
    || view.index !== `views/${VIEW_ID}/index.json` || view.sourceRole !== SOURCE_ROLE
    || view.recordEncoding !== 'array') {
    fail('manifest view is not the approved BLKT marginal view');
  }
  validateSummary(view.summary, 'manifest.views[0].summary');
  assertExactObject(value.notice, policy.fileNotice, 'manifest.notice');
  validateWordformProfile(value.wordformProfile, policy);
  return { primarySourceFile: primaryFiles[0], profile: value.wordformProfile, view };
}

function expectedField(index) {
  const id = RECORD_FIELDS[index];
  if (index === 0) return { id, type: 'string', sourceColumn: index, nullable: false, unit: null };
  return {
    id,
    type: id.endsWith('TokenCount') ? 'raw-token-count' : 'raw-document-count',
    sourceColumn: index,
    nullable: index >= 3,
    unit: id.endsWith('TokenCount') ? 'tokens' : 'documents'
  };
}

function validateField(value, index) {
  const expected = expectedField(index);
  const required = expected.unit === null
    ? ['id', 'label', 'type', 'sourceColumn']
    : ['id', 'label', 'type', 'unit', 'sourceColumn'];
  if (expected.nullable) required.push('nullable');
  assertObjectShape(value, required, [], `index.fields[${index}]`);
  if (value.id !== expected.id || value.type !== expected.type || value.sourceColumn !== index
    || value.label !== EXPECTED_FIELD_LABELS[index] || (expected.unit !== null && value.unit !== expected.unit)
    || (expected.nullable && value.nullable !== true)) {
    fail(`index.fields[${index}] does not match the approved 21-field record schema`);
  }
}

function validateIndex(value, sourceFile, policy) {
  assertObjectShape(value, [
    'schemaVersion', 'productId', 'viewId', 'recordEncoding', 'fields', 'ordering', 'sourceFile',
    'maxChunkBytes', 'notice', 'lookup', 'summary', 'routing'
  ], [], 'index');
  if (value.schemaVersion !== 1 || value.productId !== PRODUCT_ID || value.viewId !== VIEW_ID
    || value.recordEncoding !== 'array') {
    fail('index has the wrong product, view, or record encoding');
  }
  if (!Array.isArray(value.fields) || value.fields.length !== RECORD_FIELDS.length) {
    fail('index must define exactly one 21-field array record schema');
  }
  value.fields.forEach(validateField);
  assertExactObject(value.ordering, { field: 'word', direction: 'ascending' }, 'index.ordering');
  assertExactObject(value.lookup, {
    type: 'exact-string-range', field: 'word', normalization: 'trim-nfc-lower', maxIndexBytes: value.lookup?.maxIndexBytes
  }, 'index.lookup');
  if (!isSafeInteger(value.lookup.maxIndexBytes, { positive: true }) || value.lookup.maxIndexBytes < 8192
    || value.lookup.maxIndexBytes > MAX_PUBLIC_FILE_BYTES) {
    fail('index.lookup exceeds the 64 KiB public index limit');
  }
  if (!isSafeInteger(value.maxChunkBytes, { positive: true }) || value.maxChunkBytes < 1024
    || value.maxChunkBytes > MAX_PUBLIC_FILE_BYTES) {
    fail('index.maxChunkBytes exceeds the 64 KiB public chunk limit');
  }
  assertExactObject(value.sourceFile, sourceFile, 'index.sourceFile');
  assertExactObject(value.notice, policy.fileNotice, 'index.notice');
  validateSummary(value.summary, 'index.summary');
  if (value.summary.sourceRows !== sourceFile.rows) fail('index source row count does not match its aggregate source metadata');
  assertObjectShape(value.routing, ['type', 'maxPageBytes', 'pages'], [], 'index.routing');
  if (value.routing.type !== 'range-pages' || value.routing.maxPageBytes !== value.lookup.maxIndexBytes
    || !Array.isArray(value.routing.pages) || value.routing.pages.length === 0) {
    fail('index.routing must contain bounded range pages');
  }
}

function validateCountPair(tokenCount, documentCount, denominators, location, { allowZero = false } = {}) {
  if (!isSafeInteger(tokenCount) || !isSafeInteger(documentCount) || documentCount > tokenCount) {
    fail(`${location} must contain non-negative token/document counts`);
  }
  if (tokenCount === 0 || documentCount === 0) {
    if (tokenCount !== 0 || documentCount !== 0) fail(`${location} must publish zero counts as 0/0`);
    if (!allowZero) fail(`${location} must meet the 100-token/20-document disclosure threshold`);
    return;
  }
  if (tokenCount < MINIMUM_TOKEN_COUNT || documentCount < MINIMUM_DOCUMENT_SUPPORT) {
    fail(`${location} violates the 100-token/20-document disclosure threshold`);
  }
  if (tokenCount > denominators.derivedTokens || documentCount > denominators.documents) {
    fail(`${location} exceeds its published corpus denominator`);
  }
}

function validateMarginalFamily(record, startIndex, dimensions, profile, location, corpusTokenCount, corpusDocumentCount) {
  const values = record.slice(startIndex, startIndex + dimensions.length * 2);
  if (values.every((value) => value === null)) return;
  if (values.some((value) => value === null)) {
    fail(`${location} violates all-or-nothing family suppression`);
  }
  let tokenTotal = 0;
  let documentTotal = 0;
  for (let index = 0; index < dimensions.length; index += 1) {
    const tokenCount = values[index * 2];
    const documentCount = values[index * 2 + 1];
    const denominators = profile[index];
    validateCountPair(tokenCount, documentCount, denominators, `${location}[${dimensions[index][0]}]`, { allowZero: true });
    tokenTotal += tokenCount;
    documentTotal += documentCount;
  }
  if (tokenTotal !== corpusTokenCount || documentTotal !== corpusDocumentCount) {
    fail(`${location} does not reconcile with the corpus marginal`);
  }
}

export function assertBlktAggregateRecord(record, profile, location = '$') {
  if (!Array.isArray(record) || record.length !== RECORD_FIELDS.length) {
    fail(`${location} must be exactly one 21-field aggregate array record`);
  }
  const word = record[0];
  if (typeof word !== 'string' || word !== word.trim().normalize('NFC').toLowerCase()
    || !/^\p{L}{1,64}$/u.test(word)) {
    fail(`${location}.word must be 1-64 normalized lower-case Unicode letters`);
  }
  const corpusTokenCount = record[1];
  const corpusDocumentCount = record[2];
  validateCountPair(corpusTokenCount, corpusDocumentCount, profile.corpus, `${location}.corpus`);
  validateMarginalFamily(record, 3, TYPE_DIMENSIONS, profile.documentTypes, `${location}.documentTypes`, corpusTokenCount, corpusDocumentCount);
  validateMarginalFamily(record, 13, PERIOD_DIMENSIONS, profile.periods, `${location}.periods`, corpusTokenCount, corpusDocumentCount);
}

function emptyTotals() {
  return Object.fromEntries(RECORD_FIELDS.slice(1).map((field) => [field, 0]));
}

function emptyNullCounts() {
  return Object.fromEntries(RECORD_FIELDS.slice(3).map((field) => [field, 0]));
}

function accumulateRecord(record, totals, nullCounts) {
  for (let index = 1; index < record.length; index += 1) {
    const field = RECORD_FIELDS[index];
    if (record[index] === null) nullCounts[field] += 1;
    else totals[field] += record[index];
  }
}

function safeChunkPath(value, chunkIndex) {
  return value === `chunks/${String(chunkIndex + 1).padStart(6, '0')}.json`;
}

function safeRoutingPagePath(value, pageIndex) {
  return value === `routing/${String(pageIndex + 1).padStart(6, '0')}.json`;
}

async function listPublicTree(root) {
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('public product root must be a regular directory');
  const files = [];
  const directories = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      const relative = path.relative(root, filename).split(path.sep).join('/');
      if (entry.isSymbolicLink()) fail(`${relative} is an unapproved symbolic link`);
      if (entry.isDirectory()) {
        directories.push(relative);
        await visit(filename);
      } else if (entry.isFile()) {
        files.push(relative);
      } else {
        fail(`${relative} is not a regular public product file`);
      }
    }
  }
  await visit(root);
  return { files, directories };
}

function assertTreeMatches(actual, expected, description) {
  const unexpected = actual.filter((entry) => !expected.has(entry));
  const missing = [...expected].filter((entry) => !actual.includes(entry));
  if (unexpected.length > 0 || missing.length > 0) {
    fail(`${description} has unapproved or missing entries: ${[...unexpected, ...missing].join(', ')}`);
  }
}

export async function verifyBlktDisclosure({ root = repositoryRoot, policyPath = null } = {}) {
  const resolvedRoot = path.resolve(root);
  const resolvedPolicyPath = policyPath
    ? path.resolve(policyPath)
    : path.join(resolvedRoot, path.relative(repositoryRoot, defaultPolicyPath));
  const { value: policy } = await readJson(resolvedPolicyPath, 'BLKT disclosure policy');
  const forbiddenKeys = validatePolicy(policy);
  const productBase = path.join(resolvedRoot, 'static', 'data-products');
  const productRoot = path.resolve(productBase, policy.productId);
  if (path.dirname(productRoot) !== productBase) fail('policy product ID resolves outside the public product directory');

  const manifestPath = path.join(productRoot, 'manifest.json');
  const { buffer: manifestBuffer, value: manifest } = await readJson(manifestPath, 'BLKT product manifest');
  if (manifestBuffer.byteLength > MAX_PUBLIC_FILE_BYTES) fail('BLKT product manifest exceeds 64 KiB');
  assertNoForbiddenKeys(manifest, forbiddenKeys, 'manifest');
  assertOnlyApprovedMetadataKeys(manifest, 'manifest');
  const { primarySourceFile, profile, view } = validateManifest(manifest, policy);

  const indexPath = path.join(productRoot, 'views', VIEW_ID, 'index.json');
  const { buffer: indexBuffer, value: index } = await readJson(indexPath, 'BLKT range index');
  if (indexBuffer.byteLength > MAX_PUBLIC_FILE_BYTES) fail('BLKT range index exceeds 64 KiB');
  assertNoForbiddenKeys(index, forbiddenKeys, 'index');
  assertOnlyApprovedMetadataKeys(index, 'index');
  validateIndex(index, primarySourceFile, policy);
  if (indexBuffer.byteLength > index.lookup.maxIndexBytes) fail('BLKT range index exceeds its declared byte limit');
  if (!isDeepStrictEqual(view.summary, index.summary)) fail('manifest and index summaries do not match');

  const expectedFiles = new Set(['manifest.json', `views/${VIEW_ID}/index.json`]);
  for (const licence of policy.rights.licences) {
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]+\.txt$/.test(licence.file)) {
      fail(`bundled licence has an unsafe filename: ${licence.file}`);
    }
    expectedFiles.add(licence.file);
    const licencePath = path.join(productRoot, licence.file);
    const licenceStat = await lstat(licencePath);
    const licenceBuffer = await readFile(licencePath);
    const licenceText = licenceBuffer.toString('utf8');
    const hasCompleteTerms = licence.id === 'newgenltu-openrail-d-v1.0'
      ? ['Section I: PREAMBLE', 'Section IV: OTHER PROVISIONS', 'Attachment A', '10. Other restrictions']
        .every((marker) => licenceText.includes(marker))
      : ['Attribution-ShareAlike 4.0 International', 'Section 3 -- License Conditions.', 'b. ShareAlike.', 'Section 8 -- Interpretation.']
        .every((marker) => licenceText.includes(marker));
    if (!licenceStat.isFile() || licenceStat.isSymbolicLink()
      || licenceBuffer.byteLength < 1024 || licenceBuffer.byteLength > MAX_PUBLIC_FILE_BYTES
      || createHash('sha256').update(licenceBuffer).digest('hex') !== licence.sha256 || !hasCompleteTerms) {
      fail(`${licence.name} bundled licence text is missing, changed, linked, or oversized`);
    }
  }
  const totals = emptyTotals();
  const nullCounts = emptyNullCounts();
  let records = 0;
  let chunkCount = 0;
  let previousWord = null;
  let previousRangeEnd = null;
  let previousPageRangeEnd = null;

  for (const [pageIndex, pageDescriptor] of index.routing.pages.entries()) {
    const location = `index.routing.pages[${pageIndex}]`;
    assertObjectShape(pageDescriptor, ['file', 'chunks', 'records', 'bytes', 'sha256', 'range'], [], location);
    if (!safeRoutingPagePath(pageDescriptor.file, pageIndex)
      || !isSafeInteger(pageDescriptor.chunks, { positive: true })
      || !isSafeInteger(pageDescriptor.records, { positive: true })
      || !isSafeInteger(pageDescriptor.bytes, { positive: true })
      || pageDescriptor.bytes > index.routing.maxPageBytes
      || pageDescriptor.bytes > MAX_PUBLIC_FILE_BYTES || !isSha256(pageDescriptor.sha256)
      || !Array.isArray(pageDescriptor.range) || pageDescriptor.range.length !== 2
      || pageDescriptor.range.some((value) => !isNonEmptyString(value))) {
      fail(`${location} has an unsafe path, size, checksum, count, or range`);
    }
    if (previousPageRangeEnd !== null
      && compareUnicodeCodePoints(previousPageRangeEnd, pageDescriptor.range[0]) >= 0) {
      fail(`${location} overlaps the preceding routing page`);
    }
    previousPageRangeEnd = pageDescriptor.range[1];
    expectedFiles.add(`views/${VIEW_ID}/${pageDescriptor.file}`);
    const routingPath = path.join(productRoot, 'views', VIEW_ID, pageDescriptor.file);
    const { buffer: routingBuffer, value: routingPage } = await readJson(routingPath, `BLKT routing page ${pageIndex}`);
    if (routingBuffer.byteLength !== pageDescriptor.bytes
      || routingBuffer.byteLength > index.routing.maxPageBytes
      || routingBuffer.byteLength > MAX_PUBLIC_FILE_BYTES
      || createHash('sha256').update(routingBuffer).digest('hex') !== pageDescriptor.sha256) {
      fail(`BLKT routing page ${pageIndex} violates its byte limit, checksum, or descriptor`);
    }
    assertNoForbiddenKeys(routingPage, forbiddenKeys, `routing[${pageIndex}]`);
    assertOnlyApprovedMetadataKeys(routingPage, `routing[${pageIndex}]`);
    assertObjectShape(routingPage, ['schemaVersion', 'productId', 'viewId', 'page', 'notice', 'chunks'], [], `routing[${pageIndex}]`);
    if (routingPage.schemaVersion !== 1 || routingPage.productId !== PRODUCT_ID
      || routingPage.viewId !== VIEW_ID || routingPage.page !== pageIndex
      || !isDeepStrictEqual(routingPage.notice, policy.fileNotice)
      || !Array.isArray(routingPage.chunks)
      || routingPage.chunks.length !== pageDescriptor.chunks || routingPage.chunks.length === 0) {
      fail(`BLKT routing page ${pageIndex} has unexpected metadata or chunk count`);
    }

    const firstPageRange = routingPage.chunks[0]?.range?.[0];
    const lastPageRange = routingPage.chunks.at(-1)?.range?.[1];
    let pageRecords = 0;
    for (const descriptor of routingPage.chunks) {
      const chunkIndex = chunkCount;
      assertObjectShape(descriptor, ['file', 'records', 'bytes', 'sha256', 'range'], [], `routing[${pageIndex}].chunks[${chunkIndex}]`);
      if (!safeChunkPath(descriptor.file, chunkIndex) || !isSafeInteger(descriptor.records, { positive: true })
        || !isSafeInteger(descriptor.bytes, { positive: true }) || descriptor.bytes > index.maxChunkBytes
        || descriptor.bytes > MAX_PUBLIC_FILE_BYTES || !isSha256(descriptor.sha256)
        || !Array.isArray(descriptor.range) || descriptor.range.length !== 2) {
        fail(`routing[${pageIndex}].chunks[${chunkIndex}] has an unsafe path, size, checksum, count, or range`);
      }
      expectedFiles.add(`views/${VIEW_ID}/${descriptor.file}`);
      const chunkPath = path.join(productRoot, 'views', VIEW_ID, descriptor.file);
      const { buffer, value: chunk } = await readJson(chunkPath, `BLKT chunk ${chunkIndex}`);
      if (buffer.byteLength !== descriptor.bytes || buffer.byteLength > index.maxChunkBytes
        || buffer.byteLength > MAX_PUBLIC_FILE_BYTES) {
        fail(`BLKT chunk ${chunkIndex} violates its byte limit or descriptor`);
      }
      if (createHash('sha256').update(buffer).digest('hex') !== descriptor.sha256) {
        fail(`BLKT chunk ${chunkIndex} checksum does not match its descriptor`);
      }
      assertNoForbiddenKeys(chunk, forbiddenKeys, `chunks[${chunkIndex}]`);
      assertOnlyApprovedMetadataKeys(chunk, `chunks[${chunkIndex}]`);
      assertObjectShape(chunk, ['schemaVersion', 'productId', 'viewId', 'chunk', 'notice', 'records'], [], `chunks[${chunkIndex}]`);
      if (chunk.schemaVersion !== 1 || chunk.productId !== PRODUCT_ID || chunk.viewId !== VIEW_ID
        || chunk.chunk !== chunkIndex || !isDeepStrictEqual(chunk.notice, policy.fileNotice)
        || !Array.isArray(chunk.records)
        || chunk.records.length !== descriptor.records || chunk.records.length === 0) {
        fail(`BLKT chunk ${chunkIndex} has unexpected metadata or record count`);
      }
      for (const [recordIndex, record] of chunk.records.entries()) {
        assertBlktAggregateRecord(record, profile, `chunks[${chunkIndex}].records[${recordIndex}]`);
        const word = record[0];
        if (previousWord !== null && compareUnicodeCodePoints(previousWord, word) >= 0) {
          fail(`chunks[${chunkIndex}].records[${recordIndex}] is not in strict lookup order`);
        }
        previousWord = word;
        accumulateRecord(record, totals, nullCounts);
        records += 1;
        pageRecords += 1;
      }
      const actualRange = [chunk.records[0][0], chunk.records.at(-1)[0]];
      if (!isDeepStrictEqual(descriptor.range, actualRange)) fail(`BLKT chunk ${chunkIndex} does not match its exact lookup range`);
      if (previousRangeEnd !== null && compareUnicodeCodePoints(previousRangeEnd, descriptor.range[0]) >= 0) {
        fail(`BLKT chunk ${chunkIndex} range overlaps the preceding exact lookup range`);
      }
      previousRangeEnd = descriptor.range[1];
      chunkCount += 1;
    }
    if (pageRecords !== pageDescriptor.records
      || !isDeepStrictEqual(pageDescriptor.range, [firstPageRange, lastPageRange])) {
      fail(`BLKT routing page ${pageIndex} does not reconcile with its descriptor`);
    }
  }

  if (records !== index.summary.recordCount || !isDeepStrictEqual(totals, index.summary.numericTotals)
    || !isDeepStrictEqual(nullCounts, index.summary.nullCounts)) {
    fail('public BLKT records do not reconcile with the approved index summary');
  }

  const tree = await listPublicTree(productRoot);
  assertTreeMatches(tree.files, expectedFiles, 'public BLKT file tree');
  assertTreeMatches(tree.directories, new Set([
    'views', `views/${VIEW_ID}`, `views/${VIEW_ID}/chunks`, `views/${VIEW_ID}/routing`
  ]), 'public BLKT directory tree');

  return { productId: PRODUCT_ID, views: 1, routingPages: index.routing.pages.length, chunks: chunkCount, records };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await verifyBlktDisclosure(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
