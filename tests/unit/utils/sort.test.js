import { describe, it, expect } from 'vitest';
import { sortWords } from '../../../src/lib/utils.ts';

describe('sortWords', () => {
  const words = [
    { word: 'zebra', frequency: 10 },
    { word: 'apple', frequency: 5 },
    { word: 'banana', frequency: 20 }
  ];

  it('sorts by word ascending by default', () => {
    const result = sortWords(words, 'word');
    expect(result).toEqual([
      { word: 'apple', frequency: 5 },
      { word: 'banana', frequency: 20 },
      { word: 'zebra', frequency: 10 }
    ]);
  });

  it('sorts by word descending', () => {
    const result = sortWords(words, 'word', false);
    expect(result).toEqual([
      { word: 'zebra', frequency: 10 },
      { word: 'banana', frequency: 20 },
      { word: 'apple', frequency: 5 }
    ]);
  });

  it('sorts by frequency ascending', () => {
    const result = sortWords(words, 'frequency');
    expect(result).toEqual([
      { word: 'apple', frequency: 5 },
      { word: 'zebra', frequency: 10 },
      { word: 'banana', frequency: 20 }
    ]);
  });

  it('sorts by frequency descending', () => {
    const result = sortWords(words, 'frequency', false);
    expect(result).toEqual([
      { word: 'banana', frequency: 20 },
      { word: 'zebra', frequency: 10 },
      { word: 'apple', frequency: 5 }
    ]);
  });

  it('returns a new array without modifying original', () => {
    const original = [...words];
    sortWords(words, 'word');
    expect(words).toEqual(original);
  });
});