/**
 * Unit tests for CompletionCommentHandler
 *
 * Tests the dedicated Devvit server-side handler for completion comments
 * Requirements: 10.1, 10.2, 10.3, 10.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Devvit imports first
vi.mock('@devvit/web/server', () => ({
  context: {
    postId: 'test-post-123',
    subredditName: 'test-subreddit',
  },
  reddit: {
    getCurrentUser: vi.fn(),
    submitComment: vi.fn(),
  },
}));

import {
  CompletionCommentHandler,
  CompletionCommentData,
} from '../../handlers/completionCommentHandler.js';
import { context, reddit } from '@devvit/web/server';

describe('CompletionCommentHandler', () => {
  let handler: CompletionCommentHandler;

  beforeEach(() => {
    handler = new CompletionCommentHandler();
    vi.clearAllMocks();
  });

  describe('postCompletionComment', () => {
    it('should format completion comment correctly', async () => {
      // Mock successful Reddit API calls
      vi.mocked(reddit.getCurrentUser).mockResolvedValue({ username: 'testuser' } as any);
      vi.mocked(reddit.submitComment).mockResolvedValue({ id: 'comment-123' } as any);

      const commentData: CompletionCommentData = {
        username: 'testuser',
        timeTaken: 65, // 1 minute 5 seconds
        hintsUsed: 2,
        difficulty: 'Medium',
        score: 350,
        commentType: 'completion',
      };

      const result = await handler.postCompletionComment(commentData);

      expect(result.success).toBe(true);
      expect(result.type).toBe('completion');
      expect(result.commentText).toBe('u/testuser completed the puzzle in 1:05 with 2 hints!');
      expect(reddit.submitComment).toHaveBeenCalledWith({
        id: 'test-post-123',
        text: 'u/testuser completed the puzzle in 1:05 with 2 hints!',
      });
    });

    it('should format time correctly for different durations', async () => {
      vi.mocked(reddit.getCurrentUser).mockResolvedValue({ username: 'testuser' } as any);
      vi.mocked(reddit.submitComment).mockResolvedValue({ id: 'comment-123' } as any);

      // Test various time formats
      const testCases = [
        { timeTaken: 1, expected: '0:01' },
        { timeTaken: 59, expected: '0:59' },
        { timeTaken: 60, expected: '1:00' },
        { timeTaken: 125, expected: '2:05' },
        { timeTaken: 3661, expected: '61:01' }, // Over 1 hour
      ];

      for (const testCase of testCases) {
        const commentData: CompletionCommentData = {
          username: 'testuser',
          timeTaken: testCase.timeTaken,
          hintsUsed: 0,
          difficulty: 'Easy',
          score: 150,
          commentType: 'completion',
        };

        const result = await handler.postCompletionComment(commentData);
        expect(result.commentText).toBe(
          `u/testuser completed the puzzle in ${testCase.expected} with 0 hints!`
        );
      }
    });

    it('should format encouragement comment correctly', async () => {
      vi.mocked(reddit.getCurrentUser).mockResolvedValue({ username: 'testuser' } as any);
      vi.mocked(reddit.submitComment).mockResolvedValue({ id: 'comment-123' } as any);

      const commentData: CompletionCommentData = {
        username: 'testuser',
        timeTaken: 120,
        hintsUsed: 3,
        difficulty: 'Hard',
        score: 0,
        commentType: 'encouragement',
      };

      const result = await handler.postCompletionComment(commentData);

      expect(result.success).toBe(true);
      expect(result.type).toBe('encouragement');
      expect(result.commentText).toBe(
        "💪 u/testuser gave it a great try on the Hard puzzle! Keep analyzing those laser paths - you've got this! 🔬✨"
      );
    });

    it('should handle username mismatch security check', async () => {
      vi.mocked(reddit.getCurrentUser).mockResolvedValue({ username: 'actualuser' } as any);

      const commentData: CompletionCommentData = {
        username: 'differentuser',
        timeTaken: 120,
        hintsUsed: 1,
        difficulty: 'Medium',
        score: 300,
        commentType: 'completion',
      };

      const result = await handler.postCompletionComment(commentData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Username mismatch');
      expect(reddit.submitComment).not.toHaveBeenCalled();
    });

    it('should handle Reddit API timeout gracefully', async () => {
      vi.mocked(reddit.getCurrentUser).mockRejectedValue(new Error('Reddit API timeout'));

      const commentData: CompletionCommentData = {
        username: 'testuser',
        timeTaken: 120,
        hintsUsed: 1,
        difficulty: 'Medium',
        score: 300,
        commentType: 'completion',
      };

      const result = await handler.postCompletionComment(commentData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(reddit.submitComment).not.toHaveBeenCalled();
    });
  });

  describe('getCircuitBreakerState', () => {
    it('should return circuit breaker state', () => {
      const state = handler.getCircuitBreakerState();

      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('failures');
      expect(state).toHaveProperty('lastFailureTime');
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(state.state);
    });
  });
});
