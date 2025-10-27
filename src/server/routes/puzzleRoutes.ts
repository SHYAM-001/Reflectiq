/**
 * Puzzle API Routes for ReflectIQ
 * Handles puzzle retrieval, session management, hints, and submissions
 * Following Devvit Web server patterns
 */

import { Router } from 'express';
import { context, redis } from '@devvit/web/server';
import {
  GetPuzzleRequest,
  GetPuzzleResponse,
  StartPuzzleRequest,
  StartPuzzleResponse,
  RequestHintRequest,
  RequestHintResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../../shared/types/api.js';

import {
  Puzzle,
  SessionData,
  Submission,
  Difficulty,
  DailyPuzzleSet,
} from '../../shared/types/puzzle.js';

import { PuzzleService } from '../services/PuzzleService.js';
import { HINT_CONFIG, DIFFICULTY_CONFIGS } from '../../shared/physics/constants.js';

const router = Router();

/**
 * GET /api/puzzle/current?difficulty=Easy|Medium|Hard
 * Retrieve the current day's puzzle for the specified difficulty
 * Requirements: 11.1, 9.1, 9.2
 */
router.get('/current', async (req, res) => {
  try {
    const difficulty = req.query.difficulty as Difficulty;

    // Validate difficulty parameter
    if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      const response: GetPuzzleResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Difficulty must be Easy, Medium, or Hard',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    const puzzleService = PuzzleService.getInstance();
    const response = await puzzleService.getCurrentPuzzle(difficulty);

    if (response.success) {
      res.json(response);
    } else {
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Error retrieving puzzle:', error);
    const response: GetPuzzleResponse = {
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to retrieve puzzle',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/puzzle/start
 * Initialize a new puzzle session and start the timer
 * Requirements: 11.2, 4.1, 4.4, 9.2
 */
router.post('/start', async (req, res) => {
  try {
    const { puzzleId, userId }: StartPuzzleRequest = req.body;

    // Validate request
    if (!puzzleId || !userId) {
      const response: StartPuzzleResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'puzzleId and userId are required',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    // Generate session ID
    const sessionId = `session_${userId}_${puzzleId}_${Date.now()}`;

    // Extract difficulty from puzzle ID (format: puzzle_easy_2024-01-01)
    const difficultyMatch = puzzleId.match(/puzzle_(easy|medium|hard)_/);
    if (!difficultyMatch) {
      const response: StartPuzzleResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Invalid puzzle ID format',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    const difficulty = (difficultyMatch[1].charAt(0).toUpperCase() +
      difficultyMatch[1].slice(1)) as Difficulty;

    // Create session data
    const sessionData: SessionData = {
      sessionId,
      userId,
      puzzleId,
      difficulty,
      startTime: new Date(),
      hintsUsed: 0,
      status: 'active',
      currentHintLevel: 0,
    };

    // Store session in Redis with 1 hour expiration
    const sessionKey = `reflectiq:sessions:${sessionId}`;
    try {
      await redis.set(sessionKey, JSON.stringify(sessionData));
      await redis.expire(sessionKey, 3600);
    } catch (error) {
      console.error('Failed to store session:', error);
      const response: StartPuzzleResponse = {
        success: false,
        error: {
          type: 'REDIS_ERROR',
          message: 'Failed to create session',
        },
        timestamp: new Date(),
      };
      return res.status(500).json(response);
    }

    const response: StartPuzzleResponse = {
      success: true,
      data: sessionData,
      timestamp: new Date(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error starting puzzle session:', error);
    const response: StartPuzzleResponse = {
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to start puzzle session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/puzzle/hint
 * Request a hint for the current puzzle session
 * Requirements: 11.3, 3.1, 3.2, 3.4, 3.5
 */
router.post('/hint', async (req, res) => {
  try {
    const { sessionId, hintNumber }: RequestHintRequest = req.body;

    // Validate request
    if (!sessionId || !hintNumber || hintNumber < 1 || hintNumber > 4) {
      const response: RequestHintResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Valid sessionId and hintNumber (1-4) are required',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    // Retrieve session
    const sessionKey = `reflectiq:sessions:${sessionId}`;
    let sessionData: SessionData;

    try {
      const cachedSession = await redis.get(sessionKey);
      if (!cachedSession) {
        const response: RequestHintResponse = {
          success: false,
          error: {
            type: 'SESSION_EXPIRED',
            message: 'Session not found or expired',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }
      sessionData = JSON.parse(cachedSession);
    } catch (error) {
      console.error('Failed to retrieve session:', error);
      const response: RequestHintResponse = {
        success: false,
        error: {
          type: 'REDIS_ERROR',
          message: 'Failed to retrieve session',
        },
        timestamp: new Date(),
      };
      return res.status(500).json(response);
    }

    // Check if hint is already used or if requesting hints out of order
    if (hintNumber <= sessionData.hintsUsed) {
      const response: RequestHintResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Hint already used',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    if (hintNumber > sessionData.hintsUsed + 1) {
      const response: RequestHintResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Must request hints in order',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    // Get puzzle to retrieve hint data
    const puzzleService = PuzzleService.getInstance();
    const puzzleResponse = await puzzleService.getCurrentPuzzle(sessionData.difficulty);

    if (!puzzleResponse.success || !puzzleResponse.data) {
      const response: RequestHintResponse = {
        success: false,
        error: {
          type: 'PUZZLE_NOT_FOUND',
          message: 'Puzzle data not found',
        },
        timestamp: new Date(),
      };
      return res.status(404).json(response);
    }

    const puzzle = puzzleResponse.data;
    if (!puzzle.hints || puzzle.hints.length < hintNumber) {
      const response: RequestHintResponse = {
        success: false,
        error: {
          type: 'PUZZLE_NOT_FOUND',
          message: 'Hint data not available',
        },
        timestamp: new Date(),
      };
      return res.status(404).json(response);
    }

    // Update session with new hint usage
    sessionData.hintsUsed = hintNumber;
    sessionData.currentHintLevel = hintNumber;

    try {
      await redis.set(sessionKey, JSON.stringify(sessionData));
      await redis.expire(sessionKey, 3600);
    } catch (error) {
      console.warn('Failed to update session:', error);
    }

    // Get hint data
    const hintData = puzzle.hints[hintNumber - 1];
    const scoreMultiplier = HINT_CONFIG.scoreMultipliers[hintNumber];

    const response: RequestHintResponse = {
      success: true,
      data: {
        hintData,
        hintsUsed: hintNumber,
        scoreMultiplier,
      },
      timestamp: new Date(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error processing hint request:', error);
    const response: RequestHintResponse = {
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to process hint request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/puzzle/submit
 * Submit an answer and calculate the score
 * Requirements: 11.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */
router.post('/submit', async (req, res) => {
  try {
    const { sessionId, answer, timeTaken }: SubmitAnswerRequest = req.body;

    // Validate request
    if (
      !sessionId ||
      !answer ||
      !Array.isArray(answer) ||
      answer.length !== 2 ||
      typeof timeTaken !== 'number'
    ) {
      const response: SubmitAnswerResponse = {
        success: false,
        error: {
          type: 'INVALID_ANSWER',
          message: 'Valid sessionId, answer [x, y], and timeTaken are required',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    // Retrieve session
    const sessionKey = `reflectiq:sessions:${sessionId}`;
    let sessionData: SessionData;

    try {
      const cachedSession = await redis.get(sessionKey);
      if (!cachedSession) {
        const response: SubmitAnswerResponse = {
          success: false,
          error: {
            type: 'SESSION_EXPIRED',
            message: 'Session not found or expired',
          },
          timestamp: new Date(),
        };
        return res.status(404).json(response);
      }
      sessionData = JSON.parse(cachedSession);
    } catch (error) {
      console.error('Failed to retrieve session:', error);
      const response: SubmitAnswerResponse = {
        success: false,
        error: {
          type: 'REDIS_ERROR',
          message: 'Failed to retrieve session',
        },
        timestamp: new Date(),
      };
      return res.status(500).json(response);
    }

    // Check if session is still active
    if (sessionData.status !== 'active') {
      const response: SubmitAnswerResponse = {
        success: false,
        error: {
          type: 'SESSION_EXPIRED',
          message: 'Session is no longer active',
        },
        timestamp: new Date(),
      };
      return res.status(400).json(response);
    }

    // Get puzzle data
    const puzzleService = PuzzleService.getInstance();
    const puzzleResponse = await puzzleService.getCurrentPuzzle(sessionData.difficulty);

    if (!puzzleResponse.success || !puzzleResponse.data) {
      const response: SubmitAnswerResponse = {
        success: false,
        error: {
          type: 'PUZZLE_NOT_FOUND',
          message: 'Puzzle not found',
        },
        timestamp: new Date(),
      };
      return res.status(404).json(response);
    }

    const puzzle = puzzleResponse.data;

    // Check if answer is correct
    const correct = answer[0] === puzzle.solution[0] && answer[1] === puzzle.solution[1];

    // Calculate score using the scoring formula from requirements
    const config = DIFFICULTY_CONFIGS[sessionData.difficulty];
    const baseScore = config.baseScore;
    const hintMultiplier = HINT_CONFIG.scoreMultipliers[sessionData.hintsUsed];
    const timeMultiplier = Math.max(0, (config.maxTime - timeTaken) / config.maxTime);

    const finalScore = correct ? Math.round(baseScore * hintMultiplier * timeMultiplier) : 0;
    const maxPossibleScore = baseScore;

    const scoreResult = {
      baseScore,
      hintMultiplier,
      timeMultiplier,
      finalScore,
      correct,
      timeTaken,
      hintsUsed: sessionData.hintsUsed,
      maxPossibleScore,
    };

    // Create submission record
    const submission: Submission = {
      userId: sessionData.userId,
      puzzleId: sessionData.puzzleId,
      sessionId,
      answer: answer as [number, number],
      timeTaken,
      hintsUsed: sessionData.hintsUsed,
      score: finalScore,
      correct,
      timestamp: new Date(),
      difficulty: sessionData.difficulty,
    };

    // Store submission
    const submissionKey = `reflectiq:submissions:${sessionData.puzzleId}`;
    try {
      await redis.hset(submissionKey, sessionData.userId, JSON.stringify(submission));
      // Set expiration for 7 days
      await redis.expire(submissionKey, 604800);
    } catch (error) {
      console.warn('Failed to store submission:', error);
    }

    // Update leaderboard if score > 0
    let leaderboardPosition: number | undefined;
    if (finalScore > 0) {
      try {
        const leaderboardKey = `reflectiq:leaderboard:${sessionData.puzzleId}`;
        await redis.zadd(leaderboardKey, finalScore, sessionData.userId);
        await redis.expire(leaderboardKey, 604800);

        // Also update daily leaderboard
        const today = new Date().toISOString().split('T')[0];
        const dailyLeaderboardKey = `reflectiq:leaderboard:daily:${today}`;
        await redis.zadd(
          dailyLeaderboardKey,
          finalScore,
          `${sessionData.userId}:${sessionData.difficulty}`
        );
        await redis.expire(dailyLeaderboardKey, 604800);

        // Get leaderboard position
        const rank = await redis.zrevrank(leaderboardKey, sessionData.userId);
        if (rank !== null) {
          leaderboardPosition = rank + 1; // Redis ranks are 0-based
        }
      } catch (error) {
        console.warn('Failed to update leaderboard:', error);
      }
    }

    // Mark session as submitted
    sessionData.status = 'submitted';
    try {
      await redis.set(sessionKey, JSON.stringify(sessionData));
      await redis.expire(sessionKey, 3600);
    } catch (error) {
      console.warn('Failed to update session status:', error);
    }

    const response: SubmitAnswerResponse = {
      success: true,
      data: {
        scoreResult,
        submission,
        leaderboardPosition,
      },
      timestamp: new Date(),
    };

    res.json(response);
  } catch (error) {
    console.error('Error processing submission:', error);
    const response: SubmitAnswerResponse = {
      success: false,
      error: {
        type: 'REDIS_ERROR',
        message: 'Failed to process submission',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      timestamp: new Date(),
    };
    res.status(500).json(response);
  }
});

export default router;
