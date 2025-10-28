/**
 * Data loading utility for JSON datasets
 */

export interface Word {
  word: string;
  type?: string;
  frequency: number;
}

export interface Dataset {
  author: string;
  year: number;
  words: Word[];
}

/**
 * Loads and parses a JSON dataset file
 * @param filename - Name of the JSON file in the data/ directory
 * @returns Promise resolving to validated Dataset
 * @throws Error If file not found or JSON is invalid
 */
export async function loadDataset(filename: string): Promise<Dataset> {
  try {
    const response = await fetch(`data/${filename}`);

    if (!response.ok) {
      throw new Error(`Failed to load dataset: ${filename} (${response.status})`);
    }

    const data = await response.json();

    // Validate required fields
    if (!data.author || typeof data.author !== 'string') {
      throw new Error('Invalid dataset: missing or invalid "author" field');
    }

    if (!data.year || typeof data.year !== 'number') {
      throw new Error('Invalid dataset: missing or invalid "year" field');
    }

    if (!Array.isArray(data.words)) {
      throw new Error('Invalid dataset: "words" must be an array');
    }

    // Validate word structure
    for (const word of data.words) {
      if (!word.word || typeof word.word !== 'string') {
        throw new Error('Invalid word entry: missing or invalid "word" field');
      }
      if (typeof word.frequency !== 'number') {
        throw new Error('Invalid word entry: missing or invalid "frequency" field');
      }
    }

    return data as Dataset;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in dataset: ${filename}`);
    }
    throw error;
  }
}
