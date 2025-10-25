/**
 * Shared types index for ReflectIQ
 * Exports all type definitions for use across client and server
 */

// Core puzzle and game types
export * from './puzzle.js';
export * from './game.js';
export * from './physics.js';

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
} from './api.js';
