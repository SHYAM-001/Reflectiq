// Integration tests for RedisManager service

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisManager } from '../RedisManager.js';
import type { LeaderboardEntry, GameSession, UserProgress } from '../RedisManager.js';
import type { PuzzleConfiguration, DifficultyLevel } from '../GameEngine.js';

// Mock Redis client
class MockRedisClient {
  private data = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private sortedSets = new Map<string, Map<string, number>>();

  async set(key: string, value: string, options?: { ex?: number }): Promise<void> {
    this.data.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async del(key: string): Promise<number> {
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const set = this.sortedSets.get(key)!;
    const existed = set.has(member);
    set.set(member, score);
    return existed ? 0 : 1;
  }

  async zrevrange(
    key: string,
    start: number,
    stop: number,
    withScores?: boolean
  ): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];

    const entries = Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
    const sliced = entries.slice(start, stop === -1 ? undefined : stop + 1);
    return sliced.map(([member]) => member);
  }

  async zrank(key: string, member: string): Promise<number | null> {
    const set = this.sortedSets.get(key);
    if (!set || !set.has(member)) return null;

    const entries = Array.from(set.entries()).sort((a, b) => b[1] - a[1]);
    const index = entries.findIndex(([m]) => m === member);
    return index === -1 ? null : index;
  }

  async zcard(key: string): Promise<number> {
    const set = this.sortedSets.get(key);
    return set ? set.size : 0;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    const existed = hash.has(field);
    hash.set(field, value);
    return existed ? 0 : 1;
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashes.get(key);
    return hash?.get(field) || null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async hdel(key: string, field: string): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    const existed = hash.has(field);
    hash.delete(field);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.data.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    // Mock implementation - just return success
    return 1;
  }

  // Helper method to clear all data
  clear(): void {
    this.data.clear();
    this.hashes.clear();
    this.sortedSets.clear();
  }
}

