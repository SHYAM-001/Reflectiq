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
import { puzzleMetrics } from '../utils/puzzleMetrics.js';
import { performanceMonitor } from './PerformanceMonitoringService.js';

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
   * Get puzzle by date and difficulty (for legacy posts)
   * Requirement 7.2: Implement fallback to date-based daily puzzle retrieval
   * Requirement 7.3: Add logging when legacy fallback is triggered
   * Requirement 7.4: Ensure full functionality for pre-migration posts
   * Requirement 7.5: Maintain full functionality for posts created before feature implementation
   */
  public async getPuzzleByDate(date: string, difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      // Validate difficulty parameter
      if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return createErrorResponse('VALIDATION_ERROR', `Invalid difficulty: ${difficulty}`);
      }

      // Requirement 7.3: Add logging when legacy fallback is triggered
      console.log(`🔄 Legacy date-based puzzle retrieval for ${date}, difficulty: ${difficulty}`);

      const puzzleSet = await this.getDailyPuzzleSet(date);

      if (!puzzleSet) {
        // Generate puzzles if they don't exist for the requested date
        try {
          console.log(`🔄 No puzzle set found for ${date}, generating (legacy fallback)`);
          const newPuzzleSet = await this.generateDailyPuzzles(date);
          const puzzle = this.getPuzzleFromSet(newPuzzleSet, difficulty);

          // Requirement 7.3: Add logging when legacy fallback is triggered
          console.log(`✓ Legacy puzzle generated for ${date}, difficulty: ${difficulty}`);

          return createSuccessResponse(puzzle);
        } catch (generationError) {
          console.error(`Failed to generate puzzles for ${date}, using backup:`, generationError);

          // Fallback to backup puzzle
          try {
            const backupPuzzle = createBackupPuzzle(difficulty, date);
            console.log(`🔄 Using backup puzzle for ${difficulty} difficulty (legacy fallback)`);

            // Requirement 7.3: Add logging when legacy fallback is triggered
            errorMonitor.recordError(
              'GENERATION_FAILED',
              `Legacy fallback used backup puzzle for ${date}, ${difficulty}`,
              'getPuzzleByDate'
            );

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

      // Requirement 7.3: Add logging when legacy fallback is triggered
      console.log(`✓ Legacy puzzle retrieved from cache for ${date}, difficulty: ${difficulty}`);

      return createSuccessResponse(puzzle);
    } catch (error) {
      console.error(`Error getting puzzle by date (${date}):`, error);

      // Requirement 7.3: Add logging when legacy fallback is triggered
      errorMonitor.recordError(
        'PUZZLE_RETRIEVAL_ERROR',
        `Legacy date-based puzzle retrieval failed for ${date}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getPuzzleByDate'
      );

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
   * Get current day's puzzle by difficulty with comprehensive error handling
   * Supports legacy posts through date-based daily puzzle retrieval
   * Requirements: 7.2, 7.3, 7.4, 7.5
   */
  public async getCurrentPuzzle(difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      const today = new Date().toISOString().split('T')[0] as string;

      // Validate difficulty parameter
      if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return createErrorResponse('VALIDATION_ERROR', `Invalid difficulty: ${difficulty}`);
      }

      // Requirement 7.3: Add logging when legacy fallback is triggered
      console.log(
        `📅 Retrieving daily puzzle for ${today}, difficulty: ${difficulty} (legacy mode)`
      );

      const puzzleSet = await this.getDailyPuzzleSet(today);

      if (!puzzleSet) {
        // Generate puzzles if they don't exist
        try {
          console.log(
            `🔄 No puzzle set found for ${today}, generating new puzzles (legacy fallback)`
          );
          const newPuzzleSet = await this.generateDailyPuzzles(today);
          const puzzle = this.getPuzzleFromSet(newPuzzleSet, difficulty);

          // Requirement 7.3: Add logging when legacy fallback is triggered
          console.log(
            `✓ Legacy puzzle generated successfully for ${today}, difficulty: ${difficulty}`
          );

          return createSuccessResponse(puzzle);
        } catch (generationError) {
          console.error('Failed to generate puzzles, using backup:', generationError);

          // Fallback to backup puzzle
          try {
            const backupPuzzle = createBackupPuzzle(difficulty, today);
            console.log(`🔄 Using backup puzzle for ${difficulty} difficulty (legacy fallback)`);

            // Requirement 7.3: Add logging when legacy fallback is triggered
            errorMonitor.recordError(
              'GENERATION_FAILED',
              `Legacy fallback used backup puzzle for ${today}, ${difficulty}`,
              'getCurrentPuzzle'
            );

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

      // Requirement 7.3: Add logging when legacy fallback is triggered
      console.log(`✓ Legacy puzzle retrieved from cache for ${today}, difficulty: ${difficulty}`);

      return createSuccessResponse(puzzle);
    } catch (error) {
      console.error('Error getting current puzzle:', error);

      // Requirement 7.3: Add logging when legacy fallback is triggered
      errorMonitor.recordError(
        'PUZZLE_RETRIEVAL_ERROR',
        `Legacy puzzle retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getCurrentPuzzle'
      );

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

  /**
   * Get puzzle metrics for monitoring
   * Requirement 9.5: Implement metrics tracking for success rates and latency
   */
  public getMetrics() {
    return puzzleMetrics.getAggregatedMetrics();
  }

  /**
   * Get metrics summary for logging
   * Requirement 9.5: Implement metrics tracking for success rates and latency
   */
  public logMetricsSummary(): void {
    console.log(puzzleMetrics.getMetricsSummary());
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  public resetMetrics(): void {
    puzzleMetrics.reset();
  }

  /**
   * Get puzzle by unique ID (for post-specific puzzles)
   * Enhanced with proper error handling, circuit breaker, and fallback to generation
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.3, 10.4
   */
  public async getPuzzleById(puzzleId: string): Promise<Puzzle | null> {
    const key = `reflectiq:puzzle:${puzzleId}`;
    const startTime = Date.now();

    try {
      console.log(`Attempting to retrieve puzzle by ID: ${puzzleId}`);

      // Use circuit breaker for Redis operations
      const puzzle = await withRedisCircuitBreaker(
        async () => {
          const retrieveStartTime = Date.now();
          const puzzleData = await redis.get(key);
          const retrieveLatency = Date.now() - retrieveStartTime;

          // Requirement 10.4: Track Redis operation performance
          performanceMonitor.recordRedisOperation('get', key, retrieveLatency, !!puzzleData);

          if (!puzzleData) {
            console.log(`Puzzle not found in cache: ${puzzleId}`);

            // Requirement 9.3: Log puzzle retrieval with cache hit/miss status
            puzzleMetrics.recordStorage(
              puzzleId,
              'retrieve',
              retrieveLatency,
              false,
              undefined,
              'NOT_FOUND'
            );

            return null;
          }

          const retrievalTime = Date.now() - startTime;
          console.log(`✓ Puzzle retrieved from cache: ${puzzleId} (${retrievalTime}ms)`);

          // Requirement 9.2: Log Redis storage operations
          // Requirement 9.3: Log puzzle retrieval with cache hit/miss status
          puzzleMetrics.recordStorage(puzzleId, 'retrieve', retrieveLatency, true);

          const parsedPuzzle = JSON.parse(puzzleData) as Puzzle;

          // Requirement 9.3: Log puzzle retrieval with cache hit/miss status
          puzzleMetrics.recordRetrieval(
            puzzleId,
            parsedPuzzle.difficulty,
            'cache',
            retrievalTime,
            true
          );

          // Requirement 10.4: Track puzzle retrieval performance
          performanceMonitor.recordPuzzleRetrieval(puzzleId, retrievalTime, true, true);

          return parsedPuzzle;
        },
        async () => {
          // Fallback when Redis is unavailable
          console.warn(`Redis unavailable for puzzle retrieval: ${puzzleId}`);

          // Requirement 9.4: Track error types and fallback actions
          errorMonitor.recordError(
            'REDIS_ERROR',
            `Redis circuit breaker triggered for puzzle: ${puzzleId}`,
            'getPuzzleById'
          );
          puzzleMetrics.recordError('REDIS_ERROR', 'Circuit breaker triggered', 'getPuzzleById');
          puzzleMetrics.recordFallback(
            'getPuzzleById',
            'Redis unavailable',
            'Return null for generation fallback',
            true
          );

          return null;
        },
        `Get puzzle by ID: ${puzzleId}`
      );

      // Track cache miss if puzzle not found
      if (!puzzle) {
        const retrievalTime = Date.now() - startTime;
        performanceMonitor.recordPuzzleRetrieval(puzzleId, retrievalTime, true, false);
      }

      return puzzle;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const latency = Date.now() - startTime;
      console.error(`Error retrieving puzzle ${puzzleId}:`, errorMessage);

      // Requirement 9.4: Track error types and fallback actions
      errorMonitor.recordError(
        'PUZZLE_NOT_FOUND',
        `Failed to retrieve puzzle: ${puzzleId} - ${errorMessage}`,
        'getPuzzleById'
      );
      puzzleMetrics.recordError('PUZZLE_NOT_FOUND', errorMessage, 'getPuzzleById');

      // Requirement 10.4: Track failed retrieval
      performanceMonitor.recordPuzzleRetrieval(puzzleId, latency, false, false);

      // Return null to trigger fallback generation
      return null;
    }
  }

  /**
   * Generate and store a new puzzle with specific ID
   * Enhanced with 90-day TTL, comprehensive logging, and error handling
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.2, 9.4, 10.1, 10.3
   */
  public async generatePuzzleWithId(
    puzzleId: string,
    difficulty: Difficulty
  ): Promise<GetPuzzleResponse> {
    const startTime = Date.now();

    try {
      console.log(`Generating puzzle with ID: ${puzzleId}, difficulty: ${difficulty}`);

      // Validate difficulty parameter
      if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return createErrorResponse('VALIDATION_ERROR', `Invalid difficulty: ${difficulty}`);
      }

      // Requirement 10.1: Use Enhanced Generator for guaranteed generation
      let generationSource: 'enhanced' | 'legacy' | 'backup' = 'enhanced';
      const puzzle = await withPuzzleGenerationFallback(
        async () => {
          const genStartTime = Date.now();
          const generatedPuzzle = await this.enhancedEngine.generateGuaranteedPuzzle(
            difficulty,
            puzzleId
          );

          const generationTime = Date.now() - genStartTime;
          console.log(
            `✓ Puzzle generated successfully: ${puzzleId} (${generationTime}ms, difficulty: ${difficulty})`
          );

          // Requirement 9.1: Log puzzle generation with ID, difficulty, and generation time
          puzzleMetrics.recordGeneration(puzzleId, difficulty, generationTime, true, 'enhanced');

          // Requirement 10.3: Track puzzle generation performance
          performanceMonitor.recordPuzzleGeneration(
            puzzleId,
            difficulty,
            generationTime,
            true,
            'enhanced'
          );

          return generatedPuzzle;
        },
        async () => {
          // Fallback to backup puzzle if generation fails
          console.warn(`Enhanced generation failed for ${puzzleId}, using backup puzzle`);
          generationSource = 'backup';

          const genStartTime = Date.now();
          const backupPuzzle = createBackupPuzzle(difficulty, puzzleId);
          const generationTime = Date.now() - genStartTime;

          // Requirement 9.4: Track error types and fallback actions
          errorMonitor.recordError(
            'GENERATION_FAILED',
            `Used backup puzzle for ${puzzleId}`,
            'generatePuzzleWithId'
          );
          puzzleMetrics.recordError(
            'GENERATION_FAILED',
            'Enhanced generation failed',
            'generatePuzzleWithId'
          );
          puzzleMetrics.recordFallback(
            'generatePuzzleWithId',
            'Enhanced generation failed',
            'Using backup puzzle template',
            true
          );

          // Requirement 9.1: Log puzzle generation with ID, difficulty, and generation time
          puzzleMetrics.recordGeneration(puzzleId, difficulty, generationTime, true, 'backup');

          // Requirement 10.3: Track backup puzzle generation
          performanceMonitor.recordPuzzleGeneration(
            puzzleId,
            difficulty,
            generationTime,
            true,
            'backup'
          );

          return backupPuzzle;
        },
        `Generate puzzle with ID: ${puzzleId}`
      );

      // Store in Redis with 90-day TTL (7,776,000 seconds)
      const key = `reflectiq:puzzle:${puzzleId}`;
      const TTL_90_DAYS = 90 * 24 * 60 * 60;

      await withRedisCircuitBreaker(
        async () => {
          const storeStartTime = Date.now();
          await redis.set(key, JSON.stringify(puzzle));
          const setLatency = Date.now() - storeStartTime;

          // Requirement 10.4: Track Redis set operation performance
          performanceMonitor.recordRedisOperation('set', key, setLatency, true);

          const expireStartTime = Date.now();
          await redis.expire(key, TTL_90_DAYS);
          const expireLatency = Date.now() - expireStartTime;

          // Requirement 10.4: Track Redis expire operation performance
          performanceMonitor.recordRedisOperation('expire', key, expireLatency, true);

          const totalTime = Date.now() - startTime;
          console.log(
            `✓ Puzzle stored in Redis: ${puzzleId} with 90-day TTL (total time: ${totalTime}ms)`
          );

          // Requirement 9.2: Log Redis storage operations with TTL information
          puzzleMetrics.recordStorage(
            puzzleId,
            'store',
            setLatency + expireLatency,
            true,
            TTL_90_DAYS
          );
        },
        async () => {
          // Fallback: log warning but continue without cache
          console.warn(`Failed to store puzzle ${puzzleId} in Redis - continuing without cache`);

          // Requirement 9.4: Track error types and fallback actions
          errorMonitor.recordError(
            'REDIS_ERROR',
            `Failed to store puzzle: ${puzzleId}`,
            'generatePuzzleWithId'
          );
          puzzleMetrics.recordError(
            'REDIS_ERROR',
            'Failed to store puzzle',
            'generatePuzzleWithId'
          );
          puzzleMetrics.recordFallback(
            'generatePuzzleWithId',
            'Redis storage failed',
            'Continue without cache',
            true
          );
        },
        `Store puzzle with ID: ${puzzleId}`
      );

      return createSuccessResponse(puzzle);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const generationTime = Date.now() - startTime;
      console.error(`Error generating puzzle ${puzzleId}:`, errorMessage);

      // Requirement 9.1: Log puzzle generation with ID, difficulty, and generation time
      // Requirement 9.4: Track error types and fallback actions
      puzzleMetrics.recordGeneration(
        puzzleId,
        difficulty,
        generationTime,
        false,
        'enhanced',
        errorMessage
      );

      // Requirement 10.3: Track failed generation
      performanceMonitor.recordPuzzleGeneration(
        puzzleId,
        difficulty,
        generationTime,
        false,
        'enhanced'
      );

      errorMonitor.recordError(
        'GENERATION_FAILED',
        `Failed to generate puzzle: ${puzzleId} - ${errorMessage}`,
        'generatePuzzleWithId'
      );
      puzzleMetrics.recordError('GENERATION_FAILED', errorMessage, 'generatePuzzleWithId');

      return createErrorResponse('GENERATION_FAILED', `Failed to generate puzzle: ${errorMessage}`);
    }
  }
}
