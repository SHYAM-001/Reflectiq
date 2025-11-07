/**
 * Submission Analytics Service for ReflectIQ
 * Provides comprehensive logging and analytics for answer submissions
 * Requirements: 11.1, 11.2, 11.5
 */

import { logger } from '../utils/logger.js';
import { redis } from '@devvit/web/server';
import { Submission, Difficulty } from '../../shared/types/puzzle.js';

export interface SubmissionLogEntry {
  timestamp: string;
  userId: string;
  puzzleId: string;
  sessionId: string;
  answer: [number, number];
  correctAnswer: [number, number];
  isCorrect: boolean;
  timeTaken: number;
  hintsUsed: number;
  difficulty: Difficulty;
  score: number;
  leaderboardPosition?: number;
}

export interface ValidationMetrics {
  operation: 'answer_validation';
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  puzzleId: string;
  userId: string;
  error?: string;
}

export interface CommentPostingMetrics {
  operation: 'comment_posting';
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  commentType: 'completion' | 'encouragement';
  userId: string;
  puzzleId: string;
  error?: string;
}

export interface SubmissionVolumeMetrics {
  date: string;
  hour: number;
  totalSubmissions: number;
  correctSubmissions: number;
  incorrectSubmissions: number;
  averageTime: number;
  averageScore: number;
  difficulty: Difficulty;
}

export interface SuccessRateMetrics {
  period: 'hourly' | 'daily' | 'weekly';
  timestamp: string;
  difficulty: Difficulty;
  totalSubmissions: number;
  successfulSubmissions: number;
  successRate: number;
  averageCompletionTime: number;
  averageHintsUsed: number;
}

export interface CompletionTimeMetrics {
  puzzleId: string;
  difficulty: Difficulty;
  fastestTime: number;
  slowestTime: number;
  averageTime: number;
  medianTime: number;
  totalCompletions: number;
  timeDistribution: {
    under30s: number;
    under60s: number;
    under120s: number;
    under300s: number;
    over300s: number;
  };
}

class SubmissionAnalyticsService {
  private static instance: SubmissionAnalyticsService;

  private constructor() {}

  public static getInstance(): SubmissionAnalyticsService {
    if (!SubmissionAnalyticsService.instance) {
      SubmissionAnalyticsService.instance = new SubmissionAnalyticsService();
    }
    return SubmissionAnalyticsService.instance;
  }

  /**
   * Log detailed answer submission with all required data
   * Requirements: 11.1
   */
  public async logSubmission(
    submission: Submission,
    correctAnswer: [number, number],
    leaderboardPosition?: number
  ): Promise<void> {
    const logEntry: SubmissionLogEntry = {
      timestamp: new Date().toISOString(),
      userId: submission.userId,
      puzzleId: submission.puzzleId,
      sessionId: submission.sessionId,
      answer: submission.answer,
      correctAnswer,
      isCorrect: submission.correct,
      timeTaken: submission.timeTaken,
      hintsUsed: submission.hintsUsed,
      difficulty: submission.difficulty,
      score: submission.score,
      leaderboardPosition,
    };

    // Log to console with structured format
    logger.info('Answer submission recorded', {
      submissionId: `${submission.userId}_${submission.puzzleId}_${submission.timestamp.getTime()}`,
      userId: submission.userId,
      puzzleId: submission.puzzleId,
      result: submission.correct ? 'CORRECT' : 'INCORRECT',
      score: submission.score,
      timeTaken: submission.timeTaken,
      hintsUsed: submission.hintsUsed,
      difficulty: submission.difficulty,
      leaderboardPosition,
    });

    // Store detailed submission log in Redis for analytics
    try {
      const logKey = `analytics:submissions:${submission.timestamp.toISOString().split('T')[0]}`;
      const logId = `${submission.userId}_${submission.puzzleId}_${submission.timestamp.getTime()}`;

      await redis.hSet(logKey, { [logId]: JSON.stringify(logEntry) });
      await redis.expire(logKey, 2592000); // 30 days retention
    } catch (error) {
      logger.error('Failed to store submission analytics', { error: error.message });
    }

    // Update real-time metrics
    await this.updateVolumeMetrics(submission);
    await this.updateSuccessRateMetrics(submission);
    await this.updateCompletionTimeMetrics(submission);
  }

  /**
   * Log answer validation performance metrics
   * Requirements: 11.2
   */
  public logValidationMetrics(metrics: ValidationMetrics): void {
    logger.info('Answer validation performance', {
      operation: metrics.operation,
      duration: metrics.duration,
      success: metrics.success,
      puzzleId: metrics.puzzleId,
      userId: metrics.userId,
      error: metrics.error,
    });

    // Store performance metrics for monitoring
    this.storePerformanceMetrics('validation', metrics);
  }

