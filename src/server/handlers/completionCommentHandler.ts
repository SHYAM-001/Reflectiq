/**
 * Devvit Server-Side Handler for Completion Comments
 *
 * This handler provides a dedicated server-side service for posting completion comments
 * using proper Devvit context and Reddit API integration. It handles authentication
 * and permissions automatically through Devvit context.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */

import { context, reddit } from '@devvit/web/server';
import { SessionData } from '../../shared/types/puzzle.js';

/**
 * Interface for completion comment data
 */
export interface CompletionCommentData {
  username: string;
  timeTaken: number; // seconds as integer
  hintsUsed: number; // 0-4
  difficulty: 'Easy' | 'Medium' | 'Hard';
  score: number;
  commentType: 'completion' | 'encouragement';
}

/**
 * Result of comment posting operation
 */
export interface CommentPostingResult {
  success: boolean;
  error?: string;
  type: 'completion' | 'encouragement';
  commentText?: string;
  duration?: number;
}

/**
 * Circuit breaker for Reddit API operations to prevent cascading failures
 */
class RedditCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold = 3;
  private readonly recoveryTimeout = 60000; // 1 minute

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`Reddit circuit breaker for ${operationName} moving to HALF_OPEN state`);
      } else {
        throw new Error(
          `Reddit API circuit breaker is OPEN for ${operationName}. Service temporarily unavailable.`
        );
      }
    }

    try {
      const result = await operation();

      // Reset on success
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        console.log(`Reddit circuit breaker for ${operationName} reset to CLOSED state`);
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        console.error(
          `Reddit circuit breaker for ${operationName} opened after ${this.failures} failures`
        );
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

const redditCircuitBreaker = new RedditCircuitBreaker();

/**
 * Dedicated Devvit server-side handler for posting completion comments
 *
 * This handler receives completion data from the existing submit endpoint and uses
 * proper Devvit context and Reddit API integration for comment posting.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */
export class CompletionCommentHandler {
  /**
   * Format completion comment text according to requirements
   * Requirements: 3.2, 3.3, 3.4, 3.5
   */
  private formatCompletionComment(username: string, timeTaken: number, hintsUsed: number): string {
    // Format time as M:SS (e.g., "0:01", "2:45") to match timer display
    const minutes = Math.floor(timeTaken / 60);
    const seconds = Math.floor(timeTaken % 60);
    const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Use exact format from requirements: "u/{username} completed the puzzle in {time} with {hints} hints!"
    return `u/${username} completed the puzzle in ${timeFormatted} with ${hintsUsed} hints!`;
  }

  /**
   * Format encouragement comment for incorrect answers
   */
  private formatEncouragementComment(username: string, difficulty: string): string {
    return `💪 u/${username} gave it a great try on the ${difficulty} puzzle! Keep analyzing those laser paths - you've got this! 🔬✨`;
  }

  /**
   * Post completion comment using Devvit context and Reddit API
   *
   * This method handles authentication and permissions automatically through Devvit context
   * and provides comprehensive error handling with graceful degradation.
   *
   * Requirements: 10.1, 10.2, 10.3, 10.5
   */
  async postCompletionComment(commentData: CompletionCommentData): Promise<CommentPostingResult> {
    const startTime = Date.now();

    try {
      // Check if Reddit API is available by testing context
      if (!context || !reddit) {
        const error = 'Reddit context or API not available - running in degraded mode';
        console.warn(`⚠️ Comment posting skipped: ${error}`);
        return {
          success: false,
          error,
          type: commentData.commentType,
          duration: Date.now() - startTime,
        };
      }

      // Use circuit breaker to prevent cascading failures
      const currentUser = await redditCircuitBreaker.execute(async () => {
        const userPromise = reddit.getCurrentUser();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Reddit API timeout')), 5000)
        );

        return (await Promise.race([userPromise, timeoutPromise])) as any;
      }, 'getCurrentUser');

      const username = currentUser?.username;

      if (!username) {
        const error = 'Unable to get current user from Reddit context';
        console.warn(`⚠️ Comment posting failed: ${error}`);
        return {
          success: false,
          error,
          type: commentData.commentType,
          duration: Date.now() - startTime,
        };
      }

      // Verify username matches the provided username (security check)
      if (username !== commentData.username) {
        const error = `Username mismatch: context=${username}, provided=${commentData.username}`;
        console.warn(`⚠️ Comment posting failed: ${error}`);
        return {
          success: false,
          error,
          type: commentData.commentType,
          duration: Date.now() - startTime,
        };
      }

      // Generate appropriate comment text
      let commentText: string;
      if (commentData.commentType === 'completion') {
        commentText = this.formatCompletionComment(
          commentData.username,
          commentData.timeTaken,
          commentData.hintsUsed
        );
      } else {
        commentText = this.formatEncouragementComment(commentData.username, commentData.difficulty);
      }

      // Get current post context
      const { postId } = context;
      if (!postId) {
        const error = 'No postId available in context for comment posting';
        console.warn(`⚠️ Comment posting failed: ${error}`);
        console.log('Available context keys:', Object.keys(context));
        return {
          success: false,
          error,
          type: commentData.commentType,
          commentText,
          duration: Date.now() - startTime,
        };
      }

      // Post comment with circuit breaker protection
      await redditCircuitBreaker.execute(async () => {
        const commentPromise = reddit.submitComment({
          id: postId,
          text: commentText,
        });

        const commentTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Comment posting timeout')), 10000)
        );

        return await Promise.race([commentPromise, commentTimeoutPromise]);
      }, 'submitComment');

      const duration = Date.now() - startTime;
      console.log(
        `✅ Posted ${commentData.commentType} comment for ${username} in ${duration}ms: ${commentData.score} points`
      );

      return {
        success: true,
        type: commentData.commentType,
        commentText,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.message || 'Unknown error';

      // Enhanced error logging with context
      console.warn(`❌ Failed to post ${commentData.commentType} comment after ${duration}ms:`, {
        error: errorMessage,
        username: commentData.username,
        difficulty: commentData.difficulty,
        score: commentData.score,
        contextAvailable: !!context,
        redditAvailable: !!reddit,
        postId: context?.postId || 'not available',
      });

      // Categorize error types for better client feedback
      let errorType = 'unknown';
      if (errorMessage.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        errorType = 'rate_limit';
      } else if (errorMessage.includes('permission') || errorMessage.includes('403')) {
        errorType = 'permission';
      } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        errorType = 'post_not_found';
      } else if (errorMessage.includes('context') || errorMessage.includes('Reddit')) {
        errorType = 'api_unavailable';
      }

      return {
        success: false,
        error: `${errorType}: ${errorMessage}`,
        type: commentData.commentType,
        duration,
      };
    }
  }

  /**
   * Convenience method for posting completion comments from session data
   *
   * This method adapts the existing SessionData interface to the new handler
   * for backward compatibility with the existing submit endpoint.
   */
  async postCompletionCommentFromSession(
    sessionData: SessionData,
    timeTaken: number,
    finalScore: number,
    commentType: 'completion' | 'encouragement'
  ): Promise<CommentPostingResult> {
    // Get username from Devvit context
    let username: string;
    try {
      const currentUser = await reddit.getCurrentUser();
      username = currentUser?.username || sessionData.userId;
    } catch (error) {
      username = sessionData.userId;
    }

    const commentData: CompletionCommentData = {
      username,
      timeTaken,
      hintsUsed: sessionData.hintsUsed,
      difficulty: sessionData.difficulty,
      score: finalScore,
      commentType,
    };

    return this.postCompletionComment(commentData);
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitBreakerState() {
    return redditCircuitBreaker.getState();
  }
}

// Export singleton instance
export const completionCommentHandler = new CompletionCommentHandler();
