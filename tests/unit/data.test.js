import { describe, it, expect } from 'vitest';
import { loadDataset, getAvailableDatasets } from '../../src/lib/data';

describe('loadDataset', () => {
  it('should successfully load and parse valid JSON dataset', async () => {
    const result = await loadDataset('sample-dataset.json');
    
    expect(result.author).toBe('Lithuanian Language Institute');
    expect(result.year).toBe(2023);
    expect(Array.isArray(result.words)).toBe(true);
  });

  it('should throw error for missing file', async () => {
    await expect(loadDataset('missing.json')).rejects.toThrow(
      'Dataset not found: missing.json'
    );
  });

  it('should throw error for invalid JSON', async () => {
    await expect(loadDataset('invalid.json')).rejects.toThrow(
      'Dataset not found: invalid.json'
    );
  });

  it('should throw error for missing author field', async () => {
    await expect(loadDataset('no-author.json')).rejects.toThrow(
      'Dataset not found: no-author.json'
    );
  });

  it('should throw error for invalid author type', async () => {
    await expect(loadDataset('bad-author.json')).rejects.toThrow(
      'Dataset not found: bad-author.json'
    );
  });

  it('should throw error for missing year field', async () => {
    await expect(loadDataset('no-year.json')).rejects.toThrow(
      'Dataset not found: no-year.json'
    );
  });

  it('should throw error for invalid year type', async () => {
    await expect(loadDataset('bad-year.json')).rejects.toThrow(
      'Dataset not found: bad-year.json'
    );
  });

  it('should throw error for missing words array', async () => {
    await expect(loadDataset('no-words.json')).rejects.toThrow(
      'Dataset not found: no-words.json'
    );
  });

  it('should throw error for non-array words field', async () => {
    await expect(loadDataset('bad-words.json')).rejects.toThrow(
      'Dataset not found: bad-words.json'
    );
  });

  it('should throw error for word entry missing word field', async () => {
    await expect(loadDataset('missing-word-field.json')).rejects.toThrow(
      'Dataset not found: missing-word-field.json'
    );
  });

  it('should throw error for word entry with invalid word type', async () => {
    await expect(loadDataset('bad-word-type.json')).rejects.toThrow(
      'Dataset not found: bad-word-type.json'
    );
  });

  it('should throw error for word entry missing frequency field', async () => {
    await expect(loadDataset('missing-frequency.json')).rejects.toThrow(
      'Dataset not found: missing-frequency.json'
    );
  });

  it('should throw error for word entry with invalid frequency type', async () => {
    await expect(loadDataset('bad-frequency-type.json')).rejects.toThrow(
      'Dataset not found: bad-frequency-type.json'
    );
  });

  it('should accept word entries without optional type field', async () => {
    await expect(loadDataset('no-type.json')).rejects.toThrow(
      'Dataset not found: no-type.json'
    );
  });

  it('should handle empty words array', async () => {
    await expect(loadDataset('empty-words.json')).rejects.toThrow(
      'Dataset not found: empty-words.json'
    );
  });
});

describe('getAvailableDatasets', () => {
  it('should return sorted list of dataset objects with filename and author', () => {
    const result = getAvailableDatasets();
    expect(result).toEqual([
      { filename: 'sample-dataset-2.json', author: 'Vilnius University Linguistics' },
      { filename: 'sample-dataset-3.json', author: 'ABC' },
      { filename: 'sample-dataset.json', author: 'Lithuanian Language Institute' }
    ]);
  });
});
