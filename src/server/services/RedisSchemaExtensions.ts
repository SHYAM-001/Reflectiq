/**
 * Redis Schema Extensions for Guaranteed Puzzle Generation
 * Implements caching for generation metadata, validation results, and performance metrics
 * Following ReflectIQ Redis patterns: reflectiq:{type}:{identifier}
 */

import { redisClient, RedisOperationOptions } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';
import {
  PuzzleGenerationMetadata,
  ValidationResult,
  GenerationMetrics,
  DifficultyMetrics,
  EntryExitPair,
  Difficulty,
} from '../../shared/types/guaranteed-generation.js';

export interface RedisSchemaExtensions {
  // Generation metadata: reflectiq:generation:{puzzleId}
  setGenerationMetadata(puzzleId: string, metadata: PuzzleGenerationMetadata): Promise<void>;
  getGenerationMetadata(puzzleId: string): Promise<PuzzleGenerationMetadata | null>;
  deleteGenerationMetadata(puzzleId: string): Promise<boolean>;

  // Validation cache: reflectiq:validation:{puzzleId}
  setValidationResult(puzzleId: string, result: ValidationResult): Promise<void>;
  getValidationResult(puzzleId: string): Promise<ValidationResult | null>;
  deleteValidationResult(puzzleId: string): Promise<boolean>;

  // Performance metrics: reflectiq:metrics:generation
  updateGenerationMetrics(
    difficulty: Difficulty,
    success: boolean,
    generationTime: number,
    confidenceScore?: number,
    attempts?: number
  ): Promise<void>;
  getGenerationMetrics(): Promise<GenerationMetrics | null>;
  resetGenerationMetrics(): Promise<void>;

  // Entry/Exit pair caching for performance optimization
  cacheValidEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number,
    pairs: EntryExitPair[]
  ): Promise<void>;
  getCachedEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number
  ): Promise<EntryExitPair[] | null>;
  clearEntryExitCache(difficulty?: Difficulty): Promise<void>;
}

/**
 * Redis Schema Extensions Implementation
 * Provides caching and metadata storage for guaranteed puzzle generation
 */
export class RedisSchemaExtensionsService implements RedisSchemaExtensions {
  private static instance: RedisSchemaExtensionsService;
  private readonly TTL_GENERATION_METADATA = 86400; // 24 hours
  private readonly TTL_VALIDATION_CACHE = 3600; // 1 hour
  private readonly TTL_METRICS = 86400; // 24 hours
  private readonly TTL_ENTRY_EXIT_CACHE = 7200; // 2 hours

  private constructor() {}

  public static getInstance(): RedisSchemaExtensionsService {
    if (!RedisSchemaExtensionsService.instance) {
      RedisSchemaExtensionsService.instance = new RedisSchemaExtensionsService();
    }
    return RedisSchemaExtensionsService.instance;
  }

