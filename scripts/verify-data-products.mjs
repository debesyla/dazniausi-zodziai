import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultStaticRoot = path.join(repositoryRoot, 'static');
const defaultOutputRoot = path.join(defaultStaticRoot, 'data-products');

const NUMERIC_FIELD_TYPES = new Set([
  'raw-token-count',
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
  'normalized-token-count',
  'normalized-document-count'
]);
const CHUNKED_PRODUCT_TYPES = new Set([
  'chunked-wordform-list',
  'chunked-comparison',
  'chunked-frequency-list',
  'chunked-derived-frequency-list',
  'chunked-lexical-collection'
]);
const ANALYSIS_PROFILE_TYPES = new Set(['frequency-band-coverage']);

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
    await verifyFrequencyBandCoverageProfile({ productManifest, productDirectory, descriptor });
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
  return { chunkedViews: 0, chunks: 0, records: dataset.words.length, viewCount: 1 };
}

async function verifyChunkedProduct({ manifest, productDirectory }) {
  if (!Array.isArray(manifest.views) || manifest.views.length === 0) fail(`${manifest.id} has no chunked views`);
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
    const index = parseJson(await readFile(indexPath), `${manifest.id}/${view.id} index`);
    if (!isPlainObject(index) || index.schemaVersion !== 1 || index.productId !== manifest.id || index.viewId !== view.id
      || index.recordEncoding !== 'array' || !Array.isArray(index.fields) || index.fields.length === 0
      || !Array.isArray(index.chunks) || index.chunks.length === 0 || !isPlainObject(index.summary)
      || !Number.isSafeInteger(index.maxChunkBytes) || index.maxChunkBytes < 1024) {
      fail(`${manifest.id}/${view.id} index is invalid`);
    }
    const fields = index.fields;
    const fieldIds = new Set();
    for (const [fieldIndex, field] of fields.entries()) {
      validateField(field, `${manifest.id}/${view.id}.fields[${fieldIndex}]`);
      if (fieldIds.has(field.id)) fail(`${manifest.id}/${view.id} has duplicate field id ${field.id}`);
      fieldIds.add(field.id);
    }
    const totals = expectedTotals(fields);
    const nullCounts = expectedNullCounts(fields);
    const lexicalCounts = { senseCount: 0, definitionCount: 0, exampleCount: 0 };
    let viewRecords = 0;

    for (const [chunkIndex, descriptor] of index.chunks.entries()) {
      if (!isPlainObject(descriptor) || !normalizeString(descriptor.file) || !Number.isSafeInteger(descriptor.records)
        || descriptor.records < 1 || !Number.isSafeInteger(descriptor.bytes) || descriptor.bytes < 1
        || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
        fail(`${manifest.id}/${view.id} has an invalid chunk descriptor`);
      }
      const chunkPath = resolveProductPath(path.dirname(indexPath), descriptor.file, `${manifest.id}/${view.id} chunk`);
      const buffer = await readFile(chunkPath);
      if (buffer.byteLength !== descriptor.bytes || buffer.byteLength > index.maxChunkBytes) {
        fail(`${manifest.id}/${view.id} chunk ${chunkIndex} byte count is invalid`);
      }
      const checksum = createHash('sha256').update(buffer).digest('hex');
      if (checksum !== descriptor.sha256) fail(`${manifest.id}/${view.id} chunk ${chunkIndex} checksum is invalid`);
      const chunk = parseJson(buffer, `${manifest.id}/${view.id} chunk ${chunkIndex}`);
      if (!isPlainObject(chunk) || chunk.schemaVersion !== 1 || chunk.productId !== manifest.id || chunk.viewId !== view.id
        || chunk.chunk !== chunkIndex || !Array.isArray(chunk.records) || chunk.records.length !== descriptor.records) {
        fail(`${manifest.id}/${view.id} chunk ${chunkIndex} content is invalid`);
      }
      for (const [recordIndex, record] of chunk.records.entries()) {
        validateRecord(record, fields, `${manifest.id}/${view.id} chunk ${chunkIndex} record ${recordIndex}`, totals, nullCounts, lexicalCounts);
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
    chunkedViews += 1;
    chunks += index.chunks.length;
    records += viewRecords;
  }
  return { chunkedViews, chunks, records, viewCount: manifest.views.length };
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
