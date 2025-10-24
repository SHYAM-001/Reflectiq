// API request and response types

import type {
  PuzzleConfiguration,
  LaserPath,
  PathSegment,
  ScoreCalculation,
  LeaderboardEntry,
  DifficultyLevel,
  Coordinate,
} from './game.js';
import type {
  DailyPuzzleSet,
  PuzzlePost,
  FilterQuery,
  UserDailyProgress,
} from './daily-puzzles.js';

// Request types
export interface StartPuzzleRequest {
  difficulty: DifficultyLevel;
  postId?: string;
}

export interface HintRequest {
  puzzleId: string;
  quadrant: number;
  sessionId: string;
}

export interface SubmitAnswerRequest {
  puzzleId: string;
  answer: string;
  sessionId: string;
  timeElapsed: number;
  hintsUsed: number;
}

export interface GetLeaderboardRequest {
  difficulty: DifficultyLevel;
  limit?: number;
}

export interface GetPuzzlesRequest extends FilterQuery {
  // Extends FilterQuery with any additional request-specific fields
}

// Response types
export interface PuzzleResponse {
  puzzle: PuzzleConfiguration;
  sessionId: string;
  startTime: Date;
}

export interface HintResponse {
  quadrant: number;
  revealedPath: PathSegment[];
  remainingHints: number;
  scoreMultiplier: number;
}

export interface SubmissionResponse {
  isCorrect: boolean;
  correctExit: Coordinate;
  playerAnswer: Coordinate;
  score: ScoreCalculation;
  leaderboardPosition: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserRank?: number;
  totalPlayers: number;
}

export interface DailyPuzzlesResponse {
  todaysPuzzles: DailyPuzzleSet;
  userProgress: UserDailyProgress;
  nextPuzzleTime: Date;
}

export interface PuzzleListResponse {
  puzzles: PuzzlePost[];
  totalCount: number;
  hasMore: boolean;
  filters: FilterQuery;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: Date;
  };
}

// Game session types
export interface GameSession {
  sessionId: string;
  puzzleId: string;
  userId: string;
  startTime: Date;
  hintsUsed: number[];
  isActive: boolean;
}
