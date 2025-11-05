/**
 * API Types for ReflectIQ Client
 * Re-exports from shared types for consistency
 */

// Re-export shared types
export type {
  Difficulty,
  GridPosition,
  Material,
  MaterialType,
  Puzzle,
  SessionData,
  Submission,
  LeaderboardEntry,
  HintPath,
  PathSegment,
} from '../../shared/types/puzzle';

export type { ApiResponse, ScoreResult } from '../../shared/types/game';

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
  InitResponse,
  GeneratePuzzleRequest,
  GeneratePuzzleResponse,
  ValidatePuzzleRequest,
  ValidatePuzzleResponse,
  RegeneratePuzzleRequest,
  RegeneratePuzzleResponse,
} from '../../shared/types/api';
