import type { Word } from './data';

export interface RankedWord extends Word {
  rank: number;
}

export interface CoveragePoint {
  rank: number;
  coverage: number;
  cumulativeFrequency: number;
}

export interface PartOfSpeechTotal {
  type: string;
  frequency: number;
  entries: number;
  share: number;
}

export interface FrequencyAnalysis {
  entryCount: number;
  totalFrequency: number;
  topWord: RankedWord | null;
  rankedWords: RankedWord[];
  coverage: CoveragePoint[];
  partOfSpeech: PartOfSpeechTotal[];
}

function byFrequencyThenWord(a: Word, b: Word) {
  return b.frequency - a.frequency || a.word.localeCompare(b.word, 'lt');
}

/**
 * Creates deterministic, filter-safe analysis values from the words currently
 * being explored. It deliberately does not mutate the dataset's source rows.
 */
export function analyseFrequency(words: Word[]): FrequencyAnalysis {
  const rankedWords = [...words]
    .sort(byFrequencyThenWord)
    .map((word, index) => ({ ...word, rank: index + 1 }));
  const totalFrequency = rankedWords.reduce((sum, word) => sum + word.frequency, 0);

  let cumulativeFrequency = 0;
  const coverage = rankedWords.map((word) => {
    cumulativeFrequency += word.frequency;
    return {
      rank: word.rank,
      cumulativeFrequency,
      coverage: totalFrequency === 0 ? 0 : cumulativeFrequency / totalFrequency
    };
  });

  const totalsByType = new Map<string, { frequency: number; entries: number }>();
  for (const word of rankedWords) {
    if (!word.type) continue;
    const current = totalsByType.get(word.type) ?? { frequency: 0, entries: 0 };
    current.frequency += word.frequency;
    current.entries += 1;
    totalsByType.set(word.type, current);
  }
  const partOfSpeech = [...totalsByType.entries()]
    .map(([type, total]) => ({
      type,
      frequency: total.frequency,
      entries: total.entries,
      share: totalFrequency === 0 ? 0 : total.frequency / totalFrequency
    }))
    .sort((a, b) => b.frequency - a.frequency || a.type.localeCompare(b.type, 'lt'));

  return {
    entryCount: rankedWords.length,
    totalFrequency,
    topWord: rankedWords[0] ?? null,
    rankedWords,
    coverage,
    partOfSpeech
  };
}

/** Samples first, last, and logarithmically spaced ranks for SVGs with bounded DOM size. */
export function sampleByRank<T extends { rank: number }>(points: T[], maximumPoints = 180): T[] {
  if (points.length <= maximumPoints) return points;

  const maxRank = points[points.length - 1]?.rank ?? 0;
  const ranks = new Set<number>([1, maxRank]);
  for (let index = 0; index < maximumPoints; index += 1) {
    const proportion = index / (maximumPoints - 1);
    ranks.add(Math.max(1, Math.round(Math.exp(Math.log(maxRank) * proportion))));
  }
  return [...ranks].sort((a, b) => a - b).map((rank) => points[rank - 1]);
}
