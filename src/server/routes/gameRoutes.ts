// Game API routes for Logic Reflections

import type { Request, Response } from 'express';
import type {
  StartPuzzleRequest,
  HintRequest,
  SubmitAnswerRequest,
  GetLeaderboardRequest,
} from '../../shared/types/api.js';
import { GameEngine } from '../services/GameEngine.js';
import { RedisManager } from '../services/RedisManager.js';

// Note: In a real Devvit app, we would get the Redis client from the Devvit context
// For now, we'll assume it's injected
let gameEngine: GameEngine;
let redisManager: RedisManager;

// Initialize services (would be done in main server file)
export function initializeGameServices(redis: any) {
  redisManager = new RedisManager(redis);
  gameEngine = new GameEngine();
}

/**
 * Start a new puzzle session
 * POST /api/puzzle/start
 */
export async function startPuzzle(req: Request, res: Response) {
  try {
    const request: StartPuzzleRequest = req.body;
    const userId = req.headers['x-user-id'] as string; // From Devvit auth middleware

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    // Validate request
    if (!request.difficulty || !['easy', 'medium', 'hard'].includes(request.difficulty)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DIFFICULTY',
          message: 'Valid difficulty level required (easy, medium, hard)',
          timestamp: new Date(),
        },
      });
    }

    // Start puzzle session
    const response = gameEngine.startPuzzle(request, userId);

    // Store puzzle and session in Redis
    await redisManager.storePuzzle(response.puzzle.id, response.puzzle);
    const session = gameEngine.getSession(response.sessionId);
    if (session) {
      await redisManager.storeSession(response.sessionId, session);
    }

    res.json(response);
  } catch (error) {
    console.error('Error starting puzzle:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to start puzzle',
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Request a hint for a puzzle quadrant
 * POST /api/puzzle/hint
 */
export async function getHint(req: Request, res: Response) {
  try {
    const request: HintRequest = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    // Validate request
    if (!request.sessionId || !request.puzzleId || typeof request.quadrant !== 'number') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Session ID, puzzle ID, and quadrant are required',
          timestamp: new Date(),
        },
      });
    }

    if (request.quadrant < 0 || request.quadrant > 3) {
      return res.status(400).json({
        error: {
          code: 'INVALID_QUADRANT',
          message: 'Quadrant must be between 0 and 3',
          timestamp: new Date(),
        },
      });
    }

    // Process hint request
    const response = gameEngine.processHintRequest(request);

    // Track hint usage in Redis
    await redisManager.trackHintUsage(request.puzzleId, userId, request.quadrant);

    // Update session in Redis
    const session = gameEngine.getSession(request.sessionId);
    if (session) {
      await redisManager.storeSession(request.sessionId, session);
    }

    res.json(response);
  } catch (error) {
    console.error('Error processing hint request:', error);

    if (error instanceof Error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('already used') ||
        error.message.includes('Maximum')
      ) {
        return res.status(400).json({
          error: {
            code: 'HINT_ERROR',
            message: error.message,
            timestamp: new Date(),
          },
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process hint request',
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Submit puzzle answer
 * POST /api/puzzle/submit
 */
export async function submitAnswer(req: Request, res: Response) {
  try {
    const request: SubmitAnswerRequest = req.body;
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    // Validate request
    if (!request.sessionId || !request.puzzleId || !request.answer) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Session ID, puzzle ID, and answer are required',
          timestamp: new Date(),
        },
      });
    }

    if (typeof request.timeElapsed !== 'number' || request.timeElapsed < 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TIME',
          message: 'Valid elapsed time is required',
          timestamp: new Date(),
        },
      });
    }

    // Validate answer and calculate score
    const response = gameEngine.validateAnswer(request);

    // Update leaderboard if correct answer
    if (response.isCorrect && response.score.finalScore > 0) {
      const puzzle = gameEngine.getPuzzle(request.puzzleId);
      if (puzzle) {
        const leaderboardEntry = {
          rank: 0, // Will be set by Redis
          username: userId,
          difficulty: puzzle.difficulty,
          timeElapsed: request.timeElapsed,
          hintsUsed: request.hintsUsed,
          finalScore: response.score.finalScore,
          timestamp: new Date(),
        };

        await redisManager.updatePlayerScore(leaderboardEntry);

        // Get updated rank
        const rank = await redisManager.getPlayerRank(userId, puzzle.difficulty);
        response.leaderboardPosition = rank || 0;
      }
    }

    // Update session in Redis
    const session = gameEngine.getSession(request.sessionId);
    if (session) {
      await redisManager.storeSession(request.sessionId, session);
    }

    res.json(response);
  } catch (error) {
    console.error('Error submitting answer:', error);

    if (error instanceof Error) {
      if (error.message.includes('Invalid') || error.message.includes('format')) {
        return res.status(400).json({
          error: {
            code: 'INVALID_ANSWER',
            message: error.message,
            timestamp: new Date(),
          },
        });
      }
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to submit answer',
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Get leaderboard for difficulty
 * GET /api/leaderboard?difficulty=easy&limit=50
 */
export async function getLeaderboard(req: Request, res: Response) {
  try {
    const difficulty = req.query.difficulty as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.headers['x-user-id'] as string;

    // Validate difficulty
    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DIFFICULTY',
          message: 'Valid difficulty level required (easy, medium, hard)',
          timestamp: new Date(),
        },
      });
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be between 1 and 100',
          timestamp: new Date(),
        },
      });
    }

    // Get leaderboard data
    const entries = await redisManager.getLeaderboard(difficulty as any, limit);
    const totalPlayers = await redisManager.getTotalPlayers(difficulty as any);

    let currentUserRank: number | undefined;
    if (userId) {
      currentUserRank = (await redisManager.getPlayerRank(userId, difficulty as any)) || undefined;
    }

    res.json({
      entries,
      currentUserRank,
      totalPlayers,
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get leaderboard',
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Get puzzle by ID
 * GET /api/puzzle/:puzzleId
 */
export async function getPuzzle(req: Request, res: Response) {
  try {
    const puzzleId = req.params.puzzleId;

    if (!puzzleId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Puzzle ID is required',
          timestamp: new Date(),
        },
      });
    }

    // Try to get from cache first, then Redis
    let puzzle = gameEngine.getPuzzle(puzzleId);
    if (!puzzle) {
      puzzle = await redisManager.getPuzzle(puzzleId);
    }

    if (!puzzle) {
      return res.status(404).json({
        error: {
          code: 'PUZZLE_NOT_FOUND',
          message: 'Puzzle not found',
          timestamp: new Date(),
        },
      });
    }

    res.json({ puzzle });
  } catch (error) {
    console.error('Error getting puzzle:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get puzzle',
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Get game statistics
 * GET /api/stats
 */
export async function getGameStats(req: Request, res: Response) {
  try {
    const gameStats = gameEngine.getGameStats();
    const redisStats = await redisManager.getStats();

    res.json({
      game: gameStats,
      redis: redisStats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error getting game stats:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get game statistics',
        timestamp: new Date(),
      },
    });
  }
}
