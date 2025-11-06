/**
 * Shared types index for ReflectIQ
 * Exports all type definitions for use across client and server
 */

// Core puzzle and game types
export * from './puzzle.js';
export * from './game.js';
export * from './physics.js';

// Enhanced puzzle generation types
export * from './guaranteed-generation.js';

// API communication types
export * from './api.js';

// Re-export commonly used types for convenience
export type {
  Puzzle,
  Material,
  MaterialType,
  Difficulty,
  GridPosition,
  SessionData,
  Submission,
  LeaderboardEntry,
  GameState,
  ScoreResult,
  ApiResponse,
} from './puzzle.js';

export type {
  EnhancedPuzzleEngine,
  EntryExitPair,
  PathPlan,
  ValidationResult,
  PuzzleGenerationMetadata,
  SpacingConstraints,
  GuaranteedGenerationConfig,
} from './guaranteed-generation.js';

export type {
  GetPuzzleRequest,
  GetPuzzleResponse,
  StartPuzzleRequest,
  StartPuzzleResponse,
  RequestHintRequest,
  RequestHintResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  GetLeaderboardRequest,
  GetLeaderboardResponse,
  GetVolumeMetricsRequest,
  GetVolumeMetricsResponse,
  GetSuccessRateMetricsRequest,
  GetSuccessRateMetricsResponse,
  GetCompletionTimeMetricsRequest,
  GetCompletionTimeMetricsResponse,
} from './api.js';
