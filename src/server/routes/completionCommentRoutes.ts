/**
 * Completion Comment Routes for ReflectIQ
 *
 * Provides server-side endpoints for posting completion comments using the dedicated
 * Devvit handler. This allows the existing submit endpoint to call the comment handler
 * as a separate service while maintaining proper separation of concerns.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */

import { Router } from 'express';
import {
  completionCommentHandler,
  CompletionCommentData,
  CommentPostingResult,
} from '../handlers/completionCommentHandler.js';
import {
  asyncHandler,
  sendErrorResponse,
  sendSuccessResponse,
  validateRequired,
} from '../utils/errorHandler.js';

const router = Router();

/**
 * POST /api/completion-comment
 *
 * Dedicated server-side handler that receives completion data from the existing submit endpoint
 * and posts completion comments using proper Devvit context and Reddit API integration.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const commentData: CompletionCommentData = req.body;

    // Validate required fields
    const validation = validateRequired(req.body, [
      'username',
      'timeTaken',
      'hintsUsed',
      'difficulty',
      'score',
      'commentType',
    ]);

    if (!validation.isValid) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // Validate field types and ranges
    if (typeof commentData.timeTaken !== 'number' || commentData.timeTaken < 0) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'timeTaken must be a positive number');
    }

    if (
      typeof commentData.hintsUsed !== 'number' ||
      commentData.hintsUsed < 0 ||
      commentData.hintsUsed > 4
    ) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'hintsUsed must be a number between 0 and 4'
      );
    }

    if (!['Easy', 'Medium', 'Hard'].includes(commentData.difficulty)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'difficulty must be Easy, Medium, or Hard');
    }

    if (!['completion', 'encouragement'].includes(commentData.commentType)) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'commentType must be completion or encouragement'
      );
    }

    if (typeof commentData.score !== 'number' || commentData.score < 0) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'score must be a positive number');
    }

    // Post the completion comment using the dedicated handler
    const result: CommentPostingResult =
      await completionCommentHandler.postCompletionComment(commentData);

    // Return the result with appropriate status code
    if (result.success) {
      sendSuccessResponse(res, result);
    } else {
      // Don't fail the request for comment posting failures - log and return graceful response
      console.warn(
        'Comment posting failed but returning success for graceful degradation:',
        result.error
      );

      // Return success with error details for client-side handling
      sendSuccessResponse(res, {
        ...result,
        message: 'Submission processed successfully, but comment posting failed',
      });
    }
  })
);

/**
 * POST /api/completion-comment/from-session
 *
 * Convenience endpoint for posting completion comments from session data.
 * This maintains backward compatibility with the existing submit endpoint.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */
router.post(
  '/from-session',
  asyncHandler(async (req, res) => {
    const { sessionData, timeTaken, finalScore, commentType } = req.body;

    // Validate required fields
    const validation = validateRequired(req.body, [
      'sessionData',
      'timeTaken',
      'finalScore',
      'commentType',
    ]);

    if (!validation.isValid) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Missing required fields: ${validation.missingFields.join(', ')}`
      );
    }

    // Validate sessionData structure
    if (
      !sessionData ||
      !sessionData.userId ||
      !sessionData.difficulty ||
      typeof sessionData.hintsUsed !== 'number'
    ) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'sessionData must contain userId, difficulty, and hintsUsed'
      );
    }

    // Validate other fields
    if (typeof timeTaken !== 'number' || timeTaken < 0) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'timeTaken must be a positive number');
    }

    if (typeof finalScore !== 'number' || finalScore < 0) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', 'finalScore must be a positive number');
    }

    if (!['completion', 'encouragement'].includes(commentType)) {
      return sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'commentType must be completion or encouragement'
      );
    }

    // Post the completion comment using the session-based method
    const result: CommentPostingResult =
      await completionCommentHandler.postCompletionCommentFromSession(
        sessionData,
        timeTaken,
        finalScore,
        commentType
      );

    // Return the result with appropriate status code
    if (result.success) {
      sendSuccessResponse(res, result);
    } else {
      // Don't fail the request for comment posting failures - log and return graceful response
      console.warn(
        'Comment posting failed but returning success for graceful degradation:',
        result.error
      );

      // Return success with error details for client-side handling
      sendSuccessResponse(res, {
        ...result,
        message: 'Submission processed successfully, but comment posting failed',
      });
    }
  })
);

/**
 * GET /api/completion-comment/status
 *
 * Get the status of the completion comment handler, including circuit breaker state
 * for monitoring and debugging purposes.
 */
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const circuitBreakerState = completionCommentHandler.getCircuitBreakerState();

    sendSuccessResponse(res, {
      handler: 'CompletionCommentHandler',
      status: 'active',
      circuitBreaker: circuitBreakerState,
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
