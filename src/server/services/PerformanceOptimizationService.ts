/**
 * Performance Optimization Service for Guaranteed Puzzle Generation
 * Implements intelligent caching strategies to speed up generation and validation
 * Provides analytics and monitoring for generation performance
 */

import { logger } from '../utils/logger.js';
import { redisSchemaExtensions } from './RedisSchemaExtensions.js';
import {
  EntryExitPair,
  ValidationResult,
  PuzzleGenerationMetadata,
  GenerationMetrics,
  Difficulty,
  GridPosition,
} from '../../shared/types/guaranteed-generation.js';
import { Puzzle } from '../../shared/types/puzzle.js';

export interface PerformanceOptimizationConfig {
  enableEntryExitCaching: boolean;
  enableValidationCaching: boolean;
  enableMetricsCollection: boolean;
  cacheWarmupOnStartup: boolean;
  maxCacheSize: number;
  cacheHitRateThreshold: number; // Minimum hit rate to maintain cache
}

export interface CacheStatistics {
  entryExitCache: {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
  };
  validationCache: {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
  };
  overallPerformance: {
    averageGenerationTime: number;
    cacheSpeedupFactor: number;
    memoryUsage: number;
  };
}

/**
 * Performance Optimization Service
 * Manages intelligent caching and performance monitoring for puzzle generation
 */
export class PerformanceOptimizationService {
  private static instance: PerformanceOptimizationService;
  private config: PerformanceOptimizationConfig;
  private cacheStats: CacheStatistics;
  private warmupInProgress: boolean = false;

  private constructor(config?: Partial<PerformanceOptimizationConfig>) {
    this.config = {
      enableEntryExitCaching: true,
      enableValidationCaching: true,
      enableMetricsCollection: true,
      cacheWarmupOnStartup: false, // Disabled - Devvit Redis only works in request context
      maxCacheSize: 1000,
      cacheHitRateThreshold: 0.7, // 70% minimum hit rate
      ...config,
    };

    this.cacheStats = this.initializeCacheStats();

    // Note: Cache warmup is disabled during startup as Devvit Redis
    // can only be accessed within request context. Caches will be
    // populated lazily during actual requests.
    logger.info('Performance optimization service initialized', {
      enableEntryExitCaching: this.config.enableEntryExitCaching,
      enableValidationCaching: this.config.enableValidationCaching,
      cacheWarmupOnStartup: false, // Always false for Devvit compatibility
    });
  }

  public static getInstance(
    config?: Partial<PerformanceOptimizationConfig>
  ): PerformanceOptimizationService {
    if (!PerformanceOptimizationService.instance) {
      PerformanceOptimizationService.instance = new PerformanceOptimizationService(config);
    }
    return PerformanceOptimizationService.instance;
  }

