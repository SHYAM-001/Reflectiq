// Redis data management service for Logic Reflections

import type {
  PuzzleConfiguration,
  LeaderboardEntry,
  DifficultyLevel,
  GameSession,
} from '../../shared/types/game.js';
import type { DailyPuzzleSet, UserDailyProgress } from '../../shared/types/daily-puzzles.js';

// Note: In a real Devvit app, we would import the Redis client from Devvit SDK
// For now, we'll define the interface and implement the logic
interface RedisClient {
  set(key: string, value: string, options?: { ex?: number }): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<number>;
  zrevrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]>;
  zrank(key: string, member: string): Promise<number | null>;
  zcard(key: string): Promise<number>;
  hset(key: string, field: string, value: string): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, field: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

export class RedisManager {
  private redis: RedisClient;

  constructor(redisClient: RedisClient) {
    this.redis = redisClient;
  }

  // Redis key generators
  private getPuzzleKey(puzzleId: string): string {
    return `puzzle:${puzzleId}`;
  }

  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  private getLeaderboardKey(difficulty: DifficultyLevel): string {
    return `leaderboard:${difficulty}`;
  }

  private getDailyPuzzleKey(date: string): string {
    return `daily:${date}`;
  }

  private getUserProgressKey(userId: string, date: string): string {
    return `progress:${userId}:${date}`;
  }

  private getHintUsageKey(puzzleId: string, userId: string): string {
    return `hints:${puzzleId}:${userId}`;
  }

  private getPuzzleHashKey(): string {
    return 'puzzle:hashes';
  }

  /**
   * Store puzzle configuration
   */
  async storePuzzle(puzzleId: string, config: PuzzleConfiguration): Promise<void> {
    const key = this.getPuzzleKey(puzzleId);
    const value = JSON.stringify(config);

    // Store with 24 hour expiration
    await this.redis.set(key, value, { ex: 24 * 60 * 60 });
  }

  /**
   * Retrieve puzzle configuration
   */
  async getPuzzle(puzzleId: string): Promise<PuzzleConfiguration | null> {
    const key = this.getPuzzleKey(puzzleId);
    const value = await this.redis.get(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as PuzzleConfiguration;
    } catch (error) {
      console.error('Error parsing puzzle data:', error);
      return null;
    }
  }

  /**
   * Store game session
   */
  async storeSession(sessionId: string, session: GameSession): Promise<void> {
    const key = this.getSessionKey(sessionId);
    const value = JSON.stringify(session);

    // Store with 2 hour expiration
    await this.redis.set(key, value, { ex: 2 * 60 * 60 });
  }

