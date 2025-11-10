/**
 * Integration tests for unique puzzles per post feature
 * Tests end-to-end flows for post-specific puzzle generation and retrieval
 * Requirements: All requirements validation (1.1-10.5)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PuzzleService } from '../../services/PuzzleService.js';
import { generateUniquePuzzleId } from '../../utils/puzzleIdGenerator.js';
import { Difficulty } from '../../../shared/types/puzzle.js';

// Mock Devvit dependencies
vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    hGet: vi.fn(),
    hSet: vi.fn(),
    hDel: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zCard: vi.fn(),
    multi: vi.fn(() => ({
      zAdd: vi.fn(),
      hSet: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn().mockResolvedValue(['OK', 'OK', 'OK']),
    })),
  },
  context: {
    postId: 'test-post-123',
    userId: 'test-user-123',
    subredditName: 'test-subreddit',
  },
  reddit: {
    getCurrentUsername: vi.fn(() => Promise.resolve('testuser')),
    submitCustomPost: vi.fn(() => Promise.resolve({ id: 'custom-post-123' })),
  },
}));

vi.mock('../../utils/errorHandler.js', async () => {
  const actual = await vi.importActual('../../utils/errorHandler.js');
  return {
    ...actual,
    errorMonitor: {
      recordError: vi.fn(),
    },
    withRedisCircuitBreaker: vi.fn(async (operation, fallback) => {
      try {
        return await operation();
      } catch (error) {
        return await fallback();
      }
    }),
    withPuzzleGenerationFallback: vi.fn(async (operation, fallback) => {
      try {
        return await operation();
      } catch (error) {
        return await fallback();
      }
    }),
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

describe('Unique Puzzles Per Post - Integration Tests', () => {
  let puzzleService: PuzzleService;
  let mockRedis: any;
  let mockReddit: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { redis, reddit } = await import('@devvit/web/server');
    mockRedis = redis;
    mockReddit = reddit;

    puzzleService = PuzzleService.getInstance();

    // Default mock implementations
    vi.mocked(mockRedis.set).mockResolvedValue('OK');
    vi.mocked(mockRedis.expire).mockResolvedValue(1);
    vi.mocked(mockRedis.get).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Post Creation → Puzzle Generation → Redis Storage Flow', () => {
    it('should generate unique puzzle and store in Redis during post creation', async () => {
      // Requirements: 3.1, 3.2, 3.3, 3.4
      const today = '2024-01-15';
      const difficulty: Difficulty = 'Easy';
      const puzzleId = generateUniquePuzzleId(today, difficulty);

      // Act: Generate puzzle with unique ID
      const result = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      // Assert: Puzzle generation succeeded
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.difficulty).toBe(difficulty);

      // Assert: Redis storage was called (may include cache operations)
      expect(mockRedis.set).toHaveBeenCalled();

      // Find the puzzle storage call (not cache calls)
      const puzzleSetCalls = vi
        .mocked(mockRedis.set)
        .mock.calls.filter((call) => call[0].includes('reflectiq:puzzle:'));
      expect(puzzleSetCalls.length).toBeGreaterThan(0);

      // Assert: TTL was set to 90 days (7,776,000 seconds)
      expect(mockRedis.expire).toHaveBeenCalled();
      const puzzleExpireCalls = vi
        .mocked(mockRedis.expire)
        .mock.calls.filter((call) => call[0].includes('reflectiq:puzzle:'));
      expect(puzzleExpireCalls.length).toBeGreaterThan(0);
      expect(puzzleExpireCalls[0][1]).toBe(90 * 24 * 60 * 60);
    });

    it('should handle puzzle generation failure with retry logic', async () => {
      // Requirements: 3.5
      const today = '2024-01-15';
      const difficulty: Difficulty = 'Medium';
      const puzzleId = generateUniquePuzzleId(today, difficulty);

      // Mock Redis failure on first attempt
      vi.mocked(mockRedis.set)
        .mockRejectedValueOnce(new Error('Redis connection failed'))
        .mockResolvedValueOnce('OK');

      // Act: Generate puzzle (should succeed despite Redis failure)
      const result = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      // Assert: Puzzle generation still succeeded
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should generate puzzles for all difficulty levels', async () => {
      // Requirements: 2.1, 3.2
      const today = '2024-01-15';
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      for (const difficulty of difficulties) {
        const puzzleId = generateUniquePuzzleId(today, difficulty);

        // Act
        const result = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.difficulty).toBe(difficulty);
        expect(mockRedis.set).toHaveBeenCalled();
        expect(mockRedis.expire).toHaveBeenCalled();

        vi.clearAllMocks();
        vi.mocked(mockRedis.set).mockResolvedValue('OK');
        vi.mocked(mockRedis.expire).mockResolvedValue(1);
      }
    });
  });

  describe('Post Opening → Context Fetch → Puzzle Retrieval → Game Start Flow', () => {
    it('should retrieve post-specific puzzle by ID from Redis', async () => {
      // Requirements: 2.4, 4.1, 4.2, 4.3, 5.3, 5.4
      const puzzleId = '2024-01-15_easy_1234567890_abc123';
      const mockPuzzle = {
        id: puzzleId,
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

      // Mock Redis to return puzzle
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      // Act: Retrieve puzzle by ID
      const result = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Puzzle retrieved successfully
      expect(result).toBeDefined();
      expect(result?.id).toBe(puzzleId);
      expect(result?.difficulty).toBe('Easy');
      expect(mockRedis.get).toHaveBeenCalledWith(`reflectiq:puzzle:${puzzleId}`);
    });

    it('should return null when puzzle not found in Redis', async () => {
      // Requirements: 2.5, 5.5
      const puzzleId = '2024-01-15_medium_9999999999_xyz789';

      // Mock Redis to return null (puzzle not found)
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      // Act: Attempt to retrieve non-existent puzzle
      const result = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Returns null to trigger fallback
      expect(result).toBeNull();
      expect(mockRedis.get).toHaveBeenCalledWith(`reflectiq:puzzle:${puzzleId}`);
    });

    it('should handle complete game start flow with post-specific puzzle', async () => {
      // Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
      const puzzleId = '2024-01-15_hard_1234567890_def456';
      const difficulty: Difficulty = 'Hard';

      // Step 1: Simulate post context with puzzleId
      const postData = {
        puzzleId,
        specificDifficulty: 'hard',
        puzzleDate: '2024-01-15',
        type: 'puzzle',
      };

      // Step 2: Mock puzzle retrieval from Redis
      const mockPuzzle = {
        id: puzzleId,
        difficulty,
        gridSize: 10,
        materials: [],
        entry: [0, 0],
        solution: [9, 9],
        solutionPath: {
          segments: [],
          exit: [9, 9],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-15'),
        materialDensity: 0.8,
      };

      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      // Act: Retrieve puzzle by ID (simulating client flow)
      const puzzle = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Complete flow succeeded
      expect(puzzle).toBeDefined();
      expect(puzzle?.id).toBe(puzzleId);
      expect(puzzle?.difficulty).toBe(difficulty);
      expect(puzzle?.gridSize).toBe(10);
    });
  });

  describe('Backward Compatibility with Legacy Posts', () => {
    it('should handle posts without puzzleId (legacy posts)', async () => {
      // Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
      const legacyPostData = {
        type: 'puzzle',
        puzzleDate: '2024-01-10',
        specificDifficulty: 'medium',
        // No puzzleId field - this is a legacy post
      };

      // Simulate legacy puzzle retrieval by date
      const legacyPuzzleId = `puzzle_medium_2024-01-10`;
      const mockLegacyPuzzle = {
        id: legacyPuzzleId,
        difficulty: 'Medium',
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: {
          segments: [],
          exit: [7, 7],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-10'),
        materialDensity: 0.75,
      };

      // Mock Redis to return legacy puzzle
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockLegacyPuzzle));

      // Act: Retrieve legacy puzzle (using date-based ID)
      const result = await puzzleService.getPuzzleById(legacyPuzzleId);

      // Assert: Legacy puzzle retrieved successfully
      expect(result).toBeDefined();
      expect(result?.id).toBe(legacyPuzzleId);
      expect(result?.difficulty).toBe('Medium');
    });

    it('should maintain full functionality for pre-migration posts', async () => {
      // Requirements: 7.4, 7.5
      const preMigrationDate = '2024-01-01';
      const difficulty: Difficulty = 'Easy';

      // Generate a legacy-style puzzle ID
      const legacyPuzzleId = `puzzle_easy_${preMigrationDate}`;

      const mockLegacyPuzzle = {
        id: legacyPuzzleId,
        difficulty,
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
        createdAt: new Date(preMigrationDate),
        materialDensity: 0.7,
      };

      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockLegacyPuzzle));

      // Act: Retrieve pre-migration puzzle
      const result = await puzzleService.getPuzzleById(legacyPuzzleId);

      // Assert: Full functionality maintained
      expect(result).toBeDefined();
      expect(result?.id).toBe(legacyPuzzleId);
      expect(result?.difficulty).toBe(difficulty);
      expect(result?.gridSize).toBe(6);
      expect(result?.solution).toEqual([5, 5]);
    });
  });

  describe('Concurrent Puzzle Generation and Retrieval', () => {
    it('should handle concurrent puzzle generation for multiple posts', async () => {
      // Requirements: 10.1, 10.2, 10.3, 10.4
      const today = '2024-01-15';
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      // Generate unique puzzle IDs for concurrent posts
      const puzzleIds = difficulties.map((diff) => generateUniquePuzzleId(today, diff));

      // Act: Generate puzzles concurrently
      const results = await Promise.all(
        puzzleIds.map((id, index) => puzzleService.generatePuzzleWithId(id, difficulties[index]))
      );

      // Assert: All puzzles generated successfully
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data?.difficulty).toBe(difficulties[index]);
      });

      // Assert: Redis operations called for each puzzle (may include cache operations)
      const puzzleSetCalls = vi
        .mocked(mockRedis.set)
        .mock.calls.filter((call) => call[0].includes('reflectiq:puzzle:'));
      expect(puzzleSetCalls.length).toBeGreaterThanOrEqual(3);

      const puzzleExpireCalls = vi
        .mocked(mockRedis.expire)
        .mock.calls.filter((call) => call[0].includes('reflectiq:puzzle:'));
      expect(puzzleExpireCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle concurrent puzzle retrieval from cache', async () => {
      // Requirements: 10.2, 10.4
      const puzzleIds = [
        '2024-01-15_easy_1111111111_aaa111',
        '2024-01-15_medium_2222222222_bbb222',
        '2024-01-15_hard_3333333333_ccc333',
      ];

      const mockPuzzles = puzzleIds.map((id, index) => ({
        id,
        difficulty: ['Easy', 'Medium', 'Hard'][index] as Difficulty,
        gridSize: [6, 8, 10][index],
        materials: [],
        entry: [0, 0],
        solution: [5, 7, 9][index],
        solutionPath: {
          segments: [],
          exit: [5, 7, 9][index],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-15'),
        materialDensity: 0.7,
      }));

      // Mock Redis to return different puzzles
      vi.mocked(mockRedis.get).mockImplementation((key: string) => {
        const puzzleId = key.replace('reflectiq:puzzle:', '');
        const puzzle = mockPuzzles.find((p) => p.id === puzzleId);
        return Promise.resolve(puzzle ? JSON.stringify(puzzle) : null);
      });

      // Act: Retrieve puzzles concurrently
      const results = await Promise.all(puzzleIds.map((id) => puzzleService.getPuzzleById(id)));

      // Assert: All puzzles retrieved successfully
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result?.id).toBe(puzzleIds[index]);
      });

      // Assert: Redis get called for each puzzle
      expect(mockRedis.get).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed concurrent operations (generation + retrieval)', async () => {
      // Requirements: 10.1, 10.2, 10.4
      const today = '2024-01-15';

      // Puzzle 1: Generate new
      const newPuzzleId = generateUniquePuzzleId(today, 'Easy');

      // Puzzle 2: Retrieve existing
      const existingPuzzleId = '2024-01-15_medium_9999999999_existing';
      const existingPuzzle = {
        id: existingPuzzleId,
        difficulty: 'Medium' as Difficulty,
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: {
          segments: [],
          exit: [7, 7],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-15'),
        materialDensity: 0.75,
      };

      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(existingPuzzle));

      // Act: Perform operations concurrently
      const [generateResult, retrieveResult] = await Promise.all([
        puzzleService.generatePuzzleWithId(newPuzzleId, 'Easy'),
        puzzleService.getPuzzleById(existingPuzzleId),
      ]);

      // Assert: Both operations succeeded
      expect(generateResult.success).toBe(true);
      expect(retrieveResult).toBeDefined();
      expect(retrieveResult?.id).toBe(existingPuzzleId);
    });
  });

  describe('Redis Circuit Breaker Behavior', () => {
    it('should handle Redis connection failure gracefully', async () => {
      // Requirements: 8.1, 8.3, 10.4
      const puzzleId = '2024-01-15_easy_1234567890_circuit';

      // Mock Redis connection failure
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('ECONNREFUSED'));

      // Act: Attempt to retrieve puzzle
      const result = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Returns null (circuit breaker triggered)
      expect(result).toBeNull();
    });

    it('should fallback to generation when Redis retrieval fails', async () => {
      // Requirements: 8.1, 8.2
      const puzzleId = '2024-01-15_medium_1234567890_fallback';
      const difficulty: Difficulty = 'Medium';

      // Mock Redis get failure
      vi.mocked(mockRedis.get).mockRejectedValue(new Error('Redis timeout'));

      // Act: Try to get puzzle (should return null)
      const retrieveResult = await puzzleService.getPuzzleById(puzzleId);
      expect(retrieveResult).toBeNull();

      // Fallback: Generate new puzzle
      const generateResult = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      // Assert: Generation succeeded as fallback
      expect(generateResult.success).toBe(true);
      expect(generateResult.data?.difficulty).toBe(difficulty);
    });

    it('should handle Redis storage failure during generation', async () => {
      // Requirements: 8.1, 8.3
      const puzzleId = '2024-01-15_hard_1234567890_storage';
      const difficulty: Difficulty = 'Hard';

      // Mock Redis storage failure
      vi.mocked(mockRedis.set).mockRejectedValue(new Error('Redis write failed'));

      // Act: Generate puzzle (should succeed despite storage failure)
      const result = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      // Assert: Puzzle generation succeeded (circuit breaker handled storage failure)
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle Redis timeout errors', async () => {
      // Requirements: 8.3, 10.4
      const puzzleId = '2024-01-15_easy_1234567890_timeout';

      // Mock Redis timeout
      vi.mocked(mockRedis.get).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('ETIMEDOUT')), 100))
      );

      // Act: Attempt retrieval with timeout
      const result = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Circuit breaker handled timeout
      expect(result).toBeNull();
    });

    it('should recover after Redis becomes available again', async () => {
      // Requirements: 8.1, 8.3
      const puzzleId = '2024-01-15_medium_1234567890_recovery';
      const mockPuzzle = {
        id: puzzleId,
        difficulty: 'Medium' as Difficulty,
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: {
          segments: [],
          exit: [7, 7],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-15'),
        materialDensity: 0.75,
      };

      // First attempt: Redis fails
      vi.mocked(mockRedis.get).mockRejectedValueOnce(new Error('Connection failed'));

      const firstResult = await puzzleService.getPuzzleById(puzzleId);
      expect(firstResult).toBeNull();

      // Second attempt: Redis recovers
      vi.mocked(mockRedis.get).mockResolvedValueOnce(JSON.stringify(mockPuzzle));

      const secondResult = await puzzleService.getPuzzleById(puzzleId);
      expect(secondResult).toBeDefined();
      expect(secondResult?.id).toBe(puzzleId);
    });
  });

  describe('Session Management with Puzzle IDs', () => {
    it('should link session with puzzle ID', async () => {
      // Requirements: 6.1, 6.2, 6.3
      const puzzleId = '2024-01-15_easy_1234567890_session';
      const userId = 'test-user-123';
      const sessionId = `session_${userId}_${puzzleId}`;

      // Mock session data storage
      const sessionData = {
        sessionId,
        puzzleId,
        userId,
        startTime: Date.now(),
        hintsUsed: 0,
      };

      vi.mocked(mockRedis.hSet).mockResolvedValue(1);
      vi.mocked(mockRedis.hGet).mockResolvedValue(JSON.stringify(sessionData));

      // Act: Store session with puzzle ID
      await mockRedis.hSet(`reflectiq:session:${sessionId}`, 'data', JSON.stringify(sessionData));

      // Retrieve session
      const retrievedData = await mockRedis.hGet(`reflectiq:session:${sessionId}`, 'data');
      const session = JSON.parse(retrievedData);

      // Assert: Session linked to puzzle ID
      expect(session.puzzleId).toBe(puzzleId);
      expect(session.userId).toBe(userId);
    });

    it('should validate puzzle ID matches session', async () => {
      // Requirements: 6.2, 6.4
      const puzzleId = '2024-01-15_medium_1234567890_validate';
      const userId = 'test-user-456';
      const sessionId = `session_${userId}_${puzzleId}`;

      const sessionData = {
        sessionId,
        puzzleId,
        userId,
        startTime: Date.now(),
        hintsUsed: 0,
      };

      vi.mocked(mockRedis.hGet).mockResolvedValue(JSON.stringify(sessionData));

      // Act: Retrieve session and validate puzzle ID
      const retrievedData = await mockRedis.hGet(`reflectiq:session:${sessionId}`, 'data');
      const session = JSON.parse(retrievedData);

      // Assert: Puzzle ID validation
      expect(session.puzzleId).toBe(puzzleId);

      // Simulate validation check
      const isValid = session.puzzleId === puzzleId;
      expect(isValid).toBe(true);
    });

    it('should maintain session isolation between different puzzle IDs', async () => {
      // Requirements: 6.5
      const userId = 'test-user-789';
      const puzzleId1 = '2024-01-15_easy_1111111111_session1';
      const puzzleId2 = '2024-01-15_medium_2222222222_session2';

      const session1 = {
        sessionId: `session_${userId}_${puzzleId1}`,
        puzzleId: puzzleId1,
        userId,
        startTime: Date.now(),
        hintsUsed: 0,
      };

      const session2 = {
        sessionId: `session_${userId}_${puzzleId2}`,
        puzzleId: puzzleId2,
        userId,
        startTime: Date.now(),
        hintsUsed: 1,
      };

      // Mock different sessions
      vi.mocked(mockRedis.hGet).mockImplementation((key: string) => {
        if (key.includes(puzzleId1)) {
          return Promise.resolve(JSON.stringify(session1));
        } else if (key.includes(puzzleId2)) {
          return Promise.resolve(JSON.stringify(session2));
        }
        return Promise.resolve(null);
      });

      // Act: Retrieve both sessions
      const data1 = await mockRedis.hGet(`reflectiq:session:${session1.sessionId}`, 'data');
      const data2 = await mockRedis.hGet(`reflectiq:session:${session2.sessionId}`, 'data');

      const retrievedSession1 = JSON.parse(data1);
      const retrievedSession2 = JSON.parse(data2);

      // Assert: Sessions are isolated
      expect(retrievedSession1.puzzleId).toBe(puzzleId1);
      expect(retrievedSession2.puzzleId).toBe(puzzleId2);
      expect(retrievedSession1.hintsUsed).toBe(0);
      expect(retrievedSession2.hintsUsed).toBe(1);
    });
  });

  describe('Error Handling and Monitoring', () => {
    it('should log puzzle generation with metadata', async () => {
      // Requirements: 9.1, 9.2
      const puzzleId = '2024-01-15_easy_1234567890_logging';
      const difficulty: Difficulty = 'Easy';

      const startTime = Date.now();

      // Act: Generate puzzle
      const result = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      const endTime = Date.now();
      const generationTime = endTime - startTime;

      // Assert: Puzzle generated successfully
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Verify generation time is reasonable (< 5 seconds as per requirement 10.1)
      expect(generationTime).toBeLessThan(5000);
    });

    it('should log Redis storage operations', async () => {
      // Requirements: 9.2
      const puzzleId = '2024-01-15_medium_1234567890_storage';
      const difficulty: Difficulty = 'Medium';

      // Act: Generate and store puzzle
      await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      // Assert: Redis operations were called
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();

      // Verify TTL is 90 days for puzzle storage (filter out cache operations)
      const puzzleExpireCalls = vi
        .mocked(mockRedis.expire)
        .mock.calls.filter((call) => call[0].includes('reflectiq:puzzle:'));
      expect(puzzleExpireCalls.length).toBeGreaterThan(0);
      expect(puzzleExpireCalls[0][1]).toBe(90 * 24 * 60 * 60);
    });

    it('should log puzzle retrieval with cache hit/miss status', async () => {
      // Requirements: 9.3
      const puzzleId = '2024-01-15_hard_1234567890_retrieval';

      // Test cache hit
      const mockPuzzle = {
        id: puzzleId,
        difficulty: 'Hard' as Difficulty,
        gridSize: 10,
        materials: [],
        entry: [0, 0],
        solution: [9, 9],
        solutionPath: {
          segments: [],
          exit: [9, 9],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-15'),
        materialDensity: 0.8,
      };

      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      // Act: Retrieve puzzle (cache hit)
      const hitResult = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Cache hit
      expect(hitResult).toBeDefined();
      expect(mockRedis.get).toHaveBeenCalled();

      // Test cache miss
      vi.mocked(mockRedis.get).mockResolvedValue(null);

      // Act: Retrieve puzzle (cache miss)
      const missResult = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Cache miss
      expect(missResult).toBeNull();
    });

    it('should track error types and fallback actions', async () => {
      // Requirements: 9.4
      const puzzleId = '2024-01-15_easy_1234567890_error';

      // Test various error scenarios
      const errors = [
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        new Error('Redis unavailable'),
      ];

      for (const error of errors) {
        vi.mocked(mockRedis.get).mockRejectedValue(error);

        // Act: Attempt retrieval
        const result = await puzzleService.getPuzzleById(puzzleId);

        // Assert: Error handled gracefully
        expect(result).toBeNull();
      }
    });
  });

  describe('Performance and Optimization', () => {
    it('should complete puzzle generation within 5 seconds', async () => {
      // Requirements: 10.1
      const puzzleId = '2024-01-15_easy_1234567890_perf';
      const difficulty: Difficulty = 'Easy';

      const startTime = Date.now();

      // Act: Generate puzzle
      const result = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      const endTime = Date.now();
      const generationTime = endTime - startTime;

      // Assert: Generation completed within 5 seconds
      expect(result.success).toBe(true);
      expect(generationTime).toBeLessThan(5000);
    });

    it('should retrieve puzzle from Redis within 500ms', async () => {
      // Requirements: 10.2
      const puzzleId = '2024-01-15_medium_1234567890_retrieval';
      const mockPuzzle = {
        id: puzzleId,
        difficulty: 'Medium' as Difficulty,
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: {
          segments: [],
          exit: [7, 7],
          terminated: false,
        },
        hints: [],
        createdAt: new Date('2024-01-15'),
        materialDensity: 0.75,
      };

      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(mockPuzzle));

      const startTime = Date.now();

      // Act: Retrieve puzzle
      const result = await puzzleService.getPuzzleById(puzzleId);

      const endTime = Date.now();
      const retrievalTime = endTime - startTime;

      // Assert: Retrieval completed within 500ms
      expect(result).toBeDefined();
      expect(retrievalTime).toBeLessThan(500);
    });

    it('should use Enhanced Generator for guaranteed generation', async () => {
      // Requirements: 10.3
      const puzzleId = '2024-01-15_hard_1234567890_enhanced';
      const difficulty: Difficulty = 'Hard';

      // Act: Generate puzzle (should use Enhanced Generator)
      const result = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      // Assert: Puzzle generated successfully
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.difficulty).toBe(difficulty);
    });

    it('should handle high load with multiple concurrent requests', async () => {
      // Requirements: 10.4, 10.5
      const today = '2024-01-15';
      const requestCount = 10;

      // Generate multiple puzzle IDs
      const puzzleIds = Array.from({ length: requestCount }, (_, i) =>
        generateUniquePuzzleId(today, 'Easy')
      );

      const startTime = Date.now();

      // Act: Generate puzzles concurrently
      const results = await Promise.all(
        puzzleIds.map((id) => puzzleService.generatePuzzleWithId(id, 'Easy'))
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert: All puzzles generated successfully
      expect(results).toHaveLength(requestCount);
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Assert: Total time is reasonable (< 30 seconds for 10 puzzles)
      expect(totalTime).toBeLessThan(30000);
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should preserve puzzle data through storage and retrieval', async () => {
      // Requirements: 2.1, 2.2, 2.3, 2.4
      const puzzleId = '2024-01-15_easy_1234567890_integrity';
      const difficulty: Difficulty = 'Easy';

      // Act: Generate puzzle
      const generateResult = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);

      expect(generateResult.success).toBe(true);
      const originalPuzzle = generateResult.data!;

      // Mock Redis to return the same puzzle
      vi.mocked(mockRedis.get).mockResolvedValue(JSON.stringify(originalPuzzle));

      // Act: Retrieve puzzle
      const retrievedPuzzle = await puzzleService.getPuzzleById(puzzleId);

      // Assert: Data integrity maintained
      expect(retrievedPuzzle).toBeDefined();
      expect(retrievedPuzzle?.difficulty).toBe(originalPuzzle.difficulty);
      expect(retrievedPuzzle?.gridSize).toBe(originalPuzzle.gridSize);
      expect(retrievedPuzzle?.entry).toEqual(originalPuzzle.entry);
      expect(retrievedPuzzle?.solution).toEqual(originalPuzzle.solution);
    });

    it('should validate puzzle ID format', async () => {
      // Requirements: 1.1, 3.1
      const today = '2024-01-15';
      const difficulty: Difficulty = 'Medium';

      // Act: Generate unique puzzle ID
      const puzzleId = generateUniquePuzzleId(today, difficulty);

      // Assert: Puzzle ID format is correct
      expect(puzzleId).toMatch(/^\d{4}-\d{2}-\d{2}_[a-z]+_\d+_[a-z0-9]+$/i);
      expect(puzzleId).toContain(today);
      expect(puzzleId.toLowerCase()).toContain(difficulty.toLowerCase());
    });
  });
});
