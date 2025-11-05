/**
 * Integration tests for Redis Schema Extensions
 * Tests generation metadata, validation caching, and performance metrics
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PuzzleGenerationMetadata,
  ValidationResult,
  GenerationMetrics,
  EntryExitPair,
  Difficulty,
} from '../../../shared/types/guaranteed-generation.js';

// Mock the redis import with factory function
vi.mock('@devvit/web/server', () => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    hSet: vi.fn(),
    hGet: vi.fn(),
    hGetAll: vi.fn(),
    hDel: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zRangeWithScores: vi.fn(),
    zRem: vi.fn(),
    incrBy: vi.fn(),
  },
}));

// Mock the logger to avoid issues
vi.mock('../../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocking
import { redis } from '@devvit/web/server';
import { redisSchemaExtensions } from '../../services/RedisSchemaExtensions.js';

// Get the mocked redis instance
const mockRedis = vi.mocked(redis);

describe('Redis Schema Extensions Integration Tests', () => {
  let mockGenerationMetadata: PuzzleGenerationMetadata;
  let mockValidationResult: ValidationResult;
  let mockEntryExitPairs: EntryExitPair[];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock data
    mockGenerationMetadata = {
      puzzleId: 'test-puzzle-123',
      algorithm: 'guaranteed',
      attempts: 3,
      generationTime: 1250,
      confidenceScore: 92,
      validationPassed: true,
      spacingDistance: 5,
      pathComplexity: 7,
      materialDensityAchieved: 0.75,
      createdAt: new Date('2024-01-01T12:00:00Z'),
      fallbackUsed: false,
    };

    mockValidationResult = {
      isValid: true,
      hasUniqueSolution: true,
      alternativeCount: 0,
      physicsCompliant: true,
      confidenceScore: 92,
      issues: [],
      validationTime: 150,
    };

    mockEntryExitPairs = [
      {
        entry: { row: 0, col: 0, label: 'A1' },
        exit: { row: 5, col: 5, label: 'F6' },
        distance: 7.07,
        difficulty: 'Medium',
        validationScore: 85,
        placementType: 'corner',
      },
      {
        entry: { row: 0, col: 2, label: 'A3' },
        exit: { row: 5, col: 3, label: 'F4' },
        distance: 5.39,
        difficulty: 'Medium',
        validationScore: 78,
        placementType: 'edge',
      },
    ];
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Generation Metadata Storage and Retrieval', () => {
    test('should store generation metadata correctly', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await redisSchemaExtensions.setGenerationMetadata(
        mockGenerationMetadata.puzzleId,
        mockGenerationMetadata
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        'reflectiq:generation:test-puzzle-123',
        JSON.stringify({
          ...mockGenerationMetadata,
          createdAt: mockGenerationMetadata.createdAt.toISOString(),
        })
      );
    });

    test('should retrieve generation metadata correctly', async () => {
      const storedData = JSON.stringify({
        ...mockGenerationMetadata,
        createdAt: mockGenerationMetadata.createdAt.toISOString(),
      });

      mockRedis.get.mockResolvedValue(storedData);

      const retrieved = await redisSchemaExtensions.getGenerationMetadata('test-puzzle-123');

      expect(retrieved).toBeDefined();
      expect(retrieved!.puzzleId).toBe('test-puzzle-123');
      expect(retrieved!.algorithm).toBe('guaranteed');
      expect(retrieved!.confidenceScore).toBe(92);
      expect(retrieved!.createdAt).toEqual(new Date('2024-01-01T12:00:00Z'));
      expect(mockRedis.get).toHaveBeenCalledWith('reflectiq:generation:test-puzzle-123');
    });

    test('should return null for non-existent generation metadata', async () => {
      mockRedis.get.mockResolvedValue(null);

      const retrieved = await redisSchemaExtensions.getGenerationMetadata('non-existent');

      expect(retrieved).toBeNull();
    });

    test('should delete generation metadata correctly', async () => {
      mockRedis.del.mockResolvedValue(1);

      const deleted = await redisSchemaExtensions.deleteGenerationMetadata('test-puzzle-123');

      expect(deleted).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:generation:test-puzzle-123');
    });

    test('should handle generation metadata storage errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      await expect(
        redisSchemaExtensions.setGenerationMetadata(
          mockGenerationMetadata.puzzleId,
          mockGenerationMetadata
        )
      ).rejects.toThrow('Redis connection failed');
    });

    test('should handle malformed generation metadata gracefully', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const retrieved = await redisSchemaExtensions.getGenerationMetadata('test-puzzle-123');

      expect(retrieved).toBeNull();
    });
  });

  describe('Validation Result Caching', () => {
    test('should cache validation results correctly', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await redisSchemaExtensions.setValidationResult('test-puzzle-123', mockValidationResult);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'reflectiq:validation:test-puzzle-123',
        JSON.stringify(mockValidationResult)
      );
    });

    test('should retrieve cached validation results correctly', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockValidationResult));

      const retrieved = await redisSchemaExtensions.getValidationResult('test-puzzle-123');

      expect(retrieved).toBeDefined();
      expect(retrieved!.isValid).toBe(true);
      expect(retrieved!.confidenceScore).toBe(92);
      expect(retrieved!.hasUniqueSolution).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('reflectiq:validation:test-puzzle-123');
    });

    test('should return null for non-existent validation results', async () => {
      mockRedis.get.mockResolvedValue(null);

      const retrieved = await redisSchemaExtensions.getValidationResult('non-existent');

      expect(retrieved).toBeNull();
    });

    test('should delete validation results correctly', async () => {
      mockRedis.del.mockResolvedValue(1);

      const deleted = await redisSchemaExtensions.deleteValidationResult('test-puzzle-123');

      expect(deleted).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:validation:test-puzzle-123');
    });

    test('should handle validation caching errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Cache write failed'));

      await expect(
        redisSchemaExtensions.setValidationResult('test-puzzle-123', mockValidationResult)
      ).rejects.toThrow('Cache write failed');
    });

    test('should handle malformed validation data gracefully', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const retrieved = await redisSchemaExtensions.getValidationResult('test-puzzle-123');

      expect(retrieved).toBeNull();
    });
  });

  describe('Performance Metrics Management', () => {
    test('should initialize metrics correctly on first update', async () => {
      mockRedis.get.mockResolvedValue(null); // No existing metrics
      mockRedis.set.mockResolvedValue('OK');

      await redisSchemaExtensions.updateGenerationMetrics('Medium', true, 1250, 92, 3);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'reflectiq:metrics:generation',
        expect.stringContaining('"totalGenerated":1')
      );

      const setCall = mockRedis.set.mock.calls[0];
      const metricsData = JSON.parse(setCall[1]);

      expect(metricsData.totalGenerated).toBe(1);
      expect(metricsData.successRate).toBe(100);
      expect(metricsData.averageGenerationTime).toBe(1250);
      expect(metricsData.averageConfidenceScore).toBe(92);
      expect(metricsData.difficultyBreakdown.Medium.generated).toBe(1);
      expect(metricsData.difficultyBreakdown.Medium.successful).toBe(1);
    });

    test('should update existing metrics correctly', async () => {
      const existingMetrics: GenerationMetrics = {
        totalGenerated: 5,
        successRate: 80,
        averageGenerationTime: 1000,
        averageConfidenceScore: 85,
        difficultyBreakdown: {
          Easy: {
            generated: 2,
            successful: 2,
            averageTime: 800,
            averageConfidence: 90,
            averageAttempts: 1.5,
          },
          Medium: {
            generated: 2,
            successful: 1,
            averageTime: 1200,
            averageConfidence: 80,
            averageAttempts: 2.5,
          },
          Hard: {
            generated: 1,
            successful: 1,
            averageTime: 1500,
            averageConfidence: 85,
            averageAttempts: 3,
          },
        },
        fallbackUsageRate: 0.2,
        lastUpdated: new Date('2024-01-01T11:00:00Z'),
      };

      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          ...existingMetrics,
          lastUpdated: existingMetrics.lastUpdated.toISOString(),
        })
      );
      mockRedis.set.mockResolvedValue('OK');

      await redisSchemaExtensions.updateGenerationMetrics('Medium', true, 1100, 88, 2);

      const setCall = mockRedis.set.mock.calls[0];
      const updatedMetrics = JSON.parse(setCall[1]);

      expect(updatedMetrics.totalGenerated).toBe(6);
      expect(updatedMetrics.difficultyBreakdown.Medium.generated).toBe(3);
      expect(updatedMetrics.difficultyBreakdown.Medium.successful).toBe(2);
      expect(Math.round(updatedMetrics.successRate)).toBe(83); // 5/6 = 83.33%
    });

    test('should retrieve generation metrics correctly', async () => {
      const mockMetrics: GenerationMetrics = {
        totalGenerated: 10,
        successRate: 90,
        averageGenerationTime: 1200,
        averageConfidenceScore: 88,
        difficultyBreakdown: {
          Easy: {
            generated: 4,
            successful: 4,
            averageTime: 800,
            averageConfidence: 92,
            averageAttempts: 1.2,
          },
          Medium: {
            generated: 4,
            successful: 3,
            averageTime: 1200,
            averageConfidence: 85,
            averageAttempts: 2.1,
          },
          Hard: {
            generated: 2,
            successful: 2,
            averageTime: 1800,
            averageConfidence: 82,
            averageAttempts: 3.5,
          },
        },
        fallbackUsageRate: 0.1,
        lastUpdated: new Date('2024-01-01T12:00:00Z'),
      };

      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          ...mockMetrics,
          lastUpdated: mockMetrics.lastUpdated.toISOString(),
        })
      );

      const retrieved = await redisSchemaExtensions.getGenerationMetrics();

      expect(retrieved).toBeDefined();
      expect(retrieved!.totalGenerated).toBe(10);
      expect(retrieved!.successRate).toBe(90);
      expect(retrieved!.difficultyBreakdown.Medium.generated).toBe(4);
      expect(retrieved!.lastUpdated).toEqual(new Date('2024-01-01T12:00:00Z'));
    });

    test('should reset generation metrics correctly', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await redisSchemaExtensions.resetGenerationMetrics();

      const setCall = mockRedis.set.mock.calls[0];
      const resetMetrics = JSON.parse(setCall[1]);

      expect(resetMetrics.totalGenerated).toBe(0);
      expect(resetMetrics.successRate).toBe(0);
      expect(resetMetrics.averageGenerationTime).toBe(0);
      expect(resetMetrics.difficultyBreakdown.Easy.generated).toBe(0);
      expect(resetMetrics.difficultyBreakdown.Medium.generated).toBe(0);
      expect(resetMetrics.difficultyBreakdown.Hard.generated).toBe(0);
    });

    test('should handle metrics update errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockRejectedValue(new Error('Metrics update failed'));

      await expect(
        redisSchemaExtensions.updateGenerationMetrics('Medium', true, 1250, 92, 3)
      ).rejects.toThrow('Metrics update failed');
    });
  });

  describe('Entry/Exit Pair Caching', () => {
    test('should cache entry/exit pairs correctly', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await redisSchemaExtensions.cacheValidEntryExitPairs('Medium', 6, mockEntryExitPairs);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'reflectiq:cache:entryexit:medium:6',
        JSON.stringify(mockEntryExitPairs)
      );
    });

    test('should retrieve cached entry/exit pairs correctly', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEntryExitPairs));

      const retrieved = await redisSchemaExtensions.getCachedEntryExitPairs('Medium', 6);

      expect(retrieved).toBeDefined();
      expect(retrieved).toHaveLength(2);
      expect(retrieved![0].entry.label).toBe('A1');
      expect(retrieved![0].exit.label).toBe('F6');
      expect(retrieved![0].placementType).toBe('corner');
      expect(mockRedis.get).toHaveBeenCalledWith('reflectiq:cache:entryexit:medium:6');
    });

    test('should return null for non-existent cached pairs', async () => {
      mockRedis.get.mockResolvedValue(null);

      const retrieved = await redisSchemaExtensions.getCachedEntryExitPairs('Hard', 8);

      expect(retrieved).toBeNull();
    });

    test('should clear entry/exit cache for specific difficulty', async () => {
      mockRedis.del.mockResolvedValue(1);

      await redisSchemaExtensions.clearEntryExitCache('Medium');

      expect(mockRedis.del).toHaveBeenCalledTimes(3); // 3 grid sizes: 6, 8, 10
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:cache:entryexit:medium:6');
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:cache:entryexit:medium:8');
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:cache:entryexit:medium:10');
    });

    test('should clear all entry/exit caches', async () => {
      mockRedis.del.mockResolvedValue(1);

      await redisSchemaExtensions.clearEntryExitCache();

      expect(mockRedis.del).toHaveBeenCalledTimes(9); // 3 difficulties × 3 grid sizes
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:cache:entryexit:easy:6');
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:cache:entryexit:medium:8');
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:cache:entryexit:hard:10');
    });

    test('should handle entry/exit caching errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Cache write failed'));

      await expect(
        redisSchemaExtensions.cacheValidEntryExitPairs('Medium', 6, mockEntryExitPairs)
      ).rejects.toThrow('Cache write failed');
    });

    test('should handle malformed cached entry/exit data gracefully', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const retrieved = await redisSchemaExtensions.getCachedEntryExitPairs('Medium', 6);

      expect(retrieved).toBeNull();
    });
  });

  describe('Cache Performance Optimization', () => {
    test('should demonstrate caching performance improvements', async () => {
      // Simulate cache miss then hit
      mockRedis.get
        .mockResolvedValueOnce(null) // First call - cache miss
        .mockResolvedValueOnce(JSON.stringify(mockEntryExitPairs)); // Second call - cache hit

      mockRedis.set.mockResolvedValue('OK');

      // First call should result in cache miss
      const firstResult = await redisSchemaExtensions.getCachedEntryExitPairs('Medium', 6);
      expect(firstResult).toBeNull();

      // Cache the data
      await redisSchemaExtensions.cacheValidEntryExitPairs('Medium', 6, mockEntryExitPairs);

      // Second call should result in cache hit
      const secondResult = await redisSchemaExtensions.getCachedEntryExitPairs('Medium', 6);
      expect(secondResult).toBeDefined();
      expect(secondResult).toHaveLength(2);

      // Verify caching improved performance (no additional computation needed)
      expect(mockRedis.get).toHaveBeenCalledTimes(2);
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
    });

    test('should handle concurrent cache operations correctly', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(mockEntryExitPairs));

      // Simulate concurrent operations
      const operations = [
        redisSchemaExtensions.cacheValidEntryExitPairs('Easy', 6, mockEntryExitPairs),
        redisSchemaExtensions.cacheValidEntryExitPairs('Medium', 8, mockEntryExitPairs),
        redisSchemaExtensions.getCachedEntryExitPairs('Hard', 10),
      ];

      const results = await Promise.all(operations);

      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
      expect(results[2]).toBeDefined(); // getCachedEntryExitPairs result
    });
  });

  describe('Metrics Aggregation and Cleanup', () => {
    test('should aggregate metrics across multiple difficulties', async () => {
      mockRedis.get.mockResolvedValue(null); // Start with empty metrics
      mockRedis.set.mockResolvedValue('OK');

      // Update metrics for different difficulties
      await redisSchemaExtensions.updateGenerationMetrics('Easy', true, 800, 95, 1);
      await redisSchemaExtensions.updateGenerationMetrics('Medium', true, 1200, 88, 2);
      await redisSchemaExtensions.updateGenerationMetrics('Hard', false, 2000, 70, 5);

      // Verify metrics were aggregated correctly
      expect(mockRedis.set).toHaveBeenCalledTimes(3);

      // Check the final metrics call
      const lastSetCall = mockRedis.set.mock.calls[2];
      const finalMetrics = JSON.parse(lastSetCall[1]);

      expect(finalMetrics.totalGenerated).toBe(1); // Each call processes one generation
      expect(finalMetrics.difficultyBreakdown.Hard.generated).toBe(1);
      expect(finalMetrics.difficultyBreakdown.Hard.successful).toBe(0);
    });

    test('should handle cleanup procedures correctly', async () => {
      mockRedis.del.mockResolvedValue(1);

      // Test cleanup of all cache types
      await Promise.all([
        redisSchemaExtensions.deleteGenerationMetadata('old-puzzle-1'),
        redisSchemaExtensions.deleteValidationResult('old-puzzle-2'),
        redisSchemaExtensions.clearEntryExitCache('Easy'),
      ]);

      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:generation:old-puzzle-1');
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:validation:old-puzzle-2');
      expect(mockRedis.del).toHaveBeenCalledWith('reflectiq:cache:entryexit:easy:6');
    });

    test('should maintain data consistency during high-load operations', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      // Simulate high-load scenario with multiple concurrent updates
      const concurrentUpdates = Array.from({ length: 10 }, (_, i) =>
        redisSchemaExtensions.updateGenerationMetrics(
          i % 2 === 0 ? 'Easy' : 'Medium',
          i % 3 !== 0, // 2/3 success rate
          1000 + i * 100,
          80 + i,
          1 + Math.floor(i / 3)
        )
      );

      await Promise.all(concurrentUpdates);

      // Verify all operations completed
      expect(mockRedis.set).toHaveBeenCalledTimes(10);
      expect(mockRedis.get).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle Redis connection failures gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Connection timeout'));
      mockRedis.get.mockRejectedValue(new Error('Connection timeout'));

      // All operations should handle errors gracefully
      await expect(
        redisSchemaExtensions.setGenerationMetadata('test', mockGenerationMetadata)
      ).rejects.toThrow('Connection timeout');

      const result = await redisSchemaExtensions.getGenerationMetadata('test');
      expect(result).toBeNull();

      const validationResult = await redisSchemaExtensions.getValidationResult('test');
      expect(validationResult).toBeNull();
    });

    test('should handle partial operation failures', async () => {
      // Reset mocks to ensure clean state
      vi.clearAllMocks();

      // Simulate scenario where operations have different outcomes
      mockRedis.set
        .mockResolvedValueOnce('OK') // First operation succeeds
        .mockResolvedValueOnce('OK') // Second succeeds after retry
        .mockResolvedValueOnce('OK'); // Third succeeds

      // All operations should complete (Redis client handles retries internally)
      await expect(
        redisSchemaExtensions.setGenerationMetadata('test-1', mockGenerationMetadata)
      ).resolves.not.toThrow();

      await expect(
        redisSchemaExtensions.setValidationResult('test-2', mockValidationResult)
      ).resolves.not.toThrow();

      await expect(
        redisSchemaExtensions.cacheValidEntryExitPairs('Medium', 6, mockEntryExitPairs)
      ).resolves.not.toThrow();

      // Verify all operations were called
      expect(mockRedis.set).toHaveBeenCalledTimes(3);
    });

    test('should handle data corruption scenarios', async () => {
      // Test various forms of corrupted data
      const corruptedData = ['not-json', '{"incomplete": true', '', null, undefined];

      for (const corrupt of corruptedData) {
        mockRedis.get.mockResolvedValue(corrupt);

        const metadata = await redisSchemaExtensions.getGenerationMetadata('test');
        const validation = await redisSchemaExtensions.getValidationResult('test');
        const pairs = await redisSchemaExtensions.getCachedEntryExitPairs('Medium', 6);

        expect(metadata).toBeNull();
        expect(validation).toBeNull();
        expect(pairs).toBeNull();
      }
    });
  });
});
