// CommentMonitor service for Reddit comment integration

import type { Context } from '@devvit/web/server';
import type { Comment } from '@devvit/protos';
import type { SubmitAnswerRequest, SubmissionResponse } from '../../shared/types/api.js';
import type { GameSession } from '../../shared/types/game.js';
import { parseAnswerFromComment, isValidAnswerFormat } from '../../shared/utils.js';
import { GameEngine } from './GameEngine.js';
import { RedisManager } from './RedisManager.js';

export class CommentMonitor {
  private gameEngine: GameEngine;
  private redisManager: RedisManager;

  constructor(gameEngine: GameEngine, redisManager: RedisManager) {
    this.gameEngine = gameEngine;
    this.redisManager = redisManager;
  }

  /**
   * Process a new comment for potential answer submission
   */
  async processComment(comment: Comment, context: Context): Promise<SubmissionResponse | null> {
    try {
      // Extract comment details
      const commentText = comment.body || '';
      const authorId = comment.authorId;
      const postId = comment.postId;

      if (!authorId || !postId) {
        console.log('Comment missing required fields:', { authorId, postId });
        return null;
      }

      // Parse potential answer from comment
      const parsedAnswer = parseAnswerFromComment(commentText);
      if (!parsedAnswer || !isValidAnswerFormat(parsedAnswer)) {
        // Not a valid answer format, ignore
        return null;
      }

      console.log('Valid answer format detected:', {
        authorId,
        postId,
        answer: parsedAnswer,
      });

      // Find active session for this user and post
      const session = await this.findActiveSession(authorId, postId);
      if (!session) {
        console.log('No active session found for user:', { authorId, postId });
        return null;
      }

      // Calculate elapsed time
      const elapsedTime = Math.floor((Date.now() - session.startTime.getTime()) / 1000);

      // Get puzzle to check max time
      const puzzle = await this.redisManager.getPuzzle(session.puzzleId);
      if (!puzzle) {
        console.log('Puzzle not found:', session.puzzleId);
        return null;
      }

      // Check if time expired
      if (elapsedTime > puzzle.maxTime) {
        console.log('Time expired for session:', session.sessionId);
        // End the session
        this.gameEngine.endSession(session.sessionId);
        await this.redisManager.storeSession(session.sessionId, {
          ...session,
          isActive: false,
        });
        return null;
      }

      // Create submission request
      const submitRequest: SubmitAnswerRequest = {
        sessionId: session.sessionId,
        puzzleId: session.puzzleId,
        answer: parsedAnswer,
        timeElapsed: elapsedTime,
        hintsUsed: session.hintsUsed.length,
      };

      // Validate answer and calculate score
      const response = await this.validateAndScore(submitRequest, authorId, context);

      // Ensure comment is private (visible only to moderators/bot)
      await this.ensureCommentPrivacy(comment, context);

      return response;
    } catch (error) {
      console.error('Error processing comment:', error);
      return null;
    }
  }

  /**
   * Find active session for user and post
   */
  private async findActiveSession(userId: string, postId: string): Promise<GameSession | null> {
    try {
      // In a real implementation, we would need to track sessions by user and post
      // For now, we'll search through recent sessions
      // This could be optimized with better indexing in Redis

      // Get user's recent sessions (this would need to be implemented in RedisManager)
      // For now, we'll return null and rely on the game starting flow
      return null;
    } catch (error) {
      console.error('Error finding active session:', error);
      return null;
    }
  }

  /**
   * Validate answer and calculate score
   */
  private async validateAndScore(
    request: SubmitAnswerRequest,
    userId: string,
    context: Context
  ): Promise<SubmissionResponse> {
    // Validate answer using GameEngine
    const response = this.gameEngine.validateAnswer(request);

    // Update leaderboard if correct answer
    if (response.isCorrect && response.score.finalScore > 0) {
      const puzzle = this.gameEngine.getPuzzle(request.puzzleId);
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

        await this.redisManager.updatePlayerScore(leaderboardEntry);

        // Get updated rank
        const rank = await this.redisManager.getPlayerRank(userId, puzzle.difficulty);
        response.leaderboardPosition = rank || 0;
      }
    }

    // Update session in Redis
    const session = this.gameEngine.getSession(request.sessionId);
    if (session) {
      await this.redisManager.storeSession(request.sessionId, session);
    }

    // Send congratulatory reply if correct
    if (response.isCorrect) {
      await this.sendCongratulationsReply(request, response, context);
    }

