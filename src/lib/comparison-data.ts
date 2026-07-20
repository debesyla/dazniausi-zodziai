/** Types and validation for comparison datasets that are not generic frequency lists. */

export type ComparisonMetricType =
  | 'raw-token-count'
  | 'normalized-token-count'
  | 'normalized-document-count'
  | 'coverage-code';

export interface ComparisonMetricDefinition {
  id: string;
  label: string;
  type: ComparisonMetricType;
  unit: string;
  nullable?: boolean;
  sourceTokens?: number;
  targetTokens?: number;
  values?: Record<string, string>;
}

export interface ComparisonSchema {
  key: string;
  comparisonOnly: true;
  frequencyField: null;
  metrics: ComparisonMetricDefinition[];
}

export interface ComparisonEntry {
  key: string;
  metrics: Record<string, number | null>;
}

export interface ComparisonDataset {
  schemaVersion: 1;
  id: string;
  title: string;
  schema: ComparisonSchema;
  entries: ComparisonEntry[];
}

const metricTypes = new Set<ComparisonMetricType>([
  'raw-token-count',
  'normalized-token-count',
  'normalized-document-count',
  'coverage-code'
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateMetricDefinition(metric: unknown, index: number): ComparisonMetricDefinition {
  if (!metric || typeof metric !== 'object' || Array.isArray(metric)) {
    throw new Error(`Invalid comparison dataset: metric ${index} is not an object`);
  }
  const definition = metric as ComparisonMetricDefinition;
  if (!isNonEmptyString(definition.id) || !isNonEmptyString(definition.label) || !isNonEmptyString(definition.unit) || !metricTypes.has(definition.type)) {
    throw new Error(`Invalid comparison dataset: metric ${index} is missing identity or type`);
  }
  if (definition.nullable !== undefined && typeof definition.nullable !== 'boolean') {
    throw new Error(`Invalid comparison dataset: metric "${definition.id}" has invalid nullability`);
  }
  if (definition.type === 'normalized-token-count' || definition.type === 'normalized-document-count') {
    if (!isNonNegativeInteger(definition.sourceTokens) || definition.sourceTokens === 0 || !isNonNegativeInteger(definition.targetTokens) || definition.targetTokens === 0) {
      throw new Error(`Invalid comparison dataset: normalized metric "${definition.id}" needs positive source and target denominators`);
    }
  }
  if (definition.type === 'coverage-code' && (!definition.values || typeof definition.values !== 'object' || Array.isArray(definition.values) || Object.keys(definition.values).length === 0)) {
    throw new Error(`Invalid comparison dataset: coverage metric "${definition.id}" needs labelled values`);
  }
  return definition;
}

function validateMetricValue(value: unknown, definition: ComparisonMetricDefinition, entryKey: string): number | null {
  if (value === null) {
    if (definition.nullable !== true) throw new Error(`Invalid comparison dataset: non-nullable metric "${definition.id}" is null for "${entryKey}"`);
    return null;
  }
  if (!isNonNegativeInteger(value)) throw new Error(`Invalid comparison dataset: metric "${definition.id}" is not a non-negative integer for "${entryKey}"`);
  if (definition.type === 'coverage-code' && !definition.values?.[String(value)]) {
    throw new Error(`Invalid comparison dataset: unknown coverage code ${value} for "${entryKey}"`);
  }
  return value;
}

export function validateComparisonDataset(data: unknown): ComparisonDataset {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid comparison dataset');
  const dataset = data as Partial<ComparisonDataset>;
  if (dataset.schemaVersion !== 1 || !isNonEmptyString(dataset.id) || !isNonEmptyString(dataset.title)) {
    throw new Error('Invalid comparison dataset: missing identity');
  }
  const schema = dataset.schema;
  if (!schema || schema.comparisonOnly !== true || schema.frequencyField !== null || !isNonEmptyString(schema.key) || !Array.isArray(schema.metrics) || schema.metrics.length === 0) {
    throw new Error('Invalid comparison dataset: comparison schema must not define a generic frequency field');
  }

  const definitions = new Map<string, ComparisonMetricDefinition>();
  for (const [index, metric] of schema.metrics.entries()) {
    const definition = validateMetricDefinition(metric, index);
    if (definitions.has(definition.id)) throw new Error(`Invalid comparison dataset: duplicate metric "${definition.id}"`);
    definitions.set(definition.id, definition);
  }

  if (!Array.isArray(dataset.entries)) throw new Error('Invalid comparison dataset: entries must be an array');
  const entries = dataset.entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !isNonEmptyString(entry.key) || !entry.metrics || typeof entry.metrics !== 'object' || Array.isArray(entry.metrics)) {
      throw new Error(`Invalid comparison dataset: entry ${index} is malformed`);
    }
    if ('frequency' in entry || 'totalFrequency' in entry) {
      throw new Error('Invalid comparison dataset: ordinary frequency fields are not allowed');
    }
    const metricValues = entry.metrics as Record<string, unknown>;
    const metricIds = Object.keys(metricValues);
    if (metricIds.length !== definitions.size || metricIds.some((id) => !definitions.has(id))) {
      throw new Error(`Invalid comparison dataset: entry "${entry.key}" does not provide exactly the declared metrics`);
    }
    const validatedMetrics = Object.fromEntries([...definitions.entries()].map(([id, definition]) => [id, validateMetricValue(metricValues[id], definition, entry.key)]));
    return { key: entry.key, metrics: validatedMetrics };
  });

  return { schemaVersion: 1, id: dataset.id, title: dataset.title, schema, entries };
}
