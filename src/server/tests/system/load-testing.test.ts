/**
 * Load Testing for Guaranteed Puzzle Generation System
 * Tests system behavior under various load conditions
 * Validates performance, memory usage, and stability
 *
 * Requirements Coverage:
 * - System behavior under load
 * - Performance degradation monitoring
 * - Memory management validation
 * - Concurrent request handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedPuzzleEngineImpl } from '../../../shared/puzzle/EnhancedPuzzleEngine.js';
import { PuzzleService } from '../../services/PuzzleService.js';
import { CacheManager } from '../../services/CacheManager.js';
import { Difficulty, Puzzle } from '../../../shared/types/puzzle.js';

describe('Load Testing - System Behavior Under Various Conditions', () => {
  let enhancedEngine: EnhancedPuzzleEngineImpl;
  let puzzleService: PuzzleService;
  let cacheManager: CacheManager;

  beforeEach(() => {
    enhancedEngine = EnhancedPuzzleEngineImpl.getInstance();
    puzzleService = PuzzleService.getInstance();
    cacheManager = CacheManager.getInstance();

    // Clear metrics for clean testing
    enhancedEngine.clearOldMetrics(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Concurrent Load Tests', () => {
    it('should handle high concurrent puzzle generation requests', async () => {
      const testDate = '2025-01-20';
      const concurrentRequests = 10;
      const difficulty: Difficulty = 'Easy';
      const maxTimePerRequest = 15000; // 15 seconds max per request

      console.log(`🔄 Starting ${concurrentRequests} concurrent generation requests...`);

      const generationPromises = Array.from({ length: concurrentRequests }, (_, i) => {
        const requestStartTime = Date.now();
        return enhancedEngine
          .generateGuaranteedPuzzle(difficulty, `${testDate}-load-${i}`)
          .then((puzzle) => ({
            success: true,
            puzzle,
            duration: Date.now() - requestStartTime,
            index: i,
          }))
          .catch((error) => ({
            success: false,
            error: error.message,
            duration: Date.now() - requestStartTime,
            index: i,
          }));
      });

      const startTime = Date.now();
      const results = await Promise.all(generationPromises);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxTime = Math.max(...results.map((r) => r.duration));
      const minTime = Math.min(...results.map((r) => r.duration));

      // Assertions
      expect(successful).toBeGreaterThanOrEqual(concurrentRequests * 0.8); // At least 80% success
      expect(averageTime).toBeLessThan(maxTimePerRequest);
      expect(maxTime).toBeLessThan(maxTimePerRequest * 1.5); // Allow some variance

      // Verify puzzle uniqueness
      const successfulResults = results.filter((r) => r.success);
      const puzzleIds = successfulResults.map((r) => r.puzzle?.id).filter(Boolean);
      const uniqueIds = new Set(puzzleIds);
      expect(uniqueIds.size).toBe(puzzleIds.length); // All puzzles should be unique

      console.log(`✅ Concurrent load test results:`);
      console.log(
        `   - Success rate: ${successful}/${concurrentRequests} (${((successful / concurrentRequests) * 100).toFixed(1)}%)`
      );
      console.log(`   - Total time: ${totalTime}ms`);
      console.log(`   - Average time per request: ${averageTime.toFixed(0)}ms`);
      console.log(`   - Time range: ${minTime}ms - ${maxTime}ms`);
      console.log(`   - Failed requests: ${failed}`);

      if (failed > 0) {
        const failedResults = results.filter((r) => !r.success);
        console.log(
          `   - Failure reasons:`,
          failedResults.map((r) => r.error)
        );
      }
    }, 120000);

    it('should maintain performance under mixed difficulty concurrent requests', async () => {
      const testDate = '2025-01-21';
      const requestsPerDifficulty = 3;
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      console.log(`🔄 Testing mixed difficulty concurrent load...`);

      const allPromises: Promise<any>[] = [];

      difficulties.forEach((difficulty) => {
        for (let i = 0; i < requestsPerDifficulty; i++) {
          const promise = enhancedEngine
            .generateGuaranteedPuzzle(difficulty, `${testDate}-mixed-${difficulty}-${i}`)
            .then((puzzle) => ({
              success: true,
              difficulty,
              puzzle,
              index: i,
            }))
            .catch((error) => ({
              success: false,
              difficulty,
              error: error.message,
              index: i,
            }));

          allPromises.push(promise);
        }
      });

      const results = await Promise.all(allPromises);

      // Analyze by difficulty
      const resultsByDifficulty = difficulties.reduce(
        (acc, diff) => {
          acc[diff] = results.filter((r) => r.difficulty === diff);
          return acc;
        },
        {} as Record<Difficulty, any[]>
      );

      for (const difficulty of difficulties) {
        const diffResults = resultsByDifficulty[difficulty];
        const successful = diffResults.filter((r) => r.success).length;
        const successRate = (successful / requestsPerDifficulty) * 100;

        expect(successful).toBeGreaterThan(0); // At least some should succeed
        console.log(
          `   - ${difficulty}: ${successful}/${requestsPerDifficulty} successful (${successRate.toFixed(1)}%)`
        );
      }

      console.log(`✅ Mixed difficulty concurrent test completed`);
    }, 90000);
  });

  describe('Sustained Load Tests', () => {
    it('should handle sustained generation load without performance degradation', async () => {
      const testDate = '2025-01-22';
      const sustainedRequests = 12;
      const difficulty: Difficulty = 'Easy';
      const batchSize = 3;
      const delayBetweenBatches = 1000; // 1 second

      console.log(
        `🔄 Starting sustained load test with ${sustainedRequests} requests in batches of ${batchSize}...`
      );

      const batchResults: Array<{
        batchNumber: number;
        averageTime: number;
        successRate: number;
        memoryUsage?: number;
      }> = [];

      for (let batch = 0; batch < sustainedRequests / batchSize; batch++) {
        const batchStartTime = Date.now();
        const batchPromises: Promise<any>[] = [];

        // Generate batch of requests
        for (let i = 0; i < batchSize; i++) {
          const requestIndex = batch * batchSize + i;
          const promise = enhancedEngine
            .generateGuaranteedPuzzle(difficulty, `${testDate}-sustained-${requestIndex}`)
            .then((puzzle) => ({
              success: true,
              puzzle,
              duration: Date.now() - batchStartTime,
            }))
            .catch((error) => ({
              success: false,
              error: error.message,
              duration: Date.now() - batchStartTime,
            }));

          batchPromises.push(promise);
        }

        const batchResults_current = await Promise.all(batchPromises);
        const successful = batchResults_current.filter((r) => r.success).length;
        const averageTime =
          batchResults_current.reduce((sum, r) => sum + r.duration, 0) /
          batchResults_current.length;
        const successRate = (successful / batchSize) * 100;

        // Record memory usage if available
        const memoryUsage = process.memoryUsage?.()?.heapUsed;

        batchResults.push({
          batchNumber: batch + 1,
          averageTime,
          successRate,
          memoryUsage,
        });

        console.log(
          `   - Batch ${batch + 1}: ${successful}/${batchSize} successful, avg time: ${averageTime.toFixed(0)}ms`
        );

        // Clean up old metrics periodically
        if (batch % 2 === 0) {
          enhancedEngine.clearOldMetrics(5000); // Clear metrics older than 5 seconds
        }

        // Delay between batches
        if (batch < sustainedRequests / batchSize - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
        }
      }

      // Analyze performance trends
      const firstHalf = batchResults.slice(0, Math.floor(batchResults.length / 2));
      const secondHalf = batchResults.slice(Math.floor(batchResults.length / 2));

      const firstHalfAvgTime =
        firstHalf.reduce((sum, b) => sum + b.averageTime, 0) / firstHalf.length;
      const secondHalfAvgTime =
        secondHalf.reduce((sum, b) => sum + b.averageTime, 0) / secondHalf.length;

      const firstHalfSuccessRate =
        firstHalf.reduce((sum, b) => sum + b.successRate, 0) / firstHalf.length;
      const secondHalfSuccessRate =
        secondHalf.reduce((sum, b) => sum + b.successRate, 0) / secondHalf.length;

      // Performance should not degrade significantly
      expect(secondHalfAvgTime).toBeLessThan(firstHalfAvgTime * 1.5); // Max 50% degradation
      expect(secondHalfSuccessRate).toBeGreaterThan(70); // Maintain reasonable success rate

      console.log(`✅ Sustained load test results:`);
      console.log(`   - First half avg time: ${firstHalfAvgTime.toFixed(0)}ms`);
      console.log(`   - Second half avg time: ${secondHalfAvgTime.toFixed(0)}ms`);
      console.log(
        `   - Performance degradation: ${((secondHalfAvgTime / firstHalfAvgTime - 1) * 100).toFixed(1)}%`
      );
      console.log(`   - First half success rate: ${firstHalfSuccessRate.toFixed(1)}%`);
      console.log(`   - Second half success rate: ${secondHalfSuccessRate.toFixed(1)}%`);
    }, 120000);
  });

  describe('Memory and Resource Tests', () => {
    it('should manage memory efficiently during extended operations', async () => {
      const testDate = '2025-01-23';
      const extendedRequests = 20;
      const difficulty: Difficulty = 'Easy';
      const memoryCheckInterval = 5;

      console.log(`🔄 Testing memory management over ${extendedRequests} requests...`);

      const memorySnapshots: Array<{
        request: number;
        heapUsed: number;
        heapTotal: number;
        external: number;
      }> = [];

      // Initial memory snapshot
      if (process.memoryUsage) {
        const initialMemory = process.memoryUsage();
        memorySnapshots.push({
          request: 0,
          heapUsed: initialMemory.heapUsed,
          heapTotal: initialMemory.heapTotal,
          external: initialMemory.external,
        });
      }

      for (let i = 1; i <= extendedRequests; i++) {
        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
          difficulty,
          `${testDate}-memory-${i}`
        );

        expect(puzzle).toBeDefined();

        // Take memory snapshot at intervals
        if (i % memoryCheckInterval === 0 && process.memoryUsage) {
          const currentMemory = process.memoryUsage();
          memorySnapshots.push({
            request: i,
            heapUsed: currentMemory.heapUsed,
            heapTotal: currentMemory.heapTotal,
            external: currentMemory.external,
          });
        }

        // Perform cleanup every 10 requests
        if (i % 10 === 0) {
          enhancedEngine.clearOldMetrics(2000); // Clear metrics older than 2 seconds

          // Force garbage collection if available (for testing)
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Analyze memory usage
      if (memorySnapshots.length > 1) {
        const initialHeap = memorySnapshots[0].heapUsed;
        const finalHeap = memorySnapshots[memorySnapshots.length - 1].heapUsed;
        const memoryIncrease = finalHeap - initialHeap;
        const memoryIncreasePercent = (memoryIncrease / initialHeap) * 100;

        // Memory increase should be reasonable (less than 100% increase)
        expect(memoryIncreasePercent).toBeLessThan(100);

        console.log(`✅ Memory management test results:`);
        console.log(`   - Initial heap: ${(initialHeap / 1024 / 1024).toFixed(1)}MB`);
        console.log(`   - Final heap: ${(finalHeap / 1024 / 1024).toFixed(1)}MB`);
        console.log(
          `   - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB (${memoryIncreasePercent.toFixed(1)}%)`
        );

        // Log memory progression
        memorySnapshots.forEach((snapshot) => {
          console.log(
            `   - Request ${snapshot.request}: ${(snapshot.heapUsed / 1024 / 1024).toFixed(1)}MB heap`
          );
        });
      } else {
        console.log(`✅ Memory management test completed (memory tracking unavailable)`);
      }
    }, 90000);

    it('should handle cache pressure and cleanup efficiently', async () => {
      const testDate = '2025-01-24';
      const cacheStressRequests = 15;
      const difficulty: Difficulty = 'Easy';

      console.log(`🔄 Testing cache pressure handling...`);

      const puzzleIds: string[] = [];

      // Generate puzzles to fill cache
      for (let i = 0; i < cacheStressRequests; i++) {
        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
          difficulty,
          `${testDate}-cache-${i}`
        );

        puzzleIds.push(puzzle.id);

        // Store in cache
        await cacheManager.storePuzzle(puzzle);

        // Verify cache storage
        const cachedPuzzle = await cacheManager.getPuzzle(puzzle.id);
        expect(cachedPuzzle).toBeDefined();
      }

      // Test cache retrieval performance
      const retrievalStartTime = Date.now();
      const retrievalPromises = puzzleIds.map((id) => cacheManager.getPuzzle(id));
      const retrievedPuzzles = await Promise.all(retrievalPromises);
      const retrievalTime = Date.now() - retrievalStartTime;

      // Verify all puzzles retrieved successfully
      const successfulRetrievals = retrievedPuzzles.filter((p) => p !== null).length;
      expect(successfulRetrievals).toBe(puzzleIds.length);

      // Retrieval should be fast
      const averageRetrievalTime = retrievalTime / puzzleIds.length;
      expect(averageRetrievalTime).toBeLessThan(100); // Less than 100ms per retrieval on average

      console.log(`✅ Cache pressure test results:`);
      console.log(`   - Stored puzzles: ${puzzleIds.length}`);
      console.log(`   - Retrieved puzzles: ${successfulRetrievals}`);
      console.log(`   - Total retrieval time: ${retrievalTime}ms`);
      console.log(`   - Average retrieval time: ${averageRetrievalTime.toFixed(1)}ms`);
    }, 60000);
  });

  describe('Stress and Edge Case Tests', () => {
    it('should handle rapid successive requests without failure', async () => {
      const testDate = '2025-01-25';
      const rapidRequests = 8;
      const difficulty: Difficulty = 'Easy';
      const minDelayMs = 100; // Minimum delay between requests

      console.log(`🔄 Testing rapid successive requests...`);

      const results: Array<{
        success: boolean;
        duration: number;
        index: number;
      }> = [];

      for (let i = 0; i < rapidRequests; i++) {
        const startTime = Date.now();

        try {
          const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
            difficulty,
            `${testDate}-rapid-${i}`
          );

          results.push({
            success: true,
            duration: Date.now() - startTime,
            index: i,
          });

          expect(puzzle).toBeDefined();
        } catch (error) {
          results.push({
            success: false,
            duration: Date.now() - startTime,
            index: i,
          });
        }

        // Small delay to simulate rapid but not instantaneous requests
        await new Promise((resolve) => setTimeout(resolve, minDelayMs));
      }

      const successful = results.filter((r) => r.success).length;
      const successRate = (successful / rapidRequests) * 100;
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      // Should handle most rapid requests successfully
      expect(successRate).toBeGreaterThan(75); // At least 75% success rate

      console.log(`✅ Rapid requests test results:`);
      console.log(`   - Success rate: ${successful}/${rapidRequests} (${successRate.toFixed(1)}%)`);
      console.log(`   - Average response time: ${averageTime.toFixed(0)}ms`);
    }, 45000);

    it('should recover gracefully from temporary resource constraints', async () => {
      const testDate = '2025-01-26';
      const difficulty: Difficulty = 'Medium';
      const constraintSimulationRequests = 6;

      console.log(`🔄 Testing recovery from resource constraints...`);

      // Simulate resource constraint by reducing timeout temporarily
      const originalConfig = enhancedEngine.getConfig();
      enhancedEngine.updateConfig({
        timeoutMs: 2000, // Very short timeout to simulate constraint
        maxGenerationAttempts: 3, // Fewer attempts
      });

      const constrainedResults: boolean[] = [];

      try {
        // Generate under constraints
        for (let i = 0; i < constraintSimulationRequests; i++) {
          try {
            const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
              difficulty,
              `${testDate}-constrained-${i}`
            );
            constrainedResults.push(true);
            expect(puzzle).toBeDefined();
          } catch (error) {
            constrainedResults.push(false);
            console.log(`   - Request ${i + 1} failed under constraints: ${error}`);
          }
        }

        // Restore normal configuration
        enhancedEngine.updateConfig(originalConfig);

        // Test recovery
        const recoveryResults: boolean[] = [];
        for (let i = 0; i < 3; i++) {
          try {
            const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
              difficulty,
              `${testDate}-recovery-${i}`
            );
            recoveryResults.push(true);
            expect(puzzle).toBeDefined();
          } catch (error) {
            recoveryResults.push(false);
          }
        }

        const constrainedSuccessRate =
          (constrainedResults.filter(Boolean).length / constrainedResults.length) * 100;
        const recoverySuccessRate =
          (recoveryResults.filter(Boolean).length / recoveryResults.length) * 100;

        // Recovery should be significantly better than constrained performance
        expect(recoverySuccessRate).toBeGreaterThan(constrainedSuccessRate);
        expect(recoverySuccessRate).toBeGreaterThan(66); // At least 2/3 should succeed in recovery

        console.log(`✅ Resource constraint recovery test results:`);
        console.log(`   - Constrained success rate: ${constrainedSuccessRate.toFixed(1)}%`);
        console.log(`   - Recovery success rate: ${recoverySuccessRate.toFixed(1)}%`);
      } finally {
        // Ensure config is restored
        enhancedEngine.updateConfig(originalConfig);
      }
    }, 60000);
  });
});