    return response;
  }

  /**
   * Ensure comment privacy (visible only to moderators)
   */
  private async ensureCommentPrivacy(comment: Comment, context: Context): Promise<void> {
    try {
      // In Devvit, we can't directly modify comment visibility
      // But we can remove the comment if needed
      // For now, we'll log that we should ensure privacy
      console.log('Comment privacy should be ensured for:', comment.id);

      // Note: In a real implementation, you might want to:
      // 1. Remove the comment immediately after processing
      // 2. Send a private message to the user with the result
      // 3. Use a bot account to manage comment visibility
    } catch (error) {
      console.error('Error ensuring comment privacy:', error);
    }
  }

  /**
   * Send congratulatory reply for correct answers
   */
  private async sendCongratulationsReply(
    request: SubmitAnswerRequest,
    response: SubmissionResponse,
    context: Context
  ): Promise<void> {
    try {
      const puzzle = this.gameEngine.getPuzzle(request.puzzleId);
      if (!puzzle) return;

      const replyText = this.generateCongratulationsMessage(
        response,
        puzzle.difficulty,
        request.timeElapsed
      );

      // Send reply using Devvit context
      // Note: This would need to be implemented based on the specific comment
      console.log('Would send congratulations reply:', replyText);

      // In a real implementation:
      // await context.reddit.submitComment({
      //   parentId: comment.id,
      //   text: replyText
      // });
    } catch (error) {
      console.error('Error sending congratulations reply:', error);
    }
  }

  /**
   * Generate congratulations message
   */
  private generateCongratulationsMessage(
    response: SubmissionResponse,
    difficulty: string,
    timeElapsed: number
  ): string {
    const minutes = Math.floor(timeElapsed / 60);
    const seconds = timeElapsed % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return `🎉 **Congratulations!** 🎉

✅ **Correct Answer!** You found the exit at **${response.correctExit.label}**

📊 **Your Score:**
- **Final Score:** ${response.score.finalScore} points
- **Difficulty:** ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
- **Time:** ${timeStr}
- **Leaderboard Position:** #${response.leaderboardPosition}

🏆 **Score Breakdown:**
- **Base Score:** ${response.score.baseScore}
- **Hint Multiplier:** ×${response.score.hintMultiplier.toFixed(1)}
- **Time Bonus:** ×${response.score.timeMultiplier.toFixed(2)}

Great job solving this laser reflection puzzle! 🔬✨`;
  }

  /**
   * Handle comment creation event from Devvit trigger
   */
  static async handleCommentCreate(
    event: any,
    context: Context,
    gameEngine: GameEngine,
    redisManager: RedisManager
  ): Promise<void> {
    try {
      const commentMonitor = new CommentMonitor(gameEngine, redisManager);

      // Extract comment from event
      const comment = event.comment as Comment;
      if (!comment) {
        console.log('No comment in event');
        return;
      }

      // Process the comment
      const result = await commentMonitor.processComment(comment, context);

      if (result) {
        console.log('Comment processed successfully:', {
          isCorrect: result.isCorrect,
          score: result.score.finalScore,
          leaderboardPosition: result.leaderboardPosition,
        });
      }
    } catch (error) {
      console.error('Error handling comment create event:', error);
    }
  }

  /**
   * Validate answer format from comment text
   */
  static validateAnswerFormat(commentText: string): string | null {
    const answer = parseAnswerFromComment(commentText);
    if (!answer || !isValidAnswerFormat(answer)) {
      return null;
    }
    return answer;
  }

  /**
   * Check if comment is from a valid game post
   */
  static async isGamePost(postId: string, context: Context): Promise<boolean> {
    try {
      // Check if post is a Logic Reflections game post
      // This could be done by checking post flair, title, or other metadata

      // For now, return true - in a real implementation, you would:
      // const post = await context.reddit.getPostById(postId);
      // return post.flair?.text?.includes('Logic Reflections') || false;

      return true;
    } catch (error) {
      console.error('Error checking if post is game post:', error);
      return false;
    }
  }

  /**
   * Get active sessions for a post (for monitoring)
   */
  async getActiveSessionsForPost(postId: string): Promise<GameSession[]> {
    try {
      // This would need to be implemented with proper indexing
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error getting active sessions for post:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions for a post
   */
  async cleanupExpiredSessionsForPost(postId: string): Promise<void> {
    try {
      const sessions = await this.getActiveSessionsForPost(postId);
      const now = Date.now();

      for (const session of sessions) {
        const puzzle = await this.redisManager.getPuzzle(session.puzzleId);
        if (!puzzle) continue;

        const elapsedTime = Math.floor((now - session.startTime.getTime()) / 1000);
        if (elapsedTime > puzzle.maxTime) {
          // End expired session
          this.gameEngine.endSession(session.sessionId);
          await this.redisManager.storeSession(session.sessionId, {
            ...session,
            isActive: false,
          });
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }
}
