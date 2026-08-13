import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultStaticRoot = path.join(repositoryRoot, 'static');
const defaultOutputRoot = path.join(defaultStaticRoot, 'data-products');

const NUMERIC_FIELD_TYPES = new Set([
  'raw-token-count',
  'raw-document-count',
  'normalized-token-count',
  'normalized-document-count',
  'coverage-code'
]);
const FIELD_TYPES = new Set([
  'string',
  'source-pos-code',
  'lexical-entry-details',
  ...NUMERIC_FIELD_TYPES
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
const BLKT_RIGHTS = {
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
const BLKT_FILE_NOTICE = {
  modificationNotice: BLKT_RIGHTS.modificationNotice,
  attribution: 'BLKT: Valstybės skaitmeninių sprendimų agentūra (2026); Vikipedija subset: Wikipedia contributors.',
  licenceLocation: 'product-root',
  licences: BLKT_RIGHTS.licences.map(({ name, file }) => ({ name, file }))
};
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
const RIMKUTE_PDF_IDENTITIES = [
  { volume: 'I', artifactId: 'rimkute-morphemic-dictionary-volume-one' },
  { volume: 'II', artifactId: 'rimkute-morphemic-dictionary-volume-two' },
  { volume: 'III', artifactId: 'rimkute-morphemic-dictionary-volume-three' }
];

function fail(message) {
  throw new Error(`Data-product verification failed: ${message}`);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isHttpUrl(value) {
  if (!normalizeString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function assertNoInternalSourceLocator(value, description) {
  for (const key of ['repositoryUrl', 'sourceRepository', 'revision', 'path', 'archiveMember', 'archiveDirectory']) {
    if (Object.hasOwn(value, key)) fail(`${description} discloses an internal source locator`);
  }
}

function validatePublicSourceFile(value, description) {
  if (!isPlainObject(value) || !isSafeId(value.artifactId) || !Number.isSafeInteger(value.bytes)
    || value.bytes < 1 || !isSha256(value.sha256)) {
    fail(`${description} is invalid`);
  }
  assertNoInternalSourceLocator(value, description);
}

function validateDatasetProvenance(value, description) {
  if (!isPlainObject(value) || !isHttpUrl(value.sourceUrl) || !normalizeString(value.licence)
    || !normalizeString(value.citation) || !isPlainObject(value.sourceSnapshot)) {
    fail(`${description} is invalid`);
  }
  assertNoInternalSourceLocator(value, description);
  const snapshot = value.sourceSnapshot;
  if (!isSafeId(snapshot.artifactId) || !Number.isSafeInteger(snapshot.bytes) || snapshot.bytes < 1
    || snapshot.encoding !== 'utf-8' || !isSha256(snapshot.sha256)) {
    fail(`${description}.sourceSnapshot is invalid`);
  }
}

function validateProductProvenance(value, description) {
  if (!isPlainObject(value) || !isHttpUrl(value.sourceUrl) || !normalizeString(value.licence)
    || !normalizeString(value.citation) || !Array.isArray(value.files) || value.files.length === 0) {
    fail(`${description} is invalid`);
  }
  assertNoInternalSourceLocator(value, description);
  for (const [index, file] of value.files.entries()) {
    validatePublicSourceFile(file, `${description}.files[${index}]`);
  }
  if (value.permission !== undefined
    && (!isPlainObject(value.permission) || !normalizeString(value.permission.status)
      || !/^\d{4}-\d{2}-\d{2}$/.test(value.permission.confirmedOn)
      || !normalizeString(value.permission.scope)
      || typeof value.permission.privateCorrespondencePublished !== 'boolean')) {
    fail(`${description}.permission is invalid`);
  }
  if (value.attributionNotice !== undefined && !normalizeString(value.attributionNotice)) {
    fail(`${description}.attributionNotice is invalid`);
  }
  if (value.modificationNotice !== undefined && !normalizeString(value.modificationNotice)) {
    fail(`${description}.modificationNotice is invalid`);
  }
  if (value.downstreamRequirements !== undefined
    && (!Array.isArray(value.downstreamRequirements) || value.downstreamRequirements.length === 0
      || value.downstreamRequirements.some((requirement) => !normalizeString(requirement)))) {
    fail(`${description}.downstreamRequirements is invalid`);
  }
  if (value.extraction !== undefined && !isPlainObject(value.extraction)) {
    fail(`${description}.extraction is invalid`);
  }
}

function validateRimkuteProvenance(value) {
  const extraction = value.extraction;
  const canonicalFile = value.files.find((file) => file.artifactId === 'rimkute-morphemic-dictionary-entries');
  const expectedArtifactIds = [
    ...RIMKUTE_PDF_IDENTITIES.map(({ artifactId }) => artifactId),
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
    && isSha256(extraction.summaryArtifact.sha256);
  const summaryFile = value.files.find((file) => file.artifactId === 'rimkute-morphemic-dictionary-extraction-summary');
  const expectedSummaryFile = extractionIsValid ? {
    artifactId: summaryFile?.artifactId,
    format: summaryFile?.format,
    bytes: summaryFile?.bytes,
    sha256: summaryFile?.sha256
  } : null;
  if (value.licence !== RIMKUTE_RIGHTS.licence
    || !sameObject(value.permission, RIMKUTE_RIGHTS.permission)
    || value.attributionNotice !== RIMKUTE_RIGHTS.attributionNotice
    || value.modificationNotice !== RIMKUTE_RIGHTS.modificationNotice
    || !sameObject(value.downstreamRequirements, RIMKUTE_RIGHTS.downstreamRequirements)
    || !extractionIsValid
    || value.files.length !== expectedArtifactIds.length
    || new Set(value.files.map((file) => file.artifactId)).size !== expectedArtifactIds.length
    || expectedArtifactIds.some((artifactId) => !value.files.some((file) => file.artifactId === artifactId))
    || value.files.filter((file) => file.role !== undefined).length !== 1
    || !canonicalFile || canonicalFile.role !== 'morphemic-entries'
    || canonicalFile.format !== 'text' || canonicalFile.rows !== extraction.rows
    || canonicalFile.columns !== RIMKUTE_COLUMNS.length || canonicalFile.delimiter !== '\t'
    || canonicalFile.hasHeader !== true
    || !summaryFile || summaryFile.format !== 'rimkute-extraction-summary'
    || !sameObject(extraction.summaryArtifact, expectedSummaryFile)
    || RIMKUTE_PDF_IDENTITIES.some((expected) => !value.files.some((file) => file.volume === expected.volume
      && file.artifactId === expected.artifactId && file.format === 'binary'
      && Number.isSafeInteger(file.pages) && file.pages > 0))) {
    fail(`${RIMKUTE_PRODUCT_ID} does not retain the reviewed rightsholder-permission provenance`);
  }
}

function isSafeFieldId(value) {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9]*$/.test(value);
}

function isPathInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveProductPath(root, relativePath, description) {
  if (!normalizeString(relativePath) || path.isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.split('/').includes('..')) {
    fail(`${description} must be a safe relative product path`);
  }
  const resolved = path.resolve(root, relativePath);
  if (!isPathInside(root, resolved)) fail(`${description} escapes the product root`);
  return resolved;
}

function resolveStaticPath(staticRoot, fromDirectory, relativePath, description) {
  if (!normalizeString(relativePath) || path.isAbsolute(relativePath) || relativePath.includes('\\')) {
    fail(`${description} must be a relative static path`);
  }
  const resolved = path.resolve(fromDirectory, relativePath);
  if (!isPathInside(staticRoot, resolved)) fail(`${description} escapes the static root`);
  return resolved;
}

function parseJson(buffer, description) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    fail(`${description} is not valid JSON: ${error instanceof Error ? error.message : error}`);
  }
}

function assertSafeInteger(value, description) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${description} must be a non-negative safe integer`);
}

function sameObject(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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

function prefixFor(value, codePoints) {
  const prefix = Array.from(value.toLocaleLowerCase('lt')).slice(0, codePoints).join('');
  return prefix || '_';
}

function validateField(field, description) {
  if (!isPlainObject(field) || !isSafeFieldId(field.id) || !normalizeString(field.label) || !FIELD_TYPES.has(field.type)) {
    fail(`${description} is invalid`);
  }
  if (field.derived !== undefined && typeof field.derived !== 'boolean') fail(`${description}.derived is invalid`);
  if (field.derived === true) {
    if (field.sourceColumn !== undefined) fail(`${description}.sourceColumn is invalid for a derived field`);
  } else if (!Number.isInteger(field.sourceColumn) || field.sourceColumn < 0) {
    fail(`${description}.sourceColumn is invalid`);
  }
  if (field.type === 'lexical-entry-details' && field.derived !== true) {
    fail(`${description}.lexical-entry-details must be derived`);
  }
  if (field.nullable !== undefined && typeof field.nullable !== 'boolean') fail(`${description}.nullable is invalid`);
  if (NUMERIC_FIELD_TYPES.has(field.type) && !normalizeString(field.unit)) fail(`${description}.unit is invalid`);
  if (field.type === 'coverage-code') {
    if (!isPlainObject(field.values) || Object.entries(field.values).some(([key, value]) => !/^\d+$/.test(key) || !normalizeString(value))) {
      fail(`${description}.values is invalid`);
    }
  } else if (field.values !== undefined) {
    fail(`${description}.values is only valid for a coverage code`);
  }
  if (field.type.startsWith('normalized-')) {
    if (!isPlainObject(field.normalization) || !Number.isSafeInteger(field.normalization.sourceTokens)
      || field.normalization.sourceTokens < 1 || !Number.isSafeInteger(field.normalization.targetTokens)
      || field.normalization.targetTokens < 1) {
      fail(`${description}.normalization is invalid`);
    }
  } else if (field.normalization !== undefined) {
    fail(`${description}.normalization is only valid for a normalized metric`);
  }
}

function validateStringArray(value, description, { allowNull = false } = {}) {
  if (!Array.isArray(value) || value.some((item) => item !== null && !normalizeString(item))
    || (!allowNull && value.some((item) => item === null))) {
    fail(`${description} is invalid`);
  }
}

function validateLexicalEntryDetails(value, description, lexicalCounts) {
  if (!isPlainObject(value) || Object.keys(value).some((key) => !['source', 'senses', 'userGroups', 'variants', 'entryCompilers'].includes(key))
    || !isPlainObject(value.source) || Object.keys(value.source).some((key) => !['name', 'date', 'url'].includes(key))
    || !Object.hasOwn(value.source, 'name') || !Object.hasOwn(value.source, 'date') || !Object.hasOwn(value.source, 'url')) {
    fail(`${description} is invalid`);
  }
  for (const sourceField of ['name', 'date', 'url']) {
    if (value.source[sourceField] !== null && !normalizeString(value.source[sourceField])) {
      fail(`${description}.source.${sourceField} is invalid`);
    }
  }
  if (!Array.isArray(value.senses) || value.senses.length === 0) fail(`${description}.senses is invalid`);
  for (const [senseIndex, sense] of value.senses.entries()) {
    if (!isPlainObject(sense) || Object.keys(sense).some((key) => !['label', 'definitions', 'examples'].includes(key))
      || !Object.hasOwn(sense, 'label') || (sense.label !== null && !normalizeString(sense.label))) {
      fail(`${description}.senses[${senseIndex}] is invalid`);
    }
    validateStringArray(sense.definitions, `${description}.senses[${senseIndex}].definitions`);
    validateStringArray(sense.examples, `${description}.senses[${senseIndex}].examples`, { allowNull: true });
    lexicalCounts.senseCount += 1;
    lexicalCounts.definitionCount += sense.definitions.length;
    lexicalCounts.exampleCount += sense.examples.length;
  }
  validateStringArray(value.userGroups, `${description}.userGroups`);
  validateStringArray(value.variants, `${description}.variants`);
  validateStringArray(value.entryCompilers, `${description}.entryCompilers`);
  if (value.entryCompilers.length === 0) fail(`${description}.entryCompilers is invalid`);
}

function validateRecord(record, fields, description, totals, nullCounts, lexicalCounts) {
  if (!Array.isArray(record) || record.length !== fields.length) fail(`${description} has the wrong record shape`);
  for (const [index, field] of fields.entries()) {
    const value = record[index];
    if (field.type === 'lexical-entry-details') {
      validateLexicalEntryDetails(value, `${description}.${field.id}`, lexicalCounts);
      continue;
    }
    if (!NUMERIC_FIELD_TYPES.has(field.type)) {
      if (value === null) {
        if (field.nullable !== true) fail(`${description} has a null non-nullable ${field.id} field`);
        nullCounts[field.id] += 1;
        continue;
      }
      if (!normalizeString(value)) fail(`${description} has an empty ${field.id} field`);
      continue;
    }
    if (value === null) {
      if (field.nullable !== true) fail(`${description} has a null non-nullable ${field.id} metric`);
      nullCounts[field.id] += 1;
      continue;
    }
    if (!Number.isSafeInteger(value) || value < 0) fail(`${description} has an invalid ${field.id} metric`);
    if (field.type === 'coverage-code' && !Object.hasOwn(field.values, String(value))) {
      fail(`${description} has an unlabelled coverage code`);
    }
    if (SUMMARIZED_FIELD_TYPES.has(field.type)) totals[field.id] += value;
  }
}

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

function validateBlktWordformProfile(manifest) {
  const value = manifest.wordformProfile;
  if (manifest.id !== BLKT_PRODUCT_ID || manifest.productType !== 'chunked-comparison'
    || !isPlainObject(value) || value.schemaVersion !== 1 || value.viewId !== 'wordform-scope-metrics'
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
    fail(`${manifest.id} BLKT wordform profile metadata is invalid`);
  }
  for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens']) {
    if (!Number.isSafeInteger(value.corpus[field]) || value.corpus[field] < 1) {
      fail(`${manifest.id} BLKT corpus denominator is invalid`);
    }
  }
  value.documentTypes.forEach((dimension, index) => validateBlktDimension(dimension, BLKT_TYPE_DIMENSIONS[index], `${manifest.id} BLKT documentTypes[${index}]`));
  value.periods.forEach((dimension, index) => validateBlktDimension(dimension, BLKT_PERIOD_DIMENSIONS[index], `${manifest.id} BLKT periods[${index}]`));
  for (const dimensions of [value.documentTypes, value.periods]) {
    for (const field of ['documents', 'sourceAlphaWords', 'derivedTokens']) {
      if (dimensions.reduce((total, item) => total + item[field], 0) !== value.corpus[field]) {
        fail(`${manifest.id} BLKT ${field} denominators do not reconcile`);
      }
    }
  }
  if (value.sourceLicences.inventory.reduce((total, item) => total + item.documents, 0) !== value.corpus.documents
    || value.sourceLicences.inventory.reduce((total, item) => total + item.sourceAlphaWords, 0) !== value.corpus.sourceAlphaWords) {
    fail(`${manifest.id} BLKT source licence inventory does not reconcile`);
  }
  if (!manifest.views?.some((view) => view.id === value.viewId)) {
    fail(`${manifest.id} BLKT wordform profile view is missing`);
  }
}

async function verifyBlktLicenceFiles(manifest, productDirectory) {
  for (const licence of manifest.wordformProfile.rights.licences) {
    if (!/^[A-Za-z0-9][A-Za-z0-9.-]+\.txt$/.test(licence.file)) {
      fail(`${manifest.id} bundled licence filename is invalid`);
    }
    const filename = resolveProductPath(productDirectory, licence.file, `${manifest.id} bundled licence`);
    const buffer = await readFile(filename);
    const text = buffer.toString('utf8');
    const hasCompleteTerms = licence.id === 'newgenltu-openrail-d-v1.0'
      ? ['Section I: PREAMBLE', 'Section IV: OTHER PROVISIONS', 'Attachment A', '10. Other restrictions']
        .every((marker) => text.includes(marker))
      : ['Attribution-ShareAlike 4.0 International', 'Section 3 -- License Conditions.', 'b. ShareAlike.', 'Section 8 -- Interpretation.']
        .every((marker) => text.includes(marker));
    if (buffer.byteLength < 1024 || buffer.byteLength > 65536
      || createHash('sha256').update(buffer).digest('hex') !== licence.sha256 || !hasCompleteTerms) {
      fail(`${manifest.id} bundled ${licence.name} text is missing, changed, or oversized`);
    }
  }
}

function blktRecordLayout(profile, fields, description) {
  const indexes = new Map(fields.map((field, index) => [field.id, { field, index }]));
  const pair = (value) => {
    const token = indexes.get(value.tokenField);
    const documents = indexes.get(value.documentField);
    if (token?.field.type !== 'raw-token-count' || documents?.field.type !== 'raw-document-count') {
      fail(`${description} references invalid count fields`);
    }
    return [token.index, documents.index];
  };
  return {
    corpus: pair(profile.corpus),
    documentTypes: profile.documentTypes.map(pair),
    periods: profile.periods.map(pair),
    minimumTokenCount: profile.disclosure.minimumTokenCount,
    minimumDocumentSupport: profile.disclosure.minimumDocumentSupport
  };
}

function validateBlktRecordFamily(record, pairs, corpusTokens, corpusDocuments, layout, description) {
  const values = pairs.flatMap(([tokenIndex, documentIndex]) => [record[tokenIndex], record[documentIndex]]);
  if (values.every((value) => value === null)) return;
  if (values.some((value) => value === null)) fail(`${description} is only partly suppressed`);
  let tokens = 0;
  let documents = 0;
  for (const [tokenIndex, documentIndex] of pairs) {
    const tokenCount = record[tokenIndex];
    const documentCount = record[documentIndex];
    if ((tokenCount === 0) !== (documentCount === 0)
      || (tokenCount > 0 && (tokenCount < layout.minimumTokenCount || documentCount < layout.minimumDocumentSupport))
      || documentCount > tokenCount) {
      fail(`${description} violates the disclosure threshold`);
    }
    tokens += tokenCount;
    documents += documentCount;
  }
  if (tokens !== corpusTokens || documents !== corpusDocuments) fail(`${description} does not reconcile with the corpus word total`);
}

function validateBlktRecord(record, layout, description) {
  const [corpusTokenIndex, corpusDocumentIndex] = layout.corpus;
  const corpusTokens = record[corpusTokenIndex];
  const corpusDocuments = record[corpusDocumentIndex];
  if (!Number.isSafeInteger(corpusTokens) || corpusTokens < layout.minimumTokenCount
    || !Number.isSafeInteger(corpusDocuments) || corpusDocuments < layout.minimumDocumentSupport
    || corpusDocuments > corpusTokens) {
    fail(`${description} violates the corpus disclosure threshold`);
  }
  validateBlktRecordFamily(record, layout.documentTypes, corpusTokens, corpusDocuments, layout, `${description} document-type family`);
  validateBlktRecordFamily(record, layout.periods, corpusTokens, corpusDocuments, layout, `${description} period family`);
}

function validatedDerivedSourceRows({ derivation, fields, totals, lexicalCounts, viewRecords, description }) {
  if (!isPlainObject(derivation) || !isPlainObject(derivation.expectedSummary)) {
    fail(`${description} derivation metadata is invalid`);
  }
  const expected = derivation.expectedSummary;
  if (!Number.isSafeInteger(expected.sourceRows) || expected.sourceRows < viewRecords
    || expected.recordCount !== viewRecords) {
    fail(`${description} derivation metadata is invalid`);
  }
  if (derivation.type === 'conllu-frequency') {
    const countField = fields.find((field) => field.id === 'count' && field.type === 'raw-token-count');
    if (!countField || !Number.isSafeInteger(expected.totalFrequency) || expected.totalFrequency < 0
      || totals.count !== expected.totalFrequency) {
      fail(`${description} derivation metadata is invalid`);
    }
  } else if (derivation.type === 'name-transliteration') {
    const countField = fields.find((field) => field.id === 'sourceMatchCount' && field.type === 'raw-token-count');
    if (!countField || !Number.isSafeInteger(expected.totalFrequency) || expected.totalFrequency < 0
      || totals.sourceMatchCount !== expected.totalFrequency) {
      fail(`${description} derivation metadata is invalid`);
    }
  } else if (derivation.type === 'nvh-lexicon') {
    if (!Number.isSafeInteger(derivation.recordPageEntryCount) || derivation.recordPageEntryCount < 0
      || !Number.isSafeInteger(expected.senseCount) || expected.senseCount !== lexicalCounts.senseCount
      || !Number.isSafeInteger(expected.definitionCount) || expected.definitionCount !== lexicalCounts.definitionCount
      || !Number.isSafeInteger(expected.exampleCount) || expected.exampleCount !== lexicalCounts.exampleCount) {
      fail(`${description} derivation metadata is invalid`);
    }
  } else if (derivation.type === 'conllu-treebank-syntax-context') {
    // The syntax-context builder pins its own source-row and output-row totals.
  } else {
    fail(`${description} uses an unsupported derivation type`);
  }
  return expected.sourceRows;
}

function expectedTotals(fields) {
  return Object.fromEntries(fields.filter((field) => SUMMARIZED_FIELD_TYPES.has(field.type)).map((field) => [field.id, 0]));
}

function expectedNullCounts(fields) {
  return Object.fromEntries(fields.filter((field) => field.nullable === true).map((field) => [field.id, 0]));
}

function validateFrequencyBands(bands, description) {
  if (!Array.isArray(bands) || bands.length === 0) fail(`${description} is invalid`);
  const ids = new Set();
  let previousMaximum = 0;
  for (const [index, band] of bands.entries()) {
    if (!isPlainObject(band) || !isSafeId(band.id) || !normalizeString(band.label)
      || !Number.isSafeInteger(band.minimum) || band.minimum < 1
      || (band.maximum !== null && (!Number.isSafeInteger(band.maximum) || band.maximum < band.minimum))) {
      fail(`${description}[${index}] is invalid`);
    }
    if (previousMaximum === null) fail(`${description} has a band after an open-ended band`);
    if (ids.has(band.id) || band.minimum !== previousMaximum + 1) {
      fail(`${description} must use unique, contiguous bands starting at 1`);
    }
    ids.add(band.id);
    previousMaximum = band.maximum;
  }
  if (previousMaximum !== null) fail(`${description} must end with an open-ended band`);
}

function validateProfileDrilldownFields(fields, description) {
  if (!Array.isArray(fields) || fields.length !== 2) fail(`${description} is invalid`);
  const [word, frequency] = fields;
  if (!isPlainObject(word) || !isSafeFieldId(word.id) || !normalizeString(word.label) || word.type !== 'string'
    || !isPlainObject(frequency) || !isSafeFieldId(frequency.id) || !normalizeString(frequency.label)
    || frequency.type !== 'raw-token-count' || !normalizeString(frequency.unit)) {
    fail(`${description} is invalid`);
  }
}

function compareDrilldownRecords(left, right) {
  if (left[1] !== right[1]) return right[1] - left[1];
  return left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0;
}

function validateProfileOrdering(ordering, frequencyFieldId, description) {
  if (!isPlainObject(ordering) || ordering.field !== frequencyFieldId || ordering.direction !== 'descending'
    || ordering.tieBreak !== 'word-ascending') {
    fail(`${description} is invalid`);
  }
}

function findField(fields, id, type) {
  return fields.find((field) => field.id === id && field.type === type);
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

async function verifyFrequencyBandCoverageProfile({ productManifest, productDirectory, descriptor }) {
  if (!isPlainObject(descriptor) || descriptor.type !== 'frequency-band-coverage' || !isSafeId(descriptor.id) || !normalizeString(descriptor.title)
    || !normalizeString(descriptor.description) || !normalizeString(descriptor.manifest)) {
    fail(`${productManifest.id} has an invalid analysis-profile descriptor`);
  }
  const profilePath = resolveProductPath(productDirectory, descriptor.manifest, `${productManifest.id}/${descriptor.id} profile`);
  const profileDirectory = path.dirname(profilePath);
  const profileBuffer = await readFile(profilePath);
  const profile = parseJson(profileBuffer, `${productManifest.id}/${descriptor.id} profile`);
  if (!isPlainObject(profile) || profile.schemaVersion !== 1 || profile.productId !== productManifest.id
    || profile.profileId !== descriptor.id || profile.profileType !== 'frequency-band-coverage'
    || profile.title !== descriptor.title || profile.description !== descriptor.description
    || !isPlainObject(profile.sourceView) || !isSafeId(profile.sourceView.id) || !isSafeId(profile.sourceView.sourceRole)
    || !isPlainObject(profile.provenance) || !isPlainObject(profile.delivery) || !isPlainObject(profile.drilldown) || !isPlainObject(profile.summary)) {
    fail(`${productManifest.id}/${descriptor.id} profile is invalid`);
  }
  if (!Number.isSafeInteger(profile.delivery.summaryMaxBytes) || profile.delivery.summaryMaxBytes < 1024
    || profileBuffer.byteLength > profile.delivery.summaryMaxBytes) {
    fail(`${productManifest.id}/${descriptor.id} profile summary exceeds its delivery budget`);
  }
  if (profile.provenance.sourceUrl !== productManifest.provenance?.sourceUrl
    || profile.provenance.licence !== productManifest.provenance?.licence
    || profile.provenance.citation !== productManifest.provenance?.citation
    || !isPlainObject(profile.provenance.sourceFile)) {
    fail(`${productManifest.id}/${descriptor.id} profile provenance is invalid`);
  }
  validatePublicSourceFile(profile.provenance.sourceFile, `${productManifest.id}/${descriptor.id} profile provenance.sourceFile`);
  const sourceView = productManifest.views?.find((view) => view.id === profile.sourceView.id && view.sourceRole === profile.sourceView.sourceRole);
  if (!sourceView) fail(`${productManifest.id}/${descriptor.id} profile does not reference a published source view`);
  const sourceIndexPath = resolveProductPath(productDirectory, sourceView.index, `${productManifest.id}/${descriptor.id} source index`);
  const sourceIndex = parseJson(await readFile(sourceIndexPath), `${productManifest.id}/${descriptor.id} source index`);
  if (!isPlainObject(sourceIndex) || !Array.isArray(sourceIndex.fields) || !sameObject(profile.provenance.sourceFile, sourceIndex.sourceFile)) {
    fail(`${productManifest.id}/${descriptor.id} profile source metadata is invalid`);
  }
  const wordField = findField(sourceIndex.fields, profile.sourceView.wordField?.id, 'string');
  const frequencyField = findField(sourceIndex.fields, profile.sourceView.frequencyField?.id, 'raw-token-count');
  const coverageField = findField(sourceIndex.fields, profile.sourceView.coverageField?.id, 'coverage-code');
  if (!wordField || !frequencyField || !coverageField || !sameObject(profile.sourceView.wordField, { id: wordField.id, label: wordField.label })
    || !sameObject(profile.sourceView.frequencyField, { id: frequencyField.id, label: frequencyField.label, unit: frequencyField.unit })
    || !sameObject(profile.sourceView.coverageField, { id: coverageField.id, label: coverageField.label, values: coverageField.values })) {
    fail(`${productManifest.id}/${descriptor.id} profile source fields are invalid`);
  }
  if (!Number.isSafeInteger(profile.drilldown.limit) || profile.drilldown.limit < 1 || profile.drilldown.limit > 100
    || !Number.isSafeInteger(profile.drilldown.maxBytes) || profile.drilldown.maxBytes < 1024
    || profile.drilldown.recordEncoding !== 'array') {
    fail(`${productManifest.id}/${descriptor.id} profile drill-down metadata is invalid`);
  }
  validateProfileDrilldownFields(profile.drilldown.fields, `${productManifest.id}/${descriptor.id} profile drill-down fields`);
  validateProfileOrdering(profile.drilldown.ordering, frequencyField.id, `${productManifest.id}/${descriptor.id} profile drill-down ordering`);
  if (!Number.isSafeInteger(profile.summary.sourceRows) || profile.summary.sourceRows < 1
    || profile.summary.totalTypeCount !== profile.summary.sourceRows
    || !Number.isSafeInteger(profile.summary.totalTokenCount) || profile.summary.totalTokenCount < 1) {
    fail(`${productManifest.id}/${descriptor.id} profile summary is invalid`);
  }
  if (profile.provenance.sourceFile.rows !== profile.summary.sourceRows) {
    fail(`${productManifest.id}/${descriptor.id} profile source rows do not reconcile`);
  }
  validateFrequencyBands(profile.summary.bands, `${productManifest.id}/${descriptor.id} profile bands`);
  const coverageCodes = Object.keys(coverageField.values).map(Number).sort((left, right) => left - right);
  let totalTypeCount = 0;
  let totalTokenCount = 0;
  for (const band of profile.summary.bands) {
    if (!Number.isSafeInteger(band.typeCount) || band.typeCount < 0 || !Number.isSafeInteger(band.tokenCount) || band.tokenCount < 0
      || !Array.isArray(band.categories) || band.categories.length !== coverageCodes.length) {
      fail(`${productManifest.id}/${descriptor.id} profile band ${band.id} is invalid`);
    }
    const seenCoverageCodes = new Set();
    let bandTypeCount = 0;
    let bandTokenCount = 0;
    for (const category of band.categories) {
      if (!isPlainObject(category) || !Number.isSafeInteger(category.coverageCode) || !coverageCodes.includes(category.coverageCode)
        || seenCoverageCodes.has(category.coverageCode) || !Number.isSafeInteger(category.typeCount) || category.typeCount < 0
        || !Number.isSafeInteger(category.tokenCount) || category.tokenCount < 0 || !isPlainObject(category.drilldown)) {
        fail(`${productManifest.id}/${descriptor.id} profile category is invalid`);
      }
      seenCoverageCodes.add(category.coverageCode);
      const drilldownDescriptor = category.drilldown;
      if (!normalizeString(drilldownDescriptor.file) || !Number.isSafeInteger(drilldownDescriptor.records)
        || drilldownDescriptor.records < 0 || drilldownDescriptor.records > profile.drilldown.limit
        || !Number.isSafeInteger(drilldownDescriptor.bytes) || drilldownDescriptor.bytes < 1
        || !/^[a-f0-9]{64}$/.test(drilldownDescriptor.sha256)) {
        fail(`${productManifest.id}/${descriptor.id} profile drill-down descriptor is invalid`);
      }
      const drilldownPath = resolveProductPath(profileDirectory, drilldownDescriptor.file, `${productManifest.id}/${descriptor.id} drill-down`);
      const buffer = await readFile(drilldownPath);
      if (buffer.byteLength !== drilldownDescriptor.bytes || buffer.byteLength > profile.drilldown.maxBytes
        || createHash('sha256').update(buffer).digest('hex') !== drilldownDescriptor.sha256) {
        fail(`${productManifest.id}/${descriptor.id} profile drill-down bytes are invalid`);
      }
      const drilldown = parseJson(buffer, `${productManifest.id}/${descriptor.id} drill-down`);
      if (!isPlainObject(drilldown) || drilldown.schemaVersion !== 1 || drilldown.productId !== productManifest.id
        || drilldown.profileId !== descriptor.id || drilldown.bandId !== band.id || drilldown.coverageCode !== category.coverageCode
        || drilldown.recordEncoding !== 'array' || !sameObject(drilldown.fields, profile.drilldown.fields)
        || !sameObject(drilldown.ordering, profile.drilldown.ordering) || !Array.isArray(drilldown.records)
        || drilldown.records.length !== drilldownDescriptor.records) {
        fail(`${productManifest.id}/${descriptor.id} profile drill-down is invalid`);
      }
      let previousRecord = null;
      for (const record of drilldown.records) {
        if (!Array.isArray(record) || record.length !== 2 || !normalizeString(record[0])
          || !Number.isSafeInteger(record[1]) || record[1] < band.minimum
          || (band.maximum !== null && record[1] > band.maximum)
          || (previousRecord && compareDrilldownRecords(previousRecord, record) > 0)) {
          fail(`${productManifest.id}/${descriptor.id} profile drill-down record is invalid`);
        }
        previousRecord = record;
      }
      bandTypeCount += category.typeCount;
      bandTokenCount += category.tokenCount;
    }
    if (seenCoverageCodes.size !== coverageCodes.length || bandTypeCount !== band.typeCount || bandTokenCount !== band.tokenCount) {
      fail(`${productManifest.id}/${descriptor.id} profile category totals do not reconcile`);
    }
    totalTypeCount += band.typeCount;
    totalTokenCount += band.tokenCount;
  }
  if (totalTypeCount !== profile.summary.totalTypeCount || totalTokenCount !== profile.summary.totalTokenCount) {
    fail(`${productManifest.id}/${descriptor.id} profile totals do not reconcile`);
  }
}

function lookupBucketIdForWord(routingNodes, normalizedWord) {
  const characters = Array.from(normalizedWord);
  let nodeId = 0;
  let characterIndex = 0;
  for (let steps = 0; steps <= characters.length + routingNodes.length; steps += 1) {
    const node = routingNodes[nodeId];
    if (characterIndex === characters.length) return node.terminalBucket;
    const target = node.children.get(characters[characterIndex]);
    if (target === undefined) return null;
    if (target >= 0) return target;
    nodeId = -target - 1;
    characterIndex += 1;
  }
  fail('lookup routing contains a cycle');
}

async function verifyNormalizedContrastLookupProfile({ productManifest, productDirectory, descriptor }) {
  if (!isPlainObject(descriptor) || descriptor.type !== 'normalized-contrast-lookup' || !isSafeId(descriptor.id)
    || !normalizeString(descriptor.title) || !normalizeString(descriptor.description) || !normalizeString(descriptor.manifest)) {
    fail(`${productManifest.id} has an invalid normalized-contrast profile descriptor`);
  }
  const profilePath = resolveProductPath(productDirectory, descriptor.manifest, `${productManifest.id}/${descriptor.id} profile`);
  const profileDirectory = path.dirname(profilePath);
  const profileBuffer = await readFile(profilePath);
  const profile = parseJson(profileBuffer, `${productManifest.id}/${descriptor.id} profile`);
  if (!isPlainObject(profile) || profile.schemaVersion !== 1 || profile.productId !== productManifest.id
    || profile.profileId !== descriptor.id || profile.profileType !== 'normalized-contrast-lookup'
    || profile.title !== descriptor.title || profile.description !== descriptor.description || !isPlainObject(profile.sourceView)
    || !Array.isArray(profile.sources) || !isPlainObject(profile.contrast) || !isPlainObject(profile.provenance)
    || !isPlainObject(profile.delivery) || !isPlainObject(profile.lookup) || !isPlainObject(profile.summary)) {
    fail(`${productManifest.id}/${descriptor.id} profile is invalid`);
  }
  if (!Number.isSafeInteger(profile.delivery.summaryMaxBytes) || profile.delivery.summaryMaxBytes < 1024
    || profileBuffer.byteLength > profile.delivery.summaryMaxBytes
    || !Number.isSafeInteger(profile.delivery.lookupBucketMaxBytes) || profile.delivery.lookupBucketMaxBytes < 8192
    || profile.delivery.lookupBucketMaxBytes > 262144 || !Number.isSafeInteger(profile.delivery.maxSourceRowsPerWord)
    || profile.delivery.maxSourceRowsPerWord < 1 || profile.delivery.maxSourceRowsPerWord > 16) {
    fail(`${productManifest.id}/${descriptor.id} profile delivery metadata is invalid`);
  }
  if (profile.provenance.sourceUrl !== productManifest.provenance?.sourceUrl
    || profile.provenance.licence !== productManifest.provenance?.licence
    || profile.provenance.citation !== productManifest.provenance?.citation
    || !isPlainObject(profile.provenance.sourceFile)) {
    fail(`${productManifest.id}/${descriptor.id} profile provenance is invalid`);
  }
  validatePublicSourceFile(profile.provenance.sourceFile, `${productManifest.id}/${descriptor.id} profile provenance.sourceFile`);
  const sourceView = productManifest.views?.find((view) => view.id === profile.sourceView.id && view.sourceRole === profile.sourceView.sourceRole);
  if (!sourceView || profile.sourceView.index !== sourceView.index || !Array.isArray(profile.sourceView.fields)
    || !isPlainObject(profile.sourceView.wordField) || !isPlainObject(profile.sourceView.summary)) {
    fail(`${productManifest.id}/${descriptor.id} profile source view is invalid`);
  }
  const sourceIndexPath = resolveProductPath(productDirectory, sourceView.index, `${productManifest.id}/${descriptor.id} source index`);
  const sourceIndex = parseJson(await readFile(sourceIndexPath), `${productManifest.id}/${descriptor.id} source index`);
  if (!isPlainObject(sourceIndex) || !Array.isArray(sourceIndex.fields) || !isPlainObject(sourceIndex.summary)
    || !Array.isArray(sourceIndex.chunks) || !sameObject(profile.sourceView.fields, sourceIndex.fields)
    || !sameObject(profile.sourceView.summary, sourceIndex.summary)
    || !sameObject(profile.provenance.sourceFile, sourceIndex.sourceFile)) {
    fail(`${productManifest.id}/${descriptor.id} profile source metadata is invalid`);
  }
  const wordField = findField(sourceIndex.fields, profile.sourceView.wordField.id, 'string');
  if (!wordField || !sameObject(profile.sourceView.wordField, { id: wordField.id, label: wordField.label })) {
    fail(`${productManifest.id}/${descriptor.id} profile word field is invalid`);
  }
  const sourceIds = new Set();
  const usedMetricFields = new Set();
  let targetTokens = null;
  let unit = null;
  for (const source of profile.sources) {
    if (!isPlainObject(source) || !isSafeId(source.id) || !normalizeString(source.label)
      || !isPlainObject(source.tokenField) || !isPlainObject(source.documentField) || sourceIds.has(source.id)) {
      fail(`${productManifest.id}/${descriptor.id} profile source is invalid`);
    }
    const tokenField = findField(sourceIndex.fields, source.tokenField.id, 'normalized-token-count');
    const documentField = findField(sourceIndex.fields, source.documentField.id, 'normalized-document-count');
    if (!tokenField || !documentField || tokenField.nullable !== true || documentField.nullable !== true
      || tokenField.normalization.sourceTokens !== documentField.normalization.sourceTokens
      || tokenField.normalization.targetTokens !== documentField.normalization.targetTokens
      || usedMetricFields.has(tokenField.id) || usedMetricFields.has(documentField.id)
      || !sameObject(source.tokenField, publicNormalizedMetricField(tokenField))
      || !sameObject(source.documentField, publicNormalizedMetricField(documentField))) {
      fail(`${productManifest.id}/${descriptor.id} profile metric fields are invalid`);
    }
    if (targetTokens === null) targetTokens = tokenField.normalization.targetTokens;
    if (unit === null) unit = tokenField.unit;
    if (targetTokens !== tokenField.normalization.targetTokens || unit !== tokenField.unit) {
      fail(`${productManifest.id}/${descriptor.id} profile uses incompatible token normalization units`);
    }
    sourceIds.add(source.id);
    usedMetricFields.add(tokenField.id);
    usedMetricFields.add(documentField.id);
  }
  if (profile.sources.length < 2 || !Number.isSafeInteger(profile.contrast.minimumRate) || profile.contrast.minimumRate < 1
    || profile.contrast.unit !== unit || profile.contrast.targetTokens !== targetTokens
    || profile.contrast.formula !== 'log2(numeratorRate / denominatorRate)' || !Array.isArray(profile.contrast.pairs)
    || profile.contrast.pairs.length === 0) {
    fail(`${productManifest.id}/${descriptor.id} profile contrast metadata is invalid`);
  }
  const pairIds = new Set();
  for (const pair of profile.contrast.pairs) {
    if (!isPlainObject(pair) || !isSafeId(pair.id) || !normalizeString(pair.label)
      || !isSafeId(pair.numeratorSource) || !isSafeId(pair.denominatorSource)
      || pair.numeratorSource === pair.denominatorSource || !sourceIds.has(pair.numeratorSource)
      || !sourceIds.has(pair.denominatorSource) || pairIds.has(pair.id)) {
      fail(`${productManifest.id}/${descriptor.id} profile contrast pair is invalid`);
    }
    pairIds.add(pair.id);
  }
  const lookup = profile.lookup;
  if (lookup.normalization !== 'trim-nfc-uppercase-lt' || lookup.recordEncoding !== 'array'
    || !Array.isArray(lookup.fields) || !sameObject(lookup.fields, [
      { id: 'normalizedWord', label: 'Normalized lookup word form', type: 'string' },
      { id: 'sourceRow', label: 'Zero-based source row', type: 'source-row' }
    ]) || !isPlainObject(lookup.routing) || lookup.routing.root !== 0 || !Array.isArray(lookup.routing.nodes)
    || lookup.routing.nodes.length === 0 || !Array.isArray(lookup.routing.buckets)
    || lookup.routing.buckets.length === 0) {
    fail(`${productManifest.id}/${descriptor.id} profile lookup metadata is invalid`);
  }
  const routingNodes = [];
  for (const [nodeIndex, node] of lookup.routing.nodes.entries()) {
    if (!isPlainObject(node) || (node.terminalBucket !== null && !Number.isSafeInteger(node.terminalBucket))
      || !Array.isArray(node.children)) {
      fail(`${productManifest.id}/${descriptor.id} profile lookup node ${nodeIndex} is invalid`);
    }
    const children = new Map();
    for (const child of node.children) {
      if (!Array.isArray(child) || child.length !== 2 || typeof child[0] !== 'string' || child[0].length === 0
        || Array.from(child[0]).length !== 1 || !Number.isSafeInteger(child[1]) || children.has(child[0])) {
        fail(`${productManifest.id}/${descriptor.id} profile lookup node ${nodeIndex} child is invalid`);
      }
      children.set(child[0], child[1]);
    }
    routingNodes.push({ terminalBucket: node.terminalBucket, children });
  }
  const bucketCount = lookup.routing.buckets.length;
  const validTarget = (target) => (target >= 0 ? target < bucketCount : -target - 1 < routingNodes.length);
  for (const [nodeIndex, node] of routingNodes.entries()) {
    if ((node.terminalBucket !== null && (!validTarget(node.terminalBucket) || node.terminalBucket < 0))
      || [...node.children.values()].some((target) => !validTarget(target))) {
      fail(`${productManifest.id}/${descriptor.id} profile lookup node ${nodeIndex} references an invalid target`);
    }
  }
  const sourceRows = sourceIndex.summary.recordCount;
  if (!Number.isSafeInteger(sourceRows) || sourceRows < 1 || sourceIndex.summary.sourceRows !== sourceRows) {
    fail(`${productManifest.id}/${descriptor.id} profile source rows are invalid`);
  }
  const seenSourceRows = new Uint8Array(sourceRows);
  let seenSourceRowCount = 0;
  let uniqueNormalizedWordForms = 0;
  let duplicateNormalizedWordForms = 0;
  let extraDuplicateRows = 0;
  let maxSourceRowsPerWord = 0;
  for (const [bucketIndex, bucket] of lookup.routing.buckets.entries()) {
    if (!isPlainObject(bucket) || bucket.id !== bucketIndex || !normalizeString(bucket.file)
      || !Number.isSafeInteger(bucket.records) || bucket.records < 1 || !Number.isSafeInteger(bucket.bytes)
      || bucket.bytes < 1 || bucket.bytes > profile.delivery.lookupBucketMaxBytes
      || !/^[a-f0-9]{64}$/.test(bucket.sha256)) {
      fail(`${productManifest.id}/${descriptor.id} profile lookup bucket descriptor is invalid`);
    }
    const bucketPath = resolveProductPath(profileDirectory, bucket.file, `${productManifest.id}/${descriptor.id} lookup bucket`);
    const buffer = await readFile(bucketPath);
    if (buffer.byteLength !== bucket.bytes || createHash('sha256').update(buffer).digest('hex') !== bucket.sha256) {
      fail(`${productManifest.id}/${descriptor.id} profile lookup bucket bytes are invalid`);
    }
    const content = parseJson(buffer, `${productManifest.id}/${descriptor.id} lookup bucket`);
    if (!isPlainObject(content) || content.schemaVersion !== 1 || content.productId !== productManifest.id
      || content.profileId !== descriptor.id || content.bucketId !== bucket.id || content.recordEncoding !== 'array'
      || !Array.isArray(content.records) || content.records.length !== bucket.records) {
      fail(`${productManifest.id}/${descriptor.id} profile lookup bucket content is invalid`);
    }
    const wordOccurrences = new Map();
    for (const record of content.records) {
      if (!Array.isArray(record) || record.length !== 2 || !normalizeString(record[0])
        || normalizeLookupWord(record[0]) !== record[0] || !Number.isSafeInteger(record[1])
        || record[1] < 0 || record[1] >= sourceRows || seenSourceRows[record[1]] === 1
        || lookupBucketIdForWord(routingNodes, record[0]) !== bucket.id) {
        fail(`${productManifest.id}/${descriptor.id} profile lookup record is invalid`);
      }
      seenSourceRows[record[1]] = 1;
      seenSourceRowCount += 1;
      wordOccurrences.set(record[0], (wordOccurrences.get(record[0]) ?? 0) + 1);
    }
    for (const occurrences of wordOccurrences.values()) {
      uniqueNormalizedWordForms += 1;
      maxSourceRowsPerWord = Math.max(maxSourceRowsPerWord, occurrences);
      if (occurrences > 1) {
        duplicateNormalizedWordForms += 1;
        extraDuplicateRows += occurrences - 1;
      }
    }
  }
  if (seenSourceRowCount !== sourceRows || maxSourceRowsPerWord > profile.delivery.maxSourceRowsPerWord
    || !sameObject(profile.summary, {
      lookupRecords: sourceRows,
      uniqueNormalizedWordForms,
      duplicateNormalizedWordForms,
      extraDuplicateRows,
      maxSourceRowsPerWord,
      sourceRows
    })) {
    fail(`${productManifest.id}/${descriptor.id} profile lookup summary does not reconcile`);
  }
}

function normalizeCcllGenreWordform(value) {
  const word = normalizeString(value);
  return word ? word.normalize('NFC') : '';
}

function ccllGenreBucketDescriptor(value, maxBytes, description) {
  if (!isPlainObject(value) || !Number.isSafeInteger(value.id) || value.id < 0
    || !normalizeString(value.file) || !value.file.startsWith('buckets/')
    || !Number.isSafeInteger(value.records) || value.records < 1
    || !Number.isSafeInteger(value.bytes) || value.bytes < 1 || value.bytes > maxBytes
    || !isSha256(value.sha256)) {
    fail(`${description} is invalid`);
  }
  resolveProductPath('', value.file, description);
  return value;
}

function ccllGenreLookupFields(sources) {
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

async function verifyCcllGenreWordformLookupProfile({ productManifest, productDirectory, descriptor }) {
  if (!isPlainObject(descriptor) || descriptor.type !== 'ccll-genre-wordform-lookup' || !isSafeId(descriptor.id)
    || !normalizeString(descriptor.title) || !normalizeString(descriptor.description)
    || !normalizeString(descriptor.manifest)) {
    fail(`${productManifest.id} has an invalid CCLL genre profile descriptor`);
  }
  const profilePath = resolveProductPath(productDirectory, descriptor.manifest, `${productManifest.id}/${descriptor.id} profile`);
  const profileDirectory = path.dirname(profilePath);
  const profileBuffer = await readFile(profilePath);
  const profile = parseJson(profileBuffer, `${productManifest.id}/${descriptor.id} profile`);
  if (!isPlainObject(profile) || profile.schemaVersion !== 1 || profile.productId !== productManifest.id
    || profile.profileId !== descriptor.id || profile.profileType !== 'ccll-genre-wordform-lookup'
    || profile.title !== descriptor.title || profile.description !== descriptor.description
    || !isPlainObject(profile.provenance) || !Array.isArray(profile.sources) || !isPlainObject(profile.rate)
    || !isPlainObject(profile.policies) || !isPlainObject(profile.delivery) || !isPlainObject(profile.lookup)
    || !isPlainObject(profile.summary)) {
    fail(`${productManifest.id}/${descriptor.id} profile is invalid`);
  }
  if (!Number.isSafeInteger(profile.delivery.summaryMaxBytes) || profile.delivery.summaryMaxBytes < 1024
    || profile.delivery.summaryMaxBytes > 65536 || profileBuffer.byteLength > profile.delivery.summaryMaxBytes
    || !Number.isSafeInteger(profile.delivery.routingNodeMaxBytes) || profile.delivery.routingNodeMaxBytes < 1024
    || profile.delivery.routingNodeMaxBytes > 65536 || !Number.isSafeInteger(profile.delivery.lookupBucketMaxBytes)
    || profile.delivery.lookupBucketMaxBytes < 1024 || profile.delivery.lookupBucketMaxBytes > 65536) {
    fail(`${productManifest.id}/${descriptor.id} profile delivery metadata is invalid`);
  }
  if (profile.provenance.sourceUrl !== productManifest.provenance?.sourceUrl
    || profile.provenance.licence !== productManifest.provenance?.licence
    || profile.provenance.citation !== productManifest.provenance?.citation) {
    fail(`${productManifest.id}/${descriptor.id} profile provenance is invalid`);
  }
  assertNoInternalSourceLocator(profile.provenance, `${productManifest.id}/${descriptor.id} profile provenance`);
  if (!sameObject(profile.rate, {
    targetTokens: 1000000,
    unit: 'tokens per million source tokens',
    formula: 'rawCount * 1000000 / sourceTokens'
  }) || !sameObject(profile.policies, {
    aggregate: 'excluded',
    punctuation: 'preserve-source-wordforms',
    repeatedTerm: 'reject-duplicate-exact-wordforms-per-source',
    missing: 'not-observed-null',
    threshold: { minimumRawCount: 1, appliesTo: 'exact-lookup-only-no-ranking' },
    ordering: { field: 'word', direction: 'ascending', tieBreak: 'unicode-code-point' }
  }) || profile.lookup.normalization !== 'trim-nfc-preserve-case'
    || profile.lookup.recordEncoding !== 'array' || !normalizeString(profile.lookup.root)
    || !profile.lookup.root.startsWith('routing/nodes/')) {
    fail(`${productManifest.id}/${descriptor.id} profile policy or lookup metadata is invalid`);
  }
  resolveProductPath(profileDirectory, profile.lookup.root, `${productManifest.id}/${descriptor.id} lookup root`);
  if (profile.sources.length !== CCLL_GENRE_PROFILE_SOURCES.length) {
    fail(`${productManifest.id}/${descriptor.id} profile must list all five named subcorpora`);
  }

  const expectedSourceRows = {};
  const expectedSourceTokenTotals = {};
  for (const [sourceIndex, expected] of CCLL_GENRE_PROFILE_SOURCES.entries()) {
    const source = profile.sources[sourceIndex];
    if (!isPlainObject(source) || source.id !== expected.id || source.sourceRole !== expected.sourceRole
      || !normalizeString(source.label) || !Number.isSafeInteger(source.sourceRows) || source.sourceRows < 1
      || !Number.isSafeInteger(source.sourceTokens) || source.sourceTokens < 1 || !isPlainObject(source.sourceFile)
      || !isPlainObject(source.view) || !isSafeId(source.view.id) || !normalizeString(source.view.index)) {
      fail(`${productManifest.id}/${descriptor.id} profile source ${sourceIndex} is invalid`);
    }
    const productSourceFile = productManifest.provenance?.files?.find((file) => file.role === source.sourceRole);
    const sourceView = productManifest.views?.find((view) => view.id === source.view.id && view.sourceRole === source.sourceRole);
    if (!productSourceFile || !sourceView || source.view.index !== sourceView.index
      || !sameObject(source.sourceFile, productSourceFile)) {
      fail(`${productManifest.id}/${descriptor.id} profile source ${source.id} does not match a published source view`);
    }
    validatePublicSourceFile(source.sourceFile, `${productManifest.id}/${descriptor.id} profile source ${source.id}`);
    const sourceIndexPath = resolveProductPath(productDirectory, source.view.index, `${productManifest.id}/${descriptor.id} source ${source.id} index`);
    const index = parseJson(await readFile(sourceIndexPath), `${productManifest.id}/${descriptor.id} source ${source.id} index`);
    const countField = index?.fields?.find((field) => field.id === 'count' && field.type === 'raw-token-count');
    if (!isPlainObject(index) || index.productId !== productManifest.id || index.viewId !== source.view.id
      || !isPlainObject(index.summary) || !sameObject(index.sourceFile, source.sourceFile)
      || !countField || !Number.isSafeInteger(index.summary.sourceRows) || index.summary.sourceRows !== source.sourceRows
      || index.summary.recordCount !== source.sourceRows || !Number.isSafeInteger(index.summary.numericTotals?.count)
      || index.summary.numericTotals.count !== source.sourceTokens) {
      fail(`${productManifest.id}/${descriptor.id} profile source ${source.id} index is invalid`);
    }
    expectedSourceRows[source.id] = source.sourceRows;
    expectedSourceTokenTotals[source.id] = source.sourceTokens;
  }
  if (!sameObject(profile.lookup.fields, ccllGenreLookupFields(profile.sources))) {
    fail(`${productManifest.id}/${descriptor.id} profile lookup fields are invalid`);
  }

  const nodesByFile = new Map();
  const seenNodeIds = new Set();
  const bucketDescriptors = new Map();
  const seenBucketFiles = new Map();
  const pendingNodes = [{ file: profile.lookup.root, prefix: '', nodeId: null }];
  for (let pendingIndex = 0; pendingIndex < pendingNodes.length; pendingIndex += 1) {
    const expected = pendingNodes[pendingIndex];
    if (nodesByFile.has(expected.file)) fail(`${productManifest.id}/${descriptor.id} lookup routing reuses a node`);
    const nodePath = resolveProductPath(profileDirectory, expected.file, `${productManifest.id}/${descriptor.id} lookup routing node`);
    const nodeBuffer = await readFile(nodePath);
    if (nodeBuffer.byteLength > profile.delivery.routingNodeMaxBytes) {
      fail(`${productManifest.id}/${descriptor.id} lookup routing node exceeds its byte budget`);
    }
    const node = parseJson(nodeBuffer, `${productManifest.id}/${descriptor.id} lookup routing node`);
    if (!isPlainObject(node) || node.schemaVersion !== 1 || node.productId !== productManifest.id
      || node.profileId !== descriptor.id || !Number.isSafeInteger(node.nodeId) || node.nodeId < 0
      || (expected.nodeId !== null && node.nodeId !== expected.nodeId) || seenNodeIds.has(node.nodeId)
      || node.prefix !== expected.prefix || !Array.isArray(node.transitions)
      || (node.terminal !== null && !isPlainObject(node.terminal))) {
      fail(`${productManifest.id}/${descriptor.id} lookup routing node is invalid`);
    }
    seenNodeIds.add(node.nodeId);
    const transitions = new Map();
    let previousCharacter = null;
    const registerBucket = (value, description) => {
      const bucket = ccllGenreBucketDescriptor(value, profile.delivery.lookupBucketMaxBytes, description);
      const existingById = bucketDescriptors.get(bucket.id);
      const existingIdForFile = seenBucketFiles.get(bucket.file);
      if (existingById) {
        if (!sameObject(existingById, bucket)) {
          fail(`${productManifest.id}/${descriptor.id} lookup bucket descriptor is inconsistent`);
        }
        return existingById;
      }
      if (existingIdForFile !== undefined && existingIdForFile !== bucket.id) {
        fail(`${productManifest.id}/${descriptor.id} lookup bucket file has multiple ids`);
      }
      bucketDescriptors.set(bucket.id, bucket);
      seenBucketFiles.set(bucket.file, bucket.id);
      return bucket;
    };
    const terminal = node.terminal === null ? null : registerBucket(node.terminal, `${productManifest.id}/${descriptor.id} lookup terminal`);
    for (const transition of node.transitions) {
      if (!Array.isArray(transition) || transition.length !== 2 || typeof transition[0] !== 'string'
        || Array.from(transition[0]).length !== 1 || transitions.has(transition[0])
        || (previousCharacter !== null && compareUnicodeCodePoints(previousCharacter, transition[0]) >= 0)
        || !isPlainObject(transition[1])) {
        fail(`${productManifest.id}/${descriptor.id} lookup transition is invalid`);
      }
      previousCharacter = transition[0];
      const target = transition[1];
      if (Object.hasOwn(target, 'bucket') === Object.hasOwn(target, 'node')) {
        fail(`${productManifest.id}/${descriptor.id} lookup transition target is invalid`);
      }
      if (Object.hasOwn(target, 'bucket')) {
        const bucket = registerBucket(target.bucket, `${productManifest.id}/${descriptor.id} lookup bucket`);
        transitions.set(transition[0], { kind: 'bucket', bucket });
      } else {
        if (!isPlainObject(target.node) || !Number.isSafeInteger(target.node.id) || target.node.id < 0
          || !normalizeString(target.node.file) || !target.node.file.startsWith('routing/nodes/')) {
          fail(`${productManifest.id}/${descriptor.id} lookup child node is invalid`);
        }
        resolveProductPath(profileDirectory, target.node.file, `${productManifest.id}/${descriptor.id} lookup child node`);
        transitions.set(transition[0], { kind: 'node', node: target.node });
        pendingNodes.push({
          file: target.node.file,
          prefix: `${node.prefix}${transition[0]}`,
          nodeId: target.node.id
        });
      }
    }
    if (terminal === null && transitions.size === 0) fail(`${productManifest.id}/${descriptor.id} lookup routing node is empty`);
    nodesByFile.set(expected.file, { terminal, transitions });
  }
  if (bucketDescriptors.size === 0) fail(`${productManifest.id}/${descriptor.id} lookup has no buckets`);

  function routeBucketIdForWord(word) {
    let nodeFile = profile.lookup.root;
    const characters = Array.from(word);
    let characterIndex = 0;
    for (let steps = 0; steps <= characters.length + nodesByFile.size; steps += 1) {
      const node = nodesByFile.get(nodeFile);
      if (!node) fail(`${productManifest.id}/${descriptor.id} lookup route has a missing node`);
      if (characterIndex === characters.length) return node.terminal?.id ?? null;
      const transition = node.transitions.get(characters[characterIndex]);
      if (!transition) return null;
      if (transition.kind === 'bucket') return transition.bucket.id;
      nodeFile = transition.node.file;
      characterIndex += 1;
    }
    fail(`${productManifest.id}/${descriptor.id} lookup route contains a cycle`);
  }

  const actualSourceRows = Object.fromEntries(CCLL_GENRE_PROFILE_SOURCES.map((source) => [source.id, 0]));
  const actualSourceTokenTotals = Object.fromEntries(CCLL_GENRE_PROFILE_SOURCES.map((source) => [source.id, 0]));
  const observedGenreCounts = Object.fromEntries(CCLL_GENRE_PROFILE_SOURCES.map((_, index) => [String(index + 1), 0]));
  const seenWords = new Set();
  let joinedWordforms = 0;
  for (const bucket of bucketDescriptors.values()) {
    const bucketPath = resolveProductPath(profileDirectory, bucket.file, `${productManifest.id}/${descriptor.id} lookup bucket`);
    const buffer = await readFile(bucketPath);
    if (buffer.byteLength !== bucket.bytes || buffer.byteLength > profile.delivery.lookupBucketMaxBytes
      || createHash('sha256').update(buffer).digest('hex') !== bucket.sha256) {
      fail(`${productManifest.id}/${descriptor.id} lookup bucket bytes are invalid`);
    }
    const content = parseJson(buffer, `${productManifest.id}/${descriptor.id} lookup bucket`);
    if (!isPlainObject(content) || content.schemaVersion !== 1 || content.productId !== productManifest.id
      || content.profileId !== descriptor.id || content.bucketId !== bucket.id || content.recordEncoding !== 'array'
      || !Array.isArray(content.records) || content.records.length !== bucket.records) {
      fail(`${productManifest.id}/${descriptor.id} lookup bucket content is invalid`);
    }
    let previousWord = null;
    for (const record of content.records) {
      if (!Array.isArray(record) || record.length !== profile.sources.length + 2 || !normalizeString(record[0])
        || normalizeCcllGenreWordform(record[0]) !== record[0] || seenWords.has(record[0])
        || (previousWord !== null && compareUnicodeCodePoints(previousWord, record[0]) >= 0)
        || routeBucketIdForWord(record[0]) !== bucket.id) {
        fail(`${productManifest.id}/${descriptor.id} lookup record is invalid`);
      }
      previousWord = record[0];
      seenWords.add(record[0]);
      let observed = 0;
      for (const [sourceIndex, source] of profile.sources.entries()) {
        const rawCount = record[sourceIndex + 1];
        if (rawCount === null) continue;
        if (!Number.isSafeInteger(rawCount) || rawCount < 1) {
          fail(`${productManifest.id}/${descriptor.id} lookup raw count is invalid`);
        }
        observed += 1;
        actualSourceRows[source.id] += 1;
        actualSourceTokenTotals[source.id] += rawCount;
      }
      if (!Number.isSafeInteger(record[record.length - 1]) || record[record.length - 1] !== observed
        || observed < 1 || observed > profile.sources.length) {
        fail(`${productManifest.id}/${descriptor.id} lookup observed-genre count is invalid`);
      }
      observedGenreCounts[String(observed)] += 1;
      joinedWordforms += 1;
    }
  }
  const totalSourceRows = Object.values(actualSourceRows).reduce((total, value) => total + value, 0);
  if (!sameObject(actualSourceRows, expectedSourceRows) || !sameObject(actualSourceTokenTotals, expectedSourceTokenTotals)
    || !sameObject(profile.summary, {
      joinedWordforms,
      totalSourceRows,
      sourceRows: actualSourceRows,
      sourceTokenTotals: actualSourceTokenTotals,
      observedGenreCounts,
      routingNodeCount: nodesByFile.size,
      lookupBucketCount: bucketDescriptors.size
    })) {
    fail(`${productManifest.id}/${descriptor.id} profile summary does not reconcile`);
  }
}

async function verifyAnalysisProfiles({ productManifest, productDirectory }) {
  if (productManifest.analysisProfiles === undefined) return;
  if (!Array.isArray(productManifest.analysisProfiles)) fail(`${productManifest.id} analysis profiles are invalid`);
  const profileIds = new Set();
  for (const descriptor of productManifest.analysisProfiles) {
    if (!isPlainObject(descriptor) || !ANALYSIS_PROFILE_TYPES.has(descriptor.type)) {
      fail(`${productManifest.id} analysis profile is invalid`);
    }
    if (profileIds.has(descriptor.id)) fail(`${productManifest.id} has duplicate analysis-profile ids`);
    profileIds.add(descriptor.id);
    if (descriptor.type === 'frequency-band-coverage') {
      await verifyFrequencyBandCoverageProfile({ productManifest, productDirectory, descriptor });
    } else if (descriptor.type === 'normalized-contrast-lookup') {
      await verifyNormalizedContrastLookupProfile({ productManifest, productDirectory, descriptor });
    } else if (descriptor.type === 'ccll-genre-wordform-lookup') {
      await verifyCcllGenreWordformLookupProfile({ productManifest, productDirectory, descriptor });
    }
  }
}

async function verifyGenericProduct({ manifest, productDirectory, staticRoot }) {
  if (!isPlainObject(manifest.content) || manifest.content.format !== 'dazniausi-zodziai-dataset-v1'
    || !normalizeString(manifest.content.file) || !isPlainObject(manifest.content.summary)) {
    fail(`${manifest.id} generic product content is invalid`);
  }
  const datasetPath = resolveStaticPath(staticRoot, productDirectory, manifest.content.file, `${manifest.id} generic content file`);
  const dataset = parseJson(await readFile(datasetPath), `${manifest.id} generic content file`);
  if (!isPlainObject(dataset) || dataset.id !== manifest.id || !Array.isArray(dataset.words) || !isPlainObject(dataset.summary)
    || !sameObject(dataset.summary, manifest.content.summary) || dataset.words.length !== dataset.summary.entryCount) {
    fail(`${manifest.id} generic content does not match its manifest`);
  }
  validateDatasetProvenance(dataset.provenance, `${manifest.id} generic content provenance`);
  if (!sameObject(dataset.provenance, manifest.provenance)) {
    fail(`${manifest.id} generic content provenance does not match its manifest`);
  }
  return { chunkedViews: 0, chunks: 0, records: dataset.words.length, viewCount: 1 };
}

function validateLookupRange(range, description) {
  if (!Array.isArray(range) || range.length !== 2
    || range.some((value) => typeof value !== 'string' || !normalizeString(value))
    || compareUnicodeCodePoints(range[0], range[1]) > 0) {
    fail(`${description} lookup range is invalid`);
  }
}

async function readBlktRangeRouting({ manifest, view, index, indexPath }) {
  const routing = index.routing;
  if (!isPlainObject(routing) || routing.type !== 'range-pages'
    || routing.maxPageBytes !== index.lookup.maxIndexBytes
    || !Array.isArray(routing.pages) || routing.pages.length === 0) {
    fail(`${manifest.id}/${view.id} BLKT lookup routing is invalid`);
  }
  const chunks = [];
  const routingFiles = new Set();
  let previousRangeEnd = null;
  let routedRecords = 0;
  for (const [pageIndex, descriptor] of routing.pages.entries()) {
    const description = `${manifest.id}/${view.id} routing page ${pageIndex}`;
    if (!isPlainObject(descriptor) || !normalizeString(descriptor.file)
      || !Number.isSafeInteger(descriptor.chunks) || descriptor.chunks < 1
      || !Number.isSafeInteger(descriptor.records) || descriptor.records < 1
      || !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1
      || descriptor.bytes > routing.maxPageBytes || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
      fail(`${description} descriptor is invalid`);
    }
    validateLookupRange(descriptor.range, description);
    if (previousRangeEnd !== null && compareUnicodeCodePoints(previousRangeEnd, descriptor.range[0]) >= 0) {
      fail(`${description} range is not strictly ordered`);
    }
    previousRangeEnd = descriptor.range[1];
    const pagePath = resolveProductPath(path.dirname(indexPath), descriptor.file, `${description} file`);
    if (routingFiles.has(pagePath)) fail(`${description} file is reused`);
    routingFiles.add(pagePath);
    const buffer = await readFile(pagePath);
    if (buffer.byteLength !== descriptor.bytes || buffer.byteLength > routing.maxPageBytes
      || createHash('sha256').update(buffer).digest('hex') !== descriptor.sha256) {
      fail(`${description} bytes or checksum are invalid`);
    }
    const page = parseJson(buffer, description);
    if (!isPlainObject(page) || page.schemaVersion !== 1 || page.productId !== manifest.id
      || page.viewId !== view.id || page.page !== pageIndex || !sameObject(page.notice, BLKT_FILE_NOTICE)
      || !Array.isArray(page.chunks)
      || page.chunks.length !== descriptor.chunks || page.chunks.length === 0) {
      fail(`${description} content is invalid`);
    }
    for (const [chunkIndex, chunk] of page.chunks.entries()) {
      validateLookupRange(chunk?.range, `${description} chunk ${chunkIndex}`);
    }
    const records = page.chunks.reduce((total, chunk) => total + (
      Number.isSafeInteger(chunk.records) && chunk.records > 0 ? chunk.records : 0
    ), 0);
    if (records !== descriptor.records
      || page.chunks[0].range[0] !== descriptor.range[0]
      || page.chunks.at(-1).range[1] !== descriptor.range[1]) {
      fail(`${description} does not reconcile with its descriptor`);
    }
    routedRecords += records;
    chunks.push(...page.chunks);
  }
  if (routedRecords !== index.summary.recordCount) {
    fail(`${manifest.id}/${view.id} BLKT lookup routing record count does not reconcile`);
  }
  return chunks;
}

async function verifyChunkedProduct({ manifest, productDirectory }) {
  if (!Array.isArray(manifest.views) || manifest.views.length === 0) fail(`${manifest.id} has no chunked views`);
  if (manifest.wordformProfile !== undefined) await verifyBlktLicenceFiles(manifest, productDirectory);
  let chunkedViews = 0;
  let chunks = 0;
  let records = 0;
  const viewIds = new Set();
  for (const view of manifest.views) {
    if (!isPlainObject(view) || !isSafeId(view.id) || !normalizeString(view.index) || view.recordEncoding !== 'array') {
      fail(`${manifest.id} has an invalid view`);
    }
    if (viewIds.has(view.id)) fail(`${manifest.id} has duplicate view id ${view.id}`);
    viewIds.add(view.id);

    const indexPath = resolveProductPath(productDirectory, view.index, `${manifest.id}/${view.id} index`);
    const indexBuffer = await readFile(indexPath);
    const index = parseJson(indexBuffer, `${manifest.id}/${view.id} index`);
    if (!isPlainObject(index) || index.schemaVersion !== 1 || index.productId !== manifest.id || index.viewId !== view.id
      || index.recordEncoding !== 'array' || !Array.isArray(index.fields) || index.fields.length === 0
      || !isPlainObject(index.summary)
      || !Number.isSafeInteger(index.maxChunkBytes) || index.maxChunkBytes < 1024) {
      fail(`${manifest.id}/${view.id} index is invalid`);
    }
    validatePublicSourceFile(index.sourceFile, `${manifest.id}/${view.id} source file`);
    const fields = index.fields;
    const fieldIds = new Set();
    for (const [fieldIndex, field] of fields.entries()) {
      validateField(field, `${manifest.id}/${view.id}.fields[${fieldIndex}]`);
      if (fieldIds.has(field.id)) fail(`${manifest.id}/${view.id} has duplicate field id ${field.id}`);
      fieldIds.add(field.id);
    }
    const blktLayout = manifest.wordformProfile?.viewId === view.id
      ? blktRecordLayout(manifest.wordformProfile, fields, `${manifest.id}/${view.id} BLKT profile`)
      : null;
    const rimkuteLayout = manifest.id === RIMKUTE_PRODUCT_ID;
    const rimkuteCanonicalHeader = `${RIMKUTE_COLUMNS.join('\t')}\n`;
    const rimkuteCanonicalHash = rimkuteLayout ? createHash('sha256').update(rimkuteCanonicalHeader) : null;
    let rimkuteCanonicalBytes = rimkuteLayout ? Buffer.byteLength(rimkuteCanonicalHeader) : 0;
    if (rimkuteLayout && (!sameObject(index.sourceFile, manifest.provenance.files.find((file) => file.role === 'morphemic-entries'))
      || view.sourceRole !== 'morphemic-entries' || index.ordering?.field !== 'source' || index.ordering?.direction !== 'as-stored'
      || index.fields.length !== 6
      || index.fields.some((field, fieldIndex) => field.sourceColumn !== fieldIndex)
      || index.fields[0].id !== 'wordform' || index.fields[0].type !== 'string'
      || index.fields[1].id !== 'frequency' || index.fields[1].type !== 'raw-token-count'
      || index.fields[2].id !== 'morphemicAnalysis' || index.fields[2].type !== 'string'
      || index.fields[3].id !== 'lemmaAndMorphology' || index.fields[3].type !== 'string'
      || index.fields[4].id !== 'volume' || index.fields[4].type !== 'string'
      || index.fields[5].id !== 'sourcePage' || index.fields[5].type !== 'string'
      || index.summary.sourceRows !== manifest.provenance.extraction.rows
      || index.summary.recordCount !== manifest.provenance.extraction.rows
      || index.summary.numericTotals?.frequency !== manifest.provenance.extraction.frequencyTotal)) {
      fail(`${manifest.id}/${view.id} schema, source identity, rows, or frequency total do not match the extraction provenance`);
    }
    if (blktLayout && index.maxChunkBytes > 65536) {
      fail(`${manifest.id}/${view.id} BLKT data chunks exceed the 65536-byte lookup budget`);
    }
    let lookupFieldIndex = -1;
    if (index.lookup !== undefined) {
      if (!isPlainObject(index.lookup) || index.lookup.type !== 'exact-string-range'
        || index.lookup.normalization !== 'trim-nfc-lower'
        || !isSafeFieldId(index.lookup.field)
        || !Number.isSafeInteger(index.lookup.maxIndexBytes) || index.lookup.maxIndexBytes < 8192
        || index.lookup.maxIndexBytes > 65536 || indexBuffer.byteLength > index.lookup.maxIndexBytes
        || !isPlainObject(index.ordering) || index.ordering.field !== index.lookup.field
        || index.ordering.direction !== 'ascending') {
        fail(`${manifest.id}/${view.id} exact lookup metadata is invalid`);
      }
      lookupFieldIndex = fields.findIndex((field) => field.id === index.lookup.field && field.type === 'string');
      if (lookupFieldIndex < 0) fail(`${manifest.id}/${view.id} exact lookup field is invalid`);
    }
    if (blktLayout && (lookupFieldIndex < 0 || index.lookup.field !== 'word')) {
      fail(`${manifest.id}/${view.id} BLKT profile must use the exact word range lookup`);
    }
    let chunkDescriptors;
    if (blktLayout) {
      if (!sameObject(index.notice, BLKT_FILE_NOTICE)) {
        fail(`${manifest.id}/${view.id} BLKT index is missing its licence and modification notice`);
      }
      if (index.chunks !== undefined) fail(`${manifest.id}/${view.id} BLKT lookup must use bounded range routing pages`);
      chunkDescriptors = await readBlktRangeRouting({ manifest, view, index, indexPath });
    } else {
      if (rimkuteLayout && !sameObject(index.notice, RIMKUTE_FILE_NOTICE)) {
        fail(`${manifest.id}/${view.id} index is missing its attribution and modification notice`);
      }
      if (index.routing !== undefined || !Array.isArray(index.chunks) || index.chunks.length === 0) {
        fail(`${manifest.id}/${view.id} chunk descriptors are invalid`);
      }
      chunkDescriptors = index.chunks;
    }
    let selectionFieldIndex = -1;
    if (index.selection !== undefined) {
      if (!isPlainObject(index.selection) || index.selection.type !== 'lemma-prefix'
        || !isSafeFieldId(index.selection.field) || !Number.isSafeInteger(index.selection.codePoints)
        || index.selection.codePoints < 1 || index.selection.codePoints > 3) {
        fail(`${manifest.id}/${view.id} selection metadata is invalid`);
      }
      selectionFieldIndex = fields.findIndex((field) => field.id === index.selection.field);
      if (selectionFieldIndex < 0 || fields[selectionFieldIndex].type !== 'string') {
        fail(`${manifest.id}/${view.id} selection metadata names an invalid field`);
      }
    }
    const totals = expectedTotals(fields);
    const nullCounts = expectedNullCounts(fields);
    const lexicalCounts = { senseCount: 0, definitionCount: 0, exampleCount: 0 };
    let viewRecords = 0;
    let previousLookupKey = null;

    const chunkFiles = new Set();
    let previousDescriptorRangeEnd = null;
    for (const [chunkIndex, descriptor] of chunkDescriptors.entries()) {
      if (!isPlainObject(descriptor) || !normalizeString(descriptor.file) || !Number.isSafeInteger(descriptor.records)
        || descriptor.records < 1 || !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1
        || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
        fail(`${manifest.id}/${view.id} has an invalid chunk descriptor`);
      }
      if (selectionFieldIndex >= 0 && (!Array.isArray(descriptor.selectionPrefixes) || descriptor.selectionPrefixes.length === 0
        || descriptor.selectionPrefixes.some((prefix) => !normalizeString(prefix))
        || new Set(descriptor.selectionPrefixes).size !== descriptor.selectionPrefixes.length)) {
        fail(`${manifest.id}/${view.id} selection chunk ${chunkIndex} has no prefixes`);
      }
      if (selectionFieldIndex < 0 && descriptor.selectionPrefixes !== undefined) {
        fail(`${manifest.id}/${view.id} has unexpected selection metadata`);
      }
      if (lookupFieldIndex >= 0) {
        validateLookupRange(descriptor.range, `${manifest.id}/${view.id} chunk ${chunkIndex}`);
        if (previousDescriptorRangeEnd !== null
          && compareUnicodeCodePoints(previousDescriptorRangeEnd, descriptor.range[0]) >= 0) {
          fail(`${manifest.id}/${view.id} chunk ${chunkIndex} lookup range is not strictly ordered`);
        }
        previousDescriptorRangeEnd = descriptor.range[1];
      } else if (descriptor.range !== undefined) {
        fail(`${manifest.id}/${view.id} has unexpected lookup range metadata`);
      }
      const chunkPath = resolveProductPath(path.dirname(indexPath), descriptor.file, `${manifest.id}/${view.id} chunk`);
      if (chunkFiles.has(chunkPath)) fail(`${manifest.id}/${view.id} reuses a chunk file`);
      chunkFiles.add(chunkPath);
      const buffer = await readFile(chunkPath);
      if (buffer.byteLength !== descriptor.bytes || buffer.byteLength > index.maxChunkBytes) {
        fail(`${manifest.id}/${view.id} chunk ${chunkIndex} byte count is invalid`);
      }
      const checksum = createHash('sha256').update(buffer).digest('hex');
      if (checksum !== descriptor.sha256) fail(`${manifest.id}/${view.id} chunk ${chunkIndex} checksum is invalid`);
      const chunk = parseJson(buffer, `${manifest.id}/${view.id} chunk ${chunkIndex}`);
      if (!isPlainObject(chunk) || chunk.schemaVersion !== 1 || chunk.productId !== manifest.id || chunk.viewId !== view.id
        || chunk.chunk !== chunkIndex || (blktLayout && !sameObject(chunk.notice, BLKT_FILE_NOTICE))
        || (rimkuteLayout && !sameObject(chunk.notice, RIMKUTE_FILE_NOTICE))
        || !Array.isArray(chunk.records) || chunk.records.length !== descriptor.records) {
        fail(`${manifest.id}/${view.id} chunk ${chunkIndex} content is invalid`);
      }
      for (const [recordIndex, record] of chunk.records.entries()) {
        validateRecord(record, fields, `${manifest.id}/${view.id} chunk ${chunkIndex} record ${recordIndex}`, totals, nullCounts, lexicalCounts);
        if (rimkuteLayout) {
          const canonicalLine = `${record.map(String).join('\t')}\n`;
          if (/[\t\r\n]/.test(record[0]) || /[\t\r\n]/.test(record[2]) || /[\t\r\n]/.test(record[3])
            || /[\t\r\n]/.test(record[4]) || /[\t\r\n]/.test(record[5])) {
            fail(`${manifest.id}/${view.id} chunk ${chunkIndex} record ${recordIndex} cannot reconstruct a canonical TSV row`);
          }
          rimkuteCanonicalHash.update(canonicalLine);
          rimkuteCanonicalBytes += Buffer.byteLength(canonicalLine);
        }
        if (blktLayout) {
          validateBlktRecord(record, blktLayout, `${manifest.id}/${view.id} chunk ${chunkIndex} record ${recordIndex}`);
        }
        if (selectionFieldIndex >= 0
          && !descriptor.selectionPrefixes.includes(prefixFor(record[selectionFieldIndex], index.selection.codePoints))) {
          fail(`${manifest.id}/${view.id} selection chunk ${chunkIndex} has a record outside its prefix`);
        }
        if (lookupFieldIndex >= 0) {
          const key = record[lookupFieldIndex];
          if (typeof key !== 'string' || key !== key.trim().normalize('NFC').toLowerCase()
            || !/^\p{L}{1,64}$/u.test(key)
            || (previousLookupKey !== null && compareUnicodeCodePoints(previousLookupKey, key) >= 0)) {
            fail(`${manifest.id}/${view.id} exact lookup records are invalid or not strictly ascending`);
          }
          previousLookupKey = key;
        }
      }
      if (lookupFieldIndex >= 0
        && (chunk.records[0][lookupFieldIndex] !== descriptor.range[0]
          || chunk.records.at(-1)[lookupFieldIndex] !== descriptor.range[1])) {
        fail(`${manifest.id}/${view.id} chunk ${chunkIndex} does not match its lookup range`);
      }
      viewRecords += chunk.records.length;
    }

    let sourceRows = viewRecords;
    if (index.derivation !== undefined) {
      sourceRows = validatedDerivedSourceRows({
        derivation: index.derivation,
        fields,
        totals,
        lexicalCounts,
        viewRecords,
        description: `${manifest.id}/${view.id}`
      });
    }
    const expectedSummary = {
      sourceRows,
      recordCount: viewRecords,
      numericTotals: totals,
      nullCounts
    };
    if (!sameObject(index.summary, expectedSummary) || !sameObject(view.summary, expectedSummary)) {
      fail(`${manifest.id}/${view.id} summary does not match its chunks`);
    }
    if (rimkuteLayout) {
      const canonicalSha256 = rimkuteCanonicalHash.digest('hex');
      if (rimkuteCanonicalBytes !== index.sourceFile.bytes || canonicalSha256 !== index.sourceFile.sha256) {
        fail(`${manifest.id}/${view.id} records do not byte-reconstruct the pinned canonical TSV`);
      }
      const firstRecord = parseJson(await readFile(resolveProductPath(
        path.dirname(indexPath),
        chunkDescriptors[0].file,
        `${manifest.id}/${view.id} first representative chunk`
      )), `${manifest.id}/${view.id} first representative chunk`).records[0];
      const lastDescriptor = chunkDescriptors.at(-1);
      const lastChunk = parseJson(await readFile(resolveProductPath(
        path.dirname(indexPath),
        lastDescriptor.file,
        `${manifest.id}/${view.id} last representative chunk`
      )), `${manifest.id}/${view.id} last representative chunk`);
      const sampleToRecord = (sample) => [sample.wordform, sample.frequency, sample.morphemic_analysis,
        sample.lemma_and_morphology, sample.volume, String(sample.source_page)];
      if (!sameObject(firstRecord, sampleToRecord(manifest.provenance.extraction.representativeSamples[0]))
        || !sameObject(lastChunk.records.at(-1), sampleToRecord(manifest.provenance.extraction.representativeSamples.at(-1)))) {
        fail(`${manifest.id}/${view.id} boundary records do not match the extraction samples`);
      }
    }
    chunkedViews += 1;
    chunks += chunkDescriptors.length;
    records += viewRecords;
  }
  return { chunkedViews, chunks, records, viewCount: manifest.views.length };
}

function validateSyntacticContextManifest(manifest) {
  const syntaxContext = manifest.syntaxContext;
  if (!isPlainObject(syntaxContext) || !isPlainObject(syntaxContext.overview)
    || !Array.isArray(syntaxContext.exclusions) || syntaxContext.exclusions.some((value) => !normalizeString(value))
    || !isPlainObject(syntaxContext.exampleSelection) || !isPlainObject(syntaxContext.lookup)) {
    fail(`${manifest.id} syntax-context metadata is invalid`);
  }
  for (const field of [
    'repositorySentenceClaim', 'deliveredSentenceIds', 'documents', 'integerTokenRows',
    'nonPunctuationRows', 'allRelationLabels', 'nonPunctuationRelationLabels', 'rootRows',
    'nonPunctuationRootRows', 'nonRootDependencyRows'
  ]) {
    assertSafeInteger(syntaxContext.overview[field], `${manifest.id} syntax-context overview.${field}`);
  }
  if (syntaxContext.overview.repositorySentenceClaim < syntaxContext.overview.deliveredSentenceIds
    || syntaxContext.overview.nonPunctuationRows > syntaxContext.overview.integerTokenRows
    || syntaxContext.overview.nonPunctuationRootRows > syntaxContext.overview.rootRows
    || syntaxContext.overview.nonRootDependencyRows + syntaxContext.overview.nonPunctuationRootRows !== syntaxContext.overview.nonPunctuationRows) {
    fail(`${manifest.id} syntax-context overview is inconsistent`);
  }
  if (!Number.isSafeInteger(syntaxContext.exampleSelection.maxExamplesPerLemma)
    || syntaxContext.exampleSelection.maxExamplesPerLemma < 1 || syntaxContext.exampleSelection.maxExamplesPerLemma > 50
    || !normalizeString(syntaxContext.exampleSelection.order)
    || !Number.isSafeInteger(syntaxContext.exampleSelection.omittedRows) || syntaxContext.exampleSelection.omittedRows < 0) {
    fail(`${manifest.id} syntax-context example selection is invalid`);
  }
  const lookup = syntaxContext.lookup;
  if (!isSafeId(lookup.lemmaIndexView) || !isSafeId(lookup.contextView)
    || !Number.isSafeInteger(lookup.lemmaIndexPrefixCodePoints) || lookup.lemmaIndexPrefixCodePoints < 1 || lookup.lemmaIndexPrefixCodePoints > 3
    || !Number.isSafeInteger(lookup.contextPrefixCodePoints) || lookup.contextPrefixCodePoints < lookup.lemmaIndexPrefixCodePoints || lookup.contextPrefixCodePoints > 3
    || !Array.isArray(lookup.directions) || lookup.directions.length === 0
    || lookup.directions.some((direction) => !['dependent', 'head', 'root'].includes(direction))) {
    fail(`${manifest.id} syntax-context lookup metadata is invalid`);
  }
  const viewIds = new Set(manifest.views?.map((view) => view.id));
  if (!viewIds.has(lookup.lemmaIndexView) || !viewIds.has(lookup.contextView)) {
    fail(`${manifest.id} syntax-context lookup views are missing`);
  }
}

function validateManifest(manifest, catalogEntry) {
  if (!isPlainObject(manifest) || manifest.schemaVersion !== 1 || !isSafeId(manifest.id)
    || !normalizeString(manifest.title) || !normalizeString(manifest.productType)
    || !isPlainObject(manifest.publication) || !['published', 'metadata-only'].includes(manifest.publication.status)) {
    fail('product manifest is invalid');
  }
  if (manifest.id !== catalogEntry.id || manifest.productType !== catalogEntry.productType
    || manifest.publication.status !== catalogEntry.publicationStatus) {
    fail(`${catalogEntry.id} manifest does not match the catalog`);
  }
  if (manifest.productType === 'generic-frequency-dataset') {
    validateDatasetProvenance(manifest.provenance, `${manifest.id} provenance`);
  } else {
    validateProductProvenance(manifest.provenance, `${manifest.id} provenance`);
    if (manifest.id === RIMKUTE_PRODUCT_ID) validateRimkuteProvenance(manifest.provenance);
  }
  if (manifest.wordformProfile !== undefined) {
    validateBlktWordformProfile(manifest);
    if (!sameObject(manifest.notice, BLKT_FILE_NOTICE)) {
      fail(`${manifest.id} BLKT manifest is missing its licence and modification notice`);
    }
  }
  if (manifest.id === RIMKUTE_PRODUCT_ID && !sameObject(manifest.notice, RIMKUTE_FILE_NOTICE)) {
    fail(`${manifest.id} manifest is missing its attribution and modification notice`);
  }
}

export async function verifyDataProducts({ outputRoot = defaultOutputRoot, staticRoot = defaultStaticRoot } = {}) {
  const resolvedOutputRoot = await realpath(outputRoot);
  const resolvedStaticRoot = await realpath(staticRoot);
  const catalog = parseJson(await readFile(path.join(resolvedOutputRoot, 'catalog.json')), 'product catalog');
  if (!isPlainObject(catalog) || catalog.schemaVersion !== 1 || !normalizeString(catalog.title) || !Array.isArray(catalog.products)) {
    fail('product catalog is invalid');
  }
  const ids = new Set();
  const result = { products: 0, chunkedViews: 0, chunks: 0, records: 0, metadataOnlyProducts: 0 };
  for (const entry of catalog.products) {
    if (!isPlainObject(entry) || !isSafeId(entry.id) || !normalizeString(entry.title) || !normalizeString(entry.productType)
      || !['published', 'metadata-only'].includes(entry.publicationStatus) || !normalizeString(entry.manifest)
      || !normalizeString(entry.licence) || !Number.isSafeInteger(entry.viewCount) || entry.viewCount < 0
      || (entry.recordCount !== null && (!Number.isSafeInteger(entry.recordCount) || entry.recordCount < 0))) {
      fail('product catalog has an invalid entry');
    }
    if (ids.has(entry.id)) fail(`product catalog repeats ${entry.id}`);
    ids.add(entry.id);
    const manifestPath = resolveProductPath(resolvedOutputRoot, entry.manifest, `${entry.id} manifest`);
    const manifest = parseJson(await readFile(manifestPath), `${entry.id} manifest`);
    validateManifest(manifest, entry);
    const productDirectory = path.dirname(manifestPath);
    if (manifest.publication.status === 'metadata-only') {
      if (manifest.productType !== 'metadata-only' || !Array.isArray(manifest.blockedBy) || manifest.blockedBy.length === 0
        || manifest.views !== undefined || manifest.content !== undefined) {
        fail(`${entry.id} metadata-only product leaks data rows or lacks its blocker`);
      }
      if (entry.viewCount !== 0 || entry.recordCount !== null) fail(`${entry.id} metadata-only catalog counts are invalid`);
      result.metadataOnlyProducts += 1;
    } else if (manifest.productType === 'generic-frequency-dataset') {
      const genericResult = await verifyGenericProduct({ manifest, productDirectory, staticRoot: resolvedStaticRoot });
      await verifyAnalysisProfiles({ productManifest: manifest, productDirectory });
      if (entry.viewCount !== genericResult.viewCount || entry.recordCount !== genericResult.records) {
        fail(`${entry.id} generic catalog counts do not match its content`);
      }
      result.chunkedViews += genericResult.chunkedViews;
      result.chunks += genericResult.chunks;
      result.records += genericResult.records;
    } else if (CHUNKED_PRODUCT_TYPES.has(manifest.productType)) {
      if (manifest.productType === SYNTACTIC_CONTEXT_PRODUCT_TYPE) validateSyntacticContextManifest(manifest);
      const chunkedResult = await verifyChunkedProduct({ manifest, productDirectory });
      await verifyAnalysisProfiles({ productManifest: manifest, productDirectory });
      if (entry.viewCount !== chunkedResult.viewCount || entry.recordCount !== null) {
        fail(`${entry.id} chunked catalog counts are invalid`);
      }
      result.chunkedViews += chunkedResult.chunkedViews;
      result.chunks += chunkedResult.chunks;
      result.records += chunkedResult.records;
    } else {
      fail(`${entry.id} has an unknown published product type`);
    }
    result.products += 1;
  }
  return result;
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help' || option === '-h') return { help: true };
    if (!['--output', '--static-root'].includes(option)) fail(`unknown option: ${option}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`option ${option} requires a value`);
    options[option === '--output' ? 'outputRoot' : 'staticRoot'] = value;
    index += 1;
  }
  return options;
}

function usage() {
  return 'Usage: npm run products:verify -- [--output <static-data-products-dir>] [--static-root <static-dir>]';
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log(usage());
    else console.log(JSON.stringify(await verifyDataProducts(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
