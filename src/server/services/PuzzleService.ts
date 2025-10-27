/**
 * Puzzle Service for ReflectIQ
 * Handles puzzle retrieval, caching, and daily puzzle management
 * Enhanced with comprehensive error handling and Redis retry logic
 */

import { redis } from '@devvit/web/server';
import { Puzzle, DailyPuzzleSet, Difficulty } from '../../shared/types/puzzle.js';
import { GetPuzzleResponse } from '../../shared/types/api.js';
import { PuzzleGenerator } from '../../shared/puzzle/PuzzleGenerator.js';
import {
  withRedisRetry,
  createErrorResponse,
  createSuccessResponse,
  ReflectIQErrorType,
} from '../utils/errorHandler.js';
import { createBackupPuzzle } from '../utils/backupPuzzles.js';

export class PuzzleService {
  private static instance: PuzzleService;
  private puzzleGenerator: PuzzleGenerator;

  private constructor() {
    this.puzzleGenerator = PuzzleGenerator.getInstance();
  }

  public static getInstance(): PuzzleService {
    if (!PuzzleService.instance) {
      PuzzleService.instance = new PuzzleService();
    }
    return PuzzleService.instance;
  }

  /**
   * Get current day's puzzle by difficulty with comprehensive error handling
   */
  public async getCurrentPuzzle(difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      const today = new Date().toISOString().split('T')[0] as string;

      // Validate difficulty parameter
      if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return createErrorResponse('VALIDATION_ERROR', `Invalid difficulty: ${difficulty}`);
      }

      const puzzleSet = await this.getDailyPuzzleSet(today);

      if (!puzzleSet) {
        // Generate puzzles if they don't exist
        try {
          const newPuzzleSet = await this.generateDailyPuzzles(today);
          const puzzle = this.getPuzzleFromSet(newPuzzleSet, difficulty);
          return createSuccessResponse(puzzle);
        } catch (generationError) {
          console.error('Failed to generate puzzles, using backup:', generationError);

          // Fallback to backup puzzle
          try {
            const backupPuzzle = createBackupPuzzle(difficulty, today);
            console.log(`Using backup puzzle for ${difficulty} difficulty`);
            return createSuccessResponse(backupPuzzle);
          } catch (backupError) {
            console.error('Backup puzzle creation also failed:', backupError);
            return createErrorResponse(
              'GENERATION_FAILED',
              'Both puzzle generation and backup failed'
            );
          }
        }
      }

