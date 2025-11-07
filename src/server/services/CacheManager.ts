/**
 * Cache Manager for ReflectIQ Performance Optimization
 * Provides unified caching interface and intelligent cache management
 * Requirements: 1.4, 5.1 - Performance optimization through intelligent caching
 */

import { logger } from '../utils/logger.js';
import { redisSchemaExtensions } from './RedisSchemaExtensions.js';
import { performanceOptimization } from './PerformanceOptimizationService.js';
import {
  EntryExitPair,
  ValidationResult,
  GenerationMetrics,
  Difficulty,
} from '../../shared/types/guaranteed-generation.js';
import { Puzzle } from '../../shared/types/puzzle.js';

export interface CacheManagerConfig {
  enableSmartCaching: boolean;
  cacheWarmupInterval: number; // minutes
  metricsAggregationInterval: number; // minutes
  maxCacheSize: number;
  cacheCleanupInterval: number; // minutes
}

export interface CacheHealth {
  entryExitCache: {
    status: 'healthy' | 'degraded' | 'failed';
    hitRate: number;
    size: number;
    lastUpdate: Date;
  };
  validationCache: {
    status: 'healthy' | 'degraded' | 'failed';
    hitRate: number;
    size: number;
    lastUpdate: Date;
  };
  metricsCache: {
    status: 'healthy' | 'degraded' | 'failed';
    lastAggregation: Date;
    recordCount: number;
  };
  overallHealth: 'healthy' | 'degraded' | 'failed';
}

/**
 * Unified Cache Manager for Performance Optimization
 * Orchestrates all caching strategies and provides monitoring
 */
export class CacheManager {
  private static instance: CacheManager;
  private config: CacheManagerConfig;
  private warmupTimer?: NodeJS.Timeout;
  private aggregationTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private isInitialized: boolean = false;

  private constructor(config?: Partial<CacheManagerConfig>) {
    this.config = {
      enableSmartCaching: true,
      cacheWarmupInterval: 30, // 30 minutes
      metricsAggregationInterval: 15, // 15 minutes
      maxCacheSize: 10000,
      cacheCleanupInterval: 60, // 1 hour
      ...config,
    };
  }

