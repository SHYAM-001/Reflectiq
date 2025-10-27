/**
 * Leaderboard Data Repository for ReflectIQ
 * Handles leaderboard operations using Redis sorted sets with atomic updates
 * Following Devvit Web best practices for ranking systems
 */

import { redisClient, RedisOperationOptions } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';
import { LeaderboardEntry, Difficulty } from '../../shared/types/puzzle.js';

export interface LeaderboardQueryOptions {
  includeScores?: boolean;
  includeRanks?: boolean;
  reverse?: boolean; // true for ascending order (lowest scores first)
}

export interface LeaderboardStats {
  totalEntries: number;
  entriesByDifficulty: Record<Difficulty, number>;
  highestScore: number;
  lowestScore: number;
  averageScore: number;
  lastUpdated?: Date;
}

export interface RankingResult {
  entries: LeaderboardEntry[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * Repository for leaderboard data operations using Redis sorted sets
 */
export class LeaderboardRepository {
  private static instance: LeaderboardRepository;
  private readonly DAILY_LEADERBOARD_PREFIX = 'leaderboard:daily';
  private readonly PUZZLE_LEADERBOARD_PREFIX = 'leaderboard:puzzle';
  private readonly GLOBAL_LEADERBOARD_KEY = 'leaderboard:global';
  private readonly STATS_KEY_PREFIX = 'leaderboard_stats';
  private readonly DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days

  private constructor() {}

  public static getInstance(): LeaderboardRepository {
    if (!LeaderboardRepository.instance) {
      LeaderboardRepository.instance = new LeaderboardRepository();
    }
    return LeaderboardRepository.instance;
  }

  /**
   * Add or update a leaderboard entry
   */
  public async addEntry(
    entry: LeaderboardEntry,
    options: RedisOperationOptions = {}
  ): Promise<void> {
    try {
      const memberKey = `${entry.userId}:${entry.puzzleId}`;

      // Add to daily leaderboard
      const dailyKey = `${this.DAILY_LEADERBOARD_PREFIX}:${entry.date}`;
      await redisClient.zAdd(dailyKey, memberKey, entry.score, options);
      await redisClient.expire(dailyKey, this.DEFAULT_TTL);

      // Add to puzzle-specific leaderboard
      const puzzleKey = `${this.PUZZLE_LEADERBOARD_PREFIX}:${entry.puzzleId}`;
      await redisClient.zAdd(puzzleKey, memberKey, entry.score, options);
      await redisClient.expire(puzzleKey, this.DEFAULT_TTL);

      // Add to global leaderboard (all-time)
      await redisClient.zAdd(this.GLOBAL_LEADERBOARD_KEY, memberKey, entry.score, options);

      // Store detailed entry data
      await this.storeEntryDetails(entry, options);

      // Update statistics
      await this.updateLeaderboardStats(entry);

      logger.debug('Leaderboard entry added successfully', {
        userId: entry.userId,
        puzzleId: entry.puzzleId,
        score: entry.score,
        difficulty: entry.difficulty,
        date: entry.date,
      });
    } catch (error) {
      logger.error('Failed to add leaderboard entry', {
        userId: entry.userId,
        puzzleId: entry.puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to add leaderboard entry: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get daily leaderboard rankings
   */
  public async getDailyLeaderboard(
    date: string,
    limit: number = 10,
    offset: number = 0,
    options: LeaderboardQueryOptions = {}
  ): Promise<RankingResult> {
    try {
      const dailyKey = `${this.DAILY_LEADERBOARD_PREFIX}:${date}`;

      // Get total count
      const totalCount = await this.getLeaderboardSize(dailyKey);

      if (totalCount === 0) {
        return {
          entries: [],
          totalCount: 0,
          hasMore: false,
        };
      }

      // Get ranked entries (Redis sorted sets are ordered by score ascending by default)
      // We want highest scores first, so we use ZREVRANGE
      const rankedMembers = await redisClient.zRangeWithScores(
        dailyKey,
        offset,
        offset + limit - 1
      );

      // Convert to leaderboard entries
      const entries: LeaderboardEntry[] = [];

      for (let i = 0; i < rankedMembers.length; i++) {
        const { member, score } = rankedMembers[i];
        const rank = offset + i + 1;

        try {
          const entryDetails = await this.getEntryDetails(member);
          if (entryDetails) {
            entries.push({
              ...entryDetails,
              rank,
              score: options.includeScores !== false ? score : entryDetails.score,
            });
          }
        } catch (detailError) {
          logger.warn('Failed to get entry details', { member, error: detailError });
          // Continue with other entries
        }
      }

      const hasMore = offset + limit < totalCount;

      logger.debug('Daily leaderboard retrieved', {
        date,
        entriesReturned: entries.length,
        totalCount,
        hasMore,
        limit,
        offset,
      });

      return {
        entries,
        totalCount,
        hasMore,
      };
    } catch (error) {
      logger.error('Failed to get daily leaderboard', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to get daily leaderboard for ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get puzzle-specific leaderboard
   */
  public async getPuzzleLeaderboard(
    puzzleId: string,
    limit: number = 10,
    offset: number = 0,
    options: LeaderboardQueryOptions = {}
  ): Promise<RankingResult> {
    try {
      const puzzleKey = `${this.PUZZLE_LEADERBOARD_PREFIX}:${puzzleId}`;

      const totalCount = await this.getLeaderboardSize(puzzleKey);

      if (totalCount === 0) {
        return {
          entries: [],
          totalCount: 0,
          hasMore: false,
        };
      }

      const rankedMembers = await redisClient.zRangeWithScores(
        puzzleKey,
        offset,
        offset + limit - 1
      );

      const entries: LeaderboardEntry[] = [];

      for (let i = 0; i < rankedMembers.length; i++) {
        const { member, score } = rankedMembers[i];
        const rank = offset + i + 1;

        try {
          const entryDetails = await this.getEntryDetails(member);
          if (entryDetails) {
            entries.push({
              ...entryDetails,
              rank,
              score: options.includeScores !== false ? score : entryDetails.score,
            });
          }
        } catch (detailError) {
          logger.warn('Failed to get entry details', { member, error: detailError });
        }
      }

      const hasMore = offset + limit < totalCount;

      logger.debug('Puzzle leaderboard retrieved', {
        puzzleId,
        entriesReturned: entries.length,
        totalCount,
        hasMore,
      });

      return {
        entries,
        totalCount,
        hasMore,
      };
    } catch (error) {
      logger.error('Failed to get puzzle leaderboard', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to get puzzle leaderboard for ${puzzleId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get user's rank in daily leaderboard
   */
  public async getUserDailyRank(
    userId: string,
    puzzleId: string,
    date: string
  ): Promise<number | null> {
    try {
      const dailyKey = `${this.DAILY_LEADERBOARD_PREFIX}:${date}`;
      const memberKey = `${userId}:${puzzleId}`;

      // Get user's rank (Redis returns 0-based rank, we want 1-based)
      const rank = await this.getUserRankInSet(dailyKey, memberKey);

      logger.debug('User daily rank retrieved', {
        userId,
        puzzleId,
        date,
        rank,
      });

      return rank;
    } catch (error) {
      logger.error('Failed to get user daily rank', {
        userId,
        puzzleId,
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get leaderboard statistics
   */
  public async getLeaderboardStats(date?: string): Promise<LeaderboardStats> {
    try {
      const statsKey = date
        ? `${this.STATS_KEY_PREFIX}:${date}`
        : `${this.STATS_KEY_PREFIX}:global`;

      const cachedStats = await redisClient.get(statsKey);

      if (cachedStats) {
        return JSON.parse(cachedStats);
      }

      // Calculate stats
      const stats = await this.calculateLeaderboardStats(date);

      // Cache stats for 1 hour
      await redisClient.set(statsKey, JSON.stringify(stats), { ttl: 3600 });

      return stats;
    } catch (error) {
      logger.error('Failed to get leaderboard stats', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return default stats on error
      return {
        totalEntries: 0,
        entriesByDifficulty: {
          Easy: 0,
          Medium: 0,
          Hard: 0,
        },
        highestScore: 0,
        lowestScore: 0,
        averageScore: 0,
      };
    }
  }

  /**
   * Remove entries older than specified days
   */
  public async cleanupOldEntries(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      // Get all daily leaderboard keys
      const dailyKeys = await this.getDailyLeaderboardKeys();

      for (const key of dailyKeys) {
        const dateMatch = key.match(/daily:(.+)$/);
        if (!dateMatch) continue;

        const dateStr = dateMatch[1];
        const leaderboardDate = new Date(dateStr);

        if (leaderboardDate < cutoffDate) {
          // Delete the entire daily leaderboard
          const deleted = await this.deleteDailyLeaderboard(dateStr);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      // Invalidate stats cache
      await this.invalidateStatsCache();

      logger.info('Leaderboard cleanup completed', {
        retentionDays,
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old leaderboard entries', {
        retentionDays,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to cleanup old leaderboard entries: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Store detailed entry information
   */
  private async storeEntryDetails(
    entry: LeaderboardEntry,
    options: RedisOperationOptions = {}
  ): Promise<void> {
    try {
      const memberKey = `${entry.userId}:${entry.puzzleId}`;
      const detailsKey = `leaderboard:details:${memberKey}`;

      const entryData = {
        userId: entry.userId,
        username: entry.username,
        puzzleId: entry.puzzleId,
        difficulty: entry.difficulty,
        score: entry.score,
        time: entry.time,
        hints: entry.hints,
        date: entry.date,
        submittedAt: entry.submittedAt,
      };

      await redisClient.set(detailsKey, JSON.stringify(entryData), {
        ttl: this.DEFAULT_TTL,
        ...options,
      });
    } catch (error) {
      logger.warn('Failed to store entry details', {
        userId: entry.userId,
        puzzleId: entry.puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - details storage is not critical for ranking
    }
  }

  /**
   * Get detailed entry information
   */
  private async getEntryDetails(memberKey: string): Promise<LeaderboardEntry | null> {
    try {
      const detailsKey = `leaderboard:details:${memberKey}`;
      const entryData = await redisClient.get(detailsKey);

      if (!entryData) {
        return null;
      }

      return JSON.parse(entryData);
    } catch (error) {
      logger.warn('Failed to get entry details', {
        memberKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get leaderboard size
   */
  private async getLeaderboardSize(key: string): Promise<number> {
    try {
      // Use zCard to get the number of elements in the sorted set
      return await redisClient.zCard(key);
    } catch (error) {
      logger.warn('Failed to get leaderboard size', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get user's rank in a sorted set
   */
  private async getUserRankInSet(setKey: string, memberKey: string): Promise<number | null> {
    try {
      // Note: Redis ZREVRANK returns 0-based rank for descending order
      // We need to implement this using available Devvit Redis commands
      const allMembers = await redisClient.zRangeWithScores(setKey, 0, -1);

      // Sort by score descending (highest first)
      allMembers.sort((a, b) => b.score - a.score);

      // Find the member's position
      const memberIndex = allMembers.findIndex((m) => m.member === memberKey);

      return memberIndex >= 0 ? memberIndex + 1 : null;
    } catch (error) {
      logger.warn('Failed to get user rank', {
        setKey,
        memberKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Update leaderboard statistics
   */
  private async updateLeaderboardStats(entry: LeaderboardEntry): Promise<void> {
    try {
      // This is a simplified stats update - in production you might want more sophisticated aggregation
      const statsKey = `${this.STATS_KEY_PREFIX}:${entry.date}`;

      // Invalidate cached stats to force recalculation
      await redisClient.del(statsKey);

      // Also invalidate global stats
      await redisClient.del(`${this.STATS_KEY_PREFIX}:global`);
    } catch (error) {
      logger.warn('Failed to update leaderboard stats', {
        date: entry.date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - stats update is not critical
    }
  }

  /**
   * Calculate leaderboard statistics
   */
  private async calculateLeaderboardStats(date?: string): Promise<LeaderboardStats> {
    try {
      const leaderboardKey = date
        ? `${this.DAILY_LEADERBOARD_PREFIX}:${date}`
        : this.GLOBAL_LEADERBOARD_KEY;

      const allEntries = await redisClient.zRangeWithScores(leaderboardKey, 0, -1);

      const stats: LeaderboardStats = {
        totalEntries: allEntries.length,
        entriesByDifficulty: {
          Easy: 0,
          Medium: 0,
          Hard: 0,
        },
        highestScore: 0,
        lowestScore: 0,
        averageScore: 0,
        lastUpdated: new Date(),
      };

      if (allEntries.length === 0) {
        return stats;
      }

      let totalScore = 0;
      let highestScore = -Infinity;
      let lowestScore = Infinity;

      for (const { member, score } of allEntries) {
        totalScore += score;
        highestScore = Math.max(highestScore, score);
        lowestScore = Math.min(lowestScore, score);

        // Get difficulty from entry details
        try {
          const details = await this.getEntryDetails(member);
          if (details && details.difficulty in stats.entriesByDifficulty) {
            stats.entriesByDifficulty[details.difficulty as Difficulty]++;
          }
        } catch (detailError) {
          // Continue without difficulty stats for this entry
        }
      }

      stats.highestScore = highestScore;
      stats.lowestScore = lowestScore;
      stats.averageScore = Math.round(totalScore / allEntries.length);

      return stats;
    } catch (error) {
      logger.error('Failed to calculate leaderboard stats', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get daily leaderboard keys (for cleanup)
   */
  private async getDailyLeaderboardKeys(): Promise<string[]> {
    // This is a simplified implementation - in production you might maintain an index
    // For now, return empty array as cleanup will be handled by TTL
    return [];
  }

  /**
   * Delete a daily leaderboard
   */
  private async deleteDailyLeaderboard(date: string): Promise<boolean> {
    try {
      const dailyKey = `${this.DAILY_LEADERBOARD_PREFIX}:${date}`;
      const deletedCount = await redisClient.del(dailyKey);

      // Also clean up associated detail entries
      // This is simplified - in production you'd want to track these more efficiently

      return deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete daily leaderboard', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Invalidate stats cache
   */
  private async invalidateStatsCache(): Promise<void> {
    try {
      // Delete all stats cache keys
      const keysToDelete = [
        `${this.STATS_KEY_PREFIX}:global`,
        // Add more specific date keys if needed
      ];

      await redisClient.del(keysToDelete);
    } catch (error) {
      logger.warn('Failed to invalidate stats cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get Redis zCard equivalent
   */
  private async zCard(key: string): Promise<number> {
    try {
      // Get all members and count them
      const members = await redisClient.zRange(key, 0, -1);
      return members.length;
    } catch (error) {
      logger.warn('Failed to get sorted set cardinality', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }
}

export default LeaderboardRepository;
