import { describe, expect, it } from 'vitest';
import { analyseFrequency, sampleByRank } from '../../src/lib/analysis';

describe('analyseFrequency', () => {
  const words = [
    { word: 'žemė', type: 'dkt', frequency: 10 },
    { word: 'ir', type: 'jng', frequency: 60 },
    { word: 'ąžuolas', type: 'dkt', frequency: 30 },
    { word: 'be tipo', frequency: 5 }
  ];

  it('calculates deterministic ranking, totals, coverage, and POS composition', () => {
    const analysis = analyseFrequency(words);

    expect(analysis.entryCount).toBe(4);
    expect(analysis.totalFrequency).toBe(105);
    expect(analysis.topWord).toMatchObject({ word: 'ir', rank: 1, frequency: 60 });
    expect(analysis.rankedWords.map(({ word }) => word)).toEqual(['ir', 'ąžuolas', 'žemė', 'be tipo']);
    expect(analysis.coverage).toEqual([
      { rank: 1, cumulativeFrequency: 60, coverage: 60 / 105 },
      { rank: 2, cumulativeFrequency: 90, coverage: 90 / 105 },
      { rank: 3, cumulativeFrequency: 100, coverage: 100 / 105 },
      { rank: 4, cumulativeFrequency: 105, coverage: 1 }
    ]);
    expect(analysis.partOfSpeech).toEqual([
      { type: 'jng', frequency: 60, entries: 1, share: 60 / 105 },
      { type: 'dkt', frequency: 40, entries: 2, share: 40 / 105 }
    ]);
  });

  it('does not mutate the source rows and handles an empty result safely', () => {
    const original = structuredClone(words);
    expect(analyseFrequency([])).toMatchObject({ entryCount: 0, totalFrequency: 0, topWord: null });
    analyseFrequency(words);
    expect(words).toEqual(original);
  });
});

describe('sampleByRank', () => {
  it('keeps a bounded, ordered series while retaining the first and last ranks', () => {
    const points = Array.from({ length: 1_000 }, (_, index) => ({ rank: index + 1, value: index }));
    const sample = sampleByRank(points, 25);

    expect(sample.length).toBeLessThanOrEqual(25);
    expect(sample[0].rank).toBe(1);
    expect(sample[sample.length - 1].rank).toBe(1_000);
    expect(sample.every((point, index) => index === 0 || point.rank > sample[index - 1].rank)).toBe(true);
  });
});