  public static getInstance(config?: Partial<CacheManagerConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }
    return CacheManager.instance;
  }

  /**
   * Initialize cache manager with background tasks
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Cache manager already initialized');
      return;
    }

    try {
      logger.info('Initializing cache manager');

      // Note: Initial cache warmup is disabled for Devvit compatibility
      // Redis operations can only be performed within request context
      // Caches will be populated lazily during actual requests
      logger.info('Cache manager initialized - warmup disabled for Devvit compatibility');

      // Start background tasks
      this.startBackgroundTasks();

      this.isInitialized = true;
      logger.info('Cache manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize cache manager', { error });
      throw error;
    }
  }

  /**
   * Shutdown cache manager and cleanup resources
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down cache manager');

    // Clear timers
    if (this.warmupTimer) {
      clearInterval(this.warmupTimer);
    }
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.isInitialized = false;
    logger.info('Cache manager shutdown completed');
  }

  /**
   * Get or cache entry/exit pairs with intelligent optimization
   */
  public async getEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number,
    generator: () => Promise<EntryExitPair[]>
  ): Promise<EntryExitPair[]> {
    return performanceOptimization.getOptimizedEntryExitPairs(difficulty, gridSize, generator);
  }

  /**
   * Get or cache validation results with smart TTL
   */
  public async getValidationResult(
    puzzle: Puzzle,
    validator: () => Promise<ValidationResult>
  ): Promise<ValidationResult> {
    const result = await performanceOptimization.getOptimizedValidationResult(puzzle, validator);

    // Cache with smart characteristics-based TTL
    await performanceOptimization.cacheValidationResult(puzzle.id, result, {
      difficulty: puzzle.difficulty,
      materialCount: puzzle.materials.length,
      gridSize: puzzle.gridSize,
    });

    return result;
  }

  /**
   * Get aggregated generation metrics with caching
   */
  public async getGenerationMetrics(
    timeWindowHours: number = 1
  ): Promise<GenerationMetrics | null> {
    return performanceOptimization.aggregateGenerationMetrics(timeWindowHours);
  }

  /**
   * Preload commonly used cache entries
   */
  public async warmupCaches(): Promise<void> {
    try {
      logger.info('Starting cache warmup');

      // Warmup entry/exit pairs cache
      await performanceOptimization.preloadEntryExitPairs();

      // Warmup other caches
      await performanceOptimization.warmupCaches();

      logger.info('Cache warmup completed');
    } catch (error) {
      logger.error('Cache warmup failed', { error });
    }
  }

  /**
   * Get comprehensive cache health status
   */
  public async getCacheHealth(): Promise<CacheHealth> {
    try {
      const performanceMetrics = performanceOptimization.getCachePerformanceMetrics();
      const generationMetrics = await redisSchemaExtensions.getGenerationMetrics();

      const entryExitStatus = this.determineCacheStatus(
        performanceMetrics.entryExitCache.hitRate,
        performanceMetrics.entryExitCache.totalRequests
      );

      const validationStatus = this.determineCacheStatus(
        performanceMetrics.validationCache.hitRate,
        performanceMetrics.validationCache.totalRequests
      );

      const metricsStatus = generationMetrics ? 'healthy' : 'degraded';

      const overallHealth = this.determineOverallHealth([
        entryExitStatus,
        validationStatus,
        metricsStatus,
      ]);

      return {
        entryExitCache: {
          status: entryExitStatus,
          hitRate: performanceMetrics.entryExitCache.hitRate,
          size: performanceMetrics.entryExitCache.totalRequests,
          lastUpdate: new Date(),
        },
        validationCache: {
          status: validationStatus,
          hitRate: performanceMetrics.validationCache.hitRate,
          size: performanceMetrics.validationCache.totalRequests,
          lastUpdate: new Date(),
        },
        metricsCache: {
          status: metricsStatus,
          lastAggregation: generationMetrics?.lastUpdated || new Date(0),
          recordCount: generationMetrics?.totalGenerated || 0,
        },
        overallHealth,
      };
    } catch (error) {
      logger.error('Failed to get cache health', { error });

      return {
        entryExitCache: {
          status: 'failed',
          hitRate: 0,
          size: 0,
          lastUpdate: new Date(),
        },
        validationCache: {
          status: 'failed',
          hitRate: 0,
          size: 0,
          lastUpdate: new Date(),
        },
        metricsCache: {
          status: 'failed',
          lastAggregation: new Date(0),
          recordCount: 0,
        },
        overallHealth: 'failed',
      };
    }
  }

  /**
   * Clear all caches (for maintenance or troubleshooting)
   */
  public async clearAllCaches(): Promise<void> {
    try {
      logger.info('Clearing all caches');

      await performanceOptimization.clearAllCaches();
      await redisSchemaExtensions.resetGenerationMetrics();

      logger.info('All caches cleared successfully');
    } catch (error) {
      logger.error('Failed to clear caches', { error });
      throw error;
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStatistics(): {
    performance: ReturnType<typeof performanceOptimization.getCachePerformanceMetrics>;
    detailed: ReturnType<typeof performanceOptimization.getCacheStatistics>;
  } {
    return {
      performance: performanceOptimization.getCachePerformanceMetrics(),
      detailed: performanceOptimization.getCacheStatistics(),
    };
  }

  /**
   * Update cache manager configuration
   */
  public updateConfig(newConfig: Partial<CacheManagerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Restart background tasks if intervals changed
    if (
      oldConfig.cacheWarmupInterval !== this.config.cacheWarmupInterval ||
      oldConfig.metricsAggregationInterval !== this.config.metricsAggregationInterval ||
      oldConfig.cacheCleanupInterval !== this.config.cacheCleanupInterval
    ) {
      this.stopBackgroundTasks();
      this.startBackgroundTasks();
    }

    logger.info('Cache manager configuration updated', {
      enableSmartCaching: this.config.enableSmartCaching,
      cacheWarmupInterval: this.config.cacheWarmupInterval,
      metricsAggregationInterval: this.config.metricsAggregationInterval,
    });
  }

  /**
   * Private helper methods
   */
  private async performInitialWarmup(): Promise<void> {
    try {
      logger.info('Performing initial cache warmup');
      await this.warmupCaches();
    } catch (error) {
      logger.warn('Initial cache warmup failed', { error });
    }
  }

  private startBackgroundTasks(): void {
    if (!this.config.enableSmartCaching) {
      return;
    }

    // Note: Cache warmup task is disabled for Devvit compatibility
    // Redis operations can only be performed within request context
    logger.info('Background cache warmup disabled for Devvit compatibility');

    // Metrics aggregation task
    this.aggregationTimer = setInterval(
      async () => {
        try {
          await performanceOptimization.aggregateGenerationMetrics(1);
        } catch (error) {
          logger.error('Scheduled metrics aggregation failed', { error });
        }
      },
      this.config.metricsAggregationInterval * 60 * 1000
    );

    // Cache cleanup task
    this.cleanupTimer = setInterval(
      async () => {
        try {
          await this.performCacheCleanup();
        } catch (error) {
          logger.error('Scheduled cache cleanup failed', { error });
        }
      },
      this.config.cacheCleanupInterval * 60 * 1000
    );

    logger.info('Background cache tasks started', {
      warmupInterval: `${this.config.cacheWarmupInterval}m`,
      aggregationInterval: `${this.config.metricsAggregationInterval}m`,
      cleanupInterval: `${this.config.cacheCleanupInterval}m`,
    });
  }

  private stopBackgroundTasks(): void {
    if (this.warmupTimer) {
      clearInterval(this.warmupTimer);
      this.warmupTimer = undefined;
    }
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    logger.info('Background cache tasks stopped');
  }

  private async performCacheCleanup(): Promise<void> {
    try {
      logger.debug('Performing cache cleanup');

      // Get cache health to determine if cleanup is needed
      const health = await this.getCacheHealth();

      // Clean up if caches are getting too large or hit rates are low
      if (
        health.entryExitCache.size > this.config.maxCacheSize ||
        health.validationCache.size > this.config.maxCacheSize ||
        health.entryExitCache.hitRate < 0.5 ||
        health.validationCache.hitRate < 0.5
      ) {
        logger.info('Cache cleanup triggered due to size or performance thresholds');

        // Clear entry/exit cache for poor performing difficulties
        await redisSchemaExtensions.clearEntryExitCache();

        logger.info('Cache cleanup completed');
      }
    } catch (error) {
      logger.error('Cache cleanup failed', { error });
    }
  }

  private determineCacheStatus(
    hitRate: number,
    totalRequests: number
  ): 'healthy' | 'degraded' | 'failed' {
    if (totalRequests === 0) {
      return 'degraded'; // No requests yet
    }

    if (hitRate >= 0.7) {
      return 'healthy';
    } else if (hitRate >= 0.3) {
      return 'degraded';
    } else {
      return 'failed';
    }
  }

  private determineOverallHealth(
    statuses: Array<'healthy' | 'degraded' | 'failed'>
  ): 'healthy' | 'degraded' | 'failed' {
    if (statuses.every((status) => status === 'healthy')) {
      return 'healthy';
    } else if (statuses.some((status) => status === 'failed')) {
      return 'failed';
    } else {
      return 'degraded';
    }
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Export convenience functions
export const initializeCacheManager = (config?: Partial<CacheManagerConfig>) =>
  CacheManager.getInstance(config).initialize();

export const getCachedEntryExitPairs = (
  difficulty: Difficulty,
  gridSize: number,
  generator: () => Promise<EntryExitPair[]>
) => cacheManager.getEntryExitPairs(difficulty, gridSize, generator);

export const getCachedValidationResult = (
  puzzle: Puzzle,
  validator: () => Promise<ValidationResult>
) => cacheManager.getValidationResult(puzzle, validator);

export const getCachedGenerationMetrics = (timeWindowHours?: number) =>
  cacheManager.getGenerationMetrics(timeWindowHours);

export const warmupAllCaches = () => cacheManager.warmupCaches();

export const getCacheHealthStatus = () => cacheManager.getCacheHealth();

export const clearAllCaches = () => cacheManager.clearAllCaches();

export default cacheManager;
