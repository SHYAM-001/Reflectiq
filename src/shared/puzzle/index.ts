/**
 * Puzzle module index for ReflectIQ
 * Exports all puzzle generation, physics, and validation components
 */

// Core puzzle generation
export { PuzzleGenerator } from './PuzzleGenerator.js';

// Reflection physics engine
export { ReflectionEngine } from './ReflectionEngine.js';

// Puzzle validation
export { PuzzleValidator } from './PuzzleValidator.js';

// Re-export commonly used functions for convenience
export const createPuzzle = (difficulty: 'Easy' | 'Medium' | 'Hard', date: string) => {
  return PuzzleGenerator.getInstance().createPuzzle(difficulty, date);
};

export const generateDailyPuzzles = (date: string) => {
  return PuzzleGenerator.getInstance().generateDailyPuzzles(date);
};

export const traceLaserPath = (materials: any[], entry: [number, number], gridSize: number) => {
  return ReflectionEngine.getInstance().traceLaserPath(materials, entry, gridSize);
};

export const validatePuzzle = (puzzle: any) => {
  return PuzzleValidator.getInstance().validatePuzzle(puzzle);
};
