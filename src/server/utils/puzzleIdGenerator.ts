/**
 * Puzzle ID Generator Utility
 * Generates unique puzzle IDs for post-specific puzzles
 */

import { Difficulty } from '../../shared/types/puzzle.js';

/**
 * Generate a unique puzzle ID in the format: {date}_{difficulty}_{timestamp}_{random}
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @param difficulty - Puzzle difficulty level
 * @returns Unique puzzle ID string
 *
 * @example
 * generateUniquePuzzleId('2025-11-09', 'Medium')
 * // Returns: '2025-11-09_medium_1731168000000_a3f9c2'
 */
export const generateUniquePuzzleId = (date: string, difficulty: Difficulty): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const difficultyLower = difficulty.toLowerCase();

  return `${date}_${difficultyLower}_${timestamp}_${random}`;
};

/**
 * Validate puzzle ID format
 *
 * @param puzzleId - Puzzle ID to validate
 * @returns True if valid format, false otherwise
 */
export const isValidPuzzleId = (puzzleId: string): boolean => {
  // Format: {date}_{difficulty}_{timestamp}_{random}
  const pattern = /^\d{4}-\d{2}-\d{2}_(easy|medium|hard)_\d+_[a-z0-9]+$/;
  return pattern.test(puzzleId);
};

/**
 * Extract components from puzzle ID
 *
 * @param puzzleId - Puzzle ID to parse
 * @returns Object with date, difficulty, timestamp, and random components
 */
export const parsePuzzleId = (
  puzzleId: string
): {
  date: string;
  difficulty: string;
  timestamp: number;
  random: string;
} | null => {
  if (!isValidPuzzleId(puzzleId)) {
    return null;
  }

  const parts = puzzleId.split('_');
  return {
    date: parts[0] as string,
    difficulty: parts[1] as string,
    timestamp: parseInt(parts[2] as string, 10),
    random: parts[3] as string,
  };
};
