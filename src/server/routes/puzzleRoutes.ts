/**
 * Puzzle API Routes for ReflectIQ
 * Handles puzzle retrieval, session management, hints, and submissions
 * Enhanced with comprehensive error handling and validation
 */

import { Router } from 'express';
import { context, reddit } from '@devvit/web/server';
import { redisClient } from '../utils/redisClient.js';
import PuzzleRepository from '../data/PuzzleRepository.js';
import { LeaderboardService } from '../services/LeaderboardService.js';
import SessionRepository from '../data/SessionRepository.js';
import {
  asyncHandler,
  sendErrorResponse,
  sendSuccessResponse,
  validateRequired,
  checkRateLimit,
} from '../utils/errorHandler.js';
import { completionCommentHandler } from '../handlers/completionCommentHandler.js';
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
import SubmissionAnalyticsService from '../services/SubmissionAnalyticsService.js';
import { HINT_CONFIG, DIFFICULTY_CONFIGS } from '../../shared/physics/constants.js';

const router = Router();

// Initialize repositories and services
const puzzleRepository = PuzzleRepository.getInstance();
const sessionRepository = SessionRepository.getInstance();
const analyticsService = SubmissionAnalyticsService.getInstance();

// Note: Comment posting functionality has been moved to dedicated handler
// See: src/server/handlers/completionCommentHandler.ts
// Requirements: 10.1, 10.2, 10.3, 10.5

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
 * Requirements: 11.2, 4.1, 4.4, 9.2, 6.1
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
    if (!difficultyMatch || !difficultyMatch[1]) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Invalid puzzle ID format');
    }

    const difficulty = (difficultyMatch[1].charAt(0).toUpperCase() +
      difficultyMatch[1].slice(1)) as Difficulty;

    // Requirement 6.1: Modify session creation to store puzzleId with session data
    // Create session data with puzzleId
    const sessionData: SessionData = {
      sessionId,
      userId,
      puzzleId, // Puzzle ID is stored with session for validation
      difficulty,
      startTime: new Date(),
      hintsUsed: 0,
      status: 'active',
      currentHintLevel: 0,
    };

    // Store session in Redis with 1 hour expiration
    try {
      await redisClient.set(`sessions:${sessionId}`, JSON.stringify(sessionData), { ttl: 3600 });
      console.log(
        `Session created: ${sessionId} for user ${userId} with puzzleId ${puzzleId} (${difficulty})`
      );
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
 * Requirements: 11.3, 3.1, 3.2, 3.4, 3.5, 6.2, 6.5
 */
router.post(
  '/hint',
  asyncHandler(async (req, res) => {
    const { sessionId, hintNumber, puzzleId }: RequestHintRequest = req.body;

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

    // Requirement 6.3: Retrieve session using the new Redis client (includes puzzleId)
    const cachedSession = await redisClient.get(`sessions:${sessionId}`);
    if (!cachedSession) {
      return sendErrorResponse(res, 'SESSION_EXPIRED', 'Session not found or expired');
    }

    const sessionData: SessionData = JSON.parse(cachedSession);

    // Requirement 6.2: Validate that puzzle ID matches session
    // Requirement 6.5: Ensure session isolation between different puzzle IDs
    if (puzzleId && sessionData.puzzleId !== puzzleId) {
      console.warn(
        `Puzzle ID mismatch in hint request: session has ${sessionData.puzzleId}, request has ${puzzleId}`
      );
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'Puzzle ID does not match session. Please start a new game.'
      );
    }

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
    const { sessionId, answer, timeTaken, puzzleId }: SubmitAnswerRequest = req.body;

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
    // Requirement 6.3: Ensure session retrieval includes associated puzzleId
    const cachedSession = await redisClient.get(`sessions:${sessionId}`);
    if (!cachedSession) {
      return sendErrorResponse(res, 'SESSION_EXPIRED', 'Session not found or expired');
    }

    const sessionData: SessionData = JSON.parse(cachedSession);

    // Requirement 6.2: Update session validation to verify puzzle ID matches
    // Requirement 6.4: Add validation in answer submission to check puzzle ID consistency
    if (puzzleId && sessionData.puzzleId !== puzzleId) {
      console.warn(
        `Puzzle ID mismatch: session has ${sessionData.puzzleId}, submission has ${puzzleId}`
      );
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'Puzzle ID does not match session. Please start a new game.'
      );
    }

    // Check if session is still active
    if (sessionData.status !== 'active') {
      return sendErrorResponse(res, 'SESSION_EXPIRED', 'Session is no longer active');
    }

    // Check if user has already completed this puzzle correctly (first-attempt-only policy)
    // Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
    const leaderboardService = LeaderboardService.getInstance();
    const hasAlreadyCompleted = await leaderboardService.hasUserCompleted(
      sessionData.puzzleId,
      sessionData.userId
    );

    if (hasAlreadyCompleted) {
      // User has already completed this puzzle, return existing submission data
      const existingSubmission = await leaderboardService.getUserSubmission(
        sessionData.puzzleId,
        sessionData.userId
      );

      if (existingSubmission) {
        const responseData = {
          scoreResult: {
            baseScore: 0,
            hintMultiplier: 1,
            timeMultiplier: 1,
            finalScore: 0, // No score for repeat attempts
            correct: true,
            timeTaken: existingSubmission.timeTaken,
            hintsUsed: existingSubmission.hintsUsed,
            maxPossibleScore: 0,
          },
          submission: existingSubmission,
          leaderboardPosition: undefined, // No leaderboard update for repeat attempts
          message: 'Puzzle already completed. Only first correct attempt counts for leaderboard.',
          isRepeatAttempt: true,
          originalCompletion: {
            timeTaken: existingSubmission.timeTaken,
            score: existingSubmission.score,
            hintsUsed: existingSubmission.hintsUsed,
            completedAt: existingSubmission.timestamp,
          },
        };

        return sendSuccessResponse(res, responseData);
      }
    }

    // Get puzzle data
    const puzzleService = PuzzleService.getInstance();
    const puzzleResponse = await puzzleService.getCurrentPuzzle(sessionData.difficulty);

    if (!puzzleResponse.success || !puzzleResponse.data) {
      // Log validation failure metrics
      analyticsService.logValidationMetrics({
        operation: 'answer_validation',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        success: false,
        puzzleId: sessionData.puzzleId,
        userId: sessionData.userId,
        error: 'Puzzle not found',
      });

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

    // Track answer validation performance
    const validationStartTime = Date.now();

    // Check if answer is correct
    const correct = answer[0] === puzzle.solution[0] && answer[1] === puzzle.solution[1];

    const validationEndTime = Date.now();
    const validationDuration = validationEndTime - validationStartTime;

    // Log validation performance metrics
    analyticsService.logValidationMetrics({
      operation: 'answer_validation',
      startTime: validationStartTime,
      endTime: validationEndTime,
      duration: validationDuration,
      success: true,
      puzzleId: sessionData.puzzleId,
      userId: sessionData.userId,
    });

    // Calculate score using the scoring formula from requirements
    const config = DIFFICULTY_CONFIGS[sessionData.difficulty];
    const baseScore = config.baseScore;
    const hintMultiplier = HINT_CONFIG.scoreMultipliers[sessionData.hintsUsed] || 1;
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

    // Store submission (using consistent key format with reflectiq: prefix)
    try {
      await redisClient.hSet(
        `reflectiq:submissions:${sessionData.puzzleId}`,
        sessionData.userId,
        JSON.stringify(submission)
      );
      await redisClient.expire(`reflectiq:submissions:${sessionData.puzzleId}`, 604800);
    } catch (error) {
      console.warn('Failed to store submission:', error);
    }

    // Always attempt leaderboard update using atomic operations (handles first-attempt-only logic)
    let leaderboardPosition: number | undefined;
    let leaderboardUpdateMessage: string | undefined;

    try {
      const leaderboardService = LeaderboardService.getInstance();

      // Use atomic score update for consistency (handles first attempt only logic)
      const updateResult = await leaderboardService.atomicScoreUpdate(
        sessionData.puzzleId,
        sessionData.userId,
        finalScore,
        submission
      );

      if (updateResult.success) {
        // Get leaderboard position for successful updates
        try {
          const position = await leaderboardService.getUserPuzzleRank(
            sessionData.puzzleId,
            sessionData.userId
          );
          leaderboardPosition = position || undefined;
          leaderboardUpdateMessage = 'Leaderboard updated successfully';
        } catch (rankError) {
          console.warn('Failed to get leaderboard position:', rankError);
          leaderboardPosition = 1; // Fallback
        }
      } else {
        // Log the reason why leaderboard wasn't updated (first attempt only, incorrect answer, etc.)
        console.log(`Leaderboard not updated for ${sessionData.userId}: ${updateResult.error}`);
        leaderboardUpdateMessage = updateResult.error;

        // For incorrect answers or repeat attempts, don't show leaderboard position
        leaderboardPosition = undefined;
      }
    } catch (error) {
      console.warn('Failed to update leaderboard:', error);
      leaderboardUpdateMessage = 'Leaderboard update failed due to technical error';
    }

    // Mark session as submitted
    sessionData.status = 'submitted';
    try {
      await redisClient.set(`sessions:${sessionId}`, JSON.stringify(sessionData), { ttl: 3600 });
    } catch (error) {
      console.warn('Failed to update session status:', error);
    }

    // Enhanced comment posting using dedicated Devvit handler
    // Requirements: 10.1, 10.2, 10.3, 10.5
    let commentPostingResult: {
      success: boolean;
      error?: string;
      type?: 'completion' | 'encouragement';
    } = { success: true };

    if (finalScore > 0) {
      // Post completion comment for successful submissions using dedicated handler
      const commentStartTime = Date.now();
      commentPostingResult = await completionCommentHandler.postCompletionCommentFromSession(
        sessionData,
        timeTaken,
        finalScore,
        'completion'
      );
      const commentEndTime = Date.now();

      // Log comment posting performance metrics
      analyticsService.logCommentPostingMetrics({
        operation: 'comment_posting',
        startTime: commentStartTime,
        endTime: commentEndTime,
        duration: commentEndTime - commentStartTime,
        success: commentPostingResult.success,
        commentType: 'completion',
        userId: sessionData.userId,
        puzzleId: sessionData.puzzleId,
        error: commentPostingResult.error,
      });
    } else if (correct === false) {
      // Post encouragement comment for incorrect answers using dedicated handler
      const commentStartTime = Date.now();
      commentPostingResult = await completionCommentHandler.postCompletionCommentFromSession(
        sessionData,
        timeTaken,
        finalScore,
        'encouragement'
      );
      const commentEndTime = Date.now();

      // Log comment posting performance metrics
      analyticsService.logCommentPostingMetrics({
        operation: 'comment_posting',
        startTime: commentStartTime,
        endTime: commentEndTime,
        duration: commentEndTime - commentStartTime,
        success: commentPostingResult.success,
        commentType: 'encouragement',
        userId: sessionData.userId,
        puzzleId: sessionData.puzzleId,
        error: commentPostingResult.error,
      });
    }

    // Log comprehensive submission analytics
    await analyticsService.logSubmission(
      submission,
      puzzle.solution as [number, number],
      leaderboardPosition
    );

    // Include comment posting status and leaderboard update info in response for client-side feedback
    const responseData = {
      scoreResult,
      submission,
      leaderboardPosition,
      commentPosting: commentPostingResult,
      leaderboardUpdate: {
        success: leaderboardPosition !== undefined,
        message: leaderboardUpdateMessage,
      },
    };

    sendSuccessResponse(res, responseData);
  })
);

