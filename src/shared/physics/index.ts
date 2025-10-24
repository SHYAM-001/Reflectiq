// Export all physics engine components

export { LaserEngine } from './laser-engine.js';
export { PathValidator } from './path-validator.js';
export { BeamHandler } from './beam-handler.js';

export type { ValidationResult, ComplexityScore } from './path-validator.js';

export type {
  ExitResult,
  AbsorptionResult,
  SplitResult,
  PathIntegrityResult,
} from './beam-handler.js';
