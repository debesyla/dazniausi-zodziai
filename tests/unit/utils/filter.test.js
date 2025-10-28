import { filterWords } from '../../../src/lib/utils';

test('filterWords returns all words when query is empty', () => {
  const words = [
    { word: 'labas', frequency: 10 },
    { word: 'rytas', frequency: 5 }
  ];
  expect(filterWords(words, '')).toEqual(words);
});

test('filterWords performs case-insensitive search', () => {
  const words = [
    { word: 'Labas', frequency: 10 },
    { word: 'rytas', frequency: 5 }
  ];
  expect(filterWords(words, 'labas')).toEqual([{ word: 'Labas', frequency: 10 }]);
});

test('filterWords filters by partial match', () => {
  const words = [
    { word: 'labas', frequency: 10 },
    { word: 'rytas', frequency: 5 },
    { word: 'labai', frequency: 3 }
  ];
  expect(filterWords(words, 'la')).toEqual([
    { word: 'labas', frequency: 10 },
    { word: 'labai', frequency: 3 }
  ]);
});

test('filterWords returns empty array when no matches', () => {
  const words = [
    { word: 'labas', frequency: 10 },
    { word: 'rytas', frequency: 5 }
  ];
  expect(filterWords(words, 'xyz')).toEqual([]);
});

test('filterWords filters by type when selectedTypes provided', () => {
  const words = [
    { word: 'labas', type: 'greeting', frequency: 10 },
    { word: 'rytas', type: 'noun', frequency: 5 },
    { word: 'ačiū', type: 'expression', frequency: 8 }
  ];
  expect(filterWords(words, '', ['greeting'])).toEqual([{ word: 'labas', type: 'greeting', frequency: 10 }]);
});

test('filterWords combines search and type filter', () => {
  const words = [
    { word: 'labas', type: 'greeting', frequency: 10 },
    { word: 'rytas', type: 'noun', frequency: 5 },
    { word: 'labai', type: 'adverb', frequency: 3 }
  ];
  expect(filterWords(words, 'la', ['greeting', 'adverb'])).toEqual([
    { word: 'labas', type: 'greeting', frequency: 10 },
    { word: 'labai', type: 'adverb', frequency: 3 }
  ]);
});

test('filterWords ignores words without type when filtering by type', () => {
  const words = [
    { word: 'labas', type: 'greeting', frequency: 10 },
    { word: 'rytas', frequency: 5 } // no type
  ];
  expect(filterWords(words, '', ['greeting'])).toEqual([{ word: 'labas', type: 'greeting', frequency: 10 }]);
});