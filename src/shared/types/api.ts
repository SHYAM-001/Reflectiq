/**
 * API request and response types for ReflectIQ
 * Defines the contract between client and server endpoints
 */

import {
  Puzzle,
  SessionData,
  Submission,
  LeaderboardEntry,
  Difficulty,
  GridPosition,
  HintPath,
} from './puzzle.js';

import { ScoreResult, ApiResponse } from './game.js';

// Legacy types (keeping for backward compatibility)
export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
  subreddit?: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

// ReflectIQ API Types

// GET /api/puzzle/current
export interface GetPuzzleRequest {
  difficulty: Difficulty;
}

export interface GetPuzzleResponse extends ApiResponse<Puzzle> {}

// POST /api/puzzle/start
export interface StartPuzzleRequest {
  puzzleId: string;
  userId: string;
}

export interface StartPuzzleResponse extends ApiResponse<SessionData> {}

// POST /api/puzzle/hint
export interface RequestHintRequest {
  sessionId: string;
  hintNumber: 1 | 2 | 3 | 4;
  puzzleId?: string; // Optional: for puzzle ID validation (Requirement 6.2, 6.5)
}

export interface RequestHintResponse
  extends ApiResponse<{
    hintData: HintPath;
    hintsUsed: number;
    scoreMultiplier: number;
  }> {}

// POST /api/puzzle/submit
export interface SubmitAnswerRequest {
  sessionId: string;
  answer: GridPosition;
  timeTaken: number;
  puzzleId?: string; // Optional: for puzzle ID validation (Requirement 6.2, 6.4)
}

export interface SubmitAnswerResponse
  extends ApiResponse<{
    scoreResult: ScoreResult;
    submission: Submission;
    leaderboardPosition?: number;
    commentPosting?: {
      success: boolean;
      error?: string;
      type?: 'completion' | 'encouragement';
    };
    message?: string;
    isRepeatAttempt?: boolean;
    originalCompletion?: {
      timeTaken: number;
      score: number;
      hintsUsed: number;
      completedAt: Date;
    };
  }> {}

// GET /api/leaderboard/daily
export interface GetLeaderboardRequest {
  date?: string; // YYYY-MM-DD, defaults to today
  limit?: number; // default 10
}

export interface GetLeaderboardResponse
  extends ApiResponse<{
    leaderboard: LeaderboardEntry[];
    playerRank?: number;
    totalPlayers: number;
  }> {}

// GET /api/leaderboard/puzzle
export interface GetPuzzleLeaderboardRequest {
  puzzleId: string;
  limit?: number;
}

export interface GetPuzzleLeaderboardResponse
  extends ApiResponse<{
    leaderboard: LeaderboardEntry[];
    playerRank?: number;
    totalPlayers: number;
  }> {}

// Enhanced puzzle generation endpoints

// POST /api/puzzle/generate
export interface GeneratePuzzleRequest {
  difficulty: Difficulty;
  forceRegeneration?: boolean;
  maxAttempts?: number; // Default: 10
  targetComplexity?: number; // 1-10 scale
  preferredMaterials?: string[]; // MaterialType names
}

export interface GeneratePuzzleResponse extends ApiResponse<Puzzle> {}

// GET /api/puzzle/validate
export interface ValidatePuzzleRequest {
  puzzleId: string;
}

export interface ValidatePuzzleResponse
  extends ApiResponse<{
    validationResult: import('./guaranteed-generation.js').ValidationResult;
    generationMetadata?: import('./guaranteed-generation.js').PuzzleGenerationMetadata;
  }> {}

// POST /api/puzzle/regenerate
export interface RegeneratePuzzleRequest {
  puzzleId: string;
  reason: string;
  difficulty?: Difficulty;
  preserveSettings?: boolean;
}

export interface RegeneratePuzzleResponse extends ApiResponse<Puzzle> {}

// Internal scheduler endpoints
export interface SchedulerResponse
  extends ApiResponse<{
    message: string;
    puzzlesGenerated?: number;
    leaderboardPosted?: boolean;
  }> {}

// Menu action responses
export interface MenuActionResponse {
  status: 'success' | 'error';
  message: string;
  navigateTo?: string;
  data?: any;
}

// Trigger event data
export interface PostSubmitTrigger {
  postId: string;
  authorId: string;
  subredditName: string;
  title: string;
  postData?: any;
}

export interface CommentSubmitTrigger {
  commentId: string;
  postId: string;
  authorId: string;
  body: string;
  parentId?: string;
}

// Analytics API Types

// GET /api/puzzle/analytics/volume
export interface GetVolumeMetricsRequest {
  date: string; // YYYY-MM-DD format
  difficulty: Difficulty;
}

export interface GetVolumeMetricsResponse
  extends ApiResponse<
    {
      date: string;
      hour: number;
      totalSubmissions: number;
      correctSubmissions: number;
      incorrectSubmissions: number;
      averageTime: number;
      averageScore: number;
      difficulty: Difficulty;
    }[]
  > {}

// GET /api/puzzle/analytics/success-rate
export interface GetSuccessRateMetricsRequest {
  period: 'hourly' | 'daily';
  timestamp: string;
  difficulty: Difficulty;
}

export interface GetSuccessRateMetricsResponse
  extends ApiResponse<{
    period: 'hourly' | 'daily';
    timestamp: string;
    difficulty: Difficulty;
    totalSubmissions: number;
    successfulSubmissions: number;
    successRate: number;
    averageCompletionTime: number;
    averageHintsUsed: number;
  }> {}

// GET /api/puzzle/analytics/completion-time
export interface GetCompletionTimeMetricsRequest {
  puzzleId: string;
}

export interface GetCompletionTimeMetricsResponse
  extends ApiResponse<{
    puzzleId: string;
    difficulty: Difficulty;
    fastestTime: number;
    slowestTime: number;
    averageTime: number;
    medianTime: number;
    totalCompletions: number;
    timeDistribution: {
      under30s: number;
      under60s: number;
      under120s: number;
      under300s: number;
      over300s: number;
    };
  }> {}
