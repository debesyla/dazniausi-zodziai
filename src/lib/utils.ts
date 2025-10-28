import type { Word } from './data';

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
 * @param key - Key to sort by ('word' or 'frequency')
 * @param asc - Sort ascending (true) or descending (false)
 * @returns Sorted array of words
 */
export function sortWords(words: Word[], key: 'word' | 'frequency', asc: boolean = true): Word[] {
  return [...words].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (key === 'word') {
      const aStr = aVal as string;
      const bStr = bVal as string;
      return asc ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    } else {
      const aNum = aVal as number;
      const bNum = bVal as number;
      return asc ? aNum - bNum : bNum - aNum;
    }
  });
}