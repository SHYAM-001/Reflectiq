/**
 * Physics module index for ReflectIQ
 * Exports all physics-related utilities and constants
 */

// Constants and configurations
export * from './constants.js';

// Angle calculation utilities
export * from './angles.js';

// Grid coordinate utilities
export * from './grid.js';

// Re-export commonly used items for convenience
export {
  MATERIAL_PROPERTIES,
  PHYSICS_CONSTANTS,
  DIFFICULTY_CONFIGS,
  HINT_CONFIG,
  SCORING_CONFIG,
  GRID_UTILS,
} from './constants.js';

export {
  normalizeAngle,
  calculateReflection,
  calculateMirrorReflection,
  calculateMetalReversal,
  calculateWaterReflection,
  getDirectionVector,
  getAngleFromVector,
} from './angles.js';

export {
  isWithinBounds,
  isExitPoint,
  getExitSide,
  getAllExitPositions,
  getNeighbors,
  positionToKey,
  keyToPosition,
  positionsEqual,
  getQuadrant,
  getQuadrantPositions,
} from './grid.js';
