// Answer submission workflow for Logic Reflections

import type { Context } from '@devvit/web/server';
import type { Comment } from '@devvit/protos';
import type { SubmitAnswerRequest, SubmissionResponse } from '../../shared/types/api.js';
import type { GameSession, LeaderboardEntry } from '../../shared/types/game.js';
import { GameEngine } from './GameEngine.js';
import { RedisManager } from './RedisManager.js';
import { CommentMonitor } from './CommentMonitor.js';

export class AnswerSubmissionWorkflow {
  private gameEngine: GameEngine;
  private redisManager: RedisManager;
  private commentMonitor: CommentMonitor;

  constructor(gameEngine: GameEngine, redisManager: RedisManager, commentMonitor: CommentMonitor) {
    this.gameEngine = gameEngine;
    this.redisManager = redisManager;
    this.commentMonitor = commentMonitor;
  }

  /**
   * Process answer submission from comment
   */
  async processAnswerSubmission(
    comment: Comment,
    context: Context
  ): Promise<SubmissionResponse | null> {
    try {
      // Step 1: Validate comment and extract answer
      const validationResult = await this.validateCommentSubmission(comment);
      if (!validationResult.isValid) {
        console.log('Invalid comment submission:', validationResult.reason);
        return null;
      }

      // Step 2: Find and validate active session
      const session = await this.findAndValidateSession(
        validationResult.userId!,
        validationResult.postId!,
        context
      );
      if (!session) {
        console.log('No valid session found for submission');
        return null;
      }

      // Step 3: Check timing constraints
      const timingResult = await this.validateTiming(session);
      if (!timingResult.isValid) {
        console.log('Timing validation failed:', timingResult.reason);
        await this.handleExpiredSession(session);
        return null;
      }

      // Step 4: Process the answer
      const submissionRequest = this.createSubmissionRequest(
        session,
        validationResult.answer!,
        timingResult.elapsedTime!
      );

      // Step 5: Validate answer and calculate score
      const response = await this.validateAndScore(
        submissionRequest,
        validationResult.userId!,
        context
      );

      // Step 6: Update game state
      await this.updateGameState(session, response, context);

      // Step 7: Handle post-submission actions
      await this.handlePostSubmission(comment, response, context);

      return response;
    } catch (error) {
      console.error('Error processing answer submission:', error);
      return null;
    }
  }

  /**
   * Validate comment submission
   */
  private async validateCommentSubmission(comment: Comment): Promise<CommentValidationResult> {
    // Check required fields
    if (!comment.authorId || !comment.postId || !comment.body) {
      return {
        isValid: false,
        reason: 'Missing required comment fields',
      };
    }

    // Validate answer format
    const answer = CommentMonitor.validateAnswerFormat(comment.body);
    if (!answer) {
      return {
        isValid: false,
        reason: 'Invalid answer format',
      };
    }

    return {
      isValid: true,
      userId: comment.authorId,
      postId: comment.postId,
      answer,
    };
  }

  /**
   * Find and validate active session
   */
  private async findAndValidateSession(
    userId: string,
    postId: string,
    context: Context
  ): Promise<GameSession | null> {
    try {
      // Check if this is a valid game post
      const isGamePost = await CommentMonitor.isGamePost(postId, context);
      if (!isGamePost) {
        return null;
      }

      // Find active session for user
      // Note: This would need proper indexing in a real implementation
      // For now, we'll need to implement session lookup by user and post

      // In a real implementation, you would:
      // 1. Store sessions indexed by userId and postId
      // 2. Query Redis for active sessions
      // 3. Validate session is still active and not expired

      return null; // Placeholder - needs proper implementation
    } catch (error) {
      console.error('Error finding session:', error);
      return null;
    }
  }

  /**
   * Validate timing constraints
   */
  private async validateTiming(session: GameSession): Promise<TimingValidationResult> {
    try {
      const puzzle = await this.redisManager.getPuzzle(session.puzzleId);
      if (!puzzle) {
        return {
          isValid: false,
          reason: 'Puzzle not found',
        };
      }

      const elapsedTime = Math.floor((Date.now() - session.startTime.getTime()) / 1000);

      if (elapsedTime > puzzle.maxTime) {
        return {
          isValid: false,
          reason: 'Time limit exceeded',
          elapsedTime,
        };
      }

      return {
        isValid: true,
        elapsedTime,
      };
    } catch (error) {
      console.error('Error validating timing:', error);
      return {
        isValid: false,
        reason: 'Timing validation error',
      };
    }
  }

