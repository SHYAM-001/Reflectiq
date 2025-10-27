/**
 * Puzzle API Routes for ReflectIQ
 * Handles puzzle retrieval, session management, hints, and submissions
 * Enhanced with comprehensive error handling and validation
 */

import { Router } from 'express';
import { context } from '@devvit/web/server';
import { redisClient } from '../utils/redisClient.js';
import PuzzleRepository from '../data/PuzzleRepository.js';
import SessionRepository from '../data/SessionRepository.js';
import {
  asyncHandler,
  sendErrorResponse,
  sendSuccessResponse,
  validateRequired,
  checkRateLimit,
} from '../utils/errorHandler.js';
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

// Initialize repositories
const puzzleRepository = PuzzleRepository.getInstance();
const sessionRepository = SessionRepository.getInstance();

/**
 * GET /api/puzzle/current?difficulty=Easy|Medium|Hard
 * Retrieve the current day's puzzle for the specified difficulty
 * Requirements: 11.1, 9.1, 9.2
 */
router.get(
  '/current',
  asyncHandler(async (req, res) => {
    const difficulty = req.query.difficulty as Difficulty;

    // Validate difficulty parameter
    if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Difficulty must be Easy, Medium, or Hard');
    }

    // Rate limiting per user
    const userId = context.userId || req.ip || 'anonymous';
    const rateLimit = checkRateLimit(`puzzle:${userId}`, 30, 60000); // 30 requests per minute

    if (!rateLimit.allowed) {
      return sendErrorResponse(
        res,
        'RATE_LIMITED',
        `Too many requests. Try again in ${Math.ceil((rateLimit.resetTime - Date.now()) / 1000)} seconds`
      );
    }

    const puzzleService = PuzzleService.getInstance();
    const response = await puzzleService.getCurrentPuzzle(difficulty);

    if (response.success) {
      sendSuccessResponse(res, response.data);
    } else {
      const statusCode = response.error?.type === 'PUZZLE_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json(response);
    }
  })
);

/**
 * POST /api/puzzle/start
 * Initialize a new puzzle session and start the timer
 * Requirements: 11.2, 4.1, 4.4, 9.2
 */
router.post(
  '/start',
  asyncHandler(async (req, res) => {
    const { puzzleId, userId }: StartPuzzleRequest = req.body;

    // Validate required fields
    const validation = validateRequired(req.body, ['puzzleId', 'userId']);
    if (!validation.isValid) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // Rate limiting per user
    const rateLimit = checkRateLimit(`start:${userId}`, 10, 60000); // 10 starts per minute
    if (!rateLimit.allowed) {
      return sendErrorResponse(
        res,
        'RATE_LIMITED',
        'Too many session starts. Please wait before starting a new game'
      );
    }

    // Generate session ID
    const sessionId = `session_${userId}_${puzzleId}_${Date.now()}`;

    // Extract difficulty from puzzle ID (format: puzzle_easy_2024-01-01)
    const difficultyMatch = puzzleId.match(/puzzle_(easy|medium|hard)_/);
    if (!difficultyMatch) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Invalid puzzle ID format');
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
    try {
      await redisClient.set(`sessions:${sessionId}`, JSON.stringify(sessionData), { ttl: 3600 });
    } catch (error) {
      // Fallback: continue without storing session (degraded mode)
      console.warn(`Failed to store session ${sessionId} - continuing in degraded mode`);
    }

    sendSuccessResponse(res, sessionData);
  })
);

/**
 * POST /api/puzzle/hint
 * Request a hint for the current puzzle session
 * Requirements: 11.3, 3.1, 3.2, 3.4, 3.5
 */
