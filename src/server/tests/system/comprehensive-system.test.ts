/**
 * Comprehensive System Tests for Guaranteed Puzzle Generation
 * Tests complete puzzle lifecycle from generation to player completion
 * Validates all requirements through automated testing
 * Tests system behavior under various load conditions
 *
 * Requirements Coverage:
 * - 1.1: 100% solvable puzzle generation
 * - 1.2: Exactly one valid solution path
 * - 1.3: Regeneration on validation failure
 * - 1.4: 5-second generation timeout
 * - 1.5: 100% success rate maintenance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedPuzzleEngineImpl } from '../../../shared/puzzle/EnhancedPuzzleEngine.js';
import { PuzzleService } from '../../services/PuzzleService.js';
import { LeaderboardService } from '../../services/LeaderboardService.js';
import { CacheManager } from '../../services/CacheManager.js';
import { Difficulty, Puzzle, GridPosition } from '../../../shared/types/puzzle.js';
import {
  ValidationResult,
  PuzzleGenerationMetadata,
} from '../../../shared/types/guaranteed-generation.js';

describe('Comprehensive System Tests - Guaranteed Puzzle Generation', () => {
  let enhancedEngine: EnhancedPuzzleEngineImpl;
  let puzzleService: PuzzleService;
  let leaderboardService: LeaderboardService;
  let cacheManager: CacheManager;

  beforeEach(() => {
    enhancedEngine = EnhancedPuzzleEngineImpl.getInstance();
    puzzleService = PuzzleService.getInstance();
    leaderboardService = LeaderboardService.getInstance();
    cacheManager = CacheManager.getInstance();

    // Clear any existing metrics
    enhancedEngine.clearOldMetrics(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Puzzle Lifecycle Tests', () => {
    it('should complete full puzzle lifecycle from generation to player completion', async () => {
      const testDate = '2025-01-01';
      const difficulty: Difficulty = 'Easy';
      const mockUserId = 'test-user-123';
      const mockSessionId = 'test-session-123';

      // Step 1: Generate puzzle
      const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);
      expect(puzzle).toBeDefined();
      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.id).toBeDefined();

      // Step 2: Verify puzzle metadata was recorded
      const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
      expect(metadata).toBeDefined();
      expect(metadata?.validationPassed).toBe(true);

      // Step 3: Simulate puzzle storage in cache
      await cacheManager.storePuzzle(puzzle);
      const retrievedPuzzle = await cacheManager.getPuzzle(puzzle.id);
      expect(retrievedPuzzle).toEqual(puzzle);

      // Step 4: Simulate player starting puzzle
      const gameSession = await puzzleService.startPuzzleSession(
        puzzle.id,
        mockUserId,
        mockSessionId
      );
      expect(gameSession.puzzleId).toBe(puzzle.id);
      expect(gameSession.userId).toBe(mockUserId);
      expect(gameSession.isActive).toBe(true);

      // Step 5: Simulate player requesting hints
      const hint1 = await puzzleService.getHint(puzzle.id, mockUserId, 1);
      expect(hint1).toBeDefined();
      expect(hint1.hintLevel).toBe(1);

      // Step 6: Simulate player solving puzzle
      const solutionResult = await puzzleService.validateSolution(
        puzzle.id,
        mockUserId,
        puzzle.solution,
        120000, // 2 minutes
        1 // 1 hint used
      );
      expect(solutionResult.isCorrect).toBe(true);
      expect(solutionResult.score.finalScore).toBeGreaterThan(0);

      // Step 7: Verify leaderboard update
      await leaderboardService.updateLeaderboard(
        mockUserId,
        difficulty,
        solutionResult.score.finalScore,
        120000,
        1
      );

      const userRank = await leaderboardService.getUserRank(mockUserId, difficulty);
      expect(userRank).toBeDefined();

      // Step 8: Verify session completion
      const completedSession = await puzzleService.getGameSession(mockSessionId);
      expect(completedSession.isActive).toBe(false);
      expect(completedSession.completed).toBe(true);

      console.log('✅ Complete puzzle lifecycle test passed');
    }, 30000);

    it('should handle puzzle regeneration when validation fails', async () => {
      const testDate = '2025-01-02';
      const difficulty: Difficulty = 'Medium';

      // Mock validation to fail initially, then succeed
      let validationCallCount = 0;
      const originalVerifyUniqueSolution = enhancedEngine.verifyUniqueSolution;

      vi.spyOn(enhancedEngine, 'verifyUniqueSolution').mockImplementation(
        async (puzzle: Puzzle) => {
          validationCallCount++;
          if (validationCallCount === 1) {
            // First call fails
            return {
              isValid: false,
              hasUniqueSolution: false,
              alternativeCount: 2,
              physicsCompliant: true,
              confidenceScore: 45,
              issues: [
                {
                  type: 'multiple_solutions',
                  description: 'Multiple solution paths detected',
                  affectedPositions: [
                    [0, 0],
                    [1, 1],
                  ],
                  severity: 'critical',
                },
              ],
              validationTime: 100,
            } as ValidationResult;
          }
          // Subsequent calls succeed
          return originalVerifyUniqueSolution.call(enhancedEngine, puzzle);
        }
      );

      const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

      expect(puzzle).toBeDefined();
      expect(validationCallCount).toBeGreaterThan(1); // Should have retried

      const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
      expect(metadata?.attempts).toBeGreaterThan(1);

      console.log('✅ Puzzle regeneration on validation failure test passed');
    }, 15000);

    it('should maintain puzzle quality across multiple generations', async () => {
      const testDate = '2025-01-03';
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
      const puzzlesPerDifficulty = 3;
      const qualityThreshold = 80;

      for (const difficulty of difficulties) {
        const puzzles: Puzzle[] = [];
        const confidenceScores: number[] = [];

        for (let i = 0; i < puzzlesPerDifficulty; i++) {
          const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
            difficulty,
            `${testDate}-${i}`
          );
          puzzles.push(puzzle);

          const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
          if (metadata) {
            confidenceScores.push(metadata.confidenceScore);
          }
        }

        // Verify all puzzles were generated successfully
        expect(puzzles).toHaveLength(puzzlesPerDifficulty);

        // Verify quality consistency
        const averageConfidence =
          confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
        expect(averageConfidence).toBeGreaterThan(qualityThreshold);

        // Verify unique puzzles
        const uniqueIds = new Set(puzzles.map((p) => p.id));
        expect(uniqueIds.size).toBe(puzzlesPerDifficulty);

        console.log(
          `✅ Quality maintained for ${difficulty}: avg confidence ${averageConfidence.toFixed(1)}`
        );
      }
    }, 45000);
  });

  describe('Requirements Validation Tests', () => {
    describe('Requirement 1.1: 100% Solvable Puzzle Generation', () => {
      it('should generate only solvable puzzles across all difficulties', async () => {
        const testDate = '2025-01-04';
        const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
        const testsPerDifficulty = 5;

        for (const difficulty of difficulties) {
          let solvableCount = 0;

          for (let i = 0; i < testsPerDifficulty; i++) {
            const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
              difficulty,
              `${testDate}-${difficulty}-${i}`
            );

            // Verify puzzle has a valid solution path
            expect(puzzle.solutionPath).toBeDefined();
            expect(puzzle.solutionPath.segments.length).toBeGreaterThan(0);
            expect(puzzle.solutionPath.exit).toEqual(puzzle.solution);

            // Verify solution validation
            const validation = await enhancedEngine.verifyUniqueSolution(puzzle);
            if (validation.isValid && validation.hasUniqueSolution) {
              solvableCount++;
            }
          }

          // Requirement: 100% solvable
          const solvabilityRate = (solvableCount / testsPerDifficulty) * 100;
          expect(solvabilityRate).toBe(100);

          console.log(
            `✅ ${difficulty}: ${solvabilityRate}% solvable (${solvableCount}/${testsPerDifficulty})`
          );
        }
      }, 60000);
    });

    describe('Requirement 1.2: Exactly One Valid Solution Path', () => {
      it('should ensure all generated puzzles have exactly one solution', async () => {
        const testDate = '2025-01-05';
        const difficulties: Difficulty[] = ['Easy', 'Medium'];
        const testsPerDifficulty = 3;

        for (const difficulty of difficulties) {
          for (let i = 0; i < testsPerDifficulty; i++) {
            const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
              difficulty,
              `${testDate}-${difficulty}-${i}`
            );

            const validation = await enhancedEngine.verifyUniqueSolution(puzzle);

            // Requirement: Exactly one solution
            expect(validation.hasUniqueSolution).toBe(true);
            expect(validation.alternativeCount).toBe(0);

            console.log(`✅ ${difficulty} puzzle ${i + 1}: unique solution confirmed`);
          }
        }
      }, 30000);
    });

    describe('Requirement 1.4: 5-Second Generation Timeout', () => {
      it('should complete generation within 5 seconds', async () => {
        const testDate = '2025-01-06';
        const timeoutLimit = 5000; // 5 seconds
        const difficulties: Difficulty[] = ['Easy', 'Medium'];

        for (const difficulty of difficulties) {
          const startTime = Date.now();

          const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

          const generationTime = Date.now() - startTime;

          // Requirement: Complete within 5 seconds
          expect(generationTime).toBeLessThan(timeoutLimit);
          expect(puzzle).toBeDefined();

          console.log(`✅ ${difficulty}: generated in ${generationTime}ms (< ${timeoutLimit}ms)`);
        }
      }, 15000);
    });

    describe('Requirement 1.5: 100% Success Rate Maintenance', () => {
      it('should maintain 100% success rate across multiple generation attempts', async () => {
        const testDate = '2025-01-07';
        const totalAttempts = 10;
        let successfulGenerations = 0;

        for (let i = 0; i < totalAttempts; i++) {
          try {
            const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
              'Easy',
              `${testDate}-${i}`
            );

            if (puzzle && puzzle.id) {
              successfulGenerations++;
            }
          } catch (error) {
            console.warn(`Generation ${i + 1} failed:`, error);
          }
        }

        // Requirement: 100% success rate
        const successRate = (successfulGenerations / totalAttempts) * 100;
        expect(successRate).toBe(100);

        console.log(`✅ Success rate: ${successRate}% (${successfulGenerations}/${totalAttempts})`);
      }, 30000);
    });

    describe('Spacing Constraint Requirements (2.1-2.5)', () => {
      it('should enforce proper spacing constraints for all difficulties', async () => {
        const testDate = '2025-01-08';
        const spacingRequirements = {
          Easy: { minDistance: 3 },
          Medium: { minDistance: 4 },
          Hard: { minDistance: 5 },
        };

        for (const [difficulty, requirements] of Object.entries(spacingRequirements)) {
          const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
            difficulty as Difficulty,
            testDate
          );

          // Calculate actual distance
          const [entryX, entryY] = puzzle.entry;
          const [exitX, exitY] = puzzle.solution;
          const actualDistance = Math.abs(exitX - entryX) + Math.abs(exitY - entryY);

          // Verify spacing constraint
          expect(actualDistance).toBeGreaterThanOrEqual(requirements.minDistance);

          // Verify entry and exit are different
          expect(puzzle.entry).not.toEqual(puzzle.solution);

          console.log(`✅ ${difficulty}: spacing ${actualDistance} >= ${requirements.minDistance}`);
        }
      }, 20000);
    });
  });

  describe('Load and Performance Tests', () => {
    it('should handle concurrent generation requests', async () => {
      const testDate = '2025-01-09';
      const concurrentRequests = 5;
      const difficulty: Difficulty = 'Easy';

      const generationPromises = Array.from({ length: concurrentRequests }, (_, i) =>
        enhancedEngine.generateGuaranteedPuzzle(difficulty, `${testDate}-concurrent-${i}`)
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(generationPromises);
      const totalTime = Date.now() - startTime;

      // Verify all requests completed
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      expect(successful).toBe(concurrentRequests);

      // Verify reasonable performance under load
      const averageTimePerRequest = totalTime / concurrentRequests;
      expect(averageTimePerRequest).toBeLessThan(10000); // 10 seconds per request on average

      console.log(
        `✅ Concurrent load test: ${successful}/${concurrentRequests} successful in ${totalTime}ms`
      );
    }, 60000);

    it('should maintain performance under sustained load', async () => {
      const testDate = '2025-01-10';
      const sustainedRequests = 8;
      const difficulty: Difficulty = 'Easy';
      const generationTimes: number[] = [];

      for (let i = 0; i < sustainedRequests; i++) {
        const startTime = Date.now();

        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
          difficulty,
          `${testDate}-sustained-${i}`
        );

        const generationTime = Date.now() - startTime;
        generationTimes.push(generationTime);

        expect(puzzle).toBeDefined();
        expect(generationTime).toBeLessThan(8000); // 8 seconds max per request
      }

      // Verify performance doesn't degrade significantly
      const firstHalf = generationTimes.slice(0, Math.floor(sustainedRequests / 2));
      const secondHalf = generationTimes.slice(Math.floor(sustainedRequests / 2));

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Performance shouldn't degrade by more than 50%
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);

      console.log(
        `✅ Sustained load test: avg times ${firstHalfAvg.toFixed(0)}ms -> ${secondHalfAvg.toFixed(0)}ms`
      );
    }, 80000);

    it('should handle memory efficiently during extended operation', async () => {
      const testDate = '2025-01-11';
      const extendedRequests = 15;
      const difficulty: Difficulty = 'Easy';

      // Track memory usage (if available)
      const initialMemory = process.memoryUsage?.()?.heapUsed || 0;

      for (let i = 0; i < extendedRequests; i++) {
        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
          difficulty,
          `${testDate}-memory-${i}`
        );

        expect(puzzle).toBeDefined();

        // Clear old metrics every 5 generations to simulate cleanup
        if (i % 5 === 0) {
          enhancedEngine.clearOldMetrics(1000); // Clear metrics older than 1 second
        }
      }

      const finalMemory = process.memoryUsage?.()?.heapUsed || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      if (initialMemory > 0) {
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
        console.log(`✅ Memory test: increased by ${(memoryIncrease / 1024 / 1024).toFixed(1)}MB`);
      } else {
        console.log('✅ Memory test: completed (memory tracking unavailable)');
      }
    }, 60000);
  });

  describe('Error Handling and Recovery Tests', () => {
    it('should gracefully handle generation failures with fallback', async () => {
      const testDate = '2025-01-12';
      const difficulty: Difficulty = 'Hard';

      // Mock point placement to fail initially
      let placementCallCount = 0;
      const originalSelectEntryExitPairs =
        enhancedEngine['pointPlacementService'].selectEntryExitPairs;

      vi.spyOn(enhancedEngine['pointPlacementService'], 'selectEntryExitPairs').mockImplementation(
        async (diff, gridSize) => {
          placementCallCount++;
          if (placementCallCount <= 2) {
            // First two calls return empty array (failure)
            return [];
          }
          // Subsequent calls succeed
          return originalSelectEntryExitPairs.call(
            enhancedEngine['pointPlacementService'],
            diff,
            gridSize
          );
        }
      );

      const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

      expect(puzzle).toBeDefined();
      expect(placementCallCount).toBeGreaterThan(2); // Should have retried

      const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
      expect(metadata?.attempts).toBeGreaterThan(1);

      console.log('✅ Error recovery test passed with fallback mechanism');
    }, 20000);

    it('should handle timeout scenarios appropriately', async () => {
      const testDate = '2025-01-13';
      const difficulty: Difficulty = 'Medium';

      // Temporarily reduce timeout for testing
      const originalConfig = enhancedEngine.getConfig();
      enhancedEngine.updateConfig({ timeoutMs: 1000 }); // 1 second timeout

      try {
        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

        // Should either succeed quickly or use fallback
        expect(puzzle).toBeDefined();

        const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
        if (metadata?.fallbackUsed) {
          console.log('✅ Timeout test: fallback mechanism activated');
        } else {
          console.log('✅ Timeout test: generation completed within timeout');
        }
      } finally {
        // Restore original config
        enhancedEngine.updateConfig(originalConfig);
      }
    }, 15000);
  });

  describe('Integration and Compatibility Tests', () => {
    it('should maintain backward compatibility with existing systems', async () => {
      const testDate = '2025-01-14';

      // Test legacy method compatibility
      const dailyPuzzles = await enhancedEngine.generateDailyPuzzles(testDate);
      expect(dailyPuzzles).toBeDefined();
      expect(dailyPuzzles.date).toBeDefined();
      expect(dailyPuzzles.puzzles.Easy).toBeDefined();
      expect(dailyPuzzles.puzzles.Medium).toBeDefined();
      expect(dailyPuzzles.puzzles.Hard).toBeDefined();

      // Test individual puzzle creation
      const legacyPuzzle = await enhancedEngine.createPuzzle('Easy', testDate);
      expect(legacyPuzzle).toBeDefined();
      expect(legacyPuzzle.difficulty).toBe('Easy');

      console.log('✅ Backward compatibility maintained');
    }, 25000);

    it('should integrate properly with caching and storage systems', async () => {
      const testDate = '2025-01-15';
      const difficulty: Difficulty = 'Easy';

      const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

      // Test cache integration
      await cacheManager.storePuzzle(puzzle);
      const cachedPuzzle = await cacheManager.getPuzzle(puzzle.id);
      expect(cachedPuzzle).toEqual(puzzle);

      // Test metadata storage
      const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
      expect(metadata).toBeDefined();
      expect(metadata?.puzzleId).toBe(puzzle.id);

      // Test metrics aggregation
      const performanceMetrics = enhancedEngine.getPerformanceMetrics();
      expect(performanceMetrics.totalGenerated).toBeGreaterThan(0);

      console.log('✅ Cache and storage integration verified');
    }, 15000);
  });

  describe('Quality Assurance Tests', () => {
    it('should maintain consistent puzzle quality metrics', async () => {
      const testDate = '2025-01-16';
      const difficulties: Difficulty[] = ['Easy', 'Medium'];
      const qualityMetrics: { [key: string]: number[] } = {};

      for (const difficulty of difficulties) {
        qualityMetrics[difficulty] = [];

        for (let i = 0; i < 3; i++) {
          const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
            difficulty,
            `${testDate}-quality-${i}`
          );

          const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
          if (metadata) {
            qualityMetrics[difficulty].push(metadata.confidenceScore);
          }

          // Verify puzzle structure
          expect(puzzle.materials.length).toBeGreaterThan(0);
          expect(puzzle.solutionPath.segments.length).toBeGreaterThan(0);
          expect(puzzle.hints.length).toBe(4); // Progressive hints
        }

        // Verify quality consistency
        const scores = qualityMetrics[difficulty];
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const minScore = Math.min(...scores);

        expect(avgScore).toBeGreaterThan(80); // High average quality
        expect(minScore).toBeGreaterThan(70); // No extremely low quality puzzles

        console.log(`✅ ${difficulty} quality: avg ${avgScore.toFixed(1)}, min ${minScore}`);
      }
    }, 30000);

    it('should generate puzzles with appropriate complexity for each difficulty', async () => {
      const testDate = '2025-01-17';
      const complexityExpectations = {
        Easy: { minReflections: 1, maxReflections: 3, minMaterials: 3 },
        Medium: { minReflections: 2, maxReflections: 5, minMaterials: 5 },
        Hard: { minReflections: 3, maxReflections: 7, minMaterials: 7 },
      };

      for (const [difficulty, expectations] of Object.entries(complexityExpectations)) {
        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(
          difficulty as Difficulty,
          testDate
        );

        const reflectionCount = puzzle.solutionPath.segments.length;
        const materialCount = puzzle.materials.length;

        // Verify complexity is appropriate for difficulty
        expect(reflectionCount).toBeGreaterThanOrEqual(expectations.minReflections);
        expect(reflectionCount).toBeLessThanOrEqual(expectations.maxReflections);
        expect(materialCount).toBeGreaterThanOrEqual(expectations.minMaterials);

        console.log(`✅ ${difficulty}: ${reflectionCount} reflections, ${materialCount} materials`);
      }
    }, 25000);
  });
});
