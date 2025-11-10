/**
 * Cache Warming Service for ReflectIQ
 * Pre-loads puzzles and data for scheduled post creation
 * Requirement 10.5: Add cache warming for scheduled post creation
 */

import { PuzzleService } from './PuzzleService.js';
import { Difficulty } from '../../shared/types/puzzle.js';
import { generateUniquePuzzleId } from '../utils/puzzleIdGenerator.js';
import { performanceMonitor } from './PerformanceMonitoringService.js';

/**
 * Cache warming configuration
 */
interface CacheWarmingConfig {
  enabled: boolean;
  warmupLeadTime: number; // Hours before scheduled post
  difficulties: Difficulty[];
  maxConcurrentWarmups: number;
}

/**
 * Cache warming result
 */
interface WarmupResult {
  success: boolean;
  puzzlesWarmed: number;
  duration: number;
  errors: string[];
}

/**
 * Cache Warming Service
 * Pre-generates and caches puzzles for upcoming scheduled posts
 */
export class CacheWarmingService {
  private static instance: CacheWarmingService;
  private config: CacheWarmingConfig;
  private warmupInProgress: boolean = false;

  private constructor(config?: Partial<CacheWarmingConfig>) {
    this.config = {
      enabled: true,
      warmupLeadTime: 1, // 1 hour before scheduled post
      difficulties: ['Easy', 'Medium', 'Hard'],
      maxConcurrentWarmups: 3,
      ...config,
    };
  }

  public static getInstance(config?: Partial<CacheWarmingConfig>): CacheWarmingService {
    if (!CacheWarmingService.instance) {
      CacheWarmingService.instance = new CacheWarmingService(config);
    }
    return CacheWarmingService.instance;
  }

  /**
   * Warm cache for upcoming scheduled posts
   * Requirement 10.5: Add cache warming for scheduled post creation
   */
  async warmCacheForScheduledPosts(date?: string): Promise<WarmupResult> {
    if (!this.config.enabled) {
      console.log('🔄 [CACHE WARMUP] Cache warming is disabled');
      return {
        success: true,
        puzzlesWarmed: 0,
        duration: 0,
        errors: ['Cache warming disabled'],
      };
    }

    if (this.warmupInProgress) {
      console.warn('⚠️ [CACHE WARMUP] Warmup already in progress, skipping');
      return {
        success: false,
        puzzlesWarmed: 0,
        duration: 0,
        errors: ['Warmup already in progress'],
      };
    }

    this.warmupInProgress = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let puzzlesWarmed = 0;

    try {
      // Use provided date or calculate next scheduled post date
      const targetDate = date || this.getNextScheduledPostDate();
      console.log(`🔄 [CACHE WARMUP] Starting cache warmup for ${targetDate}`);

      const puzzleService = PuzzleService.getInstance();

      // Warm up puzzles for each difficulty
      const warmupPromises = this.config.difficulties.map(async (difficulty) => {
        try {
          // Generate unique puzzle ID for the scheduled post
          const puzzleId = generateUniquePuzzleId(targetDate, difficulty);

          console.log(`🔄 [CACHE WARMUP] Pre-generating puzzle: ${puzzleId} (${difficulty})`);

          // Check if puzzle already exists
          const existingPuzzle = await puzzleService.getPuzzleById(puzzleId);

          if (existingPuzzle) {
            console.log(`✓ [CACHE WARMUP] Puzzle already cached: ${puzzleId}`);
            return { success: true, puzzleId };
          }

          // Generate and cache the puzzle
          const generateStartTime = Date.now();
          const response = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);
          const generateDuration = Date.now() - generateStartTime;

          if (response.success) {
            console.log(
              `✓ [CACHE WARMUP] Puzzle pre-generated: ${puzzleId} (${generateDuration}ms)`
            );
            puzzlesWarmed++;
            return { success: true, puzzleId };
          } else {
            const error = `Failed to generate puzzle ${puzzleId}: ${response.error?.message}`;
            console.error(`✗ [CACHE WARMUP] ${error}`);
            errors.push(error);
            return { success: false, puzzleId, error };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorMsg = `Error warming ${difficulty} puzzle: ${errorMessage}`;
          console.error(`✗ [CACHE WARMUP] ${errorMsg}`);
          errors.push(errorMsg);
          return { success: false, error: errorMsg };
        }
      });

      // Wait for all warmups to complete
      await Promise.all(warmupPromises);

      const duration = Date.now() - startTime;

      // Record performance metrics
      performanceMonitor.recordCacheWarmup(
        'scheduled_posts',
        puzzlesWarmed,
        duration,
        errors.length === 0
      );

      console.log(
        `✓ [CACHE WARMUP] Completed: ${puzzlesWarmed}/${this.config.difficulties.length} puzzles warmed in ${duration}ms`
      );

      return {
        success: errors.length === 0,
        puzzlesWarmed,
        duration,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`✗ [CACHE WARMUP] Fatal error: ${errorMessage}`);

      const duration = Date.now() - startTime;
      performanceMonitor.recordCacheWarmup('scheduled_posts', puzzlesWarmed, duration, false);

      return {
        success: false,
        puzzlesWarmed,
        duration,
        errors: [...errors, errorMessage],
      };
    } finally {
      this.warmupInProgress = false;
    }
  }

