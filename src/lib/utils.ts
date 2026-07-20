import type { Word } from './data';

export type WordSortKey = 'word' | 'frequency' | 'type';
export const RESULTS_PER_PAGE = 50;

export interface Page<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  start: number;
  end: number;
}

/**
 * Filters an array of words based on a search query and optional type filter.
 * Performs case-insensitive search on the word text.
 * If selectedTypes is provided and not empty, filters words to only include those types.
 * @param words - Array of word objects
 * @param query - Search query string
 * @param selectedTypes - Optional array of types to filter by
 * @returns Filtered array of words
 */
export function filterWords(words: Word[], query: string, selectedTypes?: string[]): Word[] {
  let filtered = words;

  // Filter by search query
  if (query && query.trim() !== '') {
    const lowerQuery = query.toLowerCase();
    filtered = filtered.filter(word => word.word.toLowerCase().includes(lowerQuery));
  }

  // Filter by types
  if (selectedTypes && selectedTypes.length > 0) {
    filtered = filtered.filter(word => word.type && selectedTypes.includes(word.type));
  }

  return filtered;
}

/**
 * Sorts an array of words by a specified key.
 * @param words - Array of word objects
 * @param key - Key to sort by ('word', 'frequency', or 'type')
 * @param asc - Sort ascending (true) or descending (false)
 * @returns Sorted array of words
 */
export function sortWords<T extends Word>(words: T[], key: WordSortKey, asc: boolean = true): T[] {
  return [...words].sort((a, b) => {
    if (key === 'word') {
      const aStr = a.word;
      const bStr = b.word;
      return asc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    }
    if (key === 'frequency') {
      const aNum = a.frequency;
      const bNum = b.frequency;
      return asc ? aNum - bNum : bNum - aNum;
    }

    const aType = a.type ?? '';
    const bType = b.type ?? '';
    return asc ? aType.localeCompare(bType) : bType.localeCompare(aType);
  });
}

/**
 * Returns one bounded, one-indexed result page. The source array is never
 * mutated, so it can safely be shared by the table, dashboard, and export.
 */
export function paginate<T>(items: T[], requestedPage: number, pageSize = RESULTS_PER_PAGE): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const start = items.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, items.length);

  return {
    items: items.slice(start === 0 ? 0 : start - 1, end),
    currentPage,
    totalPages,
    start,
    end
  };
}
