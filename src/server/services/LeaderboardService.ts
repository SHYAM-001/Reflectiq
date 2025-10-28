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

  /**
   * Atomic score update with consistency checks
   * Requirements: 9.3, 9.5
   */
  public async atomicScoreUpdate(
    puzzleId: string,
    userId: string,
    score: number,
    submission: Submission
  ): Promise<{ success: boolean; previousScore?: number; error?: string }> {
    try {
      const puzzleLeaderboardKey = `reflectiq:leaderboard:${puzzleId}`;
      const dailyLeaderboardKey = `reflectiq:leaderboard:daily:${submission.timestamp.toISOString().split('T')[0]}`;
      const submissionKey = `reflectiq:submissions:${puzzleId}`;

      // Get previous score for comparison
      const previousScore = await redis.zScore(puzzleLeaderboardKey, userId);

      // Only update if new score is better (higher)
      if (previousScore !== null && score <= previousScore) {
        return {
          success: false,
          previousScore,
          error: 'New score is not better than existing score',
        };
      }

      // Use Redis transaction for atomic updates
      const multi = redis.multi();

      // Update puzzle leaderboard
      multi.zAdd(puzzleLeaderboardKey, { member: userId, score });

      // Update daily combined leaderboard (format: "username:difficulty")
      const dailyMember = `${userId}:${submission.difficulty}`;
      multi.zAdd(dailyLeaderboardKey, { member: dailyMember, score });

      // Store submission data
      multi.hSet(submissionKey, userId, JSON.stringify(submission));

      // Set expiration policies
      multi.expire(puzzleLeaderboardKey, 604800); // 7 days
      multi.expire(dailyLeaderboardKey, 2592000); // 30 days
      multi.expire(submissionKey, 604800); // 7 days

      // Execute transaction
      await multi.exec();

      console.log(
        `Atomic score update completed for ${userId} in ${puzzleId}: ${score} (previous: ${previousScore})`
      );

      return {
        success: true,
        previousScore: previousScore || 0,
      };
    } catch (error) {
      console.error('Error in atomic score update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Data consistency check and repair mechanism
   * Requirements: 9.3, 9.5
   */
  public async performConsistencyCheck(date: string): Promise<{
    success: boolean;
    issues: string[];
    repaired: string[];
    error?: string;
  }> {
    try {
      const issues: string[] = [];
      const repaired: string[] = [];

      const dailyLeaderboardKey = `reflectiq:leaderboard:daily:${date}`;
      const difficulties = ['easy', 'medium', 'hard'];

      // Check each difficulty's puzzle leaderboard
      for (const difficulty of difficulties) {
        const puzzleId = `puzzle_${difficulty}_${date}`;
        const puzzleLeaderboardKey = `reflectiq:leaderboard:${puzzleId}`;
        const submissionKey = `reflectiq:submissions:${puzzleId}`;

        // Get all members from puzzle leaderboard
        const puzzleMembers = await redis.zRange(puzzleLeaderboardKey, 0, -1, { withScores: true });

        for (const member of puzzleMembers) {
          if (typeof member === 'object' && 'member' in member && 'score' in member) {
            const userId = member.member;
            const score = member.score;

            // Check if submission data exists
            const submissionData = await redis.hGet(submissionKey, userId);

            if (!submissionData) {
              issues.push(`Missing submission data for ${userId} in ${puzzleId}`);

              // Try to repair by removing from leaderboard
              await redis.zRem(puzzleLeaderboardKey, userId);
              await redis.zRem(dailyLeaderboardKey, `${userId}:${difficulty}`);
              repaired.push(`Removed orphaned leaderboard entry for ${userId} in ${puzzleId}`);
              continue;
            }

            try {
              const submission: Submission = JSON.parse(submissionData);

              // Verify score consistency
              if (submission.score !== score) {
                issues.push(
                  `Score mismatch for ${userId} in ${puzzleId}: leaderboard=${score}, submission=${submission.score}`
                );

                // Repair by updating leaderboard with submission score
                await redis.zAdd(puzzleLeaderboardKey, { member: userId, score: submission.score });
                await redis.zAdd(dailyLeaderboardKey, {
                  member: `${userId}:${difficulty}`,
                  score: submission.score,
                });
                repaired.push(`Fixed score mismatch for ${userId} in ${puzzleId}`);
              }

              // Check if daily leaderboard entry exists
              const dailyScore = await redis.zScore(dailyLeaderboardKey, `${userId}:${difficulty}`);
              if (dailyScore === null) {
                issues.push(`Missing daily leaderboard entry for ${userId}:${difficulty}`);

                // Repair by adding to daily leaderboard
                await redis.zAdd(dailyLeaderboardKey, {
                  member: `${userId}:${difficulty}`,
                  score: submission.score,
                });
                repaired.push(`Added missing daily leaderboard entry for ${userId}:${difficulty}`);
              }
            } catch (parseError) {
              issues.push(`Invalid submission data for ${userId} in ${puzzleId}`);

              // Remove corrupted data
              await redis.hDel(submissionKey, userId);
              await redis.zRem(puzzleLeaderboardKey, userId);
              await redis.zRem(dailyLeaderboardKey, `${userId}:${difficulty}`);
              repaired.push(`Removed corrupted data for ${userId} in ${puzzleId}`);
            }
          }
        }
      }

      // Check for orphaned daily leaderboard entries
      const dailyMembers = await redis.zRange(dailyLeaderboardKey, 0, -1);

      for (const dailyMember of dailyMembers) {
        if (typeof dailyMember === 'string') {
          const [userId, difficulty] = dailyMember.split(':');

          if (!userId || !difficulty || !difficulties.includes(difficulty)) {
            issues.push(`Invalid daily leaderboard entry format: ${dailyMember}`);

            // Remove invalid entry
            await redis.zRem(dailyLeaderboardKey, dailyMember);
            repaired.push(`Removed invalid daily leaderboard entry: ${dailyMember}`);
            continue;
          }

          const puzzleId = `puzzle_${difficulty}_${date}`;
          const puzzleScore = await redis.zScore(`reflectiq:leaderboard:${puzzleId}`, userId);

          if (puzzleScore === null) {
            issues.push(`Orphaned daily leaderboard entry: ${dailyMember}`);

            // Remove orphaned entry
            await redis.zRem(dailyLeaderboardKey, dailyMember);
            repaired.push(`Removed orphaned daily leaderboard entry: ${dailyMember}`);
          }
        }
      }

      console.log(
        `Consistency check for ${date}: ${issues.length} issues found, ${repaired.length} repairs made`
      );

      return {
        success: true,
        issues,
        repaired,
      };
    } catch (error) {
      console.error('Error in consistency check:', error);
      return {
        success: false,
        issues: [],
        repaired: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cleanup old leaderboards with data retention policies
   * Requirements: 9.5
   */
  public async cleanupOldLeaderboards(retentionDays: number): Promise<number> {
    try {
      let cleanedCount = 0;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Generate list of dates to check for cleanup
      const datesToCheck: string[] = [];
      for (let i = retentionDays; i <= retentionDays + 30; i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        datesToCheck.push(checkDate.toISOString().split('T')[0]);
      }

      for (const date of datesToCheck) {
        const dailyKey = `reflectiq:leaderboard:daily:${date}`;
        const exists = await redis.exists(dailyKey);

        if (exists) {
          // Delete daily leaderboard
          await redis.del(dailyKey);
          cleanedCount++;

          // Delete individual puzzle leaderboards for this date
          for (const difficulty of ['easy', 'medium', 'hard']) {
            const puzzleId = `puzzle_${difficulty}_${date}`;
            const puzzleKey = `reflectiq:leaderboard:${puzzleId}`;
            const submissionKey = `reflectiq:submissions:${puzzleId}`;

            const puzzleExists = await redis.exists(puzzleKey);
            const submissionExists = await redis.exists(submissionKey);

            if (puzzleExists) {
              await redis.del(puzzleKey);
              cleanedCount++;
            }

            if (submissionExists) {
              await redis.del(submissionKey);
              cleanedCount++;
            }
          }

          console.log(`Cleaned up leaderboard data for ${date}`);
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up old leaderboards:', error);
      return 0;
    }
  }
}
