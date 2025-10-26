/**
 * Leaderboard Service for ReflectIQ
 * Handles Redis-based leaderboard management with sorted sets
 * Following Devvit Web patterns for Redis operations
 */

import { redis } from '@devvit/web/server';
import { LeaderboardEntry, Submission, Difficulty } from '../../shared/types/puzzle.js';

export class LeaderboardService {
  private static instance: LeaderboardService;

  private constructor() {}

  public static getInstance(): LeaderboardService {
    if (!LeaderboardService.instance) {
      LeaderboardService.instance = new LeaderboardService();
    }
    return LeaderboardService.instance;
  }

  /**
   * Add or update a player's score in a puzzle leaderboard
   * Requirements: 7.1, 7.2, 9.3
   */
  public async updatePuzzleLeaderboard(
    puzzleId: string,
    userId: string,
    score: number,
    _submission: Submission
  ): Promise<void> {
    try {
      const leaderboardKey = `reflectiq:leaderboard:${puzzleId}`;

      // Add/update score in sorted set (higher scores = better ranking)
      await redis.zAdd(leaderboardKey, { member: userId, score });

      // Set expiration for 7 days
      await redis.expire(leaderboardKey, 604800);

      console.log(`Updated puzzle leaderboard for ${puzzleId}: ${userId} = ${score}`);
    } catch (error) {
      console.error('Error updating puzzle leaderboard:', error);
      throw error;
    }
  }