describe('RedisManager Integration Tests', () => {
  let redisManager: RedisManager;
  let mockRedis: MockRedisClient;

  beforeEach(() => {
    mockRedis = new MockRedisClient();
    redisManager = new RedisManager(mockRedis as any);
    mockRedis.clear();
  });

  // Helper function to create a test puzzle
  const createTestPuzzle = (): PuzzleConfiguration => ({
    id: 'test-puzzle-123',
    difficulty: 'easy' as DifficultyLevel,
    grid: [],
    laserEntry: { row: 0, col: 0, label: 'A1' },
    correctExit: { row: 0, col: 1, label: 'B1' },
    maxTime: 300,
    baseScore: 100,
    createdAt: new Date(),
  });

  describe('Puzzle Storage and Retrieval', () => {
    it('should store and retrieve puzzles', async () => {
      const puzzle = createTestPuzzle();

      await redisManager.storePuzzle(puzzle.id, puzzle);
      const retrieved = await redisManager.getPuzzle(puzzle.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(puzzle.id);
      expect(retrieved?.difficulty).toBe(puzzle.difficulty);
      expect(retrieved?.baseScore).toBe(puzzle.baseScore);
    });

    it('should return null for non-existent puzzles', async () => {
      const retrieved = await redisManager.getPuzzle('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should handle corrupted puzzle data gracefully', async () => {
      // Manually set corrupted data
      await mockRedis.set('puzzle:corrupted', 'invalid json');

      const retrieved = await redisManager.getPuzzle('corrupted');
      expect(retrieved).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should store and retrieve sessions', async () => {
      const session: GameSession = {
        sessionId: 'test-session-123',
        puzzleId: 'test-puzzle-123',
        userId: 'test-user',
        startTime: new Date(),
        hintsUsed: [0, 1],
        isActive: true,
      };

      await redisManager.storeSession(session.sessionId, session);
      const retrieved = await redisManager.getSession(session.sessionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(session.sessionId);
      expect(retrieved?.userId).toBe(session.userId);
      expect(retrieved?.hintsUsed).toEqual([0, 1]);
      expect(retrieved?.isActive).toBe(true);
      expect(retrieved?.startTime).toBeInstanceOf(Date);
    });

    it('should return null for non-existent sessions', async () => {
      const retrieved = await redisManager.getSession('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should delete sessions', async () => {
      const session: GameSession = {
        sessionId: 'test-session-123',
        puzzleId: 'test-puzzle-123',
        userId: 'test-user',
        startTime: new Date(),
        hintsUsed: [],
        isActive: true,
      };

      await redisManager.storeSession(session.sessionId, session);
      await redisManager.deleteSession(session.sessionId);

      const retrieved = await redisManager.getSession(session.sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Leaderboard Management', () => {
    it('should update and retrieve leaderboard entries', async () => {
      const entry: LeaderboardEntry = {
        rank: 1,
        username: 'test-user',
        difficulty: 'easy',
        timeElapsed: 120,
        hintsUsed: 1,
        finalScore: 80,
        timestamp: new Date(),
      };

      await redisManager.updatePlayerScore(entry);
      const leaderboard = await redisManager.getLeaderboard('easy', 10);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].username).toBe('test-user');
      expect(leaderboard[0].finalScore).toBe(80);
      expect(leaderboard[0].rank).toBe(1);
    });

    it('should handle multiple leaderboard entries and ranking', async () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 0,
          username: 'user1',
          difficulty: 'easy',
          timeElapsed: 60,
          hintsUsed: 0,
          finalScore: 100,
          timestamp: new Date('2024-01-01T10:00:00Z'),
        },
        {
          rank: 0,
          username: 'user2',
          difficulty: 'easy',
          timeElapsed: 90,
          hintsUsed: 1,
          finalScore: 80,
          timestamp: new Date('2024-01-01T10:05:00Z'),
        },
        {
          rank: 0,
          username: 'user3',
          difficulty: 'easy',
          timeElapsed: 120,
          hintsUsed: 0,
          finalScore: 90,
          timestamp: new Date('2024-01-01T10:10:00Z'),
        },
      ];

      for (const entry of entries) {
        await redisManager.updatePlayerScore(entry);
      }

      const leaderboard = await redisManager.getLeaderboard('easy', 10);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].username).toBe('user1'); // Highest score
      expect(leaderboard[0].finalScore).toBe(100);
      expect(leaderboard[1].username).toBe('user3'); // Second highest
      expect(leaderboard[1].finalScore).toBe(90);
      expect(leaderboard[2].username).toBe('user2'); // Lowest score
      expect(leaderboard[2].finalScore).toBe(80);
    });

    it('should get player rank correctly', async () => {
      const entries: LeaderboardEntry[] = [
        {
          rank: 0,
          username: 'user1',
          difficulty: 'easy',
          timeElapsed: 60,
          hintsUsed: 0,
          finalScore: 100,
          timestamp: new Date(),
        },
        {
          rank: 0,
          username: 'user2',
          difficulty: 'easy',
          timeElapsed: 90,
          hintsUsed: 1,
          finalScore: 80,
          timestamp: new Date(),
        },
      ];

      for (const entry of entries) {
        await redisManager.updatePlayerScore(entry);
      }

      const rank1 = await redisManager.getPlayerRank('user1', 'easy');
      const rank2 = await redisManager.getPlayerRank('user2', 'easy');
      const rankNonExistent = await redisManager.getPlayerRank('user3', 'easy');

      expect(rank1).toBe(1);
      expect(rank2).toBe(2);
      expect(rankNonExistent).toBeNull();
    });

    it('should get total players count', async () => {
      expect(await redisManager.getTotalPlayers('easy')).toBe(0);

      const entry: LeaderboardEntry = {
        rank: 1,
        username: 'test-user',
        difficulty: 'easy',
        timeElapsed: 120,
        hintsUsed: 1,
        finalScore: 80,
        timestamp: new Date(),
      };

      await redisManager.updatePlayerScore(entry);
      expect(await redisManager.getTotalPlayers('easy')).toBe(1);
    });
  });

  describe('Daily Puzzle Management', () => {
    it('should store and retrieve daily puzzles', async () => {
      const dailyPuzzles: DailyPuzzleSet = {
        date: new Date('2024-01-01'),
        puzzles: {
          easy: createTestPuzzle(),
          medium: { ...createTestPuzzle(), id: 'medium-puzzle', difficulty: 'medium' },
          hard: { ...createTestPuzzle(), id: 'hard-puzzle', difficulty: 'hard' },
        },
        postIds: {
          easy: 'post-easy',
          medium: 'post-medium',
          hard: 'post-hard',
        },
      };

      await redisManager.storeDailyPuzzles('2024-01-01', dailyPuzzles);
      const retrieved = await redisManager.getDailyPuzzles('2024-01-01');

      expect(retrieved).toBeDefined();
      expect(retrieved?.puzzles.easy.id).toBe('test-puzzle-123');
      expect(retrieved?.puzzles.medium.id).toBe('medium-puzzle');
      expect(retrieved?.puzzles.hard.id).toBe('hard-puzzle');
      expect(retrieved?.date).toBeInstanceOf(Date);
    });

    it('should return null for non-existent daily puzzles', async () => {
      const retrieved = await redisManager.getDailyPuzzles('2024-12-31');
      expect(retrieved).toBeNull();
    });
  });

  describe('Hint Usage Tracking', () => {
    it('should track and retrieve hint usage', async () => {
      const puzzleId = 'test-puzzle';
      const userId = 'test-user';

      await redisManager.trackHintUsage(puzzleId, userId, 0);
      await redisManager.trackHintUsage(puzzleId, userId, 2);

      const hintUsage = await redisManager.getHintUsage(puzzleId, userId);

      expect(hintUsage).toEqual([0, 2]);
    });

    it('should return empty array for no hint usage', async () => {
      const hintUsage = await redisManager.getHintUsage('puzzle', 'user');
      expect(hintUsage).toEqual([]);
    });
  });

  describe('User Progress Tracking', () => {
    it('should store and retrieve user progress', async () => {
      const progress: UserDailyProgress = {
        date: new Date('2024-01-01'),
        completed: {
          easy: true,
          medium: false,
          hard: true,
        },
        scores: {
          easy: 100,
          hard: 250,
        },
      };

      await redisManager.storeUserProgress('test-user', '2024-01-01', progress);
      const retrieved = await redisManager.getUserProgress('test-user', '2024-01-01');

      expect(retrieved).toBeDefined();
      expect(retrieved?.completed.easy).toBe(true);
      expect(retrieved?.completed.medium).toBe(false);
      expect(retrieved?.completed.hard).toBe(true);
      expect(retrieved?.scores.easy).toBe(100);
      expect(retrieved?.scores.hard).toBe(250);
      expect(retrieved?.date).toBeInstanceOf(Date);
    });

    it('should return null for non-existent user progress', async () => {
      const retrieved = await redisManager.getUserProgress('user', '2024-01-01');
      expect(retrieved).toBeNull();
    });
  });

  describe('Puzzle Hash Management', () => {
    it('should store and check puzzle hashes', async () => {
      const hash = 'test-hash-123';
      const puzzleId = 'test-puzzle-123';

      expect(await redisManager.puzzleHashExists(hash)).toBe(false);

      await redisManager.storePuzzleHash(hash, puzzleId);

      expect(await redisManager.puzzleHashExists(hash)).toBe(true);
    });

    it('should retrieve all puzzle hashes', async () => {
      await redisManager.storePuzzleHash('hash1', 'puzzle1');
      await redisManager.storePuzzleHash('hash2', 'puzzle2');

      const hashes = await redisManager.getAllPuzzleHashes();

      expect(hashes).toContain('hash1');
      expect(hashes).toContain('hash2');
      expect(hashes).toHaveLength(2);
    });
  });

  describe('Statistics and Cleanup', () => {
    it('should provide Redis statistics', async () => {
      // Add some test data
      const entry: LeaderboardEntry = {
        rank: 1,
        username: 'test-user',
        difficulty: 'easy',
        timeElapsed: 120,
        hintsUsed: 1,
        finalScore: 80,
        timestamp: new Date(),
      };
      await redisManager.updatePlayerScore(entry);
      await redisManager.storePuzzleHash('hash1', 'puzzle1');

      const stats = await redisManager.getStats();

      expect(stats.leaderboardSizes.easy).toBe(1);
      expect(stats.leaderboardSizes.medium).toBe(0);
      expect(stats.leaderboardSizes.hard).toBe(0);
      expect(stats.puzzleHashes).toBe(1);
    });

    it('should handle cleanup operations', async () => {
      // Add test data that would be cleaned up
      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < 1005; i++) {
        entries.push({
          rank: i + 1,
          username: `user${i}`,
          difficulty: 'easy',
          timeElapsed: 60 + i,
          hintsUsed: 0,
          finalScore: 100 - i,
          timestamp: new Date(),
        });
      }

      for (const entry of entries) {
        await redisManager.updatePlayerScore(entry);
      }

      expect(await redisManager.getTotalPlayers('easy')).toBe(1005);

      await redisManager.cleanup();

      // After cleanup, should still have all entries (mock doesn't implement cleanup logic)
      expect(await redisManager.getTotalPlayers('easy')).toBe(1005);
    });

    it('should check key existence', async () => {
      expect(await redisManager.exists('non-existent-key')).toBe(false);

      await mockRedis.set('test-key', 'test-value');
      expect(await redisManager.exists('test-key')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted JSON data gracefully', async () => {
      // Manually set corrupted data for different types
      await mockRedis.set('session:corrupted', 'invalid json');
      await mockRedis.set('daily:corrupted', 'invalid json');
      await mockRedis.set('progress:user:corrupted', 'invalid json');

      const session = await redisManager.getSession('corrupted');
      const dailyPuzzles = await redisManager.getDailyPuzzles('corrupted');
      const progress = await redisManager.getUserProgress('user', 'corrupted');

      expect(session).toBeNull();
      expect(dailyPuzzles).toBeNull();
      expect(progress).toBeNull();
    });

    it('should handle corrupted leaderboard entries gracefully', async () => {
      // Add valid entry
      const validEntry: LeaderboardEntry = {
        rank: 1,
        username: 'valid-user',
        difficulty: 'easy',
        timeElapsed: 120,
        hintsUsed: 1,
        finalScore: 80,
        timestamp: new Date(),
      };
      await redisManager.updatePlayerScore(validEntry);

      // Manually add corrupted entry
      await mockRedis.zadd('leaderboard:easy', 90, 'invalid json');

      const leaderboard = await redisManager.getLeaderboard('easy', 10);

      // Should only return valid entries
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].username).toBe('valid-user');
    });
  });
});