/**
 * GET /api/puzzle/analytics/volume?date=YYYY-MM-DD&difficulty=Easy|Medium|Hard
 * Get submission volume analytics for a specific date and difficulty
 * Requirements: 11.5
 */
router.get(
  '/analytics/volume',
  asyncHandler(async (req, res) => {
    const { date, difficulty } = req.query;

    // Validate parameters
    if (!date || !difficulty) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Date and difficulty are required');
    }

    if (!['Easy', 'Medium', 'Hard'].includes(difficulty as string)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Difficulty must be Easy, Medium, or Hard');
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date as string)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Date must be in YYYY-MM-DD format');
    }

    const metrics = await analyticsService.getVolumeMetrics(
      date as string,
      difficulty as Difficulty
    );

    sendSuccessResponse(res, metrics);
  })
);

/**
 * GET /api/puzzle/analytics/success-rate?period=hourly|daily&timestamp=...&difficulty=Easy|Medium|Hard
 * Get success rate metrics for a specific period and difficulty
 * Requirements: 11.5
 */
router.get(
  '/analytics/success-rate',
  asyncHandler(async (req, res) => {
    const { period, timestamp, difficulty } = req.query;

    // Validate parameters
    if (!period || !timestamp || !difficulty) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'Period, timestamp, and difficulty are required'
      );
    }

    if (!['hourly', 'daily'].includes(period as string)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Period must be hourly or daily');
    }

    if (!['Easy', 'Medium', 'Hard'].includes(difficulty as string)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Difficulty must be Easy, Medium, or Hard');
    }

    const metrics = await analyticsService.getSuccessRateMetrics(
      period as 'hourly' | 'daily',
      timestamp as string,
      difficulty as Difficulty
    );

    if (!metrics) {
      return sendErrorResponse(res, 'NOT_FOUND', 'No metrics found for the specified parameters');
    }

    sendSuccessResponse(res, metrics);
  })
);

/**
 * GET /api/puzzle/analytics/completion-time?puzzleId=...
 * Get completion time metrics for a specific puzzle
 * Requirements: 11.5
 */
router.get(
  '/analytics/completion-time',
  asyncHandler(async (req, res) => {
    const { puzzleId } = req.query;

    if (!puzzleId) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'Puzzle ID is required');
    }

    const metrics = await analyticsService.getCompletionTimeMetrics(puzzleId as string);

    if (!metrics) {
      return sendErrorResponse(
        res,
        'NOT_FOUND',
        'No completion metrics found for the specified puzzle'
      );
    }

    sendSuccessResponse(res, metrics);
  })
);

export default router;