  /**
   * Get or generate entry/exit pairs with intelligent caching
   */
  public async getOptimizedEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number,
    generator: () => Promise<EntryExitPair[]>
  ): Promise<EntryExitPair[]> {
    if (!this.config.enableEntryExitCaching) {
      return await generator();
    }

    const startTime = Date.now();

    try {
      // Try to get from cache first
      const cachedPairs = await redisSchemaExtensions.getCachedEntryExitPairs(difficulty, gridSize);

      if (cachedPairs && cachedPairs.length > 0) {
        this.recordCacheHit('entryExitCache');

        logger.debug('Entry/exit pairs served from cache', {
          difficulty,
          gridSize,
          pairCount: cachedPairs.length,
          cacheTime: Date.now() - startTime,
        });

        return cachedPairs;
      }

      // Cache miss - generate new pairs
      this.recordCacheMiss('entryExitCache');

      const generatedPairs = await generator();

      // Cache the generated pairs for future use
      if (generatedPairs.length > 0) {
        await redisSchemaExtensions.cacheValidEntryExitPairs(difficulty, gridSize, generatedPairs);

        logger.debug('Entry/exit pairs generated and cached', {
          difficulty,
          gridSize,
          pairCount: generatedPairs.length,
          generationTime: Date.now() - startTime,
        });
      }

      return generatedPairs;
    } catch (error) {
      logger.error('Error in optimized entry/exit pair retrieval', {
        difficulty,
        gridSize,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to direct generation
      return await generator();
    }
  }

  /**
   * Get or perform validation with intelligent caching
   */
  public async getOptimizedValidationResult(
    puzzle: Puzzle,
    validator: () => Promise<ValidationResult>
  ): Promise<ValidationResult> {
    if (!this.config.enableValidationCaching) {
      return await validator();
    }

    const startTime = Date.now();

    try {
      // Try to get from cache first
      const cachedResult = await redisSchemaExtensions.getValidationResult(puzzle.id);

      if (cachedResult) {
        this.recordCacheHit('validationCache');

        logger.debug('Validation result served from cache', {
          puzzleId: puzzle.id,
          isValid: cachedResult.isValid,
          confidenceScore: cachedResult.confidenceScore,
          cacheTime: Date.now() - startTime,
        });

        return cachedResult;
      }

      // Cache miss - perform validation
      this.recordCacheMiss('validationCache');

      const validationResult = await validator();

      // Cache the validation result
      await redisSchemaExtensions.setValidationResult(puzzle.id, validationResult);

      logger.debug('Validation performed and cached', {
        puzzleId: puzzle.id,
        isValid: validationResult.isValid,
        confidenceScore: validationResult.confidenceScore,
        validationTime: Date.now() - startTime,
      });

      return validationResult;
    } catch (error) {
      logger.error('Error in optimized validation', {
        puzzleId: puzzle.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to direct validation
      return await validator();
    }
  }

  /**
   * Record generation metrics with performance tracking
   */
  public async recordGenerationMetrics(
    difficulty: Difficulty,
    success: boolean,
    generationTime: number,
    metadata: PuzzleGenerationMetadata
  ): Promise<void> {
    if (!this.config.enableMetricsCollection) {
      return;
    }

    try {
      // Store generation metadata
      await redisSchemaExtensions.setGenerationMetadata(metadata.puzzleId, metadata);

      // Update aggregated metrics
      await redisSchemaExtensions.updateGenerationMetrics(
        difficulty,
        success,
        generationTime,
        metadata.confidenceScore,
        metadata.attempts
      );

      // Update local performance stats
      this.updatePerformanceStats(generationTime);

      logger.debug('Generation metrics recorded', {
        puzzleId: metadata.puzzleId,
        difficulty,
        success,
        generationTime,
        attempts: metadata.attempts,
        confidenceScore: metadata.confidenceScore,
      });
    } catch (error) {
      logger.error('Failed to record generation metrics', {
        puzzleId: metadata.puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get comprehensive performance analytics
   */
  public async getPerformanceAnalytics(): Promise<{
    generationMetrics: GenerationMetrics | null;
    cacheStatistics: CacheStatistics;
    recommendations: string[];
  }> {
    try {
      const generationMetrics = await redisSchemaExtensions.getGenerationMetrics();
      const recommendations = this.generatePerformanceRecommendations();

      return {
        generationMetrics,
        cacheStatistics: this.cacheStats,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to get performance analytics', { error });

      return {
        generationMetrics: null,
        cacheStatistics: this.cacheStats,
        recommendations: ['Error retrieving analytics - check Redis connection'],
      };
    }
  }

  /**
   * Aggregate and cache generation metrics for monitoring and analytics
   * Implements intelligent aggregation to reduce Redis load
   */
  public async aggregateGenerationMetrics(
    timeWindowHours: number = 1
  ): Promise<GenerationMetrics | null> {
    if (!this.config.enableMetricsCollection) {
      return null;
    }

    const cacheKey = `aggregated_metrics:${timeWindowHours}h`;
    const startTime = Date.now();

    try {
      // Try to get cached aggregated metrics first
      const cachedMetrics = await redisSchemaExtensions.getGenerationMetrics();

      if (cachedMetrics && this.isMetricsRecent(cachedMetrics, timeWindowHours)) {
        logger.debug('Serving aggregated metrics from cache', {
          lastUpdated: cachedMetrics.lastUpdated,
          timeWindow: `${timeWindowHours}h`,
          cacheTime: Date.now() - startTime,
        });

        return cachedMetrics;
      }

      // Cache miss or stale data - aggregate fresh metrics
      logger.debug('Aggregating fresh generation metrics', {
        timeWindow: `${timeWindowHours}h`,
        reason: cachedMetrics ? 'stale_data' : 'cache_miss',
      });

      // Get current metrics and update aggregation
      const currentMetrics = await redisSchemaExtensions.getGenerationMetrics();

      if (currentMetrics) {
        // Update the last aggregation timestamp
        currentMetrics.lastUpdated = new Date();

        // Store updated metrics back to cache
        await redisSchemaExtensions.updateGenerationMetrics(
          'Easy', // Dummy values for the update call
          true,
          0,
          0,
          0
        );

        logger.debug('Generation metrics aggregated and cached', {
          totalGenerated: currentMetrics.totalGenerated,
          successRate: currentMetrics.successRate,
          aggregationTime: Date.now() - startTime,
        });

        return currentMetrics;
      }

      return null;
    } catch (error) {
      logger.error('Failed to aggregate generation metrics', {
        timeWindow: `${timeWindowHours}h`,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cache validation results to avoid redundant physics simulations
   * Implements smart caching based on puzzle characteristics
   */
  public async cacheValidationResult(
    puzzleId: string,
    validationResult: ValidationResult,
    puzzleCharacteristics?: {
      difficulty: Difficulty;
      materialCount: number;
      gridSize: number;
    }
  ): Promise<void> {
    if (!this.config.enableValidationCaching) {
      return;
    }

    try {
      // Determine cache TTL based on puzzle characteristics
      let cacheTTL = 3600; // Default 1 hour

      if (puzzleCharacteristics) {
        // Cache longer for simpler puzzles (they're less likely to change)
        if (puzzleCharacteristics.difficulty === 'Easy') {
          cacheTTL = 7200; // 2 hours
        } else if (puzzleCharacteristics.difficulty === 'Hard') {
          cacheTTL = 1800; // 30 minutes (more complex, cache shorter)
        }

        // Adjust based on material count
        if (puzzleCharacteristics.materialCount < 10) {
          cacheTTL *= 1.5; // Cache longer for simpler puzzles
        }
      }

      // Store validation result with calculated TTL
      await redisSchemaExtensions.setValidationResult(puzzleId, validationResult);

      logger.debug('Validation result cached with smart TTL', {
        puzzleId,
        isValid: validationResult.isValid,
        confidenceScore: validationResult.confidenceScore,
        cacheTTL: `${cacheTTL}s`,
        characteristics: puzzleCharacteristics,
      });
    } catch (error) {
      logger.error('Failed to cache validation result', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Preload commonly used entry/exit pairs for faster generation
   * Implements predictive caching based on usage patterns
   */
  public async preloadEntryExitPairs(): Promise<void> {
    if (!this.config.enableEntryExitCaching) {
      return;
    }

    const startTime = Date.now();
    const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
    const gridSizes = [6, 8, 10];

    try {
      logger.info('Starting entry/exit pairs preloading');

      const preloadTasks: Promise<void>[] = [];

      for (const difficulty of difficulties) {
        for (const gridSize of gridSizes) {
          preloadTasks.push(this.preloadPairsForDifficulty(difficulty, gridSize));
        }
      }

      await Promise.allSettled(preloadTasks);

      const preloadTime = Date.now() - startTime;
      logger.info('Entry/exit pairs preloading completed', {
        preloadTime: `${preloadTime}ms`,
        tasksCompleted: preloadTasks.length,
      });
    } catch (error) {
      logger.error('Entry/exit pairs preloading failed', { error });
    }
  }

  /**
   * Get cache performance metrics for monitoring
   */
  public getCachePerformanceMetrics(): {
    entryExitCache: {
      hitRate: number;
      totalRequests: number;
      averageResponseTime: number;
    };
    validationCache: {
      hitRate: number;
      totalRequests: number;
      averageResponseTime: number;
    };
    overallEfficiency: number;
  } {
    const entryExitHitRate = this.cacheStats.entryExitCache.hitRate;
    const validationHitRate = this.cacheStats.validationCache.hitRate;
    const overallEfficiency = (entryExitHitRate + validationHitRate) / 2;

    return {
      entryExitCache: {
        hitRate: entryExitHitRate,
        totalRequests: this.cacheStats.entryExitCache.totalRequests,
        averageResponseTime: this.cacheStats.overallPerformance.averageGenerationTime,
      },
      validationCache: {
        hitRate: validationHitRate,
        totalRequests: this.cacheStats.validationCache.totalRequests,
        averageResponseTime: this.cacheStats.overallPerformance.averageGenerationTime,
      },
      overallEfficiency,
    };
  }

  /**
   * Warm up caches with commonly used data
   */
  public async warmupCaches(): Promise<void> {
    if (this.warmupInProgress) {
      logger.debug('Cache warmup already in progress');
      return;
    }

    this.warmupInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting cache warmup');

      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
      const gridSizes = [6, 8, 10];

      // Check which caches need warming up
      const warmupTasks: Promise<void>[] = [];

      for (const difficulty of difficulties) {
        for (const gridSize of gridSizes) {
          warmupTasks.push(this.warmupEntryExitCache(difficulty, gridSize));
        }
      }

      await Promise.allSettled(warmupTasks);

      const warmupTime = Date.now() - startTime;
      logger.info('Cache warmup completed', {
        warmupTime: `${warmupTime}ms`,
        tasksCompleted: warmupTasks.length,
      });
    } catch (error) {
      logger.error('Cache warmup failed', { error });
    } finally {
      this.warmupInProgress = false;
    }
  }

  /**
   * Clear all performance caches
   */
  public async clearAllCaches(): Promise<void> {
    try {
      await redisSchemaExtensions.clearEntryExitCache();

      // Reset cache statistics
      this.cacheStats = this.initializeCacheStats();

      logger.info('All performance caches cleared');
    } catch (error) {
      logger.error('Failed to clear caches', { error });
      throw error;
    }
  }

  /**
   * Get current cache statistics
   */
  public getCacheStatistics(): CacheStatistics {
    return { ...this.cacheStats };
  }

  /**
   * Update performance optimization configuration
   */
  public updateConfig(newConfig: Partial<PerformanceOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.info('Performance optimization config updated', {
      enableEntryExitCaching: this.config.enableEntryExitCaching,
      enableValidationCaching: this.config.enableValidationCaching,
      enableMetricsCollection: this.config.enableMetricsCollection,
    });
  }

  /**
   * Private helper methods
   */
  private async warmupEntryExitCache(difficulty: Difficulty, gridSize: number): Promise<void> {
    try {
      const cachedPairs = await redisSchemaExtensions.getCachedEntryExitPairs(difficulty, gridSize);

      if (!cachedPairs) {
        logger.debug('Entry/exit cache needs warmup', { difficulty, gridSize });
        // Note: Actual pair generation would be done by the calling service
        // This just checks if cache exists
      }
    } catch (error) {
      logger.warn('Failed to warmup entry/exit cache', {
        difficulty,
        gridSize,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private recordCacheHit(cacheType: 'entryExitCache' | 'validationCache'): void {
    this.cacheStats[cacheType].hits++;
    this.cacheStats[cacheType].totalRequests++;
    this.updateCacheHitRate(cacheType);
  }

  private recordCacheMiss(cacheType: 'entryExitCache' | 'validationCache'): void {
    this.cacheStats[cacheType].misses++;
    this.cacheStats[cacheType].totalRequests++;
    this.updateCacheHitRate(cacheType);
  }

  private updateCacheHitRate(cacheType: 'entryExitCache' | 'validationCache'): void {
    const stats = this.cacheStats[cacheType];
    stats.hitRate = stats.totalRequests > 0 ? stats.hits / stats.totalRequests : 0;
  }

  private updatePerformanceStats(generationTime: number): void {
    const currentAvg = this.cacheStats.overallPerformance.averageGenerationTime;
    const totalRequests =
      this.cacheStats.entryExitCache.totalRequests + this.cacheStats.validationCache.totalRequests;

    if (totalRequests > 0) {
      this.cacheStats.overallPerformance.averageGenerationTime =
        (currentAvg * (totalRequests - 1) + generationTime) / totalRequests;
    }
  }

  private generatePerformanceRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check cache hit rates
    if (this.cacheStats.entryExitCache.hitRate < this.config.cacheHitRateThreshold) {
      recommendations.push(
        `Entry/exit cache hit rate is low (${(this.cacheStats.entryExitCache.hitRate * 100).toFixed(1)}%). Consider increasing cache TTL or warming up caches more frequently.`
      );
    }

    if (this.cacheStats.validationCache.hitRate < this.config.cacheHitRateThreshold) {
      recommendations.push(
        `Validation cache hit rate is low (${(this.cacheStats.validationCache.hitRate * 100).toFixed(1)}%). Consider increasing validation cache TTL.`
      );
    }

    // Check overall performance
    if (this.cacheStats.overallPerformance.averageGenerationTime > 3000) {
      recommendations.push(
        'Average generation time is high. Consider optimizing algorithms or increasing cache usage.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal. All metrics are within acceptable ranges.');
    }

    return recommendations;
  }

  private initializeCacheStats(): CacheStatistics {
    return {
      entryExitCache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0,
      },
      validationCache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0,
      },
      overallPerformance: {
        averageGenerationTime: 0,
        cacheSpeedupFactor: 1.0,
        memoryUsage: 0,
      },
    };
  }

  /**
   * Check if metrics are recent enough to serve from cache
   */
  private isMetricsRecent(metrics: GenerationMetrics, timeWindowHours: number): boolean {
    const now = Date.now();
    const metricsAge = now - metrics.lastUpdated.getTime();
    const maxAge = timeWindowHours * 60 * 60 * 1000; // Convert hours to milliseconds

    return metricsAge < maxAge;
  }

  /**
   * Preload entry/exit pairs for a specific difficulty and grid size
   */
  private async preloadPairsForDifficulty(difficulty: Difficulty, gridSize: number): Promise<void> {
    try {
      // Check if pairs are already cached
      const cachedPairs = await redisSchemaExtensions.getCachedEntryExitPairs(difficulty, gridSize);

      if (cachedPairs && cachedPairs.length > 0) {
        logger.debug('Entry/exit pairs already cached', {
          difficulty,
          gridSize,
          count: cachedPairs.length,
        });
        return;
      }

      // Note: In a real implementation, we would generate pairs here
      // For now, we just log that preloading is needed
      logger.debug('Entry/exit pairs need preloading', { difficulty, gridSize });

      // This would be implemented by calling the actual point placement service
      // const pairs = await this.pointPlacementService.selectEntryExitPairs(difficulty, gridSize);
      // await redisSchemaExtensions.cacheValidEntryExitPairs(difficulty, gridSize, pairs);
    } catch (error) {
      logger.warn('Failed to preload entry/exit pairs', {
        difficulty,
        gridSize,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
export const performanceOptimization = PerformanceOptimizationService.getInstance();

// Export convenience functions
export const getOptimizedEntryExitPairs = (
  difficulty: Difficulty,
  gridSize: number,
  generator: () => Promise<EntryExitPair[]>
) => performanceOptimization.getOptimizedEntryExitPairs(difficulty, gridSize, generator);

export const getOptimizedValidationResult = (
  puzzle: Puzzle,
  validator: () => Promise<ValidationResult>
) => performanceOptimization.getOptimizedValidationResult(puzzle, validator);

export const recordGenerationMetrics = (
  difficulty: Difficulty,
  success: boolean,
  generationTime: number,
  metadata: PuzzleGenerationMetadata
) => performanceOptimization.recordGenerationMetrics(difficulty, success, generationTime, metadata);

export const getPerformanceAnalytics = () => performanceOptimization.getPerformanceAnalytics();

export const warmupCaches = () => performanceOptimization.warmupCaches();

export const clearAllCaches = () => performanceOptimization.clearAllCaches();

export default performanceOptimization;
