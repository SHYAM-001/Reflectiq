/**
 * Game state and interaction interfaces for ReflectIQ
 * Defines client-server communication and game flow
 */

import {
  Puzzle,
  SessionData,
  Submission,
  LeaderboardEntry,
  GridPosition,
  HintPath,
  Difficulty,
} from './puzzle.js';

// Game state for client-side management
export interface GameState {
  currentPuzzle: Puzzle | null;
  session: SessionData | null;
  hintsRevealed: number;
  revealedHints: HintPath[];
  playerAnswer: GridPosition | null;
  gameStatus: 'loading' | 'ready' | 'playing' | 'submitted' | 'completed' | 'error';
  timer: {
    startTime: Date | null;
    elapsedTime: number; // seconds
    isRunning: boolean;
  };
}

// Client-side puzzle display data
export interface PuzzleDisplayData {
  puzzle: Puzzle;
  revealedHints: HintPath[];
  showSolution: boolean;
  highlightedCells: GridPosition[];
}

// Scoring calculation result
export interface ScoreResult {
  baseScore: number;
  hintMultiplier: number;
  timeMultiplier: number;
  finalScore: number;
  correct: boolean;
  timeTaken: number;
  hintsUsed: number;
  maxPossibleScore: number;
}

// Error types for better error handling
export type GameError =
  | 'PUZZLE_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'INVALID_ANSWER'
  | 'REDIS_ERROR'
  | 'GENERATION_FAILED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED';

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    type: GameError;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

// Puzzle statistics for analytics
export interface PuzzleStats {
  puzzleId: string;
  difficulty: Difficulty;
  totalAttempts: number;
  correctAnswers: number;
  averageTime: number;
  averageHints: number;
  successRate: number;
  topScore: number;
}

// Daily statistics aggregation
export interface DailyStats {
  date: string;
  totalPlayers: number;
  puzzleStats: {
    easy: PuzzleStats;
    medium: PuzzleStats;
    hard: PuzzleStats;
  };
  overallSuccessRate: number;
  averageScore: number;
}