      const puzzle = this.getPuzzleFromSet(puzzleSet, difficulty);
      return createSuccessResponse(puzzle);
    } catch (error) {
      console.error('Error getting current puzzle:', error);

      // Determine specific error type
      let errorType: ReflectIQErrorType = 'INTERNAL_ERROR';
      if (error instanceof Error) {
        if (error.message.includes('Redis') || error.message.includes('redis')) {
          errorType = 'REDIS_ERROR';
        } else if (error.message.includes('not found')) {
          errorType = 'PUZZLE_NOT_FOUND';
        }
      }

      return createErrorResponse(
        errorType,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get daily puzzle set from Redis cache with retry logic
   */
  private async getDailyPuzzleSet(date: string): Promise<DailyPuzzleSet | null> {
    const key = `reflectiq:puzzles:${date}`;

    return withRedisRetry(
      async () => {
        const puzzleData = await redis.get(key);
        if (!puzzleData) {
          return null;
        }
        return JSON.parse(puzzleData) as DailyPuzzleSet;
      },
      async () => {
        // Fallback: return null to trigger puzzle generation
        console.log('Redis fallback: returning null to trigger puzzle generation');
        return null;
      }
    );
  }

  /**
   * Store daily puzzle set in Redis cache with retry logic
   */
  private async storeDailyPuzzleSet(puzzleSet: DailyPuzzleSet): Promise<void> {
    const key = `reflectiq:puzzles:${puzzleSet.date}`;
    const puzzleData = JSON.stringify(puzzleSet);

    await withRedisRetry(
      async () => {
        // Store with 48-hour expiration (allows for timezone differences)
        await redis.set(key, puzzleData);
        await redis.expire(key, 48 * 60 * 60);
        console.log(`Stored daily puzzle set for ${puzzleSet.date}`);
      },
      async () => {
        // Fallback: log warning but don't fail the operation
        console.warn(`Failed to store puzzle set for ${puzzleSet.date} - continuing without cache`);
      }
    );
  }

  /**
   * Generate and cache daily puzzles
   */
  public async generateDailyPuzzles(date: string): Promise<DailyPuzzleSet> {
    try {
      console.log(`Generating daily puzzles for ${date}`);

      const puzzleSet = await this.puzzleGenerator.generateDailyPuzzles(date);

      // Store in Redis cache
      await this.storeDailyPuzzleSet(puzzleSet);

      console.log(`Successfully generated and cached puzzles for ${date}`);
      return puzzleSet;
    } catch (error) {
      console.error('Error generating daily puzzles:', error);
      throw error;
    }
  }

  /**
   * Get specific puzzle from puzzle set by difficulty
   */
  private getPuzzleFromSet(puzzleSet: DailyPuzzleSet, difficulty: Difficulty): Puzzle {
    switch (difficulty) {
      case 'Easy':
        return puzzleSet.puzzles.easy;
      case 'Medium':
        return puzzleSet.puzzles.medium;
      case 'Hard':
        return puzzleSet.puzzles.hard;
      default:
        throw new Error(`Invalid difficulty: ${difficulty}`);
    }
  }

  /**
   * Check if puzzles exist for a given date
   */
  public async puzzlesExistForDate(date: string): Promise<boolean> {
    try {
      const puzzleSet = await this.getDailyPuzzleSet(date);
      return puzzleSet !== null;
    } catch (error) {
      console.error('Error checking puzzle existence:', error);
      return false;
    }
  }

  /**
   * Get puzzle statistics for monitoring
   */
  public async getPuzzleStats(date: string): Promise<{
    exists: boolean;
    difficulties: string[];
    generatedAt?: Date;
    status?: string;
  }> {
    try {
      const puzzleSet = await this.getDailyPuzzleSet(date);

      if (!puzzleSet) {
        return {
          exists: false,
          difficulties: [],
        };
      }

      const difficulties = [];
      if (puzzleSet.puzzles.easy) difficulties.push('Easy');
      if (puzzleSet.puzzles.medium) difficulties.push('Medium');
      if (puzzleSet.puzzles.hard) difficulties.push('Hard');

      return {
        exists: true,
        difficulties,
        generatedAt: puzzleSet.createdAt,
        status: puzzleSet.status,
      };
    } catch (error) {
      console.error('Error getting puzzle stats:', error);
      return {
        exists: false,
        difficulties: [],
      };
    }
  }

  /**
   * Cleanup old puzzles (for maintenance)
   * Note: Devvit Redis doesn't support keys() command, so we'll clean up specific known keys
   */
  public async cleanupOldPuzzles(daysToKeep: number = 7): Promise<number> {
    try {
      let cleanedCount = 0;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Clean up known old puzzle keys by date
      for (let i = daysToKeep; i <= 30; i++) {
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - i);
        const dateStr = oldDate.toISOString().split('T')[0];
        const key = `reflectiq:puzzles:${dateStr}`;

        try {
          const exists = await redis.exists(key);
          if (exists) {
            await redis.del(key);
            cleanedCount++;
            console.log(`Cleaned up old puzzle: ${key}`);
          }
        } catch (error) {
          console.warn(`Failed to cleanup key ${key}:`, error);
        }
      }

      console.log(`Cleaned up ${cleanedCount} old puzzle sets`);
      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up old puzzles:', error);
      return 0;
    }
  }
}