  /**
   * Retrieve game session
   */
  async getSession(sessionId: string): Promise<GameSession | null> {
    const key = this.getSessionKey(sessionId);
    const value = await this.redis.get(key);

    if (!value) return null;

    try {
      const session = JSON.parse(value) as GameSession;
      // Convert startTime back to Date object
      session.startTime = new Date(session.startTime);
      return session;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  /**
   * Update leaderboard with new score
   */
  async updatePlayerScore(entry: LeaderboardEntry): Promise<void> {
    const key = this.getLeaderboardKey(entry.difficulty);

    // Use timestamp as tiebreaker (earlier submission wins)
    const score = entry.finalScore + entry.timestamp.getTime() / 1e15;
    const member = JSON.stringify({
      username: entry.username,
      timeElapsed: entry.timeElapsed,
      hintsUsed: entry.hintsUsed,
      finalScore: entry.finalScore,
      timestamp: entry.timestamp.toISOString(),
    });

    await this.redis.zadd(key, score, member);
  }

  /**
   * Get leaderboard for difficulty
   */
  async getLeaderboard(
    difficulty: DifficultyLevel,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    const key = this.getLeaderboardKey(difficulty);
    const results = await this.redis.zrevrange(key, 0, limit - 1);

    const entries: LeaderboardEntry[] = [];

    for (let i = 0; i < results.length; i++) {
      try {
        const data = JSON.parse(results[i]);
        entries.push({
          rank: i + 1,
          username: data.username,
          difficulty,
          timeElapsed: data.timeElapsed,
          hintsUsed: data.hintsUsed,
          finalScore: data.finalScore,
          timestamp: new Date(data.timestamp),
        });
      } catch (error) {
        console.error('Error parsing leaderboard entry:', error);
      }
    }

    return entries;
  }

  /**
   * Get player's rank on leaderboard
   */
  async getPlayerRank(username: string, difficulty: DifficultyLevel): Promise<number | null> {
    const key = this.getLeaderboardKey(difficulty);
    const results = await this.redis.zrevrange(key, 0, -1);

    for (let i = 0; i < results.length; i++) {
      try {
        const data = JSON.parse(results[i]);
        if (data.username === username) {
          return i + 1;
        }
      } catch (error) {
        console.error('Error parsing leaderboard entry:', error);
      }
    }

    return null;
  }

  /**
   * Get total players count for difficulty
   */
  async getTotalPlayers(difficulty: DifficultyLevel): Promise<number> {
    const key = this.getLeaderboardKey(difficulty);
    return await this.redis.zcard(key);
  }

  /**
   * Store daily puzzle set
   */
  async storeDailyPuzzles(date: string, puzzleSet: DailyPuzzleSet): Promise<void> {
    const key = this.getDailyPuzzleKey(date);
    const value = JSON.stringify(puzzleSet);

    // Store with 7 day expiration
    await this.redis.set(key, value, { ex: 7 * 24 * 60 * 60 });
  }

  /**
   * Get daily puzzle set
   */
  async getDailyPuzzles(date: string): Promise<DailyPuzzleSet | null> {
    const key = this.getDailyPuzzleKey(date);
    const value = await this.redis.get(key);

    if (!value) return null;

    try {
      const puzzleSet = JSON.parse(value) as DailyPuzzleSet;
      // Convert date back to Date object
      puzzleSet.date = new Date(puzzleSet.date);
      return puzzleSet;
    } catch (error) {
      console.error('Error parsing daily puzzle data:', error);
      return null;
    }
  }

  /**
   * Track hint usage for a puzzle
   */
  async trackHintUsage(puzzleId: string, userId: string, quadrant: number): Promise<void> {
    const key = this.getHintUsageKey(puzzleId, userId);
    const field = `quadrant_${quadrant}`;
    const timestamp = new Date().toISOString();

    await this.redis.hset(key, field, timestamp);

    // Set expiration for 24 hours
    await this.redis.expire(key, 24 * 60 * 60);
  }

  /**
   * Get hint usage for a puzzle
   */
  async getHintUsage(puzzleId: string, userId: string): Promise<number[]> {
    const key = this.getHintUsageKey(puzzleId, userId);
    const hints = await this.redis.hgetall(key);

    const usedQuadrants: number[] = [];
    for (const field in hints) {
      if (field.startsWith('quadrant_')) {
        const quadrant = parseInt(field.split('_')[1], 10);
        if (!isNaN(quadrant)) {
          usedQuadrants.push(quadrant);
        }
      }
    }

    return usedQuadrants.sort();
  }

  /**
   * Store user's daily progress
   */
  async storeUserProgress(
    userId: string,
    date: string,
    progress: UserDailyProgress
  ): Promise<void> {
    const key = this.getUserProgressKey(userId, date);
    const value = JSON.stringify(progress);

    // Store with 30 day expiration
    await this.redis.set(key, value, { ex: 30 * 24 * 60 * 60 });
  }

  /**
   * Get user's daily progress
   */
  async getUserProgress(userId: string, date: string): Promise<UserDailyProgress | null> {
    const key = this.getUserProgressKey(userId, date);
    const value = await this.redis.get(key);

    if (!value) return null;

    try {
      const progress = JSON.parse(value) as UserDailyProgress;
      // Convert date back to Date object
      progress.date = new Date(progress.date);
      return progress;
    } catch (error) {
      console.error('Error parsing user progress data:', error);
      return null;
    }
  }

  /**
   * Store puzzle hash for uniqueness checking
   */
  async storePuzzleHash(hash: string, puzzleId: string): Promise<void> {
    const key = this.getPuzzleHashKey();
    await this.redis.hset(key, hash, puzzleId);
  }

  /**
   * Check if puzzle hash exists
   */
  async puzzleHashExists(hash: string): Promise<boolean> {
    const key = this.getPuzzleHashKey();
    const result = await this.redis.hget(key, hash);
    return result !== null;
  }

  /**
   * Get all puzzle hashes
   */
  async getAllPuzzleHashes(): Promise<string[]> {
    const key = this.getPuzzleHashKey();
    const hashes = await this.redis.hgetall(key);
    return Object.keys(hashes);
  }

  /**
   * Clean up expired data
   */
  async cleanup(): Promise<void> {
    // Redis handles expiration automatically, but we can implement
    // additional cleanup logic here if needed

    // For example, clean up very old leaderboard entries
    const difficulties: DifficultyLevel[] = ['easy', 'medium', 'hard'];

    for (const difficulty of difficulties) {
      const key = this.getLeaderboardKey(difficulty);
      const count = await this.redis.zcard(key);

      // Keep only top 1000 entries per difficulty
      if (count > 1000) {
        // Remove entries beyond rank 1000
        await this.redis.zrevrange(key, 1000, -1);
      }
    }
  }

  /**
   * Get Redis statistics
   */
  async getStats(): Promise<{
    totalPuzzles: number;
    totalSessions: number;
    leaderboardSizes: Record<DifficultyLevel, number>;
    puzzleHashes: number;
  }> {
    const leaderboardSizes: Record<DifficultyLevel, number> = {
      easy: await this.redis.zcard(this.getLeaderboardKey('easy')),
      medium: await this.redis.zcard(this.getLeaderboardKey('medium')),
      hard: await this.redis.zcard(this.getLeaderboardKey('hard')),
    };

    const puzzleHashesKey = this.getPuzzleHashKey();
    const puzzleHashesData = await this.redis.hgetall(puzzleHashesKey);
    const puzzleHashes = Object.keys(puzzleHashesData).length;

    return {
      totalPuzzles: 0, // Would need to scan keys to get accurate count
      totalSessions: 0, // Would need to scan keys to get accurate count
      leaderboardSizes,
      puzzleHashes,
    };
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redis.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result > 0;
  }
}