  /**
   * Generation Metadata Operations
   * Key pattern: reflectiq:generation:{puzzleId}
   */
  public async setGenerationMetadata(
    puzzleId: string,
    metadata: PuzzleGenerationMetadata
  ): Promise<void> {
    try {
      const key = `generation:${puzzleId}`;
      const value = JSON.stringify({
        ...metadata,
        createdAt: metadata.createdAt.toISOString(),
      });

      await redisClient.set(key, value, { ttl: this.TTL_GENERATION_METADATA });

      logger.debug('Generation metadata stored', {
        puzzleId,
        algorithm: metadata.algorithm,
        attempts: metadata.attempts,
        generationTime: metadata.generationTime,
      });
    } catch (error) {
      logger.error('Failed to store generation metadata', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getGenerationMetadata(puzzleId: string): Promise<PuzzleGenerationMetadata | null> {
    try {
      const key = `generation:${puzzleId}`;
      const value = await redisClient.get(key);

      if (!value) {
        return null;
      }

      const parsed = JSON.parse(value);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
      };
    } catch (error) {
      logger.error('Failed to retrieve generation metadata', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async deleteGenerationMetadata(puzzleId: string): Promise<boolean> {
    try {
      const key = `generation:${puzzleId}`;
      const deleted = await redisClient.del(key);
      return deleted > 0;
    } catch (error) {
      logger.error('Failed to delete generation metadata', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Validation Result Caching
   * Key pattern: reflectiq:validation:{puzzleId}
   */
  public async setValidationResult(puzzleId: string, result: ValidationResult): Promise<void> {
    try {
      const key = `validation:${puzzleId}`;
      const value = JSON.stringify(result);

      await redisClient.set(key, value, { ttl: this.TTL_VALIDATION_CACHE });

      logger.debug('Validation result cached', {
        puzzleId,
        isValid: result.isValid,
        confidenceScore: result.confidenceScore,
        validationTime: result.validationTime,
      });
    } catch (error) {
      logger.error('Failed to cache validation result', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getValidationResult(puzzleId: string): Promise<ValidationResult | null> {
    try {
      const key = `validation:${puzzleId}`;
      const value = await redisClient.get(key);

      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error('Failed to retrieve validation result', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async deleteValidationResult(puzzleId: string): Promise<boolean> {
    try {
      const key = `validation:${puzzleId}`;
      const deleted = await redisClient.del(key);
      return deleted > 0;
    } catch (error) {
      logger.error('Failed to delete validation result', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Performance Metrics Management
   * Key pattern: reflectiq:metrics:generation
   */
  public async updateGenerationMetrics(
    difficulty: Difficulty,
    success: boolean,
    generationTime: number,
    confidenceScore: number = 0,
    attempts: number = 1
  ): Promise<void> {
    try {
      const key = 'metrics:generation';

      // Get current metrics or initialize
      let metrics = await this.getGenerationMetrics();
      if (!metrics) {
        metrics = this.initializeMetrics();
      }

      // Update overall metrics
      metrics.totalGenerated++;
      const currentSuccesses = Math.floor(
        (metrics.successRate * (metrics.totalGenerated - 1)) / 100
      );
      const newSuccesses = currentSuccesses + (success ? 1 : 0);
      metrics.successRate = (newSuccesses / metrics.totalGenerated) * 100;

      // Update average generation time
      const totalTime = metrics.averageGenerationTime * (metrics.totalGenerated - 1);
      metrics.averageGenerationTime = (totalTime + generationTime) / metrics.totalGenerated;

      // Update average confidence score
      if (confidenceScore > 0) {
        const totalConfidence = metrics.averageConfidenceScore * (metrics.totalGenerated - 1);
        metrics.averageConfidenceScore =
          (totalConfidence + confidenceScore) / metrics.totalGenerated;
      }

      // Update difficulty-specific metrics
      const difficultyMetrics = metrics.difficultyBreakdown[difficulty];
      difficultyMetrics.generated++;
      if (success) {
        difficultyMetrics.successful++;
      }

      // Update difficulty averages
      const diffTotalTime = difficultyMetrics.averageTime * (difficultyMetrics.generated - 1);
      difficultyMetrics.averageTime =
        (diffTotalTime + generationTime) / difficultyMetrics.generated;

      if (confidenceScore > 0) {
        const diffTotalConfidence =
          difficultyMetrics.averageConfidence * (difficultyMetrics.generated - 1);
        difficultyMetrics.averageConfidence =
          (diffTotalConfidence + confidenceScore) / difficultyMetrics.generated;
      }

      const diffTotalAttempts =
        difficultyMetrics.averageAttempts * (difficultyMetrics.generated - 1);
      difficultyMetrics.averageAttempts =
        (diffTotalAttempts + attempts) / difficultyMetrics.generated;

      metrics.lastUpdated = new Date();

      // Store updated metrics
      const value = JSON.stringify({
        ...metrics,
        lastUpdated: metrics.lastUpdated.toISOString(),
      });

      await redisClient.set(key, value, { ttl: this.TTL_METRICS });

      logger.debug('Generation metrics updated', {
        difficulty,
        success,
        generationTime,
        totalGenerated: metrics.totalGenerated,
        successRate: metrics.successRate,
      });
    } catch (error) {
      logger.error('Failed to update generation metrics', {
        difficulty,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getGenerationMetrics(): Promise<GenerationMetrics | null> {
    try {
      const key = 'metrics:generation';
      const value = await redisClient.get(key);

      if (!value) {
        return null;
      }

      const parsed = JSON.parse(value);
      return {
        ...parsed,
        lastUpdated: new Date(parsed.lastUpdated),
      };
    } catch (error) {
      logger.error('Failed to retrieve generation metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async resetGenerationMetrics(): Promise<void> {
    try {
      const key = 'metrics:generation';
      const metrics = this.initializeMetrics();

      const value = JSON.stringify({
        ...metrics,
        lastUpdated: metrics.lastUpdated.toISOString(),
      });

      await redisClient.set(key, value, { ttl: this.TTL_METRICS });

      logger.info('Generation metrics reset');
    } catch (error) {
      logger.error('Failed to reset generation metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Entry/Exit Pair Caching for Performance Optimization
   * Key pattern: reflectiq:cache:entryexit:{difficulty}:{gridSize}
   */
  public async cacheValidEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number,
    pairs: EntryExitPair[]
  ): Promise<void> {
    try {
      const key = `cache:entryexit:${difficulty.toLowerCase()}:${gridSize}`;
      const value = JSON.stringify(pairs);

      await redisClient.set(key, value, { ttl: this.TTL_ENTRY_EXIT_CACHE });

      logger.debug('Entry/exit pairs cached', {
        difficulty,
        gridSize,
        pairCount: pairs.length,
      });
    } catch (error) {
      logger.error('Failed to cache entry/exit pairs', {
        difficulty,
        gridSize,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async getCachedEntryExitPairs(
    difficulty: Difficulty,
    gridSize: number
  ): Promise<EntryExitPair[] | null> {
    try {
      const key = `cache:entryexit:${difficulty.toLowerCase()}:${gridSize}`;
      const value = await redisClient.get(key);

      if (!value) {
        return null;
      }

      const pairs: EntryExitPair[] = JSON.parse(value);

      logger.debug('Entry/exit pairs retrieved from cache', {
        difficulty,
        gridSize,
        pairCount: pairs.length,
      });

      return pairs;
    } catch (error) {
      logger.error('Failed to retrieve cached entry/exit pairs', {
        difficulty,
        gridSize,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async clearEntryExitCache(difficulty?: Difficulty): Promise<void> {
    try {
      if (difficulty) {
        // Clear cache for specific difficulty
        const gridSizes = [6, 8, 10];
        const deletePromises = gridSizes.map((gridSize) => {
          const key = `cache:entryexit:${difficulty.toLowerCase()}:${gridSize}`;
          return redisClient.del(key);
        });

        await Promise.all(deletePromises);

        logger.info('Entry/exit cache cleared for difficulty', { difficulty });
      } else {
        // Clear all entry/exit caches
        const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
        const gridSizes = [6, 8, 10];

        const deletePromises = difficulties.flatMap((diff) =>
          gridSizes.map((gridSize) => {
            const key = `cache:entryexit:${diff.toLowerCase()}:${gridSize}`;
            return redisClient.del(key);
          })
        );

        await Promise.all(deletePromises);

        logger.info('All entry/exit caches cleared');
      }
    } catch (error) {
      logger.error('Failed to clear entry/exit cache', {
        difficulty,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initialize default metrics structure
   */
  private initializeMetrics(): GenerationMetrics {
    const initDifficultyMetrics = (): DifficultyMetrics => ({
      generated: 0,
      successful: 0,
      averageTime: 0,
      averageConfidence: 0,
      averageAttempts: 0,
    });

    return {
      totalGenerated: 0,
      successRate: 0,
      averageGenerationTime: 0,
      averageConfidenceScore: 0,
      difficultyBreakdown: {
        Easy: initDifficultyMetrics(),
        Medium: initDifficultyMetrics(),
        Hard: initDifficultyMetrics(),
      },
      fallbackUsageRate: 0,
      lastUpdated: new Date(),
    };
  }
}

// Export singleton instance
export const redisSchemaExtensions = RedisSchemaExtensionsService.getInstance();

export default redisSchemaExtensions;
