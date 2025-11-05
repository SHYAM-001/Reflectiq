/**
 * Constants and configurations for guaranteed puzzle generation
 * Centralizes all configuration values used across the enhanced generation system
 */

import {
  SpacingConstraints,
  GuaranteedGenerationConfig,
  MaterialGenerationConfig,
  ComplexityConfig,
} from '../types/guaranteed-generation.js';
import { Difficulty, MaterialType } from '../types/puzzle.js';

/**
 * Spacing constraints by difficulty level
 * Based on requirements: Easy 3+, Medium 4+, Hard 5+ minimum distance
 */
export const SPACING_CONSTRAINTS: SpacingConstraints = {
  Easy: {
    minDistance: 3,
    preferredDistance: 4,
    cornerBonus: 1.2,
    edgeBonus: 1.1,
    maxSearchAttempts: 50,
  },
  Medium: {
    minDistance: 4,
    preferredDistance: 6,
    cornerBonus: 1.3,
    edgeBonus: 1.15,
    maxSearchAttempts: 75,
  },
  Hard: {
    minDistance: 5,
    preferredDistance: 8,
    cornerBonus: 1.4,
    edgeBonus: 1.2,
    maxSearchAttempts: 100,
  },
} as const;

/**
 * Material generation configurations by difficulty
 * Defines allowed materials and their distribution weights
 */
export const MATERIAL_GENERATION_CONFIGS: Record<Difficulty, MaterialGenerationConfig> = {
  Easy: {
    targetDensity: 0.7,
    allowedMaterials: ['mirror', 'absorber'] as MaterialType[],
    materialWeights: {
      mirror: 0.7,
      absorber: 0.3,
      water: 0,
      glass: 0,
      metal: 0,
    },
    maxMaterialsPerType: 8,
    minCriticalMaterials: 2,
  },
  Medium: {
    targetDensity: 0.8,
    allowedMaterials: ['mirror', 'water', 'glass', 'absorber'] as MaterialType[],
    materialWeights: {
      mirror: 0.4,
      water: 0.2,
      glass: 0.2,
      absorber: 0.2,
      metal: 0,
    },
    maxMaterialsPerType: 10,
    minCriticalMaterials: 3,
  },
  Hard: {
    targetDensity: 0.85,
    allowedMaterials: ['mirror', 'water', 'glass', 'metal', 'absorber'] as MaterialType[],
    materialWeights: {
      mirror: 0.3,
      water: 0.2,
      glass: 0.2,
      metal: 0.15,
      absorber: 0.15,
    },
    maxMaterialsPerType: 12,
    minCriticalMaterials: 4,
  },
} as const;

/**
 * Complexity requirements by difficulty level
 * Defines reflection counts and path complexity requirements
 */
export const COMPLEXITY_CONFIGS: Record<Difficulty, ComplexityConfig> = {
  Easy: {
    minReflections: 2,
    maxReflections: 4,
    preferredReflections: 3,
    pathLengthMultiplier: 1.0,
    allowInfiniteLoopPrevention: true,
  },
  Medium: {
    minReflections: 3,
    maxReflections: 6,
    preferredReflections: 4,
    pathLengthMultiplier: 1.2,
    allowInfiniteLoopPrevention: true,
  },
  Hard: {
    minReflections: 4,
    maxReflections: 8,
    preferredReflections: 6,
    pathLengthMultiplier: 1.5,
    allowInfiniteLoopPrevention: true,
  },
} as const;

/**
 * Default configuration for guaranteed generation system
 */
export const GUARANTEED_GENERATION_CONFIG: GuaranteedGenerationConfig = {
  maxGenerationAttempts: 10,
  minConfidenceScore: 85,
  timeoutMs: 5000,
  enableFallback: true,

  spacingConstraints: SPACING_CONSTRAINTS,
  materialConfigs: MATERIAL_GENERATION_CONFIGS,
  complexityConfigs: COMPLEXITY_CONFIGS,
} as const;

/**
 * Performance and quality thresholds
 */
export const GENERATION_THRESHOLDS = {
  // Quality thresholds
  MIN_CONFIDENCE_SCORE: 85,
  EXCELLENT_CONFIDENCE_SCORE: 95,

  // Performance thresholds
  MAX_GENERATION_TIME_MS: 5000,
  TARGET_GENERATION_TIME_MS: 2000,

  // Validation thresholds
  MAX_ALTERNATIVE_SOLUTIONS: 0, // Must be exactly one solution
  MIN_PHYSICS_ACCURACY: 0.95,

  // Retry limits
  MAX_SPACING_ATTEMPTS: 100,
  MAX_PATH_PLANNING_ATTEMPTS: 50,
  MAX_MATERIAL_PLACEMENT_ATTEMPTS: 25,
} as const;

/**
 * Error recovery strategies configuration
 */
export const ERROR_RECOVERY_STRATEGIES = {
  GENERATION_TIMEOUT: {
    strategy: 'fallback_to_legacy' as const,
    maxRetries: 0,
    relaxConstraints: false,
  },
  VALIDATION_FAILURE: {
    strategy: 'retry_with_relaxed_constraints' as const,
    maxRetries: 3,
    relaxConstraints: true,
  },
  SPACING_FAILURE: {
    strategy: 'expand_search_space' as const,
    maxRetries: 2,
    relaxConstraints: true,
  },
  MATERIAL_FAILURE: {
    strategy: 'simplify_path_requirements' as const,
    maxRetries: 3,
    relaxConstraints: true,
  },
  PHYSICS_VIOLATION: {
    strategy: 'retry' as const,
    maxRetries: 2,
    relaxConstraints: false,
  },
} as const;

/**
 * Validation issue severity levels and their impact
 */
export const VALIDATION_SEVERITY_IMPACT = {
  critical: {
    failGeneration: true,
    confidenceReduction: 50,
    requiresImmediate: true,
  },
  warning: {
    failGeneration: false,
    confidenceReduction: 15,
    requiresImmediate: false,
  },
  info: {
    failGeneration: false,
    confidenceReduction: 5,
    requiresImmediate: false,
  },
} as const;

/**
 * Material priority weights for path construction
 */
export const MATERIAL_PRIORITY_WEIGHTS = {
  critical: 1.0, // Must be placed for solution to work
  supporting: 0.7, // Helps with solution quality
  decorative: 0.3, // Adds complexity but not required
} as const;

/**
 * Grid position scoring for strategic placement
 */
export const POSITION_SCORING = {
  corner: {
    baseScore: 1.0,
    difficultyMultiplier: { Easy: 1.2, Medium: 1.3, Hard: 1.4 },
  },
  edge: {
    baseScore: 0.8,
    difficultyMultiplier: { Easy: 1.1, Medium: 1.15, Hard: 1.2 },
  },
  center: {
    baseScore: 0.5,
    difficultyMultiplier: { Easy: 0.8, Medium: 0.9, Hard: 1.0 },
  },
} as const;
