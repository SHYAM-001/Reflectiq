/**
 * Tests for SubmissionAnalyticsService
 * Verifies comprehensive logging and analytics functionality
 * Requirements: 11.1, 11.2, 11.5
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import SubmissionAnalyticsService from '../../services/SubmissionAnalyticsService.js';
import { redisClient } from '../../utils/redisClient.js';
import { logger } from '../../utils/logger.js';
import { Submission, Difficulty } from '../../../shared/types/puzzle.js';

// Mock Redis client
vi.mock('../../utils/redisClient.js', () => ({
  redisClient: {
    hSet: vi.fn(),
    hGetAll: vi.fn(),
    hIncrBy: vi.fn(),
    lPush: vi.fn(),
    lTrim: vi.fn(),
    lRange: vi.fn(),
    expire: vi.fn(),
    multi: vi.fn(() => ({
      hIncrBy: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  },
}));

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('SubmissionAnalyticsService', () => {
  let analyticsService: SubmissionAnalyticsService;
  let mockSubmission: Submission;

  beforeEach(() => {
    analyticsService = SubmissionAnalyticsService.getInstance();

    mockSubmission = {
      userId: 'test-user-123',
      puzzleId: 'puzzle_easy_2024-01-01',
      sessionId: 'session-123',
      answer: [2, 3],
      timeTaken: 45,
      hintsUsed: 1,
      score: 850,
      correct: true,
      timestamp: new Date('2024-01-01T10:30:00Z'),
      difficulty: 'Easy' as Difficulty,
    };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('logSubmission', () => {
    it('should log submission with all required data', async () => {
      const correctAnswer: [number, number] = [2, 3];
      const leaderboardPosition = 5;

      await analyticsService.logSubmission(mockSubmission, correctAnswer, leaderboardPosition);

      // Verify structured logging
      expect(logger.info).toHaveBeenCalledWith(
        'Answer submission recorded',
        expect.objectContaining({
          userId: 'test-user-123',
          puzzleId: 'puzzle_easy_2024-01-01',
          result: 'CORRECT',
          score: 850,
          timeTaken: 45,
          hintsUsed: 1,
          difficulty: 'Easy',
          leaderboardPosition: 5,
        })
      );

      // Verify Redis storage
      expect(redisClient.hSet).toHaveBeenCalledWith(
        'analytics:submissions:2024-01-01',
        'test-user-123_puzzle_easy_2024-01-01_1704105000000',
        expect.stringContaining('"userId":"test-user-123"')
      );
    });

    it('should handle incorrect answers properly', async () => {
      const incorrectSubmission = { ...mockSubmission, correct: false, score: 0 };
      const correctAnswer: [number, number] = [1, 1];

      await analyticsService.logSubmission(incorrectSubmission, correctAnswer);

      expect(logger.info).toHaveBeenCalledWith(
        'Answer submission recorded',
        expect.objectContaining({
          result: 'INCORRECT',
          score: 0,
        })
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const redisError = new Error('Redis connection failed');
      vi.mocked(redisClient.hSet).mockRejectedValueOnce(redisError);

      const correctAnswer: [number, number] = [2, 3];

      await expect(
        analyticsService.logSubmission(mockSubmission, correctAnswer)
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to store submission analytics',
        expect.objectContaining({ error: 'Redis connection failed' })
      );
    });
  });

  describe('logValidationMetrics', () => {
    it('should log validation performance metrics', () => {
      const metrics = {
        operation: 'answer_validation' as const,
        startTime: 1000,
        endTime: 1050,
        duration: 50,
        success: true,
        puzzleId: 'puzzle_easy_2024-01-01',
        userId: 'test-user-123',
      };

      analyticsService.logValidationMetrics(metrics);

      expect(logger.info).toHaveBeenCalledWith(
        'Answer validation performance',
        expect.objectContaining({
          operation: 'answer_validation',
          duration: 50,
          success: true,
          puzzleId: 'puzzle_easy_2024-01-01',
          userId: 'test-user-123',
        })
      );
    });

    it('should log validation errors', () => {
      const metrics = {
        operation: 'answer_validation' as const,
        startTime: 1000,
        endTime: 1050,
        duration: 50,
        success: false,
        puzzleId: 'puzzle_easy_2024-01-01',
        userId: 'test-user-123',
        error: 'Puzzle not found',
      };

      analyticsService.logValidationMetrics(metrics);

      expect(logger.info).toHaveBeenCalledWith(
        'Answer validation performance',
        expect.objectContaining({
          success: false,
          error: 'Puzzle not found',
        })
      );
    });
  });

  describe('logCommentPostingMetrics', () => {
    it('should log comment posting performance metrics', () => {
      const metrics = {
        operation: 'comment_posting' as const,
        startTime: 2000,
        endTime: 2500,
        duration: 500,
        success: true,
        commentType: 'completion' as const,
        userId: 'test-user-123',
        puzzleId: 'puzzle_easy_2024-01-01',
      };

      analyticsService.logCommentPostingMetrics(metrics);

      expect(logger.info).toHaveBeenCalledWith(
        'Comment posting performance',
        expect.objectContaining({
          operation: 'comment_posting',
          duration: 500,
          success: true,
          commentType: 'completion',
          userId: 'test-user-123',
          puzzleId: 'puzzle_easy_2024-01-01',
        })
      );
    });

    it('should log comment posting failures', () => {
      const metrics = {
        operation: 'comment_posting' as const,
        startTime: 2000,
        endTime: 2500,
        duration: 500,
        success: false,
        commentType: 'encouragement' as const,
        userId: 'test-user-123',
        puzzleId: 'puzzle_easy_2024-01-01',
        error: 'Reddit API timeout',
      };

      analyticsService.logCommentPostingMetrics(metrics);

      expect(logger.info).toHaveBeenCalledWith(
        'Comment posting performance',
        expect.objectContaining({
          success: false,
          error: 'Reddit API timeout',
        })
      );
    });
  });

  describe('getVolumeMetrics', () => {
    it('should retrieve volume metrics for a specific date and difficulty', async () => {
      const mockData = {
        totalSubmissions: '10',
        correctSubmissions: '7',
        incorrectSubmissions: '3',
        totalTime: '450',
        totalScore: '6800',
      };

      // Mock to return data only for hour 10, empty for others
      vi.mocked(redisClient.hGetAll).mockImplementation((key: string) => {
        if (key.includes(':10:')) {
          return Promise.resolve(mockData);
        }
        return Promise.resolve({});
      });

      const metrics = await analyticsService.getVolumeMetrics('2024-01-01', 'Easy');

      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual({
        date: '2024-01-01',
        hour: 10,
        totalSubmissions: 10,
        correctSubmissions: 7,
        incorrectSubmissions: 3,
        averageTime: 45,
        averageScore: 680,
        difficulty: 'Easy',
      });
    });

    it('should handle empty metrics gracefully', async () => {
      vi.mocked(redisClient.hGetAll).mockResolvedValue({});

      const metrics = await analyticsService.getVolumeMetrics('2024-01-01', 'Easy');

      expect(metrics).toHaveLength(0);
    });

    it('should handle Redis errors gracefully', async () => {
      vi.mocked(redisClient.hGetAll).mockRejectedValue(new Error('Redis error'));

      const metrics = await analyticsService.getVolumeMetrics('2024-01-01', 'Easy');

      expect(metrics).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get volume metrics',
        expect.objectContaining({ error: 'Redis error' })
      );
    });
  });

  describe('getSuccessRateMetrics', () => {
    it('should calculate success rate metrics correctly', async () => {
      const mockData = {
        totalSubmissions: '20',
        successfulSubmissions: '15',
        totalTime: '900',
        totalHints: '25',
      };

      vi.mocked(redisClient.hGetAll).mockResolvedValue(mockData);

      const metrics = await analyticsService.getSuccessRateMetrics('daily', '2024-01-01', 'Easy');

      expect(metrics).toEqual({
        period: 'daily',
        timestamp: '2024-01-01',
        difficulty: 'Easy',
        totalSubmissions: 20,
        successfulSubmissions: 15,
        successRate: 0.75,
        averageCompletionTime: 60,
        averageHintsUsed: 1.25,
      });
    });

    it('should return null for missing data', async () => {
      vi.mocked(redisClient.hGetAll).mockResolvedValue({});

      const metrics = await analyticsService.getSuccessRateMetrics('daily', '2024-01-01', 'Easy');

      expect(metrics).toBeNull();
    });
  });

  describe('getCompletionTimeMetrics', () => {
    it('should calculate completion time statistics', async () => {
      const mockDistribution = {
        totalCompletions: '10',
        under30s: '2',
        under60s: '5',
        under120s: '2',
        under300s: '1',
        over300s: '0',
      };

      const mockTimes = ['25', '35', '45', '55', '65', '75', '85', '95', '105', '115'];

      vi.mocked(redisClient.hGetAll).mockResolvedValue(mockDistribution);
      vi.mocked(redisClient.lRange).mockResolvedValue(mockTimes);

      const metrics = await analyticsService.getCompletionTimeMetrics('puzzle_easy_2024-01-01');

      expect(metrics).toEqual({
        puzzleId: 'puzzle_easy_2024-01-01',
        difficulty: 'Easy',
        fastestTime: 25,
        slowestTime: 115,
        averageTime: 70,
        medianTime: 75,
        totalCompletions: 10,
        timeDistribution: {
          under30s: 2,
          under60s: 5,
          under120s: 2,
          under300s: 1,
          over300s: 0,
        },
      });
    });

    it('should return null for puzzles with no completions', async () => {
      vi.mocked(redisClient.lRange).mockResolvedValue([]);

      const metrics = await analyticsService.getCompletionTimeMetrics('puzzle_easy_2024-01-01');

      expect(metrics).toBeNull();
    });
  });
});