  /**
   * Log comment posting performance metrics
   * Requirements: 11.2
   */
  public logCommentPostingMetrics(metrics: CommentPostingMetrics): void {
    logger.info('Comment posting performance', {
      operation: metrics.operation,
      duration: metrics.duration,
      success: metrics.success,
      commentType: metrics.commentType,
      userId: metrics.userId,
      puzzleId: metrics.puzzleId,
      error: metrics.error,
    });

    // Store performance metrics for monitoring
    this.storePerformanceMetrics('comment_posting', metrics);
  }

  /**
   * Update submission volume metrics
   * Requirements: 11.5
   */
  private async updateVolumeMetrics(submission: Submission): Promise<void> {
    try {
      const submissionDate = submission.timestamp;
      const dateKey = submissionDate.toISOString().split('T')[0];
      const hour = submissionDate.getHours();

      const metricsKey = `analytics:volume:${dateKey}:${hour}:${submission.difficulty}`;

      // Use individual Redis calls (Devvit doesn't support multi/transactions)
      await redis.hIncrBy(metricsKey, 'totalSubmissions', 1);

      if (submission.correct) {
        await redis.hIncrBy(metricsKey, 'correctSubmissions', 1);
      } else {
        await redis.hIncrBy(metricsKey, 'incorrectSubmissions', 1);
      }

      // Update running averages (simplified approach)
      await redis.hIncrBy(metricsKey, 'totalTime', submission.timeTaken);
      await redis.hIncrBy(metricsKey, 'totalScore', submission.score);

      await redis.expire(metricsKey, 604800); // 7 days retention
    } catch (error) {
      logger.error('Failed to update volume metrics', { error: error.message });
    }
  }

  /**
   * Update success rate metrics
   * Requirements: 11.5
   */
  private async updateSuccessRateMetrics(submission: Submission): Promise<void> {
    try {
      const submissionDate = submission.timestamp;
      const hourKey = `analytics:success:hourly:${submissionDate.toISOString().slice(0, 13)}:${submission.difficulty}`;
      const dailyKey = `analytics:success:daily:${submissionDate.toISOString().split('T')[0]}:${submission.difficulty}`;

      // Update hourly metrics (individual calls for Devvit compatibility)
      await redis.hIncrBy(hourKey, 'totalSubmissions', 1);
      if (submission.correct) {
        await redis.hIncrBy(hourKey, 'successfulSubmissions', 1);
      }
      await redis.hIncrBy(hourKey, 'totalTime', submission.timeTaken);
      await redis.hIncrBy(hourKey, 'totalHints', submission.hintsUsed);
      await redis.expire(hourKey, 604800); // 7 days retention

      // Update daily metrics
      await redis.hIncrBy(dailyKey, 'totalSubmissions', 1);
      if (submission.correct) {
        await redis.hIncrBy(dailyKey, 'successfulSubmissions', 1);
      }
      await redis.hIncrBy(dailyKey, 'totalTime', submission.timeTaken);
      await redis.hIncrBy(dailyKey, 'totalHints', submission.hintsUsed);
      await redis.expire(dailyKey, 2592000); // 30 days retention
    } catch (error) {
      logger.error('Failed to update success rate metrics', { error: error.message });
    }
  }

  /**
   * Update completion time metrics
   * Requirements: 11.5
   */
  private async updateCompletionTimeMetrics(submission: Submission): Promise<void> {
    if (!submission.correct) return; // Only track completion times for correct answers

    try {
      const metricsKey = `analytics:completion:${submission.puzzleId}`;

      // Store completion time in hash for statistical analysis (Devvit compatible)
      const timestamp = Date.now();
      await redis.hSet(`${metricsKey}:times`, {
        [timestamp.toString()]: submission.timeTaken.toString(),
      });
      await redis.expire(`${metricsKey}:times`, 604800); // 7 days retention

      // Update time distribution counters (individual calls for Devvit compatibility)
      if (submission.timeTaken < 30) {
        await redis.hIncrBy(metricsKey, 'under30s', 1);
      } else if (submission.timeTaken < 60) {
        await redis.hIncrBy(metricsKey, 'under60s', 1);
      } else if (submission.timeTaken < 120) {
        await redis.hIncrBy(metricsKey, 'under120s', 1);
      } else if (submission.timeTaken < 300) {
        await redis.hIncrBy(metricsKey, 'under300s', 1);
      } else {
        await redis.hIncrBy(metricsKey, 'over300s', 1);
      }

      await redis.hIncrBy(metricsKey, 'totalCompletions', 1);
      await redis.expire(metricsKey, 604800); // 7 days retention
    } catch (error) {
      logger.error('Failed to update completion time metrics', { error: error.message });
    }
  }

