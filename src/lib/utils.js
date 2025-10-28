/**
 * Filters an array of words based on a search query and optional type filter.
 * Performs case-insensitive search on the word text.
 * If selectedTypes is provided and not empty, filters words to only include those types.
 * @param {Array} words - Array of word objects with 'word' property
 * @param {string} query - Search query string
 * @param {Array} [selectedTypes] - Optional array of types to filter by
 * @returns {Array} Filtered array of words
 */
export function filterWords(words, query, selectedTypes) {
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