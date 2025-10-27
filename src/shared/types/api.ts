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
}

export interface SubmitAnswerResponse
  extends ApiResponse<{
    scoreResult: ScoreResult;
    submission: Submission;
    leaderboardPosition?: number;
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