  /**
   * Add or update a player's score in the daily combined leaderboard
   * Requirements: 7.2, 7.3, 9.3
   */
  public async updateDailyLeaderboard(
    date: string,
    userId: string,
    difficulty: Difficulty,
    score: number
  ): Promise<void> {
    try {
      const dailyLeaderboardKey = `reflectiq:leaderboard:daily:${date}`;
      const memberKey = `${userId}:${difficulty}`;

      // Add/update score in daily leaderboard
      await redis.zAdd(dailyLeaderboardKey, { member: memberKey, score });

      // Set expiration for 7 days
      await redis.expire(dailyLeaderboardKey, 604800);

      console.log(`Updated daily leaderboard for ${date}: ${memberKey} = ${score}`);
    } catch (error) {
      console.error('Error updating daily leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get puzzle leaderboard with pagination
   * Requirements: 7.1, 7.4, 7.5
   */
  public async getPuzzleLeaderboard(
    puzzleId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{
    entries: LeaderboardEntry[];
    totalPlayers: number;
  }> {
    try {
      const leaderboardKey = `reflectiq:leaderboard:${puzzleId}`;
      const submissionKey = `reflectiq:submissions:${puzzleId}`;

      // Get total player count
      const totalPlayers = await redis.zCard(leaderboardKey);

      if (totalPlayers === 0) {
        return {
          entries: [],
          totalPlayers: 0,
        };
      }

      // Get top scores in descending order (highest first)
      const scores = await redis.zRange(leaderboardKey, offset, offset + limit - 1, {
        by: 'rank',
        reverse: true,
      });

      // Build leaderboard entries with detailed submission data
      const entries: LeaderboardEntry[] = [];

      for (let i = 0; i < scores.length; i++) {
        const scoreData = scores[i];
        if (
          scoreData &&
          typeof scoreData === 'object' &&
          'member' in scoreData &&
          'score' in scoreData
        ) {
          const username = scoreData.member;
          const score = scoreData.score;

          // Get detailed submission data
          let submission: Submission | null = null;
          try {
            const submissionData = await redis.hGet(submissionKey, username);
            if (submissionData) {
              submission = JSON.parse(submissionData);
            }
          } catch (error) {
            console.warn(`Failed to get submission for ${username}:`, error);
          }

          entries.push({
            rank: offset + i + 1,
            username,
            difficulty: submission?.difficulty || 'Easy',
            time: submission?.timeTaken || 0,
            hints: submission?.hintsUsed || 0,
            score,
            timestamp: submission?.timestamp || new Date(),
          });
        }
      }

      return {
        entries,
        totalPlayers,
      };
    } catch (error) {
      console.error('Error getting puzzle leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get daily combined leaderboard with pagination
   * Requirements: 7.2, 7.3, 7.4, 7.5
   */
  public async getDailyLeaderboard(
    date: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{
    entries: LeaderboardEntry[];
    totalPlayers: number;
  }> {
    try {
      const dailyLeaderboardKey = `reflectiq:leaderboard:daily:${date}`;

      // Get total player count
      const totalPlayers = await redis.zCard(dailyLeaderboardKey);

      if (totalPlayers === 0) {
        return {
          entries: [],
          totalPlayers: 0,
        };
      }

      // Get top scores in descending order (highest first)
      const scores = await redis.zRange(dailyLeaderboardKey, offset, offset + limit - 1, {
        by: 'rank',
        reverse: true,
      });

      // Build leaderboard entries
      const entries: LeaderboardEntry[] = [];

      for (let i = 0; i < scores.length; i++) {
        const scoreData = scores[i];
        if (
          scoreData &&
          typeof scoreData === 'object' &&
          'member' in scoreData &&
          'score' in scoreData
        ) {
          const memberData = scoreData.member;
          const score = scoreData.score;

          // Parse member data (format: "username:difficulty")
          const [username, difficulty] = memberData.split(':');

          if (username && difficulty) {
            // Get submission details for timing info
            let timeTaken = 0;
            let hintsUsed = 0;
            let timestamp = new Date();

            try {
              const puzzleId = `puzzle_${difficulty.toLowerCase()}_${date}`;
              const submissionKey = `reflectiq:submissions:${puzzleId}`;
              const submissionData = await redis.hGet(submissionKey, username);

              if (submissionData) {
                const submission: Submission = JSON.parse(submissionData);
                timeTaken = submission.timeTaken;
                hintsUsed = submission.hintsUsed;
                timestamp = submission.timestamp;
              }
            } catch (error) {
              console.warn(`Failed to get submission details for ${username}:`, error);
            }

            entries.push({
              rank: offset + i + 1,
              username,
              difficulty: difficulty as Difficulty,
              time: timeTaken,
              hints: hintsUsed,
              score,
              timestamp,
            });
          }
        }
      }

      return {
        entries,
        totalPlayers,
      };
    } catch (error) {
      console.error('Error getting daily leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get a specific user's rank in a puzzle leaderboard
   * Requirements: 7.4, 7.5
   */
  public async getUserPuzzleRank(puzzleId: string, userId: string): Promise<number | null> {
    try {
      const leaderboardKey = `reflectiq:leaderboard:${puzzleId}`;

      // Get user's rank (Redis uses reverse rank for highest-first ordering)
      // Since zRevRank is not available, we'll use zRange with reverse to find the rank
      const allScores = await redis.zRange(leaderboardKey, 0, -1, {
        by: 'rank',
        reverse: true,
      });

      let rank: number | null = null;
      for (let i = 0; i < allScores.length; i++) {
        const scoreData = allScores[i];
        if (
          scoreData &&
          typeof scoreData === 'object' &&
          'member' in scoreData &&
          scoreData.member === userId
        ) {
          rank = i;
          break;
        }
      }

      return rank !== null ? rank + 1 : null; // Convert to 1-based ranking
    } catch (error) {
      console.error('Error getting user puzzle rank:', error);
      return null;
    }
  }

  /**
   * Get a specific user's rank in the daily leaderboard
   * Requirements: 7.4, 7.5
   */
  public async getUserDailyRank(
    date: string,
    userId: string,
    difficulty: Difficulty
  ): Promise<number | null> {
    try {
      const dailyLeaderboardKey = `reflectiq:leaderboard:daily:${date}`;
      const memberKey = `${userId}:${difficulty}`;

      // Get user's rank (Redis uses reverse rank for highest-first ordering)
      // Since zRevRank is not available, we'll use zRange with reverse to find the rank
      const allScores = await redis.zRange(dailyLeaderboardKey, 0, -1, {
        by: 'rank',
        reverse: true,
      });

      let rank: number | null = null;
      for (let i = 0; i < allScores.length; i++) {
        const scoreData = allScores[i];
        if (
          scoreData &&
          typeof scoreData === 'object' &&
          'member' in scoreData &&
          scoreData.member === memberKey
        ) {
          rank = i;
          break;
        }
      }

      return rank !== null ? rank + 1 : null; // Convert to 1-based ranking
    } catch (error) {
      console.error('Error getting user daily rank:', error);
      return null;
    }
  }

  /**
   * Get user's score for a specific puzzle
   * Requirements: 7.4, 7.5
   */
  public async getUserPuzzleScore(puzzleId: string, userId: string): Promise<number | null> {
    try {
      const leaderboardKey = `reflectiq:leaderboard:${puzzleId}`;

      const score = await redis.zScore(leaderboardKey, userId);

      return score !== undefined ? score : null;
    } catch (error) {
      console.error('Error getting user puzzle score:', error);
      return null;
    }
  }

  /**
   * Remove old leaderboard entries (cleanup)
   * Requirements: 9.3, 9.5
   */
  public async cleanupOldLeaderboards(daysToKeep: number = 7): Promise<number> {
    try {
      let cleanedCount = 0;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Clean up daily leaderboards for the past 30 days (beyond the keep period)
      for (let i = daysToKeep; i <= 30; i++) {
        const cleanupDate = new Date();
        cleanupDate.setDate(cleanupDate.getDate() - i);
        const dateStr = cleanupDate.toISOString().split('T')[0];

        const dailyKey = `reflectiq:leaderboard:daily:${dateStr}`;

        try {
          const exists = await redis.exists(dailyKey);
          if (exists) {
            await redis.del(dailyKey);
            cleanedCount++;
            console.log(`Cleaned up old daily leaderboard: ${dailyKey}`);
          }
        } catch (error) {
          console.warn(`Failed to cleanup ${dailyKey}:`, error);
        }

        // Also clean up individual puzzle leaderboards
        for (const difficulty of ['easy', 'medium', 'hard']) {
          const puzzleKey = `reflectiq:leaderboard:puzzle_${difficulty}_${dateStr}`;
          try {
            const exists = await redis.exists(puzzleKey);
            if (exists) {
              await redis.del(puzzleKey);
              cleanedCount++;
              console.log(`Cleaned up old puzzle leaderboard: ${puzzleKey}`);
            }
          } catch (error) {
            console.warn(`Failed to cleanup ${puzzleKey}:`, error);
          }
        }
      }

      console.log(`Cleaned up ${cleanedCount} old leaderboard entries`);
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up old leaderboards:', error);
      return 0;
    }
  }

  /**
   * Get leaderboard statistics for monitoring
   * Requirements: 9.3, 9.5
   */
  public async getLeaderboardStats(date: string): Promise<{
    dailyPlayers: number;
    puzzleStats: {
      easy: number;
      medium: number;
      hard: number;
    };
    totalSubmissions: number;
  }> {
    try {
      const dailyLeaderboardKey = `reflectiq:leaderboard:daily:${date}`;
      const dailyPlayers = await redis.zCard(dailyLeaderboardKey);

      const puzzleStats = {
        easy: 0,
        medium: 0,
        hard: 0,
      };

      // Get individual puzzle leaderboard counts
      for (const difficulty of ['easy', 'medium', 'hard']) {
        const puzzleKey = `reflectiq:leaderboard:puzzle_${difficulty}_${date}`;
        puzzleStats[difficulty as keyof typeof puzzleStats] = await redis.zCard(puzzleKey);
      }

      const totalSubmissions = puzzleStats.easy + puzzleStats.medium + puzzleStats.hard;

      return {
        dailyPlayers,
        puzzleStats,
        totalSubmissions,
      };
    } catch (error) {
      console.error('Error getting leaderboard stats:', error);
      return {
        dailyPlayers: 0,
        puzzleStats: { easy: 0, medium: 0, hard: 0 },
        totalSubmissions: 0,
      };
    }
  }
}