  /**
   * Handle expired session
   */
  private async handleExpiredSession(session: GameSession): Promise<void> {
    try {
      // End the session
      this.gameEngine.endSession(session.sessionId);

      // Update session in Redis
      await this.redisManager.storeSession(session.sessionId, {
        ...session,
        isActive: false,
      });

      console.log('Session expired and deactivated:', session.sessionId);
    } catch (error) {
      console.error('Error handling expired session:', error);
    }
  }

  /**
   * Create submission request
   */
  private createSubmissionRequest(
    session: GameSession,
    answer: string,
    elapsedTime: number
  ): SubmitAnswerRequest {
    return {
      sessionId: session.sessionId,
      puzzleId: session.puzzleId,
      answer,
      timeElapsed: elapsedTime,
      hintsUsed: session.hintsUsed.length,
    };
  }

  /**
   * Validate answer and calculate score
   */
  private async validateAndScore(
    request: SubmitAnswerRequest,
    userId: string,
    context: Context
  ): Promise<SubmissionResponse> {
    try {
      // Validate answer using GameEngine
      const response = this.gameEngine.validateAnswer(request);

      // Update leaderboard if correct answer
      if (response.isCorrect && response.score.finalScore > 0) {
        await this.updateLeaderboard(request, response, userId);
      }

      return response;
    } catch (error) {
      console.error('Error validating and scoring answer:', error);
      throw error;
    }
  }