  /**
   * Store performance metrics for monitoring
   */
  private async storePerformanceMetrics(
    type: 'validation' | 'comment_posting',
    metrics: ValidationMetrics | CommentPostingMetrics
  ): Promise<void> {
    try {
      const now = new Date();
      const metricsKey = `analytics:performance:${type}:${now.toISOString().split('T')[0]}`;
      const metricsId = `${metrics.userId}_${now.getTime()}`;

      await redis.hSet(metricsKey, { [metricsId]: JSON.stringify(metrics) });
      await redis.expire(metricsKey, 604800); // 7 days retention
    } catch (error) {
      logger.error(`Failed to store ${type} performance metrics`, { error: error.message });
    }
  }

  /**
   * Get submission volume analytics for a specific date and difficulty
   */
  public async getVolumeMetrics(
    date: string,
    difficulty: Difficulty
  ): Promise<SubmissionVolumeMetrics[]> {
    const metrics: SubmissionVolumeMetrics[] = [];

    try {
      for (let hour = 0; hour < 24; hour++) {
        const metricsKey = `analytics:volume:${date}:${hour}:${difficulty}`;
        const data = await redis.hGetAll(metricsKey);

        if (Object.keys(data).length > 0) {
          const totalSubmissions = parseInt(data.totalSubmissions || '0');
          const totalTime = parseInt(data.totalTime || '0');
          const totalScore = parseInt(data.totalScore || '0');

          metrics.push({
            date,
            hour,
            totalSubmissions,
            correctSubmissions: parseInt(data.correctSubmissions || '0'),
            incorrectSubmissions: parseInt(data.incorrectSubmissions || '0'),
            averageTime: totalSubmissions > 0 ? totalTime / totalSubmissions : 0,
            averageScore: totalSubmissions > 0 ? totalScore / totalSubmissions : 0,
            difficulty,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to get volume metrics', { error: error.message });
    }

    return metrics;
  }

  /**
   * Get success rate metrics for a specific period and difficulty
   */
  public async getSuccessRateMetrics(
    period: 'hourly' | 'daily',
    timestamp: string,
    difficulty: Difficulty
  ): Promise<SuccessRateMetrics | null> {
    try {
      const metricsKey = `analytics:success:${period}:${timestamp}:${difficulty}`;
      const data = await redis.hGetAll(metricsKey);

      if (Object.keys(data).length === 0) {
        return null;
      }

      const totalSubmissions = parseInt(data.totalSubmissions || '0');
      const successfulSubmissions = parseInt(data.successfulSubmissions || '0');
      const totalTime = parseInt(data.totalTime || '0');
      const totalHints = parseInt(data.totalHints || '0');

      return {
        period,
        timestamp,
        difficulty,
        totalSubmissions,
        successfulSubmissions,
        successRate: totalSubmissions > 0 ? successfulSubmissions / totalSubmissions : 0,
        averageCompletionTime: successfulSubmissions > 0 ? totalTime / successfulSubmissions : 0,
        averageHintsUsed: totalSubmissions > 0 ? totalHints / totalSubmissions : 0,
      };
    } catch (error) {
      logger.error('Failed to get success rate metrics', { error: error.message });
      return null;
    }
  }

  /**
   * Get completion time metrics for a specific puzzle
   */
  public async getCompletionTimeMetrics(puzzleId: string): Promise<CompletionTimeMetrics | null> {
    try {
      const metricsKey = `analytics:completion:${puzzleId}`;
      const distributionData = await redis.hGetAll(metricsKey);
      // Note: Using hGetAll instead of lRange since we changed to hash storage for Devvit compatibility
      const timesData = await redis.hGetAll(`${metricsKey}:times`);
      const times = Object.values(timesData).map((time) => parseInt(time));

      if (times.length === 0) {
        return null;
      }

      const numericTimes = times.map((t) => parseInt(t)).sort((a, b) => a - b);
      const totalCompletions = parseInt(distributionData.totalCompletions || '0');

      // Extract difficulty from puzzle ID (format: puzzle_easy_2024-01-01)
      const difficultyMatch = puzzleId.match(/puzzle_(easy|medium|hard)_/);
      const difficulty = difficultyMatch
        ? ((difficultyMatch[1].charAt(0).toUpperCase() + difficultyMatch[1].slice(1)) as Difficulty)
        : ('Easy' as Difficulty);

      return {
        puzzleId,
        difficulty,
        fastestTime: numericTimes[0],
        slowestTime: numericTimes[numericTimes.length - 1],
        averageTime: numericTimes.reduce((sum, time) => sum + time, 0) / numericTimes.length,
        medianTime: numericTimes[Math.floor(numericTimes.length / 2)],
        totalCompletions,
        timeDistribution: {
          under30s: parseInt(distributionData.under30s || '0'),
          under60s: parseInt(distributionData.under60s || '0'),
          under120s: parseInt(distributionData.under120s || '0'),
          under300s: parseInt(distributionData.under300s || '0'),
          over300s: parseInt(distributionData.over300s || '0'),
        },
      };
    } catch (error) {
      logger.error('Failed to get completion time metrics', { error: error.message });
      return null;
    }
  }
}

export default SubmissionAnalyticsService;
