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
 * Loads and parses a JSON dataset file from modules
 * @param filename - Name of the JSON file
 * @param modules - The modules object from import.meta.glob
 * @returns Validated Dataset
 * @throws Error If file not found or JSON is invalid
 */
export function loadDatasetFromModules(filename: string, modules: Record<string, any>): Dataset {
  const path = Object.keys(modules).find(p => p.endsWith(`/${filename}`));
  if (!path) {
    throw new Error(`Dataset not found: ${filename}`);
  }
  const data = modules[path] as Dataset;

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

  return data;
}

/**
 * Loads and parses a JSON dataset file
 * @param filename - Name of the JSON file in the data/ directory
 * @returns Promise resolving to validated Dataset
 * @throws Error If file not found or JSON is invalid
 */
export async function loadDataset(filename: string): Promise<Dataset> {
  const modules = import.meta.glob('/src/data/*.json', { import: 'default', eager: true });
  return loadDatasetFromModules(filename, modules);
}

/**
 * Gets the list of available JSON dataset filenames with their authors from modules
 * @param modules - The modules object
 * @returns Array of objects with filename and author
 */
export function getAvailableDatasetsFromModules(modules: Record<string, any>): { filename: string; author: string }[] {
  return Object.entries(modules)
    .map(([path, data]: [string, any]) => ({
      filename: path.split('/').pop()!,
      author: data.author
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Gets the list of available JSON dataset filenames with their authors
 * @returns Array of objects with filename and author
 */
export function getAvailableDatasets(): { filename: string; author: string }[] {
  const modules = import.meta.glob('/src/data/*.json', { import: 'default', eager: true });
  return getAvailableDatasetsFromModules(modules);
}
