/**
 * Puzzle module index for ReflectIQ
 * Exports all puzzle generation, physics, and validation components
 */

import { PuzzleValidator } from './PuzzleValidator.js';

import { ReflectionEngine } from './ReflectionEngine.js';

import { EnhancedPuzzleEngineImpl } from './EnhancedPuzzleEngine.js';

import { EnhancedPuzzleEngineImpl } from './EnhancedPuzzleEngine.js';

import { PuzzleGenerator } from './PuzzleGenerator.js';

import { PuzzleGenerator } from './PuzzleGenerator.js';

import { PuzzleValidator } from './PuzzleValidator.js';

import { ReflectionEngine } from './ReflectionEngine.js';

import { EnhancedPuzzleEngineImpl } from './EnhancedPuzzleEngine.js';

import { EnhancedPuzzleEngineImpl } from './EnhancedPuzzleEngine.js';

import { PuzzleGenerator } from './PuzzleGenerator.js';

import { PuzzleGenerator } from './PuzzleGenerator.js';

// Core puzzle generation
export { PuzzleGenerator } from './PuzzleGenerator.js';
export { EnhancedPuzzleEngineImpl } from './EnhancedPuzzleEngine.js';

// Reflection physics engine
export { ReflectionEngine } from './ReflectionEngine.js';

// Puzzle validation
export { PuzzleValidator } from './PuzzleValidator.js';

// Strategic point placement service
export { PointPlacementService } from './PointPlacementService.js';

// Re-export commonly used functions for convenience
export const createPuzzle = (difficulty: 'Easy' | 'Medium' | 'Hard', date: string) => {
  return PuzzleGenerator.getInstance().createPuzzle(difficulty, date);
};

export const generateDailyPuzzles = (date: string) => {
  return PuzzleGenerator.getInstance().generateDailyPuzzles(date);
};

// Enhanced puzzle generation convenience functions
export const createGuaranteedPuzzle = (difficulty: 'Easy' | 'Medium' | 'Hard', date: string) => {
  return EnhancedPuzzleEngineImpl.getInstance().generateGuaranteedPuzzle(difficulty, date);
};

export const getEnhancedEngine = () => {
  return EnhancedPuzzleEngineImpl.getInstance();
};

export const traceLaserPath = (materials: any[], entry: [number, number], gridSize: number) => {
  return ReflectionEngine.getInstance().traceLaserPath(materials, entry, gridSize);
};

export const validatePuzzle = (puzzle: any) => {
  return PuzzleValidator.getInstance().validatePuzzle(puzzle);
};