  /**
   * Update leaderboard with new score
   */
  private async updateLeaderboard(
    request: SubmitAnswerRequest,
    response: SubmissionResponse,
    userId: string
  ): Promise<void> {
    try {
      const puzzle = this.gameEngine.getPuzzle(request.puzzleId);
      if (!puzzle) return;

      const leaderboardEntry: LeaderboardEntry = {
        rank: 0, // Will be set by Redis
        username: userId,
        difficulty: puzzle.difficulty,
        timeElapsed: request.timeElapsed,
        hintsUsed: request.hintsUsed,
        finalScore: response.score.finalScore,
        timestamp: new Date(),
      };

      await this.redisManager.updatePlayerScore(leaderboardEntry);

      // Get updated rank
      const rank = await this.redisManager.getPlayerRank(userId, puzzle.difficulty);
      response.leaderboardPosition = rank || 0;

      console.log('Leaderboard updated:', {
        userId,
        difficulty: puzzle.difficulty,
        score: response.score.finalScore,
        rank: response.leaderboardPosition,
      });
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  }

  /**
   * Update game state after submission
   */
  private async updateGameState(
    session: GameSession,
    response: SubmissionResponse,
    context: Context
  ): Promise<void> {
    try {
      // Deactivate session
      session.isActive = false;

      // Update session in Redis
      await this.redisManager.storeSession(session.sessionId, session);

      // Update user's daily progress if applicable
      await this.updateUserProgress(session, response);

      console.log('Game state updated for session:', session.sessionId);
    } catch (error) {
      console.error('Error updating game state:', error);
    }
  }

  /**
   * Update user's daily progress
   */
  private async updateUserProgress(
    session: GameSession,
    response: SubmissionResponse
  ): Promise<void> {
    try {
      const puzzle = await this.redisManager.getPuzzle(session.puzzleId);
      if (!puzzle) return;

      const today = new Date().toISOString().split('T')[0];
      let progress = await this.redisManager.getUserProgress(session.userId, today);

      if (!progress) {
        progress = {
          date: new Date(),
          completed: {
            easy: false,
            medium: false,
            hard: false,
          },
          scores: {},
        };
      }

      // Update completion status
      progress.completed[puzzle.difficulty] = response.isCorrect;

      // Update score if correct or if it's a better score
      if (response.isCorrect) {
        const currentScore = progress.scores[puzzle.difficulty];
        if (!currentScore || response.score.finalScore > currentScore) {
          progress.scores[puzzle.difficulty] = response.score.finalScore;
        }
      }

      await this.redisManager.storeUserProgress(session.userId, today, progress);
    } catch (error) {
      console.error('Error updating user progress:', error);
    }
  }

  /**
   * Handle post-submission actions
   */
  private async handlePostSubmission(
    comment: Comment,
    response: SubmissionResponse,
    context: Context
  ): Promise<void> {
    try {
      // Send response to user
      if (response.isCorrect) {
        await this.sendSuccessResponse(comment, response, context);
      } else {
        await this.sendFailureResponse(comment, response, context);
      }

      // Ensure comment privacy
      await this.ensureCommentPrivacy(comment, context);

      // Log submission for analytics
      this.logSubmission(comment, response);
    } catch (error) {
      console.error('Error handling post-submission actions:', error);
    }
  }

  /**
   * Send success response to user
   */
  private async sendSuccessResponse(
    comment: Comment,
    response: SubmissionResponse,
    context: Context
  ): Promise<void> {
    try {
      // In a real implementation, you would send a private message or reply
      console.log('Would send success response to user:', {
        userId: comment.authorId,
        score: response.score.finalScore,
        rank: response.leaderboardPosition,
      });

      // Example implementation:
      // await context.reddit.sendPrivateMessage({
      //   to: comment.authorId,
      //   subject: 'Logic Reflections - Correct Answer!',
      //   text: generateSuccessMessage(response)
      // });
    } catch (error) {
      console.error('Error sending success response:', error);
    }
  }

  /**
   * Send failure response to user
   */
  private async sendFailureResponse(
    comment: Comment,
    response: SubmissionResponse,
    context: Context
  ): Promise<void> {
    try {
      console.log('Would send failure response to user:', {
        userId: comment.authorId,
        correctAnswer: response.correctExit.label,
      });

      // Example implementation:
      // await context.reddit.sendPrivateMessage({
      //   to: comment.authorId,
      //   subject: 'Logic Reflections - Try Again!',
      //   text: generateFailureMessage(response)
      // });
    } catch (error) {
      console.error('Error sending failure response:', error);
    }
  }

  /**
   * Ensure comment privacy
   */
  private async ensureCommentPrivacy(comment: Comment, context: Context): Promise<void> {
    try {
      // Remove the comment to maintain privacy
      console.log('Would ensure comment privacy for:', comment.id);

      // Example implementation:
      // await context.reddit.remove(comment.id, false);
    } catch (error) {
      console.error('Error ensuring comment privacy:', error);
    }
  }

  /**
   * Log submission for analytics
   */
  private logSubmission(comment: Comment, response: SubmissionResponse): void {
    console.log('Answer submission logged:', {
      userId: comment.authorId,
      postId: comment.postId,
      isCorrect: response.isCorrect,
      score: response.score.finalScore,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Batch process multiple comment submissions
   */
  async batchProcessSubmissions(
    comments: Comment[],
    context: Context
  ): Promise<SubmissionResponse[]> {
    const results: SubmissionResponse[] = [];

    for (const comment of comments) {
      try {
        const result = await this.processAnswerSubmission(comment, context);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error('Error processing comment in batch:', error);
      }
    }

    return results;
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStats(postId: string): Promise<SubmissionStats> {
    try {
      // This would need to be implemented with proper tracking
      return {
        totalSubmissions: 0,
        correctSubmissions: 0,
        averageTime: 0,
        averageScore: 0,
      };
    } catch (error) {
      console.error('Error getting submission stats:', error);
      return {
        totalSubmissions: 0,
        correctSubmissions: 0,
        averageTime: 0,
        averageScore: 0,
      };
    }
  }
}

// Type definitions
interface CommentValidationResult {
  isValid: boolean;
  reason?: string;
  userId?: string;
  postId?: string;
  answer?: string;
}

interface TimingValidationResult {
  isValid: boolean;
  reason?: string;
  elapsedTime?: number;
}

interface SubmissionStats {
  totalSubmissions: number;
  correctSubmissions: number;
  averageTime: number;
  averageScore: number;
}
