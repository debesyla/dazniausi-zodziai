import { describe, it, expect } from 'vitest';
import { loadDataset, getAvailableDatasets, loadDatasetFromModules, getAvailableDatasetsFromModules } from '../../src/lib/data';

describe('loadDatasetFromModules', () => {
  it('should successfully load and parse valid JSON dataset', () => {
    const validDataset = {
      author: 'Test Author',
      year: 2023,
      words: [
        { word: 'test', frequency: 10 },
        { word: 'word', type: 'noun', frequency: 5 }
      ]
    };
    const modules = { '/test.json': validDataset };
    const result = loadDatasetFromModules('test.json', modules);
    
    expect(result.author).toBe('Test Author');
    expect(result.year).toBe(2023);
    expect(Array.isArray(result.words)).toBe(true);
    expect(result.words).toHaveLength(2);
  });

  it('should throw error for missing file', () => {
    const modules = {};
    expect(() => loadDatasetFromModules('missing.json', modules)).toThrow(
      'Dataset not found: missing.json'
    );
  });

  it('should throw error for missing author field', () => {
    const modules = { '/no-author.json': { year: 2023, words: [] } };
    expect(() => loadDatasetFromModules('no-author.json', modules)).toThrow(
      'Invalid dataset: missing or invalid "author" field'
    );
  });

  it('should throw error for invalid author type', () => {
    const modules = { '/bad-author.json': { author: 123, year: 2023, words: [] } };
    expect(() => loadDatasetFromModules('bad-author.json', modules)).toThrow(
      'Invalid dataset: missing or invalid "author" field'
    );
  });

  it('should throw error for missing year field', () => {
    const modules = { '/no-year.json': { author: 'A', words: [] } };
    expect(() => loadDatasetFromModules('no-year.json', modules)).toThrow(
      'Invalid dataset: missing or invalid "year" field'
    );
  });

  it('should throw error for invalid year type', () => {
    const modules = { '/bad-year.json': { author: 'A', year: '2023', words: [] } };
    expect(() => loadDatasetFromModules('bad-year.json', modules)).toThrow(
      'Invalid dataset: missing or invalid "year" field'
    );
  });

  it('should throw error for missing words array', () => {
    const modules = { '/no-words.json': { author: 'A', year: 2023 } };
    expect(() => loadDatasetFromModules('no-words.json', modules)).toThrow(
      'Invalid dataset: "words" must be an array'
    );
  });

  it('should throw error for non-array words field', () => {
    const modules = { '/bad-words.json': { author: 'A', year: 2023, words: 'not array' } };
    expect(() => loadDatasetFromModules('bad-words.json', modules)).toThrow(
      'Invalid dataset: "words" must be an array'
    );
  });

  it('should throw error for word entry missing word field', () => {
    const modules = { '/missing-word-field.json': { author: 'A', year: 2023, words: [{ frequency: 1 }] } };
    expect(() => loadDatasetFromModules('missing-word-field.json', modules)).toThrow(
      'Invalid word entry: missing or invalid "word" field'
    );
  });

  it('should throw error for word entry with invalid word type', () => {
    const modules = { '/bad-word-type.json': { author: 'A', year: 2023, words: [{ word: 123, frequency: 1 }] } };
    expect(() => loadDatasetFromModules('bad-word-type.json', modules)).toThrow(
      'Invalid word entry: missing or invalid "word" field'
    );
  });

  it('should throw error for word entry missing frequency field', () => {
    const modules = { '/missing-frequency.json': { author: 'A', year: 2023, words: [{ word: 'w' }] } };
    expect(() => loadDatasetFromModules('missing-frequency.json', modules)).toThrow(
      'Invalid word entry: missing or invalid "frequency" field'
    );
  });

  it('should throw error for word entry with invalid frequency type', () => {
    const modules = { '/bad-frequency-type.json': { author: 'A', year: 2023, words: [{ word: 'w', frequency: '1' }] } };
    expect(() => loadDatasetFromModules('bad-frequency-type.json', modules)).toThrow(
      'Invalid word entry: missing or invalid "frequency" field'
    );
  });

  it('should accept word entries without optional type field', () => {
    const modules = { '/no-type.json': { author: 'A', year: 2023, words: [{ word: 'w', frequency: 1 }] } };
    expect(() => loadDatasetFromModules('no-type.json', modules)).not.toThrow();
  });

  it('should handle empty words array', () => {
    const modules = { '/empty-words.json': { author: 'A', year: 2023, words: [] } };
    expect(() => loadDatasetFromModules('empty-words.json', modules)).not.toThrow();
  });

  it('should handle large dataset', () => {
    const largeWords = Array.from({ length: 1000 }, (_, i) => ({ word: `word${i}`, frequency: i }));
    const modules = { '/large.json': { author: 'A', year: 2023, words: largeWords } };
    const result = loadDatasetFromModules('large.json', modules);
    expect(result.words).toHaveLength(1000);
  });
});

describe('loadDataset', () => {
  it('should successfully load and parse real JSON dataset', async () => {
    const result = await loadDataset('sample-dataset.json');
    
    expect(result.author).toBe('Lithuanian Language Institute');
    expect(result.year).toBe(2023);
    expect(Array.isArray(result.words)).toBe(true);
    expect(result.words.length).toBeGreaterThan(0);
  });
});

describe('getAvailableDatasetsFromModules', () => {
  it('should return sorted list of dataset objects with filename and author', () => {
    const modules = {
      '/path/sample-dataset-2.json': { author: 'Vilnius University Linguistics' },
      '/path/sample-dataset-3.json': { author: 'ABC' },
      '/path/sample-dataset.json': { author: 'Lithuanian Language Institute' }
    };
    const result = getAvailableDatasetsFromModules(modules);
    expect(result).toEqual([
      { filename: 'sample-dataset-2.json', author: 'Vilnius University Linguistics' },
      { filename: 'sample-dataset-3.json', author: 'ABC' },
      { filename: 'sample-dataset.json', author: 'Lithuanian Language Institute' }
    ]);
  });
});

describe('getAvailableDatasets', () => {
  it('should return sorted list of real dataset objects with filename and author', () => {
    const result = getAvailableDatasets();
    expect(result).toEqual([
      { filename: 'sample-dataset-2.json', author: 'Vilnius University Linguistics' },
      { filename: 'sample-dataset-3.json', author: 'ABC' },
      { filename: 'sample-dataset.json', author: 'Lithuanian Language Institute' }
    ]);
  });
});
