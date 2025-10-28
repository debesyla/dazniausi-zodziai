import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadDataset, getAvailableDatasets } from '../../src/lib/data';

describe('loadDataset', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  it('should successfully load and parse valid JSON dataset', async () => {
    const mockData = {
      author: 'Test Author',
      year: 2023,
      words: [
        { word: 'test', type: 'noun', frequency: 100 },
        { word: 'example', frequency: 50 }
      ]
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const result = await loadDataset('test.json');
    
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('data/test.json');
  });

  it('should throw error for missing file (404)', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 404
    });

    await expect(loadDataset('missing.json')).rejects.toThrow(
      'Failed to load dataset: missing.json (404)'
    );
  });

  it('should throw error for invalid JSON', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Invalid JSON');
      }
    });

    await expect(loadDataset('invalid.json')).rejects.toThrow(
      'Invalid JSON in dataset: invalid.json'
    );
  });

  it('should throw error for missing author field', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        year: 2023,
        words: []
      })
    });

    await expect(loadDataset('no-author.json')).rejects.toThrow(
      'Invalid dataset: missing or invalid "author" field'
    );
  });

  it('should throw error for invalid author type', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 123,
        year: 2023,
        words: []
      })
    });

    await expect(loadDataset('bad-author.json')).rejects.toThrow(
      'Invalid dataset: missing or invalid "author" field'
    );
  });

  it('should throw error for missing year field', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        words: []
      })
    });

    await expect(loadDataset('no-year.json')).rejects.toThrow(
      'Invalid dataset: missing or invalid "year" field'
    );
  });

  it('should throw error for invalid year type', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        year: '2023',
        words: []
      })
    });

    await expect(loadDataset('bad-year.json')).rejects.toThrow(
      'Invalid dataset: missing or invalid "year" field'
    );
  });

  it('should throw error for missing words array', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        year: 2023
      })
    });

    await expect(loadDataset('no-words.json')).rejects.toThrow(
      'Invalid dataset: "words" must be an array'
    );
  });

  it('should throw error for non-array words field', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        year: 2023,
        words: 'not an array'
      })
    });

    await expect(loadDataset('bad-words.json')).rejects.toThrow(
      'Invalid dataset: "words" must be an array'
    );
  });

  it('should throw error for word entry missing word field', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        year: 2023,
        words: [
          { frequency: 100 }
        ]
      })
    });

    await expect(loadDataset('missing-word-field.json')).rejects.toThrow(
      'Invalid word entry: missing or invalid "word" field'
    );
  });

  it('should throw error for word entry with invalid word type', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        year: 2023,
        words: [
          { word: 123, frequency: 100 }
        ]
      })
    });

    await expect(loadDataset('bad-word-type.json')).rejects.toThrow(
      'Invalid word entry: missing or invalid "word" field'
    );
  });

  it('should throw error for word entry missing frequency field', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        year: 2023,
        words: [
          { word: 'test' }
        ]
      })
    });

    await expect(loadDataset('missing-frequency.json')).rejects.toThrow(
      'Invalid word entry: missing or invalid "frequency" field'
    );
  });

  it('should throw error for word entry with invalid frequency type', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        author: 'Test',
        year: 2023,
        words: [
          { word: 'test', frequency: '100' }
        ]
      })
    });

    await expect(loadDataset('bad-frequency-type.json')).rejects.toThrow(
      'Invalid word entry: missing or invalid "frequency" field'
    );
  });

  it('should accept word entries without optional type field', async () => {
    const mockData = {
      author: 'Test',
      year: 2023,
      words: [
        { word: 'test', frequency: 100 }
      ]
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const result = await loadDataset('no-type.json');
    expect(result).toEqual(mockData);
  });

  it('should handle empty words array', async () => {
    const mockData = {
      author: 'Test',
      year: 2023,
      words: []
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const result = await loadDataset('empty-words.json');
    expect(result).toEqual(mockData);
  });
});

describe('getAvailableDatasets', () => {
  beforeEach(() => {
    vi.stubGlobal('import', {
      meta: {
        glob: vi.fn(() => ({
          '/static/data/sample-dataset.json': { author: 'Author 1' },
          '/static/data/sample-dataset-2.json': { author: 'Author 2' }
        }))
      }
    });
  });

  it('should return sorted list of dataset objects with filename and author', () => {
    const result = getAvailableDatasets();
    expect(result).toEqual([
      { filename: 'sample-dataset-2.json', author: 'Vilnius University Linguistics Department' },
      { filename: 'sample-dataset.json', author: 'Lithuanian Language Institute' }
    ]);
  });
});
