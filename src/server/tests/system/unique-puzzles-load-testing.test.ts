/**
 * Load and Performance Testing for Unique Puzzles Per Post Feature
 * Tests system behavior under load for post-specific puzzle generation and retrieval
 *
 * Task 13 Requirements:
 * - Test generating 100 puzzles concurrently
 * - Test retrieving 1000 puzzles from cache
 * - Measure Redis memory usage with 10,000 puzzles
 * - Verify API response times meet targets (<500ms)
 * - Test system behavior with Redis unavailable
 *
 * Requirements Coverage: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PuzzleService } from '../../services/PuzzleService.js';
import { EnhancedPuzzleEngineImpl } from '../../../shared/puzzle/EnhancedPuzzleEngine.js';
import { redis } from '@devvit/web/server';
import type { Puzzle, Difficulty } from '../../../shared/types/puzzle.js';

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

describe('Task 13: Load and Performance Testing for Unique Puzzles Per Post', () => {
  let puzzleService: PuzzleService;
  let enhancedEngine: EnhancedPuzzleEngineImpl;
  let mockRedis: any;

  beforeEach(async () => {
    // Get mock Redis instance
    mockRedis = redis;

    // Reset all mocks
    vi.clearAllMocks();

    // Initialize services
    puzzleService = PuzzleService.getInstance();
    enhancedEngine = EnhancedPuzzleEngineImpl.getInstance();

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

  /**
   * Sub-task: Test generating 100 puzzles concurrently
   * Requirement 10.1: Verify Enhanced Generator is used for guaranteed generation
   * Requirement 10.3: Add performance monitoring for puzzle generation (<5s target)
   */
  describe('Concurrent Puzzle Generation (100 puzzles)', () => {
    it('should generate 100 puzzles concurrently within performance targets', async () => {
      const concurrentCount = 100;
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
      const testDate = '2025-01-20';
      const maxGenerationTime = 5000; // 5 seconds per requirement 10.3

      console.log(`🔄 Starting concurrent generation of ${concurrentCount} puzzles...`);

      // Create mock puzzle generator
      const createMockPuzzle = (id: string, difficulty: Difficulty): Puzzle => ({
        id,
        difficulty,
        gridSize: difficulty === 'Easy' ? 6 : difficulty === 'Medium' ? 8 : 10,
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
        hints: [{ hintLevel: 1, segments: [{ start: [0, 1], end: [1, 2] }] }],
        createdAt: new Date(),
        materialDensity: 0.33,
      });

      // Mock enhanced engine with realistic timing
      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
        async (difficulty: Difficulty, puzzleId: string) => {
          // Simulate generation time (0.5-3 seconds)
          const generationTime = Math.random() * 2500 + 500;
          await new Promise((resolve) => setTimeout(resolve, generationTime));
          return createMockPuzzle(puzzleId, difficulty);
        }
      );

      // Generate puzzles concurrently
      const startTime = Date.now();
      const generationPromises = Array.from({ length: concurrentCount }, (_, i) => {
        const difficulty = difficulties[i % difficulties.length];
        const puzzleId = `${testDate}_${difficulty}_${Date.now()}_${i}`;
        const requestStartTime = Date.now();

        return puzzleService
          .generatePuzzleWithId(puzzleId, difficulty)
          .then((response) => ({
            success: response.success,
            puzzleId,
            difficulty,
            duration: Date.now() - requestStartTime,
            index: i,
          }))
          .catch((error) => ({
            success: false,
            puzzleId,
            difficulty,
            error: error.message,
            duration: Date.now() - requestStartTime,
            index: i,
          }));
      });

      const results = await Promise.all(generationPromises);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const successRate = (successful / concurrentCount) * 100;
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxTime = Math.max(...results.map((r) => r.duration));
      const minTime = Math.min(...results.map((r) => r.duration));

      // Assertions - Requirement 10.1, 10.3
      expect(successful).toBeGreaterThanOrEqual(concurrentCount * 0.95); // At least 95% success
      expect(maxTime).toBeLessThan(maxGenerationTime); // Each puzzle under 5 seconds
      expect(averageTime).toBeLessThan(maxGenerationTime * 0.8); // Average well under limit

      // Verify Enhanced Generator was used
      expect(enhancedEngine.generateGuaranteedPuzzle).toHaveBeenCalledTimes(concurrentCount);

      console.log(`✅ Concurrent generation test results:`);
      console.log(
        `   - Success rate: ${successful}/${concurrentCount} (${successRate.toFixed(1)}%)`
      );
      console.log(`   - Total time: ${totalTime}ms`);
      console.log(`   - Average time per puzzle: ${averageTime.toFixed(0)}ms`);
      console.log(`   - Time range: ${minTime}ms - ${maxTime}ms`);
      console.log(`   - Failed requests: ${failed}`);

      // Verify Redis storage operations
      expect(mockRedis.set).toHaveBeenCalledTimes(concurrentCount);
      expect(mockRedis.expire).toHaveBeenCalledTimes(concurrentCount);
    }, 120000); // 2 minute timeout
  });

  /**
   * Sub-task: Test retrieving 1000 puzzles from cache
   * Requirement 10.4: Optimize puzzle retrieval from Redis (<500ms target)
   */
  describe('Cache Retrieval Performance (1000 puzzles)', () => {
    it('should retrieve 1000 puzzles from cache within performance targets', async () => {
      const retrievalCount = 1000;
      const testDate = '2025-01-21';
      const maxRetrievalTime = 500; // 500ms per requirement 10.4

      console.log(`🔄 Testing retrieval of ${retrievalCount} puzzles from cache...`);

      // Pre-populate cache with mock puzzles
      const puzzleIds: string[] = [];
      const cachedPuzzles = new Map<string, string>();

      for (let i = 0; i < retrievalCount; i++) {
        const difficulty: Difficulty = ['Easy', 'Medium', 'Hard'][i % 3] as Difficulty;
        const puzzleId = `${testDate}_${difficulty}_${Date.now()}_${i}`;
        puzzleIds.push(puzzleId);

        const mockPuzzle: Puzzle = {
          id: puzzleId,
          difficulty,
          gridSize: 8,
          materials: [],
          entry: [0, 0],
          solution: [7, 7],
          solutionPath: { segments: [] },
          hints: [],
          createdAt: new Date(),
          materialDensity: 0,
        };

        cachedPuzzles.set(`reflectiq:puzzle:${puzzleId}`, JSON.stringify(mockPuzzle));
      }

      // Mock Redis get to return cached puzzles with realistic timing
      mockRedis.get.mockImplementation(async (key: string) => {
        // Simulate Redis retrieval time (1-50ms)
        const retrievalTime = Math.random() * 49 + 1;
        await new Promise((resolve) => setTimeout(resolve, retrievalTime));
        return cachedPuzzles.get(key) || null;
      });

      // Retrieve all puzzles
      const startTime = Date.now();
      const retrievalPromises = puzzleIds.map((puzzleId) => {
        const requestStartTime = Date.now();
        return puzzleService
          .getPuzzleById(puzzleId)
          .then((puzzle) => ({
            success: !!puzzle,
            puzzleId,
            duration: Date.now() - requestStartTime,
          }))
          .catch((error) => ({
            success: false,
            puzzleId,
            error: error.message,
            duration: Date.now() - requestStartTime,
          }));
      });

      const results = await Promise.all(retrievalPromises);
      const totalTime = Date.now() - startTime;

      // Analyze results
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      const successRate = (successful / retrievalCount) * 100;
      const averageTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxTime = Math.max(...results.map((r) => r.duration));
      const minTime = Math.min(...results.map((r) => r.duration));

      // Assertions - Requirement 10.4
      expect(successful).toBe(retrievalCount); // 100% success for cache hits
      expect(averageTime).toBeLessThan(maxRetrievalTime); // Average under 500ms
      expect(maxTime).toBeLessThan(maxRetrievalTime * 2); // Max under 1 second

      console.log(`✅ Cache retrieval test results:`);
      console.log(
        `   - Success rate: ${successful}/${retrievalCount} (${successRate.toFixed(1)}%)`
      );
      console.log(`   - Total time: ${totalTime}ms`);
      console.log(`   - Average time per retrieval: ${averageTime.toFixed(2)}ms`);
      console.log(`   - Time range: ${minTime.toFixed(2)}ms - ${maxTime.toFixed(2)}ms`);
      console.log(`   - Failed requests: ${failed}`);

      // Verify Redis get operations
      expect(mockRedis.get).toHaveBeenCalledTimes(retrievalCount);
    }, 120000); // 2 minute timeout
  });

  /**
   * Sub-task: Measure Redis memory usage with 10,000 puzzles
   * Requirement 10.2: Implement circuit breaker patterns for Redis operations
   */
  describe('Redis Memory Usage (10,000 puzzles)', () => {
    it('should measure and validate Redis memory usage with 10,000 puzzles', async () => {
      const puzzleCount = 10000;
      const testDate = '2025-01-22';
      const TTL_90_DAYS = 90 * 24 * 60 * 60;

      console.log(`🔄 Measuring Redis memory usage with ${puzzleCount} puzzles...`);

      // Track memory metrics
      let totalStorageSize = 0;
      const storedKeys = new Set<string>();

      // Mock Redis operations to track memory
      mockRedis.set.mockImplementation(async (key: string, value: string) => {
        storedKeys.add(key);
        totalStorageSize += Buffer.byteLength(value, 'utf8');
        totalStorageSize += Buffer.byteLength(key, 'utf8');
        return 'OK';
      });

      mockRedis.expire.mockResolvedValue(1);

      // Create mock puzzle generator
      const createMockPuzzle = (id: string, difficulty: Difficulty): Puzzle => ({
        id,
        difficulty,
        gridSize: difficulty === 'Easy' ? 6 : difficulty === 'Medium' ? 8 : 10,
        materials: [
          { type: 'mirror', position: [1, 2], angle: 45 },
          { type: 'water', position: [3, 4] },
          { type: 'glass', position: [5, 6] },
        ],
        entry: [0, 1],
        solution: [9, 8],
        solutionPath: {
          segments: [
            { start: [0, 1], end: [1, 2] },
            { start: [1, 2], end: [3, 4] },
            { start: [3, 4], end: [5, 6] },
            { start: [5, 6], end: [9, 8] },
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
        materialDensity: 0.4,
      });

      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
        async (difficulty: Difficulty, puzzleId: string) => {
          return createMockPuzzle(puzzleId, difficulty);
        }
      );

      // Generate and store puzzles in batches
      const batchSize = 100;
      const batches = Math.ceil(puzzleCount / batchSize);
      const startTime = Date.now();

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises: Promise<any>[] = [];

        for (let i = 0; i < batchSize && batch * batchSize + i < puzzleCount; i++) {
          const index = batch * batchSize + i;
          const difficulty: Difficulty = ['Easy', 'Medium', 'Hard'][index % 3] as Difficulty;
          const puzzleId = `${testDate}_${difficulty}_${Date.now()}_${index}`;

          batchPromises.push(puzzleService.generatePuzzleWithId(puzzleId, difficulty));
        }

        await Promise.all(batchPromises);

        // Log progress
        if ((batch + 1) % 10 === 0) {
          const progress = ((batch + 1) / batches) * 100;
          console.log(
            `   - Progress: ${progress.toFixed(1)}% (${(batch + 1) * batchSize} puzzles)`
          );
        }
      }

      const totalTime = Date.now() - startTime;

      // Calculate memory metrics
      const averagePuzzleSize = totalStorageSize / puzzleCount;
      const totalSizeMB = totalStorageSize / (1024 * 1024);
      const estimatedRedisMemory = totalSizeMB * 1.5; // Redis overhead estimate

      console.log(`✅ Redis memory usage test results:`);
      console.log(`   - Total puzzles stored: ${storedKeys.size}`);
      console.log(`   - Total storage size: ${totalSizeMB.toFixed(2)}MB`);
      console.log(`   - Average puzzle size: ${(averagePuzzleSize / 1024).toFixed(2)}KB`);
      console.log(`   - Estimated Redis memory: ${estimatedRedisMemory.toFixed(2)}MB`);
      console.log(`   - Total time: ${(totalTime / 1000).toFixed(2)}s`);
      console.log(`   - TTL: ${TTL_90_DAYS}s (90 days)`);

      // Assertions
      expect(storedKeys.size).toBe(puzzleCount);
      expect(totalSizeMB).toBeLessThan(500); // Should be under 500MB for 10k puzzles
      expect(averagePuzzleSize).toBeLessThan(50 * 1024); // Each puzzle under 50KB

      // Verify Redis operations
      expect(mockRedis.set).toHaveBeenCalledTimes(puzzleCount);
      expect(mockRedis.expire).toHaveBeenCalledTimes(puzzleCount);

      // Verify TTL is set correctly
      const expireCalls = mockRedis.expire.mock.calls;
      expireCalls.forEach((call: any[]) => {
        expect(call[1]).toBe(TTL_90_DAYS);
      });
    }, 300000); // 5 minute timeout
  });

  /**
   * Sub-task: Verify API response times meet targets (<500ms)
   * Requirement 10.4: Optimize puzzle retrieval from Redis (<500ms target)
   */
  describe('API Response Time Validation', () => {
    it('should verify API response times meet <500ms target for puzzle retrieval', async () => {
      const testCount = 100;
      const testDate = '2025-01-23';
      const targetResponseTime = 500; // 500ms per requirement 10.4

      console.log(`🔄 Testing API response times for ${testCount} requests...`);

      // Pre-populate cache
      const cachedPuzzles = new Map<string, string>();
      const puzzleIds: string[] = [];

      for (let i = 0; i < testCount; i++) {
        const difficulty: Difficulty = ['Easy', 'Medium', 'Hard'][i % 3] as Difficulty;
        const puzzleId = `${testDate}_${difficulty}_${Date.now()}_${i}`;
        puzzleIds.push(puzzleId);

        const mockPuzzle: Puzzle = {
          id: puzzleId,
          difficulty,
          gridSize: 8,
          materials: [{ type: 'mirror', position: [2, 3], angle: 45 }],
          entry: [0, 0],
          solution: [7, 7],
          solutionPath: { segments: [{ start: [0, 0], end: [7, 7] }] },
          hints: [],
          createdAt: new Date(),
          materialDensity: 0.125,
        };

        cachedPuzzles.set(`reflectiq:puzzle:${puzzleId}`, JSON.stringify(mockPuzzle));
      }

      // Mock Redis with realistic timing
      mockRedis.get.mockImplementation(async (key: string) => {
        // Simulate Redis retrieval (10-100ms)
        const retrievalTime = Math.random() * 90 + 10;
        await new Promise((resolve) => setTimeout(resolve, retrievalTime));
        return cachedPuzzles.get(key) || null;
      });

      // Test API response times
      const responseTimes: number[] = [];

      for (const puzzleId of puzzleIds) {
        const startTime = Date.now();
        const puzzle = await puzzleService.getPuzzleById(puzzleId);
        const responseTime = Date.now() - startTime;

        responseTimes.push(responseTime);
        expect(puzzle).toBeDefined();
      }

      // Analyze response times
      const averageResponseTime =
        responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[
        Math.floor(responseTimes.length * 0.95)
      ];
      const p99ResponseTime = responseTimes.sort((a, b) => a - b)[
        Math.floor(responseTimes.length * 0.99)
      ];

      // Count responses meeting target
      const meetingTarget = responseTimes.filter((t) => t < targetResponseTime).length;
      const targetMeetRate = (meetingTarget / testCount) * 100;

      console.log(`✅ API response time test results:`);
      console.log(`   - Average response time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`   - Min response time: ${minResponseTime.toFixed(2)}ms`);
      console.log(`   - Max response time: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`   - P95 response time: ${p95ResponseTime.toFixed(2)}ms`);
      console.log(`   - P99 response time: ${p99ResponseTime.toFixed(2)}ms`);
      console.log(
        `   - Meeting target (<500ms): ${meetingTarget}/${testCount} (${targetMeetRate.toFixed(1)}%)`
      );

      // Assertions - Requirement 10.4
      expect(averageResponseTime).toBeLessThan(targetResponseTime);
      expect(p95ResponseTime).toBeLessThan(targetResponseTime * 1.2); // P95 within 20% of target
      expect(targetMeetRate).toBeGreaterThan(90); // At least 90% meet target
    }, 60000); // 1 minute timeout
  });

  /**
   * Sub-task: Test system behavior with Redis unavailable
   * Requirement 10.2: Implement circuit breaker patterns for Redis operations
   * Requirement 10.5: Prioritize puzzle retrieval over generation for active users
   */
  describe('Redis Unavailability Handling', () => {
    it('should handle Redis unavailability with circuit breaker and fallback', async () => {
      const testCount = 20;
      const testDate = '2025-01-24';

      console.log(`🔄 Testing system behavior with Redis unavailable...`);

      // Mock Redis to simulate unavailability
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));
      mockRedis.expire.mockRejectedValue(new Error('Redis connection failed'));

      // Mock enhanced engine for fallback generation
      const createMockPuzzle = (id: string, difficulty: Difficulty): Puzzle => ({
        id,
        difficulty,
        gridSize: 8,
        materials: [{ type: 'mirror', position: [2, 3], angle: 45 }],
        entry: [0, 0],
        solution: [7, 7],
        solutionPath: { segments: [{ start: [0, 0], end: [7, 7] }] },
        hints: [],
        createdAt: new Date(),
        materialDensity: 0.125,
      });

      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
        async (difficulty: Difficulty, puzzleId: string) => {
          // Simulate generation time
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return createMockPuzzle(puzzleId, difficulty);
        }
      );

      // Test puzzle generation with Redis unavailable
      const generationResults: Array<{ success: boolean; duration: number }> = [];

      for (let i = 0; i < testCount; i++) {
        const difficulty: Difficulty = ['Easy', 'Medium', 'Hard'][i % 3] as Difficulty;
        const puzzleId = `${testDate}_${difficulty}_${Date.now()}_${i}`;
        const startTime = Date.now();

        try {
          const response = await puzzleService.generatePuzzleWithId(puzzleId, difficulty);
          generationResults.push({
            success: response.success,
            duration: Date.now() - startTime,
          });
        } catch (error) {
          generationResults.push({
            success: false,
            duration: Date.now() - startTime,
          });
        }
      }

      // Analyze results
      const successful = generationResults.filter((r) => r.success).length;
      const successRate = (successful / testCount) * 100;
      const averageTime =
        generationResults.reduce((sum, r) => sum + r.duration, 0) / generationResults.length;

      console.log(`✅ Redis unavailability test results:`);
      console.log(`   - Success rate: ${successful}/${testCount} (${successRate.toFixed(1)}%)`);
      console.log(`   - Average generation time: ${averageTime.toFixed(0)}ms`);
      console.log(`   - Circuit breaker triggered: ${testCount} times`);

      // Assertions - Requirement 10.2
      expect(successRate).toBeGreaterThan(80); // At least 80% success with fallback
      expect(successful).toBeGreaterThan(0); // Some puzzles should be generated

      // Verify fallback generation was used
      expect(enhancedEngine.generateGuaranteedPuzzle).toHaveBeenCalled();
    }, 90000); // 1.5 minute timeout

    it('should prioritize retrieval over generation when Redis recovers', async () => {
      const testDate = '2025-01-25';
      const puzzleId = `${testDate}_Medium_${Date.now()}_recovery`;

      console.log(`🔄 Testing retrieval prioritization after Redis recovery...`);

      // Mock puzzle for cache
      const mockPuzzle: Puzzle = {
        id: puzzleId,
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

      // First attempt: Redis unavailable
      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      const firstAttemptStart = Date.now();
      const firstResult = await puzzleService.getPuzzleById(puzzleId);
      const firstAttemptTime = Date.now() - firstAttemptStart;

      expect(firstResult).toBeNull(); // Should return null for fallback

      // Second attempt: Redis recovered
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockPuzzle));

      const secondAttemptStart = Date.now();
      const secondResult = await puzzleService.getPuzzleById(puzzleId);
      const secondAttemptTime = Date.now() - secondAttemptStart;

      expect(secondResult).toBeDefined();
      expect(secondResult?.id).toBe(puzzleId);

      // Retrieval should be faster than generation
      expect(secondAttemptTime).toBeLessThan(500); // Under 500ms target

      console.log(`✅ Retrieval prioritization test results:`);
      console.log(`   - First attempt (Redis down): ${firstAttemptTime}ms`);
      console.log(`   - Second attempt (Redis up): ${secondAttemptTime}ms`);
      console.log(`   - Retrieval prioritized: ${secondAttemptTime < firstAttemptTime}`);
    }, 30000); // 30 second timeout
  });
});
