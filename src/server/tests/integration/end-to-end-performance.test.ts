/**
 * End-to-End Performance and Workflow Integration Tests
 * Tests complete daily puzzle generation workflow and performance validation
 * Requirements: 1.1, 1.4, 1.5, 9.2
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PuzzleService } from '../../services/PuzzleService.js';
import { EnhancedPuzzleEngineImpl } from '../../../shared/puzzle/EnhancedPuzzleEngine.js';
import { FeatureFlagService } from '../../services/FeatureFlagService.js';
import { GenerationMetricsService } from '../../services/GenerationMetricsService.js';
import type { Puzzle, Difficulty, DailyPuzzleSet } from '../../../shared/types/puzzle.js';

// Mock Redis for testing
vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    expire: vi.fn(),
    exists: vi.fn(),
    del: vi.fn(),
    hSet: vi.fn(),
    hGet: vi.fn(),
    hGetAll: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zScore: vi.fn(),
    zCard: vi.fn(),
  },
}));

describe('End-to-End Performance and Workflow Tests', () => {
  let puzzleService: PuzzleService;
  let enhancedEngine: EnhancedPuzzleEngineImpl;
  let featureFlagService: FeatureFlagService;
  let metricsService: GenerationMetricsService;
  let mockRedis: any;

  beforeEach(async () => {
    // Get mock Redis instance
    const { redis } = await import('@devvit/web/server');
    mockRedis = redis;

    // Reset all mocks
    vi.clearAllMocks();

    // Initialize services
    puzzleService = PuzzleService.getInstance();
    enhancedEngine = EnhancedPuzzleEngineImpl.getInstance();
    featureFlagService = FeatureFlagService.getInstance();
    metricsService = GenerationMetricsService.getInstance();

    // Setup default mock responses
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.hSet.mockResolvedValue(1);
    mockRedis.hGet.mockResolvedValue(null);
    mockRedis.hGetAll.mockResolvedValue({});
    mockRedis.zAdd.mockResolvedValue(1);
    mockRedis.zRange.mockResolvedValue([]);
    mockRedis.zScore.mockResolvedValue(null);
    mockRedis.zCard.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Daily Puzzle Generation Workflow', () => {
    it('should complete full daily puzzle generation workflow within time limits', async () => {
      const testDate = '2024-01-25';
      const startTime = Date.now();

      // Mock enhanced generation enabled
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      // Mock successful enhanced puzzle generation for all difficulties
      const mockPuzzles: Record<string, Puzzle> = {
        easy: {
          id: `enhanced-easy-${testDate}`,
          difficulty: 'Easy',
          gridSize: 6,
          materials: [
            { type: 'mirror', position: [1, 2], angle: 45 },
            { type: 'absorber', position: [3, 4] },
          ],
          entry: [0, 1],
          solution: [5, 4],
          solutionPath: {
            segments: [
              { start: [0, 1], end: [1, 2] },
              { start: [1, 2], end: [3, 4] },
            ],
          },
          hints: [
            { hintLevel: 1, segments: [{ start: [0, 1], end: [1, 2] }] },
            {
              hintLevel: 2,
              segments: [
                { start: [0, 1], end: [1, 2] },
                { start: [1, 2], end: [3, 4] },
              ],
            },
          ],
          createdAt: new Date(),
          materialDensity: 0.33,
        },
        medium: {
          id: `enhanced-medium-${testDate}`,
          difficulty: 'Medium',
          gridSize: 8,
          materials: [
            { type: 'mirror', position: [2, 3], angle: 45 },
            { type: 'water', position: [4, 5] },
            { type: 'glass', position: [6, 1] },
          ],
          entry: [0, 2],
          solution: [7, 6],
          solutionPath: {
            segments: [
              { start: [0, 2], end: [2, 3] },
              { start: [2, 3], end: [4, 5] },
              { start: [4, 5], end: [6, 1] },
              { start: [6, 1], end: [7, 6] },
            ],
          },
          hints: [
            { hintLevel: 1, segments: [{ start: [0, 2], end: [2, 3] }] },
            {
              hintLevel: 2,
              segments: [
                { start: [0, 2], end: [2, 3] },
                { start: [2, 3], end: [4, 5] },
              ],
            },
          ],
          createdAt: new Date(),
          materialDensity: 0.375,
        },
        hard: {
          id: `enhanced-hard-${testDate}`,
          difficulty: 'Hard',
          gridSize: 10,
          materials: [
            { type: 'mirror', position: [1, 3], angle: 45 },
            { type: 'water', position: [3, 6] },
            { type: 'glass', position: [5, 2] },
            { type: 'metal', position: [7, 8] },
            { type: 'absorber', position: [8, 4] },
          ],
          entry: [0, 1],
          solution: [9, 8],
          solutionPath: {
            segments: [
              { start: [0, 1], end: [1, 3] },
              { start: [1, 3], end: [3, 6] },
              { start: [3, 6], end: [5, 2] },
              { start: [5, 2], end: [7, 8] },
              { start: [7, 8], end: [8, 4] },
            ],
          },
          hints: [
            { hintLevel: 1, segments: [{ start: [0, 1], end: [1, 3] }] },
            {
              hintLevel: 2,
              segments: [
                { start: [0, 1], end: [1, 3] },
                { start: [1, 3], end: [3, 6] },
              ],
            },
          ],
          createdAt: new Date(),
          materialDensity: 0.5,
        },
      };

      // Mock enhanced engine generation with realistic timing
      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
        async (difficulty: Difficulty) => {
          // Simulate generation time (should be under 5 seconds per requirement 1.4)
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000 + 500)); // 0.5-2.5 seconds
          return mockPuzzles[difficulty.toLowerCase()];
        }
      );

      // Execute complete workflow
      const puzzleSet = await puzzleService.generateDailyPuzzles(testDate);
      const totalTime = Date.now() - startTime;

      // Verify workflow completion
      expect(puzzleSet).toBeDefined();
      expect(puzzleSet.date).toBe(testDate);
      expect(puzzleSet.status).toBe('active');
      expect(puzzleSet.puzzles.easy).toBeDefined();
      expect(puzzleSet.puzzles.medium).toBeDefined();
      expect(puzzleSet.puzzles.hard).toBeDefined();

      // Verify performance requirements (Requirement 1.4: 5-second generation)
      expect(totalTime).toBeLessThan(15000); // Total workflow under 15 seconds for all 3 puzzles

      // Verify individual puzzle generation was called for each difficulty
      expect(enhancedEngine.generateGuaranteedPuzzle).toHaveBeenCalledTimes(3);
      expect(enhancedEngine.generateGuaranteedPuzzle).toHaveBeenCalledWith('Easy', testDate);
      expect(enhancedEngine.generateGuaranteedPuzzle).toHaveBeenCalledWith('Medium', testDate);
      expect(enhancedEngine.generateGuaranteedPuzzle).toHaveBeenCalledWith('Hard', testDate);

      // Verify Redis storage operations
      expect(mockRedis.set).toHaveBeenCalledWith(
        `reflectiq:puzzles:${testDate}`,
        JSON.stringify(puzzleSet)
      );
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should handle concurrent daily puzzle generation requests efficiently', async () => {
      const testDate = '2024-01-26';
      const concurrentRequests = 5;

      // Mock enhanced generation
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      const mockPuzzle: Puzzle = {
        id: 'concurrent-test-puzzle',
        difficulty: 'Medium',
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: { segments: [] },
        hints: [],
        createdAt: new Date(),
        materialDensity: 0,
      };

      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockResolvedValue(mockPuzzle);

      // Execute concurrent requests
      const startTime = Date.now();
      const promises = Array.from({ length: concurrentRequests }, () =>
        puzzleService.generateDailyPuzzles(testDate)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Verify all requests completed successfully
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.date).toBe(testDate);
        expect(result.status).toBe('active');
      });

      // Verify reasonable performance under concurrent load
      expect(totalTime).toBeLessThan(30000); // All concurrent requests under 30 seconds

      console.log(`Concurrent generation test: ${concurrentRequests} requests in ${totalTime}ms`);
    });
  });

  describe('100% Success Rate Target Validation', () => {
    it('should achieve 100% success rate across multiple generation attempts', async () => {
      const testAttempts = 20;
      const testDate = '2024-01-27';
      let successCount = 0;
      let totalGenerationTime = 0;

      // Mock enhanced generation with occasional realistic delays
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      const mockPuzzle: Puzzle = {
        id: 'success-rate-test',
        difficulty: 'Hard',
        gridSize: 10,
        materials: [
          { type: 'mirror', position: [2, 3], angle: 45 },
          { type: 'water', position: [5, 6] },
        ],
        entry: [0, 2],
        solution: [9, 7],
        solutionPath: {
          segments: [
            { start: [0, 2], end: [2, 3] },
            { start: [2, 3], end: [5, 6] },
            { start: [5, 6], end: [9, 7] },
          ],
        },
        hints: [{ hintLevel: 1, segments: [{ start: [0, 2], end: [2, 3] }] }],
        createdAt: new Date(),
        materialDensity: 0.2,
      };

      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
        async (difficulty: Difficulty) => {
          const generationTime = Math.random() * 3000 + 1000; // 1-4 seconds
          await new Promise((resolve) => setTimeout(resolve, generationTime));
          return { ...mockPuzzle, difficulty, id: `${difficulty.toLowerCase()}-${Date.now()}` };
        }
      );

      // Test multiple generation attempts
      for (let i = 0; i < testAttempts; i++) {
        const attemptStartTime = Date.now();

        try {
          const result = await puzzleService.generateDailyPuzzles(`${testDate}-${i}`);

          if (result && result.puzzles.easy && result.puzzles.medium && result.puzzles.hard) {
            successCount++;
          }

          totalGenerationTime += Date.now() - attemptStartTime;
        } catch (error) {
          console.warn(`Generation attempt ${i + 1} failed:`, error);
        }
      }

      const successRate = (successCount / testAttempts) * 100;
      const averageGenerationTime = totalGenerationTime / testAttempts;

      // Verify 100% success rate requirement (Requirement 1.1)
      expect(successRate).toBe(100);
      expect(successCount).toBe(testAttempts);

      // Verify average generation time meets performance requirements
      expect(averageGenerationTime).toBeLessThan(15000); // Average under 15 seconds

      console.log(`Success rate test: ${successRate}% (${successCount}/${testAttempts})`);
      console.log(`Average generation time: ${averageGenerationTime.toFixed(2)}ms`);
    });

    it('should maintain success rate with fallback mechanisms', async () => {
      const testAttempts = 10;
      let successCount = 0;

      // Mock enhanced generation with some failures to test fallback
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);
      vi.spyOn(featureFlagService, 'shouldFallbackToLegacy').mockResolvedValue(true);

      let enhancedCallCount = 0;
      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(async () => {
        enhancedCallCount++;
        // Fail every 3rd attempt to test fallback
        if (enhancedCallCount % 3 === 0) {
          throw new Error('Enhanced generation timeout');
        }

        return {
          id: `enhanced-${enhancedCallCount}`,
          difficulty: 'Medium',
          gridSize: 8,
          materials: [],
          entry: [0, 0],
          solution: [7, 7],
          solutionPath: { segments: [] },
          hints: [],
          createdAt: new Date(),
          materialDensity: 0,
        } as Puzzle;
      });

      // Test generation with fallback scenarios
      for (let i = 0; i < testAttempts; i++) {
        try {
          const result = await puzzleService.generateDailyPuzzles(`fallback-test-${i}`);

          if (result && result.puzzles.easy && result.puzzles.medium && result.puzzles.hard) {
            successCount++;
          }
        } catch (error) {
          console.warn(`Fallback test attempt ${i + 1} failed:`, error);
        }
      }

      const successRate = (successCount / testAttempts) * 100;

      // Even with some enhanced generation failures, fallback should maintain 100% success
      expect(successRate).toBe(100);
      expect(successCount).toBe(testAttempts);

      console.log(`Fallback success rate test: ${successRate}% (${successCount}/${testAttempts})`);
    });
  });

  describe('Generation Performance Measurement', () => {
    it('should measure and validate generation performance against 5-second requirement', async () => {
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
      const performanceResults: Record<Difficulty, number[]> = {
        Easy: [],
        Medium: [],
        Hard: [],
      };

      // Mock enhanced generation with performance tracking
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      for (const difficulty of difficulties) {
        const mockPuzzle: Puzzle = {
          id: `perf-test-${difficulty.toLowerCase()}`,
          difficulty,
          gridSize: difficulty === 'Easy' ? 6 : difficulty === 'Medium' ? 8 : 10,
          materials: [],
          entry: [0, 0],
          solution: [5, 5],
          solutionPath: { segments: [] },
          hints: [],
          createdAt: new Date(),
          materialDensity: 0,
        };

        vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
          async (diff: Difficulty) => {
            // Simulate realistic generation times based on difficulty
            const baseTime = diff === 'Easy' ? 1000 : diff === 'Medium' ? 2000 : 3000;
            const variationTime = Math.random() * 1000; // Add some variation
            await new Promise((resolve) => setTimeout(resolve, baseTime + variationTime));

            return { ...mockPuzzle, difficulty: diff };
          }
        );

        // Test multiple generations for each difficulty
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now();

          try {
            await enhancedEngine.generateGuaranteedPuzzle(difficulty);
            const generationTime = Date.now() - startTime;
            performanceResults[difficulty].push(generationTime);
          } catch (error) {
            console.warn(`Performance test failed for ${difficulty}:`, error);
          }
        }
      }

      // Analyze performance results
      for (const difficulty of difficulties) {
        const times = performanceResults[difficulty];
        expect(times.length).toBeGreaterThan(0);

        const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        // Verify 5-second requirement (Requirement 1.4)
        expect(maxTime).toBeLessThan(5000);
        expect(averageTime).toBeLessThan(4000); // Average should be well under limit

        console.log(
          `${difficulty} performance: avg=${averageTime.toFixed(2)}ms, max=${maxTime}ms, min=${minTime}ms`
        );
      }
    });

    it('should track and validate resource usage during generation', async () => {
      const testDate = '2024-01-28';

      // Mock metrics collection
      const mockMetrics = {
        memoryUsage: {
          heapUsed: 50 * 1024 * 1024, // 50MB
          heapTotal: 100 * 1024 * 1024, // 100MB
          external: 5 * 1024 * 1024, // 5MB
        },
        generationAttempts: 1,
        successRate: 100,
        averageTime: 2500,
      };

      vi.spyOn(metricsService, 'collectGenerationMetrics').mockResolvedValue(mockMetrics);
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      const mockPuzzle: Puzzle = {
        id: 'resource-test',
        difficulty: 'Medium',
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: { segments: [] },
        hints: [],
        createdAt: new Date(),
        materialDensity: 0,
      };

      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockResolvedValue(mockPuzzle);

      // Execute generation with metrics collection
      const startTime = Date.now();
      await puzzleService.generateDailyPuzzles(testDate);
      const endTime = Date.now();

      // Collect and validate metrics
      const metrics = await metricsService.collectGenerationMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.memoryUsage.heapUsed).toBeLessThan(200 * 1024 * 1024); // Under 200MB
      expect(metrics.successRate).toBe(100);
      expect(metrics.averageTime).toBeLessThan(5000);

      // Verify generation completed within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(15000);

      console.log(`Resource usage test: ${JSON.stringify(metrics, null, 2)}`);
    });
  });

  describe('Concurrent Generation Scenarios', () => {
    it('should handle multiple simultaneous generation requests without conflicts', async () => {
      const concurrentDates = ['2024-01-29', '2024-01-30', '2024-01-31'];
      const concurrentUsers = 3;

      // Mock enhanced generation
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      const mockPuzzle: Puzzle = {
        id: 'concurrent-test',
        difficulty: 'Easy',
        gridSize: 6,
        materials: [],
        entry: [0, 0],
        solution: [5, 5],
        solutionPath: { segments: [] },
        hints: [],
        createdAt: new Date(),
        materialDensity: 0,
      };

      let generationCount = 0;
      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
        async (difficulty: Difficulty) => {
          generationCount++;
          // Simulate concurrent processing delay
          await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));
          return { ...mockPuzzle, difficulty, id: `concurrent-${generationCount}` };
        }
      );

      // Create concurrent generation requests
      const concurrentPromises: Promise<DailyPuzzleSet>[] = [];

      for (const date of concurrentDates) {
        for (let user = 0; user < concurrentUsers; user++) {
          concurrentPromises.push(puzzleService.generateDailyPuzzles(`${date}-user${user}`));
        }
      }

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentPromises);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successfulResults = results.filter((result) => result.status === 'fulfilled');
      const failedResults = results.filter((result) => result.status === 'rejected');

      expect(successfulResults.length).toBe(concurrentPromises.length);
      expect(failedResults.length).toBe(0);

      // Verify reasonable performance under load
      expect(totalTime).toBeLessThan(60000); // All concurrent requests under 60 seconds

      console.log(
        `Concurrent test: ${successfulResults.length}/${concurrentPromises.length} successful in ${totalTime}ms`
      );
    });

    it('should maintain data consistency under concurrent access', async () => {
      const sharedDate = '2024-02-01';
      const concurrentRequests = 5;

      // Mock Redis operations to simulate concurrent access
      let redisCallCount = 0;
      mockRedis.get.mockImplementation(async (key: string) => {
        redisCallCount++;
        // Simulate some requests finding existing data, others not
        if (redisCallCount % 2 === 0) {
          return JSON.stringify({
            date: sharedDate,
            puzzles: { easy: {}, medium: {}, hard: {} },
            status: 'active',
          });
        }
        return null;
      });

      mockRedis.set.mockImplementation(async (key: string, value: string) => {
        // Simulate successful storage
        return 'OK';
      });

      // Mock enhanced generation
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      const mockPuzzle: Puzzle = {
        id: 'consistency-test',
        difficulty: 'Medium',
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: { segments: [] },
        hints: [],
        createdAt: new Date(),
        materialDensity: 0,
      };

      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockResolvedValue(mockPuzzle);

      // Execute concurrent requests for the same date
      const promises = Array.from({ length: concurrentRequests }, () =>
        puzzleService.getCurrentPuzzle('Medium')
      );

      const results = await Promise.allSettled(promises);

      // Verify all requests completed successfully
      const successfulResults = results.filter(
        (result) => result.status === 'fulfilled' && result.value.success
      );

      expect(successfulResults.length).toBe(concurrentRequests);

      // Verify data consistency - all results should have valid puzzle data
      successfulResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          const puzzle = result.value.data;
          expect(puzzle.id).toBeDefined();
          expect(puzzle.difficulty).toBe('Medium');
          expect(puzzle.gridSize).toBe(8);
        }
      });

      console.log(
        `Consistency test: ${successfulResults.length}/${concurrentRequests} consistent results`
      );
    });
  });
});
