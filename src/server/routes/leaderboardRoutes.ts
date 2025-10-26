/**
 * Leaderboard API Routes for ReflectIQ
 * Handles leaderboard retrieval and ranking operations
 * Following Devvit Web patterns for API endpoints
 */

import { Router } from 'express';
import { redis } from '@devvit/web/server';
import {
  GetLeaderboardRequest,
  GetLeaderboardResponse,
  GetPuzzleLeaderboardRequest,
  GetPuzzleLeaderboardResponse,
} from '../../shared/types/api.js';

import { LeaderboardService } from '../services/LeaderboardService.js';

const router = Router();

/**
 * GET /api/leaderboard/daily?date=YYYY-MM-DD&limit=10
 * Get the combined daily leaderboard for all difficulties
 * Requirements: 11.5, 7.4, 7.5
 */
router.get('/daily', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const response: GetLeaderboardResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Date must be in YYYY-MM-DD format',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      const response: GetLeaderboardResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Limit must be between 1 and 100',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    const leaderboardService = LeaderboardService.getInstance();
    const result = await leaderboardService.getDailyLeaderboard(date, limit);

    const response: GetLeaderboardResponse = {
      success: true,
      data: {
        leaderboard: result.entries,
        totalPlayers: result.totalPlayers,
      },
      timestamp: new Date(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error processing daily leaderboard request:', error);
    const response: GetLeaderboardResponse = {
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to process leaderboard request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/leaderboard/puzzle?puzzleId=puzzle_easy_2024-01-01&limit=10
 * Get the leaderboard for a specific puzzle
 * Requirements: 11.5, 7.4, 7.5
 */
router.get('/puzzle', async (req, res) => {
  try {
    const puzzleId = req.query.puzzleId as string;
    const limit = parseInt(req.query.limit as string) || 10;

    // Validate puzzle ID
    if (!puzzleId || !/^puzzle_(easy|medium|hard)_\d{4}-\d{2}-\d{2}$/.test(puzzleId)) {
      const response: GetPuzzleLeaderboardResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Valid puzzleId is required (format: puzzle_difficulty_YYYY-MM-DD)',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    // Validate limit
    if (limit < 1 || limit > 100) {
      const response: GetPuzzleLeaderboardResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Limit must be between 1 and 100',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    const leaderboardService = LeaderboardService.getInstance();
    const result = await leaderboardService.getPuzzleLeaderboard(puzzleId, limit);

    const response: GetPuzzleLeaderboardResponse = {
      success: true,
      data: {
        leaderboard: result.entries,
        totalPlayers: result.totalPlayers,
      },
      timestamp: new Date(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error processing puzzle leaderboard request:', error);
    const response: GetPuzzleLeaderboardResponse = {
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to process leaderboard request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/leaderboard/user/:username?date=YYYY-MM-DD
 * Get a specific user's ranking and stats
 * Requirements: 7.4, 7.5
 */
router.get('/user/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    if (!username) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Username is required',
        },
        timestamp: new Date(),
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Date must be in YYYY-MM-DD format',
        },
        timestamp: new Date(),
      });
    }

    const leaderboardService = LeaderboardService.getInstance();

    // Get user's rankings for each difficulty
    const userRankings = [];
    const difficulties = ['Easy', 'Medium', 'Hard'] as const;

    for (const difficulty of difficulties) {
      const puzzleId = `puzzle_${difficulty.toLowerCase()}_${date}`;

      // Get user's score and rank for this puzzle
      const score = await leaderboardService.getUserPuzzleScore(puzzleId, username);
      const rank = await leaderboardService.getUserPuzzleRank(puzzleId, username);
      const dailyRank = await leaderboardService.getUserDailyRank(date, username, difficulty);

      if (score !== null) {
        userRankings.push({
          difficulty,
          score,
          puzzleRank: rank,
          dailyRank,
          puzzleId,
        });
      }
    }

    res.json({
      success: true,
      data: {
        username,
        date,
        rankings: userRankings,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error processing user ranking request:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to process user ranking request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    });
  }
});

/**
 * GET /api/leaderboard/stats?date=YYYY-MM-DD
 * Get leaderboard statistics for monitoring
 * Requirements: 7.4, 7.5
 */
router.get('/stats', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Date must be in YYYY-MM-DD format',
        },
        timestamp: new Date(),
      });
    }

    const leaderboardService = LeaderboardService.getInstance();
    const stats = await leaderboardService.getLeaderboardStats(date);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error getting leaderboard stats:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to get leaderboard statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    });
  }
});

export default router;
