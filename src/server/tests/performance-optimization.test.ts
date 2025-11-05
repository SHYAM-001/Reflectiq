/**
 * Performance Optimization Tests
 * Tests for intelligent caching and performance optimization features
 * Requirements: 1.4, 5.1 - Performance optimization through intelligent caching
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceOptimizationService } from '../services/PerformanceOptimizationService.js';
import { CacheManager } from '../services/CacheManager.js';
import { redisSchemaExtensions } from '../services/RedisSchemaExtensions.js';
import {
  EntryExitPair,
  ValidationResult,
  PuzzleGenerationMetadata,
  Difficulty,
} from '../../shared/types/guaranteed-generation.js';
import { Puzzle } from '../../shared/types/puzzle.js';

// Mock Redis operations
vi.mock('../utils/redisClient.js', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Performance Optimization Service', () => {
  let performanceService: PerformanceOptimizationService;
  let mockEntryExitPairs: EntryExitPair[];
  let mockValidationResult: ValidationResult;
  let mockPuzzle: Puzzle;

  beforeEach(() => {
    performanceService = PerformanceOptimizationService.getInstance();

    // Setup mock data
    mockEntryExitPairs = [
      {
        entry: [0, 3],
        exit: [5, 2],
        distance: 6,
        difficulty: 'Medium',
        validationScore: 85,
        placementType: 'corner',
      },
      {
        entry: [1, 0],
        exit: [4, 5],
        distance: 8,
        difficulty: 'Medium',
        validationScore: 90,
        placementType: 'optimal',
      },
    ];

    mockValidationResult = {
      isValid: true,
      hasUniqueSolution: true,
      alternativeCount: 0,
      physicsCompliant: true,
      confidenceScore: 92,
      issues: [],
      validationTime: 150,
    };

    mockPuzzle = {
      id: 'test_puzzle_123',
      difficulty: 'Medium',
      gridSize: 6,
      materials: [],
      entry: [0, 3],
      solution: [5, 2],
      solutionPath: { segments: [], exit: [5, 2], terminated: false },
      hints: [],
      createdAt: new Date(),
      materialDensity: 0.15,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Entry/Exit Pair Caching', () => {
    test('should cache entry/exit pairs on first generation', async () => {
      const mockGenerator = vi.fn().mockResolvedValue(mockEntryExitPairs);
      const cacheSpy = vi.spyOn(redisSchemaExtensions, 'cacheValidEntryExitPairs');

      const result = await performanceService.getOptimizedEntryExitPairs(
        'Medium',
        6,
        mockGenerator
      );

      expect(result).toEqual(mockEntryExitPairs);
      expect(mockGenerator).toHaveBeenCalledOnce();
      expect(cacheSpy).toHaveBeenCalledWith('Medium', 6, mockEntryExitPairs);
    });

    test('should serve entry/exit pairs from cache on subsequent requests', async () => {
      const mockGenerator = vi.fn().mockResolvedValue(mockEntryExitPairs);
      vi.spyOn(redisSchemaExtensions, 'getCachedEntryExitPairs').mockResolvedValue(
        mockEntryExitPairs
      );

      const result = await performanceService.getOptimizedEntryExitPairs(
        'Medium',
        6,
        mockGenerator
      );

      expect(result).toEqual(mockEntryExitPairs);
      expect(mockGenerator).not.toHaveBeenCalled(); // Should not call generator if cached
    });

    test('should handle cache miss gracefully', async () => {
      const mockGenerator = vi.fn().mockResolvedValue(mockEntryExitPairs);
      vi.spyOn(redisSchemaExtensions, 'getCachedEntryExitPairs').mockResolvedValue(null);

      const result = await performanceService.getOptimizedEntryExitPairs(
        'Medium',
        6,
        mockGenerator
      );

      expect(result).toEqual(mockEntryExitPairs);
      expect(mockGenerator).toHaveBeenCalledOnce();
    });
  });

  describe('Validation Result Caching', () => {
    test('should cache validation results on first validation', async () => {
      const mockValidator = vi.fn().mockResolvedValue(mockValidationResult);
      const cacheSpy = vi.spyOn(redisSchemaExtensions, 'setValidationResult');

      const result = await performanceService.getOptimizedValidationResult(
        mockPuzzle,
        mockValidator
      );

      expect(result).toEqual(mockValidationResult);
      expect(mockValidator).toHaveBeenCalledOnce();
      expect(cacheSpy).toHaveBeenCalledWith(mockPuzzle.id, mockValidationResult);
    });

    test('should serve validation results from cache on subsequent requests', async () => {
      const mockValidator = vi.fn().mockResolvedValue(mockValidationResult);
      vi.spyOn(redisSchemaExtensions, 'getValidationResult').mockResolvedValue(
        mockValidationResult
      );

      const result = await performanceService.getOptimizedValidationResult(
        mockPuzzle,
        mockValidator
      );

      expect(result).toEqual(mockValidationResult);
      expect(mockValidator).not.toHaveBeenCalled(); // Should not call validator if cached
    });
  });

  describe('Generation Metrics Recording', () => {
    test('should record generation metrics with performance tracking', async () => {
      const mockMetadata: PuzzleGenerationMetadata = {
        puzzleId: 'test_puzzle_123',
        algorithm: 'guaranteed',
        attempts: 2,
        generationTime: 1500,
        confidenceScore: 92,
        validationPassed: true,
        spacingDistance: 6,
        pathComplexity: 4,
        materialDensityAchieved: 0.15,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      const metadataSpy = vi.spyOn(redisSchemaExtensions, 'setGenerationMetadata');
      const metricsSpy = vi.spyOn(redisSchemaExtensions, 'updateGenerationMetrics');

      await performanceService.recordGenerationMetrics('Medium', true, 1500, mockMetadata);

      expect(metadataSpy).toHaveBeenCalledWith(mockMetadata.puzzleId, mockMetadata);
      expect(metricsSpy).toHaveBeenCalledWith('Medium', true, 1500, 92, 2);
    });
  });

  describe('Performance Analytics', () => {
    test('should provide comprehensive performance analytics', async () => {
      const mockGenerationMetrics = {
        totalGenerated: 100,
        successRate: 95,
        averageGenerationTime: 1200,
        averageConfidenceScore: 88,
        difficultyBreakdown: {
          Easy: {
            generated: 30,
            successful: 30,
            averageTime: 800,
            averageConfidence: 92,
            averageAttempts: 1.2,
          },
          Medium: {
            generated: 40,
            successful: 38,
            averageTime: 1200,
            averageConfidence: 87,
            averageAttempts: 1.8,
          },
          Hard: {
            generated: 30,
            successful: 27,
            averageTime: 1800,
            averageConfidence: 82,
            averageAttempts: 2.5,
          },
        },
        fallbackUsageRate: 0.05,
        lastUpdated: new Date(),
      };

      vi.spyOn(redisSchemaExtensions, 'getGenerationMetrics').mockResolvedValue(
        mockGenerationMetrics
      );

      const analytics = await performanceService.getPerformanceAnalytics();

      expect(analytics.generationMetrics).toEqual(mockGenerationMetrics);
      expect(analytics.cacheStatistics).toBeDefined();
      expect(analytics.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Cache Warmup', () => {
    test('should warm up caches without errors', async () => {
      const warmupSpy = vi.spyOn(performanceService, 'warmupCaches');

      await performanceService.warmupCaches();

      expect(warmupSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('Cache Manager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = CacheManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize cache manager successfully', async () => {
      await expect(cacheManager.initialize()).resolves.not.toThrow();
    });

    test('should handle initialization errors gracefully', async () => {
      vi.spyOn(cacheManager, 'warmupCaches').mockRejectedValue(new Error('Warmup failed'));

      // The cache manager should handle errors gracefully and not throw
      await expect(cacheManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Cache Health Monitoring', () => {
    test('should provide cache health status', async () => {
      const health = await cacheManager.getCacheHealth();

      expect(health).toHaveProperty('entryExitCache');
      expect(health).toHaveProperty('validationCache');
      expect(health).toHaveProperty('metricsCache');
      expect(health).toHaveProperty('overallHealth');

      expect(['healthy', 'degraded', 'failed']).toContain(health.overallHealth);
    });
  });

  describe('Cache Statistics', () => {
    test('should provide detailed cache statistics', () => {
      const stats = cacheManager.getCacheStatistics();

      expect(stats).toHaveProperty('performance');
      expect(stats).toHaveProperty('detailed');
      expect(stats.performance).toHaveProperty('entryExitCache');
      expect(stats.performance).toHaveProperty('validationCache');
      expect(stats.performance).toHaveProperty('overallEfficiency');
    });
  });

  describe('Configuration Updates', () => {
    test('should update configuration successfully', () => {
      const newConfig = {
        enableSmartCaching: false,
        cacheWarmupInterval: 60,
      };

      expect(() => cacheManager.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Cache Operations', () => {
    test('should clear all caches successfully', async () => {
      await expect(cacheManager.clearAllCaches()).resolves.not.toThrow();
    });

    test('should warm up caches successfully', async () => {
      await expect(cacheManager.warmupCaches()).resolves.not.toThrow();
    });
  });
});

describe('Integration Tests', () => {
  test('should integrate performance optimization with puzzle generation', async () => {
    const cacheManager = CacheManager.getInstance();

    // Mock entry/exit pair generation
    const mockGenerator = vi.fn().mockResolvedValue([
      {
        entry: [0, 2],
        exit: [5, 3],
        distance: 7,
        difficulty: 'Easy' as Difficulty,
        validationScore: 88,
        placementType: 'corner' as const,
      },
    ]);

    // Mock cache to return null first (cache miss), then return data (cache hit)
    vi.spyOn(redisSchemaExtensions, 'getCachedEntryExitPairs')
      .mockResolvedValueOnce(null) // First call - cache miss
      .mockResolvedValueOnce([
        // Second call - cache hit
        {
          entry: [0, 2],
          exit: [5, 3],
          distance: 7,
          difficulty: 'Easy' as Difficulty,
          validationScore: 88,
          placementType: 'corner' as const,
        },
      ]);

    // Test cached entry/exit pair retrieval - first call (cache miss)
    const pairs = await cacheManager.getEntryExitPairs('Easy', 6, mockGenerator);

    expect(pairs).toHaveLength(1);
    expect(pairs[0].difficulty).toBe('Easy');
    expect(mockGenerator).toHaveBeenCalledOnce();

    // Test cache hit on second call
    const cachedPairs = await cacheManager.getEntryExitPairs('Easy', 6, mockGenerator);
    expect(cachedPairs).toEqual(pairs);
    // Generator should still only be called once due to caching
    expect(mockGenerator).toHaveBeenCalledOnce();
  });

  test('should handle cache failures gracefully', async () => {
    const performanceService = PerformanceOptimizationService.getInstance();

    // Mock Redis failure
    vi.spyOn(redisSchemaExtensions, 'getCachedEntryExitPairs').mockRejectedValue(
      new Error('Redis connection failed')
    );

    const mockGenerator = vi.fn().mockResolvedValue([]);

    // Should fallback to direct generation on cache failure
    await expect(
      performanceService.getOptimizedEntryExitPairs('Medium', 8, mockGenerator)
    ).resolves.not.toThrow();

    expect(mockGenerator).toHaveBeenCalledOnce();
  });
});
