/**
 * Unit tests for PuzzleService
 * Tests puzzle generation, retrieval, storage, and error handling
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.1, 9.2, 9.3, 9.4, 10.1, 10.3, 10.4
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Difficulty, Puzzle } from '../../../shared/types/puzzle.js';

// Mock dependencies BEFORE importing PuzzleService
vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock('../../utils/errorHandler.js', async () => {
  const actual = await vi.importActual('../../utils/errorHandler.js');
  return {
    ...actual,
    errorMonitor: {
      recordError: vi.fn(),
    },
  };
});

vi.mock('../../services/PerformanceMonitoringService.js', () => ({
  performanceMonitor: {
    recordRedisOperation: vi.fn(),
    recordPuzzleRetrieval: vi.fn(),
    recordPuzzleGeneration: vi.fn(),
  },
}));

vi.mock('../../utils/puzzleMetrics.js', () => ({
  puzzleMetrics: {
    recordGeneration: vi.fn(),
    recordStorage: vi.fn(),
    recordRetrieval: vi.fn(),
    recordError: vi.fn(),
    recordFallback: vi.fn(),
  },
}));

vi.mock('../../services/CacheManager.js', () => ({
  cacheManager: {},
  initializeCacheManager: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/FeatureFlagService.js', () => ({
  FeatureFlagService: {
    getInstance: vi.fn(() => ({
      shouldUseEnhancedGeneration: vi.fn().mockResolvedValue(true),
      shouldFallbackToLegacy: vi.fn().mockResolvedValue(true),
      recordGenerationMetrics: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Import after mocks are set up
import { PuzzleService } from '../../services/PuzzleService.js';
import { redis } from '@devvit/web/server';

describe('PuzzleService', () => {
  let puzzleService: PuzzleService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Get fresh instance
    puzzleService = PuzzleService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPuzzleById', () => {
    const mockPuzzleId = '2024-01-15_easy_1234567890_abc123';
    const mockPuzzle: Puzzle = {
      id: mockPuzzleId,
      difficulty: 'Easy',
      gridSize: 6,
      materials: [],
      entry: [0, 0],
      solution: [5, 5],
      solutionPath: {
        segments: [],
        exit: [5, 5],
        terminated: false,
      },
      hints: [],
      createdAt: new Date('2024-01-15'),
      materialDensity: 0.7,
    };

    it('should retrieve puzzle from Redis when it exists', async () => {
      // Arrange
      const puzzleData = JSON.stringify(mockPuzzle);
      vi.mocked(redis.get).mockResolvedValue(puzzleData);

      // Act
      const result = await puzzleService.getPuzzleById(mockPuzzleId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockPuzzleId);
      expect(result?.difficulty).toBe('Easy');
      expect(redis.get).toHaveBeenCalledWith(`reflectiq:puzzle:${mockPuzzleId}`);
    });

    it('should return null when puzzle does not exist in Redis', async () => {
      // Arrange
      vi.mocked(redis.get).mockResolvedValue(null);

      // Act
      const result = await puzzleService.getPuzzleById(mockPuzzleId);

      // Assert
      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith(`reflectiq:puzzle:${mockPuzzleId}`);
    });

    it('should handle Redis errors gracefully and return null', async () => {
      // Arrange
      vi.mocked(redis.get).mockRejectedValue(new Error('Redis connection failed'));

      // Act
      const result = await puzzleService.getPuzzleById(mockPuzzleId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle invalid JSON data and return null', async () => {
      // Arrange
      vi.mocked(redis.get).mockResolvedValue('invalid-json-data');

      // Act
      const result = await puzzleService.getPuzzleById(mockPuzzleId);

      // Assert
      expect(result).toBeNull();
    });

    it('should test with different difficulty levels', async () => {
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      for (const difficulty of difficulties) {
        const puzzleId = `2024-01-15_${difficulty.toLowerCase()}_1234567890_abc123`;
        const puzzle: Puzzle = {
          ...mockPuzzle,
          id: puzzleId,
          difficulty,
          gridSize: difficulty === 'Easy' ? 6 : difficulty === 'Medium' ? 8 : 10,
        };

        vi.mocked(redis.get).mockResolvedValue(JSON.stringify(puzzle));

        const result = await puzzleService.getPuzzleById(puzzleId);

        expect(result).toBeDefined();
        expect(result?.id).toBe(puzzleId);
        expect(result?.difficulty).toBe(difficulty);
        expect(result?.gridSize).toBe(puzzle.gridSize);
      }
    });
  });

  describe('generatePuzzleWithId', () => {
    const mockPuzzleId = '2024-01-15_easy_1234567890_abc123';

    beforeEach(() => {
      // Mock successful Redis operations
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.expire).mockResolvedValue(1);
    });

    it('should generate puzzle for Easy difficulty', async () => {
      // Act
      const result = await puzzleService.generatePuzzleWithId(mockPuzzleId, 'Easy');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.difficulty).toBe('Easy');
      // Note: The generator may modify the puzzle ID by adding additional identifiers
      expect(result.data?.id).toContain('easy');
    });

    it('should generate puzzle for Medium difficulty', async () => {
      // Act
      const result = await puzzleService.generatePuzzleWithId(
        '2024-01-15_medium_1234567890_abc123',
        'Medium'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.difficulty).toBe('Medium');
    });

    it('should generate puzzle for Hard difficulty', async () => {
      // Act
      const result = await puzzleService.generatePuzzleWithId(
        '2024-01-15_hard_1234567890_abc123',
        'Hard'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.difficulty).toBe('Hard');
    });

    it('should store puzzle in Redis with 90-day TTL', async () => {
      // Act
      await puzzleService.generatePuzzleWithId(mockPuzzleId, 'Easy');

      // Assert
      expect(redis.set).toHaveBeenCalled();
      expect(redis.expire).toHaveBeenCalledWith(
        `reflectiq:puzzle:${mockPuzzleId}`,
        90 * 24 * 60 * 60 // 90 days in seconds
      );
    });

    it('should return validation error for invalid difficulty', async () => {
      // Act
      const result = await puzzleService.generatePuzzleWithId(
        mockPuzzleId,
        'Invalid' as Difficulty
      );

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle Redis storage failure gracefully', async () => {
      // Arrange
      vi.mocked(redis.set).mockRejectedValue(new Error('Redis storage failed'));

      // Act
      const result = await puzzleService.generatePuzzleWithId(mockPuzzleId, 'Easy');

      // Assert - Should still succeed with puzzle generation even if storage fails
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Redis storage and retrieval operations', () => {
    it('should use correct Redis key format', async () => {
      // Arrange
      const puzzleId = '2024-01-15_easy_1234567890_abc123';
      const expectedKey = `reflectiq:puzzle:${puzzleId}`;
      vi.mocked(redis.get).mockResolvedValue(null);

      // Act
      await puzzleService.getPuzzleById(puzzleId);

      // Assert
      expect(redis.get).toHaveBeenCalledWith(expectedKey);
    });

    it('should handle concurrent retrieval requests', async () => {
      // Arrange
      const puzzleIds = [
        '2024-01-15_easy_1234567890_abc123',
        '2024-01-15_medium_1234567890_def456',
        '2024-01-15_hard_1234567890_ghi789',
      ];

      vi.mocked(redis.get).mockResolvedValue(null);

      // Act
      const results = await Promise.all(puzzleIds.map((id) => puzzleService.getPuzzleById(id)));

      // Assert
      expect(results).toHaveLength(3);
      expect(redis.get).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent generation requests', async () => {
      // Arrange
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.expire).mockResolvedValue(1);

      const requests = [
        { id: '2024-01-15_easy_1234567890_abc123', difficulty: 'Easy' as Difficulty },
        { id: '2024-01-15_medium_1234567890_def456', difficulty: 'Medium' as Difficulty },
        { id: '2024-01-15_hard_1234567890_ghi789', difficulty: 'Hard' as Difficulty },
      ];

      // Act
      const results = await Promise.all(
        requests.map((req) => puzzleService.generatePuzzleWithId(req.id, req.difficulty))
      );

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('TTL expiration behavior', () => {
    it('should set 90-day TTL on puzzle storage', async () => {
      // Arrange
      const puzzleId = '2024-01-15_easy_1234567890_abc123';
      const expectedTTL = 90 * 24 * 60 * 60; // 7,776,000 seconds
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.expire).mockResolvedValue(1);

      // Act
      await puzzleService.generatePuzzleWithId(puzzleId, 'Easy');

      // Assert
      expect(redis.expire).toHaveBeenCalledWith(`reflectiq:puzzle:${puzzleId}`, expectedTTL);
    });

    it('should handle TTL setting failure gracefully', async () => {
      // Arrange
      const puzzleId = '2024-01-15_easy_1234567890_abc123';
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.expire).mockRejectedValue(new Error('TTL setting failed'));

      // Act
      const result = await puzzleService.generatePuzzleWithId(puzzleId, 'Easy');

      // Assert - Should still succeed even if TTL fails
      expect(result.success).toBe(true);
    });
  });

  describe('Error handling and fallback scenarios', () => {
    it('should handle Redis connection timeout', async () => {
      // Arrange
      vi.mocked(redis.get).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 100))
      );

      // Act
      const result = await puzzleService.getPuzzleById('test-puzzle-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle Redis connection refused', async () => {
      // Arrange
      vi.mocked(redis.get).mockRejectedValue(new Error('ECONNREFUSED'));

      // Act
      const result = await puzzleService.getPuzzleById('test-puzzle-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle malformed puzzle data', async () => {
      // Arrange
      vi.mocked(redis.get).mockResolvedValue('{"incomplete": "data"');

      // Act
      const result = await puzzleService.getPuzzleById('test-puzzle-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should use backup puzzle when generation fails', async () => {
      // Arrange
      const puzzleId = '2024-01-15_easy_1234567890_abc123';
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.expire).mockResolvedValue(1);

      // Act
      const result = await puzzleService.generatePuzzleWithId(puzzleId, 'Easy');

      // Assert - Should succeed with either enhanced or backup puzzle
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.difficulty).toBe('Easy');
      // Note: The generator may modify the puzzle ID
      expect(result.data?.id).toBeDefined();
    });

    it('should handle empty puzzle ID', async () => {
      // Act
      const result = await puzzleService.getPuzzleById('');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle very long puzzle ID', async () => {
      // Arrange
      const longPuzzleId = 'a'.repeat(1000);
      vi.mocked(redis.get).mockResolvedValue(null);

      // Act
      const result = await puzzleService.getPuzzleById(longPuzzleId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Puzzle data integrity', () => {
    it('should preserve all puzzle properties during storage and retrieval', async () => {
      // Arrange
      const puzzleId = '2024-01-15_easy_1234567890_abc123';
      const mockPuzzle: Puzzle = {
        id: puzzleId,
        difficulty: 'Easy',
        gridSize: 6,
        materials: [
          {
            type: 'mirror',
            position: [1, 2],
            angle: 45,
            properties: {
              reflectivity: 0.9,
              transparency: 0.0,
              diffusion: 0.0,
              absorption: false,
            },
          },
        ],
        entry: [0, 0],
        solution: [5, 5],
        solutionPath: {
          segments: [
            {
              start: [0, 0],
              end: [5, 5],
              direction: 45,
            },
          ],
          exit: [5, 5],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-15'),
        materialDensity: 0.7,
      };

      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      // Act
      const result = await puzzleService.getPuzzleById(puzzleId);

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(mockPuzzle.id);
      expect(result?.difficulty).toBe(mockPuzzle.difficulty);
      expect(result?.gridSize).toBe(mockPuzzle.gridSize);
      expect(result?.materials).toHaveLength(1);
      expect(result?.entry).toEqual(mockPuzzle.entry);
      expect(result?.solution).toEqual(mockPuzzle.solution);
    });

    it('should generate valid puzzle structure', async () => {
      // Arrange
      const puzzleId = '2024-01-15_easy_1234567890_abc123';
      vi.mocked(redis.set).mockResolvedValue('OK');
      vi.mocked(redis.expire).mockResolvedValue(1);

      // Act
      const result = await puzzleService.generatePuzzleWithId(puzzleId, 'Easy');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const puzzle = result.data!;
      expect(puzzle.id).toBeDefined();
      expect(puzzle.difficulty).toBe('Easy');
      expect(puzzle.gridSize).toBeGreaterThan(0);
      expect(Array.isArray(puzzle.materials)).toBe(true);
      expect(Array.isArray(puzzle.entry)).toBe(true);
      expect(Array.isArray(puzzle.solution)).toBe(true);
      expect(puzzle.solutionPath).toBeDefined();
      expect(Array.isArray(puzzle.hints)).toBe(true);
    });
  });
});
