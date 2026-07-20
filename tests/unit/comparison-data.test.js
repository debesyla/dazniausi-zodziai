import { describe, expect, it } from 'vitest';
import { validateComparisonDataset } from '../../src/lib/comparison-data';

const schema = {
  key: 'word',
  comparisonOnly: true,
  frequencyField: null,
  metrics: [
    { id: 'normalizedCount', label: 'Normalized token count', type: 'normalized-token-count', unit: 'tokens per 100m words', nullable: true, sourceTokens: 36_000_000, targetTokens: 100_000_000 },
    { id: 'normalizedDocuments', label: 'Normalized document count', type: 'normalized-document-count', unit: 'documents per 100m words', nullable: true, sourceTokens: 36_000_000, targetTokens: 100_000_000 },
    { id: 'coverage', label: 'Dictionary coverage', type: 'coverage-code', unit: 'category', values: { 0: 'missing', 1: 'main entry' } }
  ]
};

function fixture(entries) {
  return { schemaVersion: 1, id: 'fixture', title: 'Comparison fixture', schema, entries };
}

describe('validateComparisonDataset', () => {
  it('preserves nullable metrics and keeps token, document, and coverage values distinct', () => {
    const dataset = validateComparisonDataset(fixture([
      { key: 'HRS', metrics: { normalizedCount: 1, normalizedDocuments: 1, coverage: 0 } },
      { key: 'BACHMUTO', metrics: { normalizedCount: null, normalizedDocuments: null, coverage: 1 } }
    ]));

    expect(dataset.entries[1].metrics.normalizedCount).toBeNull();
    expect(dataset.entries[0].metrics.coverage).toBe(0);
    expect(dataset.schema.frequencyField).toBeNull();
  });

  it('rejects ordinary frequency fields', () => {
    expect(() => validateComparisonDataset(fixture([
      { key: 'IR', frequency: 10, metrics: { normalizedCount: 10, normalizedDocuments: 2, coverage: 1 } }
    ]))).toThrow('ordinary frequency fields are not allowed');
  });

  it('rejects an unlabelled coverage code and a null non-nullable metric', () => {
    expect(() => validateComparisonDataset(fixture([
      { key: 'IR', metrics: { normalizedCount: 10, normalizedDocuments: 2, coverage: 2 } }
    ]))).toThrow('unknown coverage code');

    const nonNullableSchema = { ...schema, metrics: schema.metrics.map((metric) => metric.id === 'normalizedCount' ? { ...metric, nullable: false } : metric) };
    expect(() => validateComparisonDataset({ ...fixture([{ key: 'IR', metrics: { normalizedCount: null, normalizedDocuments: 2, coverage: 1 } }]), schema: nonNullableSchema })).toThrow('non-nullable metric');
  });
});
