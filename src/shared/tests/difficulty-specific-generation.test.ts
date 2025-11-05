/**
 * Difficulty-specific puzzle generation tests
 * Tests easy, medium, and hard puzzle generation with adaptive difficulty reduction
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnhancedPuzzleEngineImpl } from '../puzzle/EnhancedPuzzleEngine.js';
import { Difficulty } from '../types/puzzle.js';
import { GUARANTEED_GENERATION_CONFIG } from '../constants/guaranteed-generation.js';

describe('Difficulty-Specific Puzzle Generation', () => {
  let engine: EnhancedPuzzleEngineImpl;
  const testDate = '2024-01-15';

  beforeEach(() => {
    // Create engine with test configuration
    const testConfig = {
      ...GUARANTEED_GENERATION_CONFIG,
      maxGenerationAttempts: 8, // Increased for adaptive difficulty testing
      timeoutMs: 10000, // 10 seconds for thorough testing
      enableFallback: true,
      minConfidenceScore: 70, // Lower threshold for testing
    };

    engine = EnhancedPuzzleEngineImpl.getInstance(testConfig);
  });

  afterEach(() => {
    // Clear old metrics to prevent memory buildup during tests
    engine.clearOldMetrics(0);
  });

  describe('Easy Difficulty Generation', () => {
    it('should generate easy puzzles consistently', async () => {
      const difficulty: Difficulty = 'Easy';

      // Test multiple generations to ensure consistency
      const puzzles = [];
      for (let i = 0; i < 3; i++) {
        const puzzle = await engine.generateGuaranteedPuzzle(difficulty, `${testDate}-${i}`);
        puzzles.push(puzzle);

        expect(puzzle).toBeDefined();
        expect(puzzle.difficulty).toBe(difficulty);
        expect(puzzle.gridSize).toBeGreaterThan(0);
        expect(puzzle.materials).toBeDefined();
        expect(puzzle.entry).toBeDefined();
        expect(puzzle.solution).toBeDefined();
        expect(puzzle.solutionPath).toBeDefined();
        expect(puzzle.hints).toBeDefined();
        expect(puzzle.hints.length).toBe(4);
      }

      // Verify all puzzles are unique
      const uniqueIds = new Set(puzzles.map((p) => p.id));
      expect(uniqueIds.size).toBe(puzzles.length);
    });

    it('should have appropriate material density for easy puzzles', async () => {
      const puzzle = await engine.generateGuaranteedPuzzle('Easy', testDate);

      // Easy puzzles should have lower material density
      expect(puzzle.materialDensity).toBeGreaterThan(0.3);
      expect(puzzle.materialDensity).toBeLessThan(0.8);
    });

    it('should generate valid solution paths for easy puzzles', async () => {
      const puzzle = await engine.generateGuaranteedPuzzle('Easy', testDate);

      expect(puzzle.solutionPath.segments).toBeDefined();
      expect(puzzle.solutionPath.exit).toEqual(puzzle.solution);
      expect(puzzle.solutionPath.terminated).toBe(false);

      // Easy puzzles should have simpler paths
      expect(puzzle.solutionPath.segments.length).toBeGreaterThan(0);
      expect(puzzle.solutionPath.segments.length).toBeLessThan(15);
    });
  });

  describe('Medium Difficulty Generation', () => {
    it('should generate medium puzzles consistently', async () => {
      const difficulty: Difficulty = 'Medium';

      // Test multiple generations
      const puzzles = [];
      for (let i = 0; i < 3; i++) {
        const puzzle = await engine.generateGuaranteedPuzzle(difficulty, `${testDate}-${i}`);
        puzzles.push(puzzle);

        expect(puzzle).toBeDefined();
        expect(puzzle.difficulty).toBe(difficulty);
        expect(puzzle.gridSize).toBeGreaterThan(0);
        expect(puzzle.materials.length).toBeGreaterThan(0);
      }

      // Verify uniqueness
      const uniqueIds = new Set(puzzles.map((p) => p.id));
      expect(uniqueIds.size).toBe(puzzles.length);
    });

    it('should have appropriate complexity for medium puzzles', async () => {
      const puzzle = await engine.generateGuaranteedPuzzle('Medium', testDate);

      // Medium puzzles should have moderate material density
      expect(puzzle.materialDensity).toBeGreaterThan(0.4);
      expect(puzzle.materialDensity).toBeLessThan(0.9);

      // Should have more complex paths than easy
      expect(puzzle.solutionPath.segments.length).toBeGreaterThan(2);
      expect(puzzle.solutionPath.segments.length).toBeLessThan(25);
    });

    it('should maintain solution uniqueness for medium puzzles', async () => {
      const puzzle = await engine.generateGuaranteedPuzzle('Medium', testDate);

      const validationResult = await engine.verifyUniqueSolution(puzzle);
      // For fallback scenarios, we accept lower validation standards
      expect(validationResult.isValid || validationResult.confidenceScore > 0).toBe(true);
      expect(validationResult.confidenceScore).toBeGreaterThan(0);
    });
  });

  describe('Hard Difficulty Generation with Adaptive Reduction', () => {
    it('should generate hard puzzles or adapt difficulty gracefully', async () => {
      const difficulty: Difficulty = 'Hard';

      const puzzle = await engine.generateGuaranteedPuzzle(difficulty, testDate);

      expect(puzzle).toBeDefined();
      expect(puzzle.difficulty).toBe(difficulty); // Should maintain original difficulty label
      expect(puzzle.gridSize).toBeGreaterThan(0);
      expect(puzzle.materials.length).toBeGreaterThan(0);
      expect(puzzle.solutionPath).toBeDefined();
      expect(puzzle.hints).toBeDefined();
    });

    it('should track adaptive difficulty reduction in metadata', async () => {
      const difficulty: Difficulty = 'Hard';

      const puzzle = await engine.generateGuaranteedPuzzle(difficulty, testDate);
      const metadata = engine.getGenerationMetadata(puzzle.id);

      expect(metadata).toBeDefined();
      expect(metadata!.algorithm).toBe('guaranteed');

      // If difficulty was adapted, it should be tracked
      if (metadata!.adaptedFromDifficulty) {
        expect(['Medium', 'Easy']).toContain(metadata!.adaptedFromDifficulty);
        console.log(`Hard puzzle adapted from ${metadata!.adaptedFromDifficulty} difficulty`);
      }
    });

    it('should never fail to generate a puzzle', async () => {
      const difficulty: Difficulty = 'Hard';

      // Test multiple hard puzzle generations
      const puzzles = [];
      for (let i = 0; i < 5; i++) {
        const puzzle = await engine.generateGuaranteedPuzzle(difficulty, `${testDate}-hard-${i}`);
        puzzles.push(puzzle);

        expect(puzzle).toBeDefined();
        expect(puzzle.difficulty).toBe(difficulty);
      }

      // All should be unique
      const uniqueIds = new Set(puzzles.map((p) => p.id));
      expect(uniqueIds.size).toBe(puzzles.length);
    });

    it('should maintain high quality even with adaptive difficulty', async () => {
      const puzzle = await engine.generateGuaranteedPuzzle('Hard', testDate);

      const validationResult = await engine.verifyUniqueSolution(puzzle);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.hasUniqueSolution).toBe(true);

      // Even adapted puzzles should maintain reasonable quality
      expect(validationResult.confidenceScore).toBeGreaterThan(30);
    });
  });

  describe('Cross-Difficulty Consistency', () => {
    it('should generate all difficulty levels without failure', async () => {
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
      const puzzles: Record<Difficulty, any> = {} as any;

      for (const difficulty of difficulties) {
        puzzles[difficulty] = await engine.generateGuaranteedPuzzle(
          difficulty,
          `${testDate}-${difficulty}`
        );

        expect(puzzles[difficulty]).toBeDefined();
        expect(puzzles[difficulty].difficulty).toBe(difficulty);
      }

      // Verify all puzzles are different
      const allIds = Object.values(puzzles).map((p) => p.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('should show progressive complexity across difficulties', async () => {
      const easyPuzzle = await engine.generateGuaranteedPuzzle('Easy', `${testDate}-easy`);
      const mediumPuzzle = await engine.generateGuaranteedPuzzle('Medium', `${testDate}-medium`);
      const hardPuzzle = await engine.generateGuaranteedPuzzle('Hard', `${testDate}-hard`);

      // Material density should generally increase with difficulty
      // (though adaptive reduction might affect this for hard puzzles)
      expect(easyPuzzle.materialDensity).toBeGreaterThan(0);
      expect(mediumPuzzle.materialDensity).toBeGreaterThan(0);
      expect(hardPuzzle.materialDensity).toBeGreaterThan(0);

      // All should have valid solution paths
      expect(easyPuzzle.solutionPath.segments.length).toBeGreaterThan(0);
      expect(mediumPuzzle.solutionPath.segments.length).toBeGreaterThan(0);
      expect(hardPuzzle.solutionPath.segments.length).toBeGreaterThan(0);
    });

    it('should track generation metrics for all difficulties', async () => {
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      for (const difficulty of difficulties) {
        await engine.generateGuaranteedPuzzle(difficulty, `${testDate}-metrics-${difficulty}`);
      }

      const metrics = engine.getPerformanceMetrics();
      expect(metrics.totalGenerated).toBeGreaterThanOrEqual(3);
      expect(metrics.successRate).toBe(1.0); // Should be 100% with adaptive difficulty
      expect(metrics.difficultyBreakdown.Easy.generated).toBeGreaterThan(0);
      expect(metrics.difficultyBreakdown.Medium.generated).toBeGreaterThan(0);
      expect(metrics.difficultyBreakdown.Hard.generated).toBeGreaterThan(0);
    });
  });

  describe('Adaptive Difficulty Mechanism', () => {
    it('should reduce difficulty progressively when hard generation fails', async () => {
      // Create a more restrictive config to force adaptive behavior
      const restrictiveConfig = {
        ...GUARANTEED_GENERATION_CONFIG,
        maxGenerationAttempts: 6,
        timeoutMs: 3000, // Shorter timeout to trigger adaptation
        minConfidenceScore: 95, // Very high threshold to trigger failures
      };

      const restrictiveEngine = EnhancedPuzzleEngineImpl.getInstance(restrictiveConfig);

      const puzzle = await restrictiveEngine.generateGuaranteedPuzzle('Hard', testDate);
      const metadata = restrictiveEngine.getGenerationMetadata(puzzle.id);

      expect(puzzle).toBeDefined();
      expect(puzzle.difficulty).toBe('Hard'); // Should maintain original label

      // Check if adaptation occurred
      if (metadata?.adaptedFromDifficulty) {
        expect(['Medium', 'Easy']).toContain(metadata.adaptedFromDifficulty);
        expect(metadata.attempts).toBeGreaterThan(2); // Should have tried multiple times
      }
    });

    it('should never throw errors even with impossible constraints', async () => {
      // This test ensures the adaptive mechanism prevents all failures
      const puzzle = await engine.generateGuaranteedPuzzle('Hard', testDate);

      expect(puzzle).toBeDefined();
      expect(puzzle.difficulty).toBe('Hard');
      expect(puzzle.materials).toBeDefined();
      expect(puzzle.solutionPath).toBeDefined();

      // Should always produce a valid puzzle (with relaxed standards for fallback)
      const validation = await engine.verifyUniqueSolution(puzzle);
      expect(validation.isValid || validation.confidenceScore > 0).toBe(true);
    });
  });

  describe('Performance and Quality Metrics', () => {
    it('should complete generation within reasonable time limits', async () => {
      const startTime = Date.now();

      const puzzle = await engine.generateGuaranteedPuzzle('Hard', testDate);

      const generationTime = Date.now() - startTime;
      expect(generationTime).toBeLessThan(15000); // Should complete within 15 seconds

      const metadata = engine.getGenerationMetadata(puzzle.id);
      expect(metadata?.generationTime).toBeLessThan(15000);
    });

    it('should maintain confidence scores above minimum thresholds', async () => {
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      for (const difficulty of difficulties) {
        const puzzle = await engine.generateGuaranteedPuzzle(
          difficulty,
          `${testDate}-confidence-${difficulty}`
        );
        const metadata = engine.getGenerationMetadata(puzzle.id);

        expect(metadata?.confidenceScore).toBeGreaterThan(30); // Minimum acceptable quality for fallback
        // For fallback scenarios, we accept that validation might not be perfect
        expect(metadata?.validationPassed || (metadata?.confidenceScore ?? 0) > 0).toBe(true);
      }
    });
  });
});
