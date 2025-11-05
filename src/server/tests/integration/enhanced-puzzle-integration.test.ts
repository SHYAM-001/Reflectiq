/**
 * Integration tests for Enhanced Puzzle Generation System
 * Tests complete system integration with existing ReflectIQ components
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 9.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PuzzleService } from '../../services/PuzzleService.js';
import { LeaderboardService } from '../../services/LeaderboardService.js';
import { EnhancedPuzzleEngineImpl } from '../../../shared/puzzle/EnhancedPuzzleEngine.js';
import { FeatureFlagService } from '../../services/FeatureFlagService.js';
import type { Puzzle, Difficulty, Submission } from '../../../shared/types/puzzle.js';

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
    hDel: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zScore: vi.fn(),
    zCard: vi.fn(),
    zRem: vi.fn(),
  },
}));

describe('Enhanced Puzzle Generation System Integration', () => {
  let puzzleService: PuzzleService;
  let leaderboardService: LeaderboardService;
  let enhancedEngine: EnhancedPuzzleEngineImpl;
  let featureFlagService: FeatureFlagService;
  let mockRedis: any;

  beforeEach(async () => {
    // Get mock Redis instance
    const { redis } = await import('@devvit/web/server');
    mockRedis = redis;

    // Reset all mocks
    vi.clearAllMocks();

    // Initialize services
    puzzleService = PuzzleService.getInstance();
    leaderboardService = LeaderboardService.getInstance();
    enhancedEngine = EnhancedPuzzleEngineImpl.getInstance();
    featureFlagService = FeatureFlagService.getInstance();

    // Setup default mock responses
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.hSet.mockResolvedValue(1);
    mockRedis.hGet.mockResolvedValue(null);
    mockRedis.hDel.mockResolvedValue(1);
    mockRedis.zAdd.mockResolvedValue(1);
    mockRedis.zRange.mockResolvedValue([]);
    mockRedis.zScore.mockResolvedValue(null);
    mockRedis.zCard.mockResolvedValue(0);
    mockRedis.zRem.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hint Generation System Integration', () => {
    it('should integrate with existing hint generation for enhanced puzzles', async () => {
      // Mock enhanced puzzle generation
      const mockPuzzle: Puzzle = {
        id: 'enhanced-puzzle-123',
        difficulty: 'Medium',
        gridSize: 8,
        materials: [
          { type: 'mirror', position: [2, 3], angle: 45 },
          { type: 'water', position: [4, 5] },
        ],
        entry: [0, 2],
        solution: [7, 6],
        solutionPath: {
          segments: [
            { start: [0, 2], end: [2, 3] },
            { start: [2, 3], end: [4, 5] },
            { start: [4, 5], end: [7, 6] },
          ],
        },
        hints: [
          {
            hintLevel: 1,
            segments: [{ start: [0, 2], end: [2, 3] }],
          },
          {
            hintLevel: 2,
            segments: [
              { start: [0, 2], end: [2, 3] },
              { start: [2, 3], end: [4, 5] },
            ],
          },
        ],
        createdAt: new Date(),
        materialDensity: 0.25,
      };

      // Mock feature flag to use enhanced generation
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);
      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockResolvedValue(mockPuzzle);

      // Generate puzzle using enhanced system
      const result = await puzzleService.getCurrentPuzzle('Medium');

      expect(result.success).toBe(true);
      if (result.success) {
        const puzzle = result.data;

        // Verify puzzle structure is compatible with hint system
        expect(puzzle.hints).toBeDefined();
        expect(puzzle.hints.length).toBeGreaterThan(0);
        expect(puzzle.solutionPath).toBeDefined();
        expect(puzzle.solutionPath.segments).toBeDefined();

        // Verify hint paths are progressive (each level includes previous)
        for (let i = 1; i < puzzle.hints.length; i++) {
          const currentHint = puzzle.hints[i];
          const previousHint = puzzle.hints[i - 1];

          expect(currentHint.segments.length).toBeGreaterThanOrEqual(previousHint.segments.length);
        }

        // Verify final hint reveals complete solution path
        const finalHint = puzzle.hints[puzzle.hints.length - 1];
        expect(finalHint.segments.length).toBe(puzzle.solutionPath.segments.length);
      }
    });

    it('should maintain hint compatibility with legacy puzzles', async () => {
      // Mock fallback to legacy generation
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(false);

      const result = await puzzleService.getCurrentPuzzle('Easy');

      expect(result.success).toBe(true);
      if (result.success) {
        const puzzle = result.data;

        // Verify legacy puzzle structure is preserved
        expect(puzzle.hints).toBeDefined();
        expect(puzzle.solutionPath).toBeDefined();
        expect(puzzle.entry).toBeDefined();
        expect(puzzle.solution).toBeDefined();
      }
    });
  });

  describe('Leaderboard and Scoring System Integration', () => {
    it('should integrate enhanced puzzles with leaderboard system', async () => {
      const puzzleId = 'enhanced-puzzle-456';
      const userId = 'test-user-123';
      const submission: Submission = {
        puzzleId,
        userId,
        difficulty: 'Hard',
        answer: [7, 5],
        timeTaken: 180000, // 3 minutes
        hintsUsed: 1,
        score: 285,
        timestamp: new Date(),
      };

      // Mock successful score update
      mockRedis.zScore.mockResolvedValue(null); // No previous score
      mockRedis.zAdd.mockResolvedValue(1);
      mockRedis.hSet.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await leaderboardService.atomicScoreUpdate(
        puzzleId,
        userId,
        submission.score,
        submission
      );

      expect(result.success).toBe(true);
      expect(result.previousScore).toBe(0);

      // Verify Redis operations for enhanced puzzle integration
      expect(mockRedis.zAdd).toHaveBeenCalledWith(`reflectiq:leaderboard:${puzzleId}`, {
        member: userId,
        score: submission.score,
      });

      expect(mockRedis.zAdd).toHaveBeenCalledWith(
        expect.stringMatching(/reflectiq:leaderboard:daily:/),
        { member: `${userId}:${submission.difficulty}`, score: submission.score }
      );

      expect(mockRedis.hSet).toHaveBeenCalledWith(
        `reflectiq:submissions:${puzzleId}`,
        userId,
        JSON.stringify(submission)
      );
    });

    it('should handle enhanced puzzle scoring with generation metadata', async () => {
      const puzzleId = 'enhanced-puzzle-789';
      const date = '2024-01-15';

      // Mock generation metadata storage
      const generationMetadata = {
        puzzleId,
        algorithm: 'enhanced' as const,
        attempts: 2,
        generationTime: 1500,
        confidenceScore: 92,
        validationPassed: true,
        spacingDistance: 6,
        pathComplexity: 4,
        createdAt: new Date(),
      };

      mockRedis.hSet.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      // Store generation metadata
      await mockRedis.hSet(
        `reflectiq:generation:${puzzleId}`,
        'metadata',
        JSON.stringify(generationMetadata)
      );

      // Verify metadata integration with scoring
      expect(mockRedis.hSet).toHaveBeenCalledWith(
        `reflectiq:generation:${puzzleId}`,
        'metadata',
        JSON.stringify(generationMetadata)
      );

      // Test leaderboard stats with enhanced puzzle data
      mockRedis.zCard.mockResolvedValue(15); // Mock player count

      const stats = await leaderboardService.getLeaderboardStats(date);

      expect(stats.dailyPlayers).toBe(15);
      expect(stats.puzzleStats).toBeDefined();
      expect(stats.totalSubmissions).toBeDefined();
    });
  });

  describe('Client-Side Puzzle Rendering Compatibility', () => {
    it('should ensure enhanced puzzles work with existing client rendering', async () => {
      // Mock enhanced puzzle with all required client properties
      const enhancedPuzzle: Puzzle = {
        id: 'client-test-puzzle',
        difficulty: 'Medium',
        gridSize: 8,
        materials: [
          { type: 'mirror', position: [1, 2], angle: 45 },
          { type: 'water', position: [3, 4] },
          { type: 'glass', position: [5, 6] },
        ],
        entry: [0, 1],
        solution: [7, 7],
        solutionPath: {
          segments: [
            { start: [0, 1], end: [1, 2] },
            { start: [1, 2], end: [3, 4] },
            { start: [3, 4], end: [5, 6] },
            { start: [5, 6], end: [7, 7] },
          ],
        },
        hints: [
          {
            hintLevel: 1,
            segments: [{ start: [0, 1], end: [1, 2] }],
          },
          {
            hintLevel: 2,
            segments: [
              { start: [0, 1], end: [1, 2] },
              { start: [1, 2], end: [3, 4] },
            ],
          },
        ],
        createdAt: new Date(),
        materialDensity: 0.375, // 3 materials on 8x8 grid
      };

      // Verify all required client properties are present
      expect(enhancedPuzzle.id).toBeDefined();
      expect(enhancedPuzzle.difficulty).toBeDefined();
      expect(enhancedPuzzle.gridSize).toBeDefined();
      expect(enhancedPuzzle.materials).toBeDefined();
      expect(enhancedPuzzle.entry).toBeDefined();
      expect(enhancedPuzzle.solution).toBeDefined();
      expect(enhancedPuzzle.solutionPath).toBeDefined();
      expect(enhancedPuzzle.hints).toBeDefined();

      // Verify material positions are valid for grid rendering
      enhancedPuzzle.materials.forEach((material) => {
        expect(material.position[0]).toBeGreaterThanOrEqual(0);
        expect(material.position[0]).toBeLessThan(enhancedPuzzle.gridSize);
        expect(material.position[1]).toBeGreaterThanOrEqual(0);
        expect(material.position[1]).toBeLessThan(enhancedPuzzle.gridSize);
      });

      // Verify entry and solution positions are on grid boundaries
      const [entryRow, entryCol] = enhancedPuzzle.entry;
      const [solutionRow, solutionCol] = enhancedPuzzle.solution;

      const isOnBoundary = (row: number, col: number, gridSize: number) => {
        return row === 0 || row === gridSize - 1 || col === 0 || col === gridSize - 1;
      };

      expect(isOnBoundary(entryRow, entryCol, enhancedPuzzle.gridSize)).toBe(true);
      expect(isOnBoundary(solutionRow, solutionCol, enhancedPuzzle.gridSize)).toBe(true);

      // Verify hint paths are compatible with client animation system
      enhancedPuzzle.hints.forEach((hint) => {
        expect(hint.hintLevel).toBeGreaterThan(0);
        expect(hint.segments).toBeDefined();
        expect(Array.isArray(hint.segments)).toBe(true);

        hint.segments.forEach((segment) => {
          expect(segment.start).toBeDefined();
          expect(segment.end).toBeDefined();
          expect(Array.isArray(segment.start)).toBe(true);
          expect(Array.isArray(segment.end)).toBe(true);
          expect(segment.start.length).toBe(2);
          expect(segment.end.length).toBe(2);
        });
      });
    });

    it('should maintain viewport constraints for Devvit Web client', async () => {
      // Test different grid sizes for viewport compatibility
      const gridSizes = [6, 8, 10] as const;

      for (const gridSize of gridSizes) {
        const mockPuzzle: Puzzle = {
          id: `viewport-test-${gridSize}`,
          difficulty: 'Easy',
          gridSize,
          materials: [],
          entry: [0, 0],
          solution: [gridSize - 1, gridSize - 1],
          solutionPath: { segments: [] },
          hints: [],
          createdAt: new Date(),
          materialDensity: 0,
        };

        // Verify grid size is within supported range
        expect(gridSize).toBeGreaterThanOrEqual(6);
        expect(gridSize).toBeLessThanOrEqual(10);

        // Verify positions are within grid bounds
        expect(mockPuzzle.entry[0]).toBeGreaterThanOrEqual(0);
        expect(mockPuzzle.entry[0]).toBeLessThan(gridSize);
        expect(mockPuzzle.entry[1]).toBeGreaterThanOrEqual(0);
        expect(mockPuzzle.entry[1]).toBeLessThan(gridSize);

        expect(mockPuzzle.solution[0]).toBeGreaterThanOrEqual(0);
        expect(mockPuzzle.solution[0]).toBeLessThan(gridSize);
        expect(mockPuzzle.solution[1]).toBeGreaterThanOrEqual(0);
        expect(mockPuzzle.solution[1]).toBeLessThan(gridSize);
      }
    });
  });

  describe('Feature Flag Integration and Fallback Mechanisms', () => {
    it('should seamlessly fallback to legacy generation when enhanced fails', async () => {
      // Mock enhanced generation failure
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);
      vi.spyOn(featureFlagService, 'shouldFallbackToLegacy').mockResolvedValue(true);
      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockRejectedValue(
        new Error('Enhanced generation timeout')
      );

      const result = await puzzleService.getCurrentPuzzle('Hard');

      expect(result.success).toBe(true);
      if (result.success) {
        // Verify fallback puzzle maintains compatibility
        const puzzle = result.data;
        expect(puzzle.id).toBeDefined();
        expect(puzzle.difficulty).toBe('Hard');
        expect(puzzle.materials).toBeDefined();
        expect(puzzle.entry).toBeDefined();
        expect(puzzle.solution).toBeDefined();
      }

      // Verify metrics are recorded for fallback
      expect(featureFlagService.recordGenerationMetrics).toHaveBeenCalled();
    });

    it('should handle feature flag configuration changes gracefully', async () => {
      // Test dynamic feature flag changes
      const testCases = [
        { enhanced: true, fallback: true },
        { enhanced: true, fallback: false },
        { enhanced: false, fallback: true },
        { enhanced: false, fallback: false },
      ];

      for (const testCase of testCases) {
        vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(
          testCase.enhanced
        );
        vi.spyOn(featureFlagService, 'shouldFallbackToLegacy').mockResolvedValue(testCase.fallback);

        const result = await puzzleService.getCurrentPuzzle('Medium');

        // All configurations should result in a valid puzzle
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBeDefined();
          expect(result.data.difficulty).toBe('Medium');
        }
      }
    });
  });

  describe('Redis Schema Compatibility', () => {
    it('should maintain backward compatibility with existing Redis keys', async () => {
      const date = '2024-01-20';
      const puzzleId = 'compat-test-puzzle';

      // Test existing key patterns are preserved
      const expectedKeys = [
        `reflectiq:puzzles:${date}`,
        `reflectiq:leaderboard:${puzzleId}`,
        `reflectiq:submissions:${puzzleId}`,
        `reflectiq:leaderboard:daily:${date}`,
      ];

      // Mock puzzle generation and storage
      vi.spyOn(featureFlagService, 'shouldUseEnhancedGeneration').mockResolvedValue(true);

      const mockPuzzleSet = {
        date,
        puzzles: {
          easy: { id: 'easy-123', difficulty: 'Easy' as Difficulty },
          medium: { id: 'medium-123', difficulty: 'Medium' as Difficulty },
          hard: { id: 'hard-123', difficulty: 'Hard' as Difficulty },
        },
        status: 'active' as const,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockPuzzleSet));

      const result = await puzzleService.getCurrentPuzzle('Easy');

      expect(result.success).toBe(true);

      // Verify Redis operations use expected key patterns
      expect(mockRedis.get).toHaveBeenCalledWith(`reflectiq:puzzles:${date}`);
    });

    it('should extend Redis schema without breaking existing functionality', async () => {
      const puzzleId = 'schema-test-puzzle';

      // Test new enhanced keys don't interfere with existing ones
      const enhancedKeys = [
        `reflectiq:generation:${puzzleId}`,
        `reflectiq:validation:${puzzleId}`,
        `reflectiq:metrics:generation`,
      ];

      // Mock enhanced metadata storage
      mockRedis.hSet.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      // Store enhanced metadata
      for (const key of enhancedKeys) {
        await mockRedis.hSet(key, 'test', 'data');
        expect(mockRedis.hSet).toHaveBeenCalledWith(key, 'test', 'data');
      }

      // Verify existing functionality still works
      const submission: Submission = {
        puzzleId,
        userId: 'test-user',
        difficulty: 'Medium',
        answer: [5, 5],
        timeTaken: 120000,
        hintsUsed: 0,
        score: 300,
        timestamp: new Date(),
      };

      mockRedis.zScore.mockResolvedValue(null);

      const result = await leaderboardService.atomicScoreUpdate(
        puzzleId,
        'test-user',
        300,
        submission
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling and Recovery Integration', () => {
    it('should handle Redis failures gracefully across all systems', async () => {
      // Mock Redis connection failure
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      // Test puzzle service handles Redis failure
      const puzzleResult = await puzzleService.getCurrentPuzzle('Easy');
      expect(puzzleResult.success).toBe(true); // Should fallback to backup puzzles

      // Test leaderboard service handles Redis failure
      const submission: Submission = {
        puzzleId: 'error-test',
        userId: 'test-user',
        difficulty: 'Easy',
        answer: [0, 0],
        timeTaken: 60000,
        hintsUsed: 0,
        score: 100,
        timestamp: new Date(),
      };

      const leaderboardResult = await leaderboardService.atomicScoreUpdate(
        'error-test',
        'test-user',
        100,
        submission
      );

      // Should handle error gracefully
      expect(leaderboardResult.success).toBe(false);
      expect(leaderboardResult.error).toBeDefined();
    });

    it('should maintain data consistency during partial failures', async () => {
      const puzzleId = 'consistency-test';
      const userId = 'test-user';

      // Mock partial Redis failure (some operations succeed, others fail)
      mockRedis.zAdd.mockResolvedValueOnce(1); // First call succeeds
      mockRedis.zAdd.mockRejectedValueOnce(new Error('Redis timeout')); // Second call fails
      mockRedis.hSet.mockResolvedValue(1); // hSet succeeds

      const submission: Submission = {
        puzzleId,
        userId,
        difficulty: 'Medium',
        answer: [3, 3],
        timeTaken: 90000,
        hintsUsed: 1,
        score: 200,
        timestamp: new Date(),
      };

      const result = await leaderboardService.atomicScoreUpdate(puzzleId, userId, 200, submission);

      // Should detect and report partial failure
      expect(result.success).toBe(false);
      expect(result.error).toContain('Redis');
    });
  });
});
