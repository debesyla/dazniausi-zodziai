import { describe, expect, it } from 'vitest';
import {
  assertAggregateRecord,
  assertNoForbiddenKeys,
  assertOnlyApprovedMetadataKeys,
  verifyParliamentDisclosure
} from '../../scripts/verify-parliament-disclosure.mjs';

describe('Parliament disclosure quarantine', () => {
  it('verifies every approved public artifact and aggregate record', async () => {
    await expect(verifyParliamentDisclosure()).resolves.toEqual({
      productId: 'kapociute-dzikiene-2017-parliament-frequency-aggregates',
      views: 2,
      chunks: 98,
      records: 358989
    });
  }, 30_000);

  it.each([
    [{ metadata: { speakerId: 'source-1' } }, 'speakerId'],
    [{ result: { calendar_year: 2012 } }, 'calendar_year'],
    [{ nested: [{ 'document-id': 'sample-1' }] }, 'document-id']
  ])('rejects identity-bearing or under-review structure %#', (value, key) => {
    expect(() => assertNoForbiddenKeys(value, ['speakerId', 'calendarYear', 'documentId']))
      .toThrow(`contains forbidden identity or granularity key ${key}`);
  });

  it.each(['speakerMetadata', 'personStats', 'timeBuckets', 'documentRows'])
    ('rejects unapproved compound metadata key %s', (key) => {
      expect(() => assertOnlyApprovedMetadataKeys({ [key]: [] }))
        .toThrow(`contains unapproved metadata key ${key}`);
    });

  it('accepts only a two-field aggregate row', () => {
    expect(() => assertAggregateRecord(['žodis', 12])).not.toThrow();
    expect(() => assertAggregateRecord(['visas kalbos tekstas', 12])).toThrow(/must be exactly/);
    expect(() => assertAggregateRecord(['speaker-1', 12])).toThrow(/must be exactly/);
    expect(() => assertAggregateRecord(['žodis', 12, 'speaker-1'])).toThrow(/must be exactly/);
    expect(() => assertAggregateRecord(['žodis', 0])).toThrow(/must be exactly/);
  });
});
