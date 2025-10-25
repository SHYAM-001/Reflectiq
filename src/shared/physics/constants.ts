/**
 * Physics constants and material properties for ReflectIQ
 * Defines the behavior of different materials and laser physics
 */

import { MaterialType, MaterialProperties } from '../types/puzzle.js';
import { PhysicsConstants } from '../types/physics.js';

// Material behavior definitions based on requirements
export const MATERIAL_PROPERTIES: Record<MaterialType, MaterialProperties> = {
  mirror: {
    reflectivity: 1.0, // 100% reflection
    transparency: 0.0, // 0% pass-through
    diffusion: 0.0, // No randomness
    absorption: false, // Does not stop beam
  },

  water: {
    reflectivity: 0.8, // 80% reflection with soft behavior
    transparency: 0.0, // No pass-through
    diffusion: 0.3, // 30% chance of 1-cell offset
    absorption: false, // Does not stop beam
  },

  glass: {
    reflectivity: 0.5, // 50% reflection
    transparency: 0.5, // 50% pass-through
    diffusion: 0.0, // No randomness
    absorption: false, // Does not stop beam
  },

  metal: {
    reflectivity: 1.0, // 100% reflection (reverses direction)
    transparency: 0.0, // No pass-through
    diffusion: 0.0, // No randomness
    absorption: false, // Does not stop beam
  },

  absorber: {
    reflectivity: 0.0, // No reflection
    transparency: 0.0, // No pass-through
    diffusion: 0.0, // No randomness
    absorption: true, // Completely stops beam
  },
};

// Complete physics constants
export const PHYSICS_CONSTANTS: PhysicsConstants = {
  materials: MATERIAL_PROPERTIES,

  laser: {
    maxBounces: 1000, // Prevent infinite loops
    minIntensity: 0.01, // Minimum intensity before absorption (1%)
    defaultDirection: 0, // Starting direction (0° = right, 90° = down)
  },

  grid: {
    cellSize: 1.0, // Logical cell size for calculations
    precision: 0.001, // Decimal precision for floating point calculations
  },
};

// Difficulty-specific configurations
export const DIFFICULTY_CONFIGS = {
  Easy: {
    gridSize: 6 as const,
    materialDensity: 0.7, // 70% material coverage
    allowedMaterials: ['mirror', 'absorber'] as MaterialType[],
    baseScore: 150,
    maxTime: 300, // 5 minutes
  },

  Medium: {
    gridSize: 8 as const,
    materialDensity: 0.8, // 80% material coverage
    allowedMaterials: ['mirror', 'water', 'glass', 'absorber'] as MaterialType[],
    baseScore: 400,
    maxTime: 600, // 10 minutes
  },

  Hard: {
    gridSize: 10 as const,
    materialDensity: 0.85, // 85% material coverage
    allowedMaterials: ['mirror', 'water', 'glass', 'metal', 'absorber'] as MaterialType[],
    baseScore: 800,
    maxTime: 900, // 15 minutes
  },
} as const;

// Hint system configuration
export const HINT_CONFIG = {
  totalHints: 4,
  scoreMultipliers: [1.0, 0.8, 0.6, 0.4, 0.2], // For 0, 1, 2, 3, 4 hints used
  quadrantMapping: {
    1: { startRow: 0, endRow: 0.5, startCol: 0, endCol: 0.5 }, // Top-left
    2: { startRow: 0, endRow: 0.5, startCol: 0.5, endCol: 1.0 }, // Top-right
    3: { startRow: 0.5, endRow: 1.0, startCol: 0, endCol: 0.5 }, // Bottom-left
    4: { startRow: 0.5, endRow: 1.0, startCol: 0.5, endCol: 1.0 }, // Bottom-right
  },
} as const;

// Scoring formula constants
export const SCORING_CONFIG = {
  baseScoreMultiplier: 1.0,
  timeScoreWeight: 0.3, // 30% of score based on time
  accuracyBonus: 1.0, // 100% bonus for correct answer
  penaltyForIncorrect: 0.0, // 0 points for wrong answer
  minimumScore: 0, // Minimum possible score
} as const;

// Grid coordinate system utilities
export const GRID_UTILS = {
  // Convert grid position to array index
  positionToIndex: (x: number, y: number, gridSize: number): number => {
    return y * gridSize + x;
  },

  // Convert array index to grid position
  indexToPosition: (index: number, gridSize: number): [number, number] => {
    return [index % gridSize, Math.floor(index / gridSize)];
  },

  // Check if position is valid within grid
  isValidPosition: (x: number, y: number, gridSize: number): boolean => {
    return x >= 0 && x < gridSize && y >= 0 && y < gridSize;
  },

  // Check if position is on grid boundary
  isBoundaryPosition: (x: number, y: number, gridSize: number): boolean => {
    return x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1;
  },

  // Get all boundary positions for a grid
  getBoundaryPositions: (gridSize: number): [number, number][] => {
    const positions: [number, number][] = [];

    // Top and bottom edges
    for (let x = 0; x < gridSize; x++) {
      positions.push([x, 0]); // Top edge
      positions.push([x, gridSize - 1]); // Bottom edge
    }

    // Left and right edges (excluding corners already added)
    for (let y = 1; y < gridSize - 1; y++) {
      positions.push([0, y]); // Left edge
      positions.push([gridSize - 1, y]); // Right edge
    }

    return positions;
  },
} as const;
