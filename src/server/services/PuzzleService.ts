/**
 * Puzzle Service for ReflectIQ
 * Handles puzzle retrieval, caching, and daily puzzle management
 * Enhanced with comprehensive error handling and Redis retry logic
 */

import { redis } from '@devvit/web/server';
import { Puzzle, DailyPuzzleSet, Difficulty } from '../../shared/types/puzzle.js';
import { GetPuzzleResponse } from '../../shared/types/api.js';
import { PuzzleGenerator } from '../../shared/puzzle/PuzzleGenerator.js';
import { EnhancedPuzzleEngineImpl } from '../../shared/puzzle/EnhancedPuzzleEngine.js';
import { FeatureFlagService } from './FeatureFlagService.js';
import {
  withRedisRetry,
  withRedisCircuitBreaker,
  withPuzzleGenerationFallback,
  createErrorResponse,
  createSuccessResponse,
  ReflectIQErrorType,
  errorMonitor,
} from '../utils/errorHandler.js';
import { createBackupPuzzle } from '../utils/backupPuzzles.js';
import { cacheManager, initializeCacheManager } from './CacheManager.js';

export class PuzzleService {
  private static instance: PuzzleService;
  private puzzleGenerator: PuzzleGenerator;
  private enhancedEngine: EnhancedPuzzleEngineImpl;
  private featureFlagService: FeatureFlagService;

  private constructor() {
    this.puzzleGenerator = PuzzleGenerator.getInstance();
    this.enhancedEngine = EnhancedPuzzleEngineImpl.getInstance();
    this.featureFlagService = FeatureFlagService.getInstance();

    // Initialize cache manager for performance optimization
    initializeCacheManager().catch((error) => {
      console.warn('Failed to initialize cache manager:', error);
    });
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

    return withRedisCircuitBreaker(
      async () => {
        const puzzleData = await redis.get(key);
        if (!puzzleData) {
          return null;
        }
        return JSON.parse(puzzleData) as DailyPuzzleSet;
      },
      async () => {
        // Fallback: return null to trigger puzzle generation
        console.warn(
          `Redis unavailable for puzzle retrieval, will generate new puzzles for ${date}`
        );
        return null;
      },
      `Get daily puzzle set for ${date}`
    );
  }

  /**
   * Store daily puzzle set in Redis cache with retry logic
   */
  private async storeDailyPuzzleSet(puzzleSet: DailyPuzzleSet): Promise<void> {
    const key = `reflectiq:puzzles:${puzzleSet.date}`;
    const puzzleData = JSON.stringify(puzzleSet);

    await withRedisCircuitBreaker(
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
   * Generate and cache daily puzzles with enhanced error handling and fallbacks
   * Integrates with enhanced generation system and feature flags
   */
  public async generateDailyPuzzles(date: string): Promise<DailyPuzzleSet> {
    const startTime = Date.now();

    // Check if enhanced generation should be used
    const useEnhanced = await this.featureFlagService.shouldUseEnhancedGeneration(date);
    const algorithm = useEnhanced ? 'enhanced' : 'legacy';

    console.log(`Generating daily puzzles for ${date} using ${algorithm} algorithm`);

    return withPuzzleGenerationFallback(
      // Primary generation attempt
      async () => {
        let puzzleSet: DailyPuzzleSet;

        if (useEnhanced) {
          // Use enhanced generation system
          try {
            puzzleSet = await this.generateWithEnhancedSystem(date);
            console.log(`✓ Enhanced generation successful for ${date}`);
            await this.featureFlagService.recordGenerationMetrics(
              'enhanced',
              Date.now() - startTime,
              true
            );
          } catch (enhancedError) {
            console.warn(
              `Enhanced generation failed for ${date}, falling back to legacy:`,
              enhancedError
            );

            // Check if fallback is enabled
            const shouldFallback = await this.featureFlagService.shouldFallbackToLegacy();
            if (shouldFallback) {
              puzzleSet = await this.puzzleGenerator.generateDailyPuzzles(date);
              await this.featureFlagService.recordGenerationMetrics(
                'legacy',
                Date.now() - startTime,
                true
              );
            } else {
              throw enhancedError;
            }
          }
        } else {
          // Use legacy generation system
          puzzleSet = await this.puzzleGenerator.generateDailyPuzzles(date);
          await this.featureFlagService.recordGenerationMetrics(
            'legacy',
            Date.now() - startTime,
            true
          );
        }

        // Store in Redis cache with circuit breaker protection
        await withRedisCircuitBreaker(
          () => this.storeDailyPuzzleSet(puzzleSet),
          undefined,
          `Store daily puzzles for ${date}`
        );

        console.log(`Successfully generated and cached puzzles for ${date}`);
        return puzzleSet;
      },
      // Backup generation using templates
      async () => {
        console.warn(`Primary puzzle generation failed for ${date}, using backup templates`);

        const backupPuzzleSet: DailyPuzzleSet = {
          date,
          puzzles: {
            easy: createBackupPuzzle('Easy', date),
            medium: createBackupPuzzle('Medium', date),
            hard: createBackupPuzzle('Hard', date),
          },
          status: 'active',
        };

        // Try to store backup puzzles, but don't fail if Redis is down
        try {
          await withRedisCircuitBreaker(
            () => this.storeDailyPuzzleSet(backupPuzzleSet),
            undefined,
            `Store backup puzzles for ${date}`
          );
          console.log(`Successfully stored backup puzzles for ${date}`);
        } catch (error) {
          console.warn(
            `Failed to store backup puzzles in Redis for ${date}, continuing with in-memory puzzles:`,
            error
          );
        }

        errorMonitor.recordError(
          'GENERATION_FAILED',
          `Used backup puzzles for ${date}`,
          'generateDailyPuzzles'
        );

        await this.featureFlagService.recordGenerationMetrics(
          algorithm,
          Date.now() - startTime,
          false
        );
        return backupPuzzleSet;
      },
      `Daily puzzle generation for ${date}`
    );
  }

  /**
   * Generate puzzles using the enhanced guaranteed generation system
   */
  private async generateWithEnhancedSystem(date: string): Promise<DailyPuzzleSet> {
    const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
    const puzzles: any = {};

    for (const difficulty of difficulties) {
      try {
        const puzzle = await this.enhancedEngine.generateGuaranteedPuzzle(difficulty, date);
        puzzles[difficulty.toLowerCase()] = puzzle;
        console.log(`✓ Enhanced ${difficulty} puzzle generated: ${puzzle.id}`);
      } catch (error) {
        console.error(`Failed to generate enhanced ${difficulty} puzzle:`, error);
        throw new Error(`Enhanced generation failed for ${difficulty} difficulty`);
      }
    }

    return {
      date,
      puzzles,
      status: 'active',
    };
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