  /**
   * Warm cache for specific puzzle IDs
   */
  async warmCacheForPuzzles(
    puzzleIds: Array<{ id: string; difficulty: Difficulty }>
  ): Promise<WarmupResult> {
    if (!this.config.enabled) {
      return {
        success: true,
        puzzlesWarmed: 0,
        duration: 0,
        errors: ['Cache warming disabled'],
      };
    }

    const startTime = Date.now();
    const errors: string[] = [];
    let puzzlesWarmed = 0;

    console.log(`🔄 [CACHE WARMUP] Warming ${puzzleIds.length} specific puzzles`);

    const puzzleService = PuzzleService.getInstance();

    for (const { id, difficulty } of puzzleIds) {
      try {
        // Check if puzzle already exists
        const existingPuzzle = await puzzleService.getPuzzleById(id);

        if (existingPuzzle) {
          console.log(`✓ [CACHE WARMUP] Puzzle already cached: ${id}`);
          puzzlesWarmed++;
          continue;
        }

        // Generate and cache the puzzle
        const response = await puzzleService.generatePuzzleWithId(id, difficulty);

        if (response.success) {
          console.log(`✓ [CACHE WARMUP] Puzzle pre-generated: ${id}`);
          puzzlesWarmed++;
        } else {
          const error = `Failed to generate puzzle ${id}: ${response.error?.message}`;
          console.error(`✗ [CACHE WARMUP] ${error}`);
          errors.push(error);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorMsg = `Error warming puzzle ${id}: ${errorMessage}`;
        console.error(`✗ [CACHE WARMUP] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    const duration = Date.now() - startTime;

    performanceMonitor.recordCacheWarmup(
      'specific_puzzles',
      puzzlesWarmed,
      duration,
      errors.length === 0
    );

    console.log(
      `✓ [CACHE WARMUP] Completed: ${puzzlesWarmed}/${puzzleIds.length} puzzles warmed in ${duration}ms`
    );

    return {
      success: errors.length === 0,
      puzzlesWarmed,
      duration,
      errors,
    };
  }

  /**
   * Schedule automatic cache warming
   * Note: In Devvit, this should be called from a scheduler job
   */
  async scheduleAutomaticWarmup(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🔄 [CACHE WARMUP] Automatic warmup disabled');
      return;
    }

    console.log(
      `🔄 [CACHE WARMUP] Scheduling automatic warmup (${this.config.warmupLeadTime}h lead time)`
    );

    // Calculate when to run warmup (lead time before scheduled post)
    const now = new Date();
    const nextScheduledPost = this.getNextScheduledPostTime();
    const warmupTime = new Date(
      nextScheduledPost.getTime() - this.config.warmupLeadTime * 60 * 60 * 1000
    );

    const timeUntilWarmup = warmupTime.getTime() - now.getTime();

    if (timeUntilWarmup > 0) {
      console.log(
        `🔄 [CACHE WARMUP] Next warmup scheduled for ${warmupTime.toISOString()} (in ${Math.round(timeUntilWarmup / 1000 / 60)} minutes)`
      );

      // Note: In production, this should be handled by Devvit scheduler
      // For now, we'll just log the schedule
    } else {
      console.log('🔄 [CACHE WARMUP] Warmup time has passed, running immediately');
      await this.warmCacheForScheduledPosts();
    }
  }

  /**
   * Get cache warming status
   */
  getStatus(): {
    enabled: boolean;
    warmupInProgress: boolean;
    config: CacheWarmingConfig;
    nextScheduledWarmup: Date;
  } {
    const nextScheduledPost = this.getNextScheduledPostTime();
    const nextScheduledWarmup = new Date(
      nextScheduledPost.getTime() - this.config.warmupLeadTime * 60 * 60 * 1000
    );

    return {
      enabled: this.config.enabled,
      warmupInProgress: this.warmupInProgress,
      config: this.config,
      nextScheduledWarmup,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CacheWarmingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔄 [CACHE WARMUP] Configuration updated:', this.config);
  }

  /**
   * Private helper methods
   */
  private getNextScheduledPostDate(): string {
    // Get tomorrow's date (assuming daily posts are scheduled for midnight)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0] as string;
  }

  private getNextScheduledPostTime(): Date {
    // Assume posts are scheduled for midnight UTC
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}

// Export singleton instance
export const cacheWarmingService = CacheWarmingService.getInstance();

/**
 * Convenience function to warm cache for scheduled posts
 */
export async function warmCacheForScheduledPosts(date?: string): Promise<WarmupResult> {
  return cacheWarmingService.warmCacheForScheduledPosts(date);
}

/**
 * Convenience function to warm cache for specific puzzles
 */
export async function warmCacheForPuzzles(
  puzzleIds: Array<{ id: string; difficulty: Difficulty }>
): Promise<WarmupResult> {
  return cacheWarmingService.warmCacheForPuzzles(puzzleIds);
}
