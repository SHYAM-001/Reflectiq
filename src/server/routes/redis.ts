import express from 'express';
import { context } from '@devvit/web/server';
import { redisManager } from '../services/RedisManager.js';
import type { DifficultyLevel } from '../services/GameEngine.js';

const router = express.Router();

/**
 * Get leaderboard for specific difficulty
 * GET /api/redis/leaderboard/:difficulty
 */
router.get('/api/redis/leaderboard/:difficulty', async (req, res) => {
  try {
    const { difficulty } = req.params as { difficulty: DifficultyLevel };
    const limit = parseInt(req.query.limit as string) || 50;

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DIFFICULTY',
          message: 'Difficulty must be easy, medium, or hard',
          timestamp: new Date(),
        },
      });
    }

    const leaderboard = await redisManager.getLeaderboard(difficulty, limit);

    res.json({
      difficulty,
      leaderboard,
      totalEntries: leaderboard.length,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      error: {
        code: 'LEADERBOARD_FETCH_FAILED',
        message: 'Failed to fetch leaderboard',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Get user's rank in leaderboard
 * GET /api/redis/rank/:difficulty
 */
router.get('/api/redis/rank/:difficulty', async (req, res) => {
  try {
    const { difficulty } = req.params as { difficulty: DifficultyLevel };
    const { userId } = context;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DIFFICULTY',
          message: 'Difficulty must be easy, medium, or hard',
          timestamp: new Date(),
        },
      });
    }

    const rank = await redisManager.getUserRank(userId, difficulty);

    res.json({
      userId,
      difficulty,
      rank,
      hasRank: rank !== null,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching user rank:', error);
    res.status(500).json({
      error: {
        code: 'RANK_FETCH_FAILED',
        message: 'Failed to fetch user rank',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Get user progress statistics
 * GET /api/redis/progress
 */
router.get('/api/redis/progress', async (_req, res) => {
  try {
    const { userId } = context;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    const progress = await redisManager.getUserProgress(userId);

    res.json({
      userId,
      progress,
      hasProgress: progress !== null,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({
      error: {
        code: 'PROGRESS_FETCH_FAILED',
        message: 'Failed to fetch user progress',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Create game session
 * POST /api/redis/session
 */
router.post('/api/redis/session', async (req, res) => {
  try {
    const { puzzleId, difficulty } = req.body as { puzzleId: string; difficulty: DifficultyLevel };
    const { userId } = context;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    if (!puzzleId || !difficulty) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'puzzleId and difficulty are required',
          timestamp: new Date(),
        },
      });
    }

    const sessionId = `session_${puzzleId}_${userId}_${Date.now()}`;

    await redisManager.createGameSession(sessionId, puzzleId, userId, difficulty);

    res.json({
      sessionId,
      puzzleId,
      userId,
      difficulty,
      startTime: new Date(),
      message: 'Game session created successfully',
    });
  } catch (error) {
    console.error('Error creating game session:', error);
    res.status(500).json({
      error: {
        code: 'SESSION_CREATE_FAILED',
        message: 'Failed to create game session',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Get game session
 * GET /api/redis/session/:sessionId
 */
router.get('/api/redis/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = context;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    const session = await redisManager.getGameSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or expired',
          timestamp: new Date(),
        },
      });
    }

    // Verify session belongs to current user
    if (session.userId !== userId) {
      return res.status(403).json({
        error: {
          code: 'SESSION_ACCESS_DENIED',
          message: 'Access denied to this game session',
          timestamp: new Date(),
        },
      });
    }

    res.json({
      session,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error fetching game session:', error);
    res.status(500).json({
      error: {
        code: 'SESSION_FETCH_FAILED',
        message: 'Failed to fetch game session',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Update game session with hint usage
 * PUT /api/redis/session/:sessionId/hints
 */
router.put('/api/redis/session/:sessionId/hints', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { hintsUsed } = req.body as { hintsUsed: number[] };
    const { userId } = context;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    if (!Array.isArray(hintsUsed)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'hintsUsed must be an array of numbers',
          timestamp: new Date(),
        },
      });
    }

    const session = await redisManager.getGameSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or expired',
          timestamp: new Date(),
        },
      });
    }

    if (session.userId !== userId) {
      return res.status(403).json({
        error: {
          code: 'SESSION_ACCESS_DENIED',
          message: 'Access denied to this game session',
          timestamp: new Date(),
        },
      });
    }

    await redisManager.updateGameSession(sessionId, hintsUsed);

    res.json({
      sessionId,
      hintsUsed,
      message: 'Game session updated successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error updating game session:', error);
    res.status(500).json({
      error: {
        code: 'SESSION_UPDATE_FAILED',
        message: 'Failed to update game session',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * End game session
 * POST /api/redis/session/:sessionId/end
 */
router.post('/api/redis/session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = context;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    const session = await redisManager.getGameSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Game session not found or expired',
          timestamp: new Date(),
        },
      });
    }

    if (session.userId !== userId) {
      return res.status(403).json({
        error: {
          code: 'SESSION_ACCESS_DENIED',
          message: 'Access denied to this game session',
          timestamp: new Date(),
        },
      });
    }

    await redisManager.endGameSession(sessionId);

    res.json({
      sessionId,
      message: 'Game session ended successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error ending game session:', error);
    res.status(500).json({
      error: {
        code: 'SESSION_END_FAILED',
        message: 'Failed to end game session',
        timestamp: new Date(),
      },
    });
  }
});

/**
 * Track hint usage
 * POST /api/redis/hints
 */
router.post('/api/redis/hints', async (req, res) => {
  try {
    const { puzzleId, quadrant } = req.body as { puzzleId: string; quadrant: number };
    const { userId } = context;

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          timestamp: new Date(),
        },
      });
    }

    if (!puzzleId || quadrant === undefined) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'puzzleId and quadrant are required',
          timestamp: new Date(),
        },
      });
    }

    await redisManager.trackHintUsage(puzzleId, userId, quadrant);

    res.json({
      puzzleId,
      userId,
      quadrant,
      message: 'Hint usage tracked successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error tracking hint usage:', error);
    res.status(500).json({
      error: {
        code: 'HINT_TRACKING_FAILED',
        message: 'Failed to track hint usage',
        timestamp: new Date(),
      },
    });
  }
});

export default router;
