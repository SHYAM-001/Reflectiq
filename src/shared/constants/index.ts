/**
 * Constants index for ReflectIQ shared constants
 * Exports all constant definitions for use across client and server
 */

// Guaranteed generation constants
export * from './guaranteed-generation.js';

// Re-export commonly used constants for convenience
export {
  SPACING_CONSTRAINTS,
  GUARANTEED_GENERATION_CONFIG,
  GENERATION_THRESHOLDS,
  ERROR_RECOVERY_STRATEGIES,
} from './guaranteed-generation.js';
