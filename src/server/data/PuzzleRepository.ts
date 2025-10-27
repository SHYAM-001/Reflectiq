/**
 * Puzzle Data Repository for ReflectIQ
 * Handles CRUD operations for puzzles using Redis with proper error handling
 * Following Devvit Web best practices for data persistence
 */

import { redisClient, RedisOperationOptions } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';
import { Puzzle, DailyPuzzleSet, Difficulty } from '../../shared/types/puzzle.js';

export interface PuzzleQueryOptions {
  includeHints?: boolean;
  includeSolution?: boolean;
  useCache?: boolean;
}

export interface PuzzleStats {
  totalPuzzles: number;
  puzzlesByDifficulty: Record<Difficulty, number>;
  oldestPuzzle?: string;
  newestPuzzle?: string;
}

/**
 * Repository for puzzle data operations
 */
export class PuzzleRepository {
  private static instance: PuzzleRepository;
  private readonly PUZZLE_KEY_PREFIX = 'puzzles';
  private readonly DAILY_SET_KEY_PREFIX = 'daily_sets';
  private readonly STATS_KEY_PREFIX = 'puzzle_stats';
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days

  private constructor() {}

  public static getInstance(): PuzzleRepository {
    if (!PuzzleRepository.instance) {
      PuzzleRepository.instance = new PuzzleRepository();
    }
    return PuzzleRepository.instance;
  }

