import type { Word } from './data';

/**
 * Filters an array of words based on a search query.
 * Performs case-insensitive search on the word text.
 * @param words - Array of word objects
 * @param query - Search query string
 * @returns Filtered array of words
 */
export function filterWords(words: Word[], query: string): Word[] {
  if (!query || query.trim() === '') {
    return words;
  }
  const lowerQuery = query.toLowerCase();
  return words.filter(word => word.word.toLowerCase().includes(lowerQuery));
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