router.post(
  '/hint',
  asyncHandler(async (req, res) => {
    const { sessionId, hintNumber }: RequestHintRequest = req.body;

    // Validate required fields
    const validation = validateRequired(req.body, ['sessionId', 'hintNumber']);
    if (!validation.isValid) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // Validate hint number range
    if (hintNumber < 1 || hintNumber > 4) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Hint number must be between 1 and 4');
    }

    // Retrieve session using the new Redis client
    const cachedSession = await redisClient.get(`sessions:${sessionId}`);
    if (!cachedSession) {
      return sendErrorResponse(res, 'SESSION_EXPIRED', 'Session not found or expired');
    }

    const sessionData: SessionData = JSON.parse(cachedSession);

    // Check if hint is already used or if requesting hints out of order
    if (hintNumber <= sessionData.hintsUsed) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Hint already used');
    }

    if (hintNumber > sessionData.hintsUsed + 1) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Hints must be requested in order');
    }

    // Get puzzle to retrieve hint data
    const puzzleService = PuzzleService.getInstance();
    const puzzleResponse = await puzzleService.getCurrentPuzzle(sessionData.difficulty);

    if (!puzzleResponse.success || !puzzleResponse.data) {
      return sendErrorResponse(res, 'PUZZLE_NOT_FOUND', 'Puzzle data not found');
    }

    const puzzle = puzzleResponse.data;
    if (!puzzle.hints || puzzle.hints.length < hintNumber) {
      return sendErrorResponse(res, 'PUZZLE_NOT_FOUND', 'Hint data not available');
    }

    // Update session with new hint usage
    sessionData.hintsUsed = hintNumber;
    sessionData.currentHintLevel = hintNumber;

    try {
      await redisClient.set(`sessions:${sessionId}`, JSON.stringify(sessionData), { ttl: 3600 });
    } catch (error) {
      console.warn('Failed to update session:', error);
    }

    // Get hint data
    const hintData = puzzle.hints[hintNumber - 1];
    const scoreMultiplier = HINT_CONFIG.scoreMultipliers[hintNumber];

    sendSuccessResponse(res, {
      hintData,
      hintsUsed: hintNumber,
      scoreMultiplier,
    });
  })
);

/**
 * POST /api/puzzle/submit
 * Submit an answer and calculate the score
 * Requirements: 11.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */
router.post(
  '/submit',
  asyncHandler(async (req, res) => {
    const { sessionId, answer, timeTaken }: SubmitAnswerRequest = req.body;

    // Validate required fields
    const validation = validateRequired(req.body, ['sessionId', 'answer', 'timeTaken']);
    if (!validation.isValid) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // Validate answer format
    if (
      !Array.isArray(answer) ||
      answer.length !== 2 ||
      typeof answer[0] !== 'number' ||
      typeof answer[1] !== 'number'
    ) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'Answer must be an array of two numbers [row, col]'
      );
    }

    // Validate time taken
    if (typeof timeTaken !== 'number' || timeTaken < 0) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Time taken must be a positive number');
    }

    // Retrieve session
    const cachedSession = await redisClient.get(`sessions:${sessionId}`);
    if (!cachedSession) {
      return sendErrorResponse(res, 'SESSION_EXPIRED', 'Session not found or expired');
    }

    const sessionData: SessionData = JSON.parse(cachedSession);

    // Check if session is still active
    if (sessionData.status !== 'active') {
      return sendErrorResponse(res, 'SESSION_EXPIRED', 'Session is no longer active');
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
    try {
      await redisClient.hSet(
        `submissions:${sessionData.puzzleId}`,
        sessionData.userId,
        JSON.stringify(submission)
      );
      await redisClient.expire(`submissions:${sessionData.puzzleId}`, 604800);
    } catch (error) {
      console.warn('Failed to store submission:', error);
    }

    // Update leaderboard if score > 0
    let leaderboardPosition: number | undefined;
    if (finalScore > 0) {
      try {
        await redisClient.zAdd(
          `leaderboard:${sessionData.puzzleId}`,
          sessionData.userId,
          finalScore
        );
        await redisClient.expire(`leaderboard:${sessionData.puzzleId}`, 604800);

        // Also update daily leaderboard
        const today = new Date().toISOString().split('T')[0];
        await redisClient.zAdd(
          `leaderboard:daily:${today}`,
          `${sessionData.userId}:${sessionData.difficulty}`,
          finalScore
        );
        await redisClient.expire(`leaderboard:daily:${today}`, 604800);

        // Get leaderboard position (simplified for now)
        leaderboardPosition = 1; // TODO: Implement proper ranking with new Redis client
      } catch (error) {
        console.warn('Failed to update leaderboard:', error);
      }
    }

    // Mark session as submitted
    sessionData.status = 'submitted';
    try {
      await redisClient.set(`sessions:${sessionId}`, JSON.stringify(sessionData), { ttl: 3600 });
    } catch (error) {
      console.warn('Failed to update session status:', error);
    }

    sendSuccessResponse(res, {
      scoreResult,
      submission,
      leaderboardPosition,
    });
  })
);

export default router;