  /**
   * Store a single puzzle
   */
  public async storePuzzle(puzzle: Puzzle, options: RedisOperationOptions = {}): Promise<void> {
    try {
      const puzzleKey = `${this.PUZZLE_KEY_PREFIX}:${puzzle.id}`;
      const puzzleData = JSON.stringify(puzzle);

      await redisClient.set(puzzleKey, puzzleData, {
        ttl: this.DEFAULT_TTL,
        ...options,
      });

      // Update puzzle index for quick lookups
      await this.updatePuzzleIndex(puzzle);

      logger.debug('Puzzle stored successfully', {
        puzzleId: puzzle.id,
        difficulty: puzzle.difficulty,
        gridSize: puzzle.gridSize,
      });
    } catch (error) {
      logger.error('Failed to store puzzle', {
        puzzleId: puzzle.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to store puzzle ${puzzle.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieve a single puzzle by ID
   */
  public async getPuzzle(
    puzzleId: string,
    options: PuzzleQueryOptions = {}
  ): Promise<Puzzle | null> {
    try {
      const puzzleKey = `${this.PUZZLE_KEY_PREFIX}:${puzzleId}`;
      const puzzleData = await redisClient.get(puzzleKey);

      if (!puzzleData) {
        logger.debug('Puzzle not found', { puzzleId });
        return null;
      }

      const puzzle: Puzzle = JSON.parse(puzzleData);

      // Filter sensitive data based on options
      if (!options.includeHints) {
        puzzle.hints = [];
      }

      if (!options.includeSolution) {
        delete puzzle.solution;
      }

      logger.debug('Puzzle retrieved successfully', {
        puzzleId,
        difficulty: puzzle.difficulty,
        includeHints: options.includeHints,
        includeSolution: options.includeSolution,
      });

      return puzzle;
    } catch (error) {
      logger.error('Failed to retrieve puzzle', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to retrieve puzzle ${puzzleId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Store a daily puzzle set
   */
  public async storeDailyPuzzleSet(
    date: string,
    puzzleSet: DailyPuzzleSet,
    options: RedisOperationOptions = {}
  ): Promise<void> {
    try {
      const setKey = `${this.DAILY_SET_KEY_PREFIX}:${date}`;
      const setData = JSON.stringify(puzzleSet);

      await redisClient.set(setKey, setData, {
        ttl: this.DEFAULT_TTL,
        ...options,
      });

      // Store individual puzzles
      const puzzles = [puzzleSet.puzzles.easy, puzzleSet.puzzles.medium, puzzleSet.puzzles.hard];

      for (const puzzle of puzzles) {
        if (puzzle) {
          await this.storePuzzle(puzzle, options);
        }
      }

      // Update daily set index
      await this.updateDailySetIndex(date, puzzleSet);

      logger.info('Daily puzzle set stored successfully', {
        date,
        puzzleCount: puzzles.filter((p) => p !== null).length,
        generatedAt: puzzleSet.generatedAt,
      });
    } catch (error) {
      logger.error('Failed to store daily puzzle set', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to store daily puzzle set for ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieve a daily puzzle set
   */
  public async getDailyPuzzleSet(
    date: string,
    options: PuzzleQueryOptions = {}
  ): Promise<DailyPuzzleSet | null> {
    try {
      const setKey = `${this.DAILY_SET_KEY_PREFIX}:${date}`;
      const setData = await redisClient.get(setKey);

      if (!setData) {
        logger.debug('Daily puzzle set not found', { date });
        return null;
      }

      const puzzleSet: DailyPuzzleSet = JSON.parse(setData);

      // Filter sensitive data from individual puzzles
      if (!options.includeHints || !options.includeSolution) {
        const difficulties: (keyof typeof puzzleSet.puzzles)[] = ['easy', 'medium', 'hard'];

        for (const difficulty of difficulties) {
          const puzzle = puzzleSet.puzzles[difficulty];
          if (puzzle) {
            if (!options.includeHints) {
              puzzle.hints = [];
            }
            if (!options.includeSolution) {
              delete puzzle.solution;
            }
          }
        }
      }

      logger.debug('Daily puzzle set retrieved successfully', {
        date,
        puzzleCount: Object.values(puzzleSet.puzzles).filter((p) => p !== null).length,
      });

      return puzzleSet;
    } catch (error) {
      logger.error('Failed to retrieve daily puzzle set', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to retrieve daily puzzle set for ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get puzzle by date and difficulty
   */
  public async getPuzzleByDateAndDifficulty(
    date: string,
    difficulty: Difficulty,
    options: PuzzleQueryOptions = {}
  ): Promise<Puzzle | null> {
    try {
      const puzzleSet = await this.getDailyPuzzleSet(date, options);

      if (!puzzleSet) {
        return null;
      }

      const difficultyKey = difficulty.toLowerCase() as keyof typeof puzzleSet.puzzles;
      return puzzleSet.puzzles[difficultyKey] || null;
    } catch (error) {
      logger.error('Failed to retrieve puzzle by date and difficulty', {
        date,
        difficulty,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to retrieve ${difficulty} puzzle for ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if puzzles exist for a specific date
   */
  public async puzzlesExistForDate(date: string): Promise<boolean> {
    try {
      const setKey = `${this.DAILY_SET_KEY_PREFIX}:${date}`;
      return await redisClient.exists(setKey);
    } catch (error) {
      logger.error('Failed to check puzzle existence', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get puzzle statistics
   */
  public async getPuzzleStats(): Promise<PuzzleStats> {
    try {
      const statsKey = `${this.STATS_KEY_PREFIX}:global`;
      const statsData = await redisClient.get(statsKey);

      if (statsData) {
        return JSON.parse(statsData);
      }

      // Calculate stats if not cached
      const stats = await this.calculatePuzzleStats();

      // Cache stats for 1 hour
      await redisClient.set(statsKey, JSON.stringify(stats), { ttl: 3600 });

      return stats;
    } catch (error) {
      logger.error('Failed to get puzzle stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return default stats on error
      return {
        totalPuzzles: 0,
        puzzlesByDifficulty: {
          Easy: 0,
          Medium: 0,
          Hard: 0,
        },
      };
    }
  }

  /**
   * Delete puzzles older than specified days
   */
  public async cleanupOldPuzzles(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;
      const batchSize = 10;

      // Get list of daily sets to check
      const dailySets = await this.getDailySetKeys();

      for (let i = 0; i < dailySets.length; i += batchSize) {
        const batch = dailySets.slice(i, i + batchSize);

        for (const setKey of batch) {
          const dateMatch = setKey.match(/daily_sets:(.+)$/);
          if (!dateMatch) continue;

          const dateStr = dateMatch[1];
          const puzzleDate = new Date(dateStr);

          if (puzzleDate < cutoffDate) {
            // Delete the daily set and its individual puzzles
            const deleted = await this.deleteDailyPuzzleSet(dateStr);
            if (deleted) {
              deletedCount++;
            }
          }
        }

        // Small delay between batches to avoid overwhelming Redis
        if (i + batchSize < dailySets.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Update stats cache
      await this.invalidateStatsCache();

      logger.info('Puzzle cleanup completed', {
        retentionDays,
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old puzzles', {
        retentionDays,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to cleanup old puzzles: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a daily puzzle set and its individual puzzles
   */
  private async deleteDailyPuzzleSet(date: string): Promise<boolean> {
    try {
      // Get the puzzle set first to find individual puzzle IDs
      const puzzleSet = await this.getDailyPuzzleSet(date, {
        includeHints: false,
        includeSolution: false,
      });

      if (!puzzleSet) {
        return false;
      }

      // Collect all keys to delete
      const keysToDelete: string[] = [`${this.DAILY_SET_KEY_PREFIX}:${date}`];

      // Add individual puzzle keys
      const puzzles = [puzzleSet.puzzles.easy, puzzleSet.puzzles.medium, puzzleSet.puzzles.hard];
      for (const puzzle of puzzles) {
        if (puzzle) {
          keysToDelete.push(`${this.PUZZLE_KEY_PREFIX}:${puzzle.id}`);
        }
      }

      // Delete all keys
      const deletedCount = await redisClient.del(keysToDelete);

      logger.debug('Daily puzzle set deleted', {
        date,
        keysDeleted: deletedCount,
        totalKeys: keysToDelete.length,
      });

      return deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete daily puzzle set', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Update puzzle index for quick lookups
   */
  private async updatePuzzleIndex(puzzle: Puzzle): Promise<void> {
    try {
      const indexKey = `${this.PUZZLE_KEY_PREFIX}:index`;
      const indexData = {
        id: puzzle.id,
        difficulty: puzzle.difficulty,
        createdAt: puzzle.createdAt,
        gridSize: puzzle.gridSize,
      };

      await redisClient.hSet(indexKey, puzzle.id, JSON.stringify(indexData));
    } catch (error) {
      logger.warn('Failed to update puzzle index', {
        puzzleId: puzzle.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - index update is not critical
    }
  }

  /**
   * Update daily set index
   */
  private async updateDailySetIndex(date: string, puzzleSet: DailyPuzzleSet): Promise<void> {
    try {
      const indexKey = `${this.DAILY_SET_KEY_PREFIX}:index`;
      const indexData = {
        date,
        generatedAt: puzzleSet.generatedAt,
        puzzleCount: Object.values(puzzleSet.puzzles).filter((p) => p !== null).length,
      };

      await redisClient.hSet(indexKey, date, JSON.stringify(indexData));
    } catch (error) {
      logger.warn('Failed to update daily set index', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - index update is not critical
    }
  }

  /**
   * Calculate puzzle statistics
   */
  private async calculatePuzzleStats(): Promise<PuzzleStats> {
    try {
      const indexKey = `${this.PUZZLE_KEY_PREFIX}:index`;
      const indexData = await redisClient.hGetAll(indexKey);

      const stats: PuzzleStats = {
        totalPuzzles: 0,
        puzzlesByDifficulty: {
          Easy: 0,
          Medium: 0,
          Hard: 0,
        },
      };

      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      for (const [puzzleId, dataStr] of Object.entries(indexData)) {
        try {
          const data = JSON.parse(dataStr);
          stats.totalPuzzles++;

          if (data.difficulty in stats.puzzlesByDifficulty) {
            stats.puzzlesByDifficulty[data.difficulty as Difficulty]++;
          }

          const createdAt = new Date(data.createdAt);
          if (!oldestDate || createdAt < oldestDate) {
            oldestDate = createdAt;
            stats.oldestPuzzle = puzzleId;
          }
          if (!newestDate || createdAt > newestDate) {
            newestDate = createdAt;
            stats.newestPuzzle = puzzleId;
          }
        } catch (parseError) {
          logger.warn('Failed to parse puzzle index data', { puzzleId, dataStr });
        }
      }

      return stats;
    } catch (error) {
      logger.error('Failed to calculate puzzle stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get daily set keys (for cleanup operations)
   */
  private async getDailySetKeys(): Promise<string[]> {
    try {
      const indexKey = `${this.DAILY_SET_KEY_PREFIX}:index`;
      const indexData = await redisClient.hGetAll(indexKey);

      return Object.keys(indexData).map((date) => `${this.DAILY_SET_KEY_PREFIX}:${date}`);
    } catch (error) {
      logger.warn('Failed to get daily set keys from index, using fallback method', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback: return empty array (cleanup will be less efficient but won't fail)
      return [];
    }
  }

  /**
   * Invalidate stats cache
   */
  private async invalidateStatsCache(): Promise<void> {
    try {
      const statsKey = `${this.STATS_KEY_PREFIX}:global`;
      await redisClient.del(statsKey);
    } catch (error) {
      logger.warn('Failed to invalidate stats cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default PuzzleRepository;
