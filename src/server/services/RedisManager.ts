import { redis } from '@devvit/web/server';
import type { DifficultyLevel } from './GameEngine.js';

// Types for Redis data management
export interface LeaderboardEntry {
  rank: number;
  username: string;
  difficulty: DifficultyLevel;
  timeElapsed: number;
  hintsUsed: number;
  finalScore: number;
  timestamp: Date;
  userId: string;
}

export interface UserProgress {
  userId: string;
  totalGamesPlayed: number;
  totalScore: number;
  bestScores: {
    easy: number;
    medium: number;
    hard: number;
  };
  averageTime: {
    easy: number;
    medium: number;
    hard: number;
  };
  hintsUsageStats: {
    totalHintsUsed: number;
    averageHintsPerGame: number;
  };
  lastPlayedDate: Date;
}

export interface GameSession {
  sessionId: string;
  puzzleId: string;
  userId: string;
  startTime: Date;
  difficulty: DifficultyLevel;
  hintsUsed: number[];
  isActive: boolean;
  lastActivity: Date;
}

export interface PuzzleMetadata {
  puzzleId: string;
  difficulty: DifficultyLevel;
  createdAt: Date;
  totalAttempts: number;
  successfulAttempts: number;
  averageTime: number;
  averageHints: number;
}

/**
 * RedisManager service for handling all Redis operations
 * Following Devvit Web patterns with proper data isolation per subreddit
 */
export class RedisManager {
  // Redis key prefixes for data organization
  private static readonly KEYS = {
    PUZZLE: 'puzzle:',
    LEADERBOARD: 'leaderboard:',
    USER_PROGRESS: 'user:progress:',
    GAME_SESSION: 'session:',
    PUZZLE_METADATA: 'puzzle:meta:',
    DAILY_PUZZLES: 'daily:puzzles:',
    HINT_USAGE: 'hints:',
    GLOBAL_STATS: 'stats:global',
  };

  // Leaderboard size limits
  private static readonly LEADERBOARD_MAX_SIZE = 100;
  private static readonly SESSION_EXPIRY = 3600; // 1 hour in seconds

  /**
   * Store puzzle configuration in Redis with expiration
   */
  async storePuzzle(puzzleId: string, puzzleData: any): Promise<void> {
    const key = RedisManager.KEYS.PUZZLE + puzzleId;

    // Store puzzle with 24-hour expiration
    await redis.setEx(key, 86400, JSON.stringify(puzzleData));

    // Update puzzle metadata
    await this.updatePuzzleMetadata(puzzleId, puzzleData.difficulty);
  }

  /**
   * Retrieve puzzle configuration from Redis
   */
  async getPuzzle(puzzleId: string): Promise<any | null> {
    const key = RedisManager.KEYS.PUZZLE + puzzleId;
    const data = await redis.get(key);

    return data ? JSON.parse(data) : null;
  }

  /**
   * Get leaderboard for specific difficulty
   * Uses Redis sorted sets for efficient ranking
   */
  async getLeaderboard(
    difficulty: DifficultyLevel,
    limit: number = 50
  ): Promise<LeaderboardEntry[]> {
    const key = RedisManager.KEYS.LEADERBOARD + difficulty;

    // Get top scores in descending order (highest scores first)
    const results = await redis.zRange(key, 0, limit - 1, { by: 'rank', rev: true });

    const leaderboard: LeaderboardEntry[] = [];

    for (let i = 0; i < results.length; i++) {
      const entryData = await redis.hGetAll(`${key}:entry:${results[i].member}`);

      if (entryData.username) {
        leaderboard.push({
          rank: i + 1,
          username: entryData.username,
          difficulty,
          timeElapsed: parseInt(entryData.timeElapsed || '0'),
          hintsUsed: parseInt(entryData.hintsUsed || '0'),
          finalScore: results[i].score,
          timestamp: new Date(entryData.timestamp || Date.now()),
          userId: results[i].member,
        });
      }
    }

    return leaderboard;
  }

  /**
   * Update player score in leaderboard
   * Uses Redis transactions for atomic operations
   */
  async updatePlayerScore(entry: Omit<LeaderboardEntry, 'rank'>): Promise<number> {
    const leaderboardKey = RedisManager.KEYS.LEADERBOARD + entry.difficulty;
    const entryKey = `${leaderboardKey}:entry:${entry.userId}`;

    // Use Redis transaction for atomic update
    const txn = await redis.watch(leaderboardKey);

    try {
      await txn.multi();

      // Add/update score in sorted set
      await txn.zAdd(leaderboardKey, { member: entry.userId, score: entry.finalScore });

      // Store detailed entry information in hash
      await txn.hSet(entryKey, {
        username: entry.username,
        difficulty: entry.difficulty,
        timeElapsed: entry.timeElapsed.toString(),
        hintsUsed: entry.hintsUsed.toString(),
        finalScore: entry.finalScore.toString(),
        timestamp: entry.timestamp.toISOString(),
        userId: entry.userId,
      });

      // Set expiration for entry details (30 days)
      await txn.expire(entryKey, 2592000);

      // Trim leaderboard to max size
      await txn.zRemRangeByRank(leaderboardKey, 0, -(RedisManager.LEADERBOARD_MAX_SIZE + 1));

      await txn.exec();

      // Get player's rank
      const rank = await redis.zRank(leaderboardKey, entry.userId);
      return rank !== undefined ? rank + 1 : -1;
    } catch (error) {
      await txn.discard();
      throw error;
    }
  }

  /**
   * Get user's current rank in leaderboard
   */
  async getUserRank(userId: string, difficulty: DifficultyLevel): Promise<number | null> {
    const key = RedisManager.KEYS.LEADERBOARD + difficulty;
    const rank = await redis.zRank(key, userId);

    return rank !== undefined ? rank + 1 : null;
  }

  /**
   * Track user progress and statistics
   */
  async updateUserProgress(
    userId: string,
    gameResult: {
      difficulty: DifficultyLevel;
      score: number;
      timeElapsed: number;
      hintsUsed: number;
      isCorrect: boolean;
    }
  ): Promise<void> {
    const key = RedisManager.KEYS.USER_PROGRESS + userId;

    // Get current progress or initialize
    const currentData = await redis.hGetAll(key);
    const progress: UserProgress = {
      userId,
      totalGamesPlayed: parseInt(currentData.totalGamesPlayed || '0'),
      totalScore: parseInt(currentData.totalScore || '0'),
      bestScores: {
        easy: parseInt(currentData.bestScoreEasy || '0'),
        medium: parseInt(currentData.bestScoreMedium || '0'),
        hard: parseInt(currentData.bestScoreHard || '0'),
      },
      averageTime: {
        easy: parseFloat(currentData.avgTimeEasy || '0'),
        medium: parseFloat(currentData.avgTimeMedium || '0'),
        hard: parseFloat(currentData.avgTimeHard || '0'),
      },
      hintsUsageStats: {
        totalHintsUsed: parseInt(currentData.totalHintsUsed || '0'),
        averageHintsPerGame: parseFloat(currentData.avgHintsPerGame || '0'),
      },
      lastPlayedDate: new Date(),
    };

    // Update statistics
    progress.totalGamesPlayed += 1;
    if (gameResult.isCorrect) {
      progress.totalScore += gameResult.score;
    }

    // Update best scores
    if (gameResult.score > progress.bestScores[gameResult.difficulty]) {
      progress.bestScores[gameResult.difficulty] = gameResult.score;
    }

    // Update average times (simple moving average)
    const currentAvg = progress.averageTime[gameResult.difficulty];
    const gamesForDifficulty =
      parseInt(currentData[`gamesPlayed${gameResult.difficulty}`] || '0') + 1;
    progress.averageTime[gameResult.difficulty] =
      (currentAvg * (gamesForDifficulty - 1) + gameResult.timeElapsed) / gamesForDifficulty;

    // Update hints statistics
    progress.hintsUsageStats.totalHintsUsed += gameResult.hintsUsed;
    progress.hintsUsageStats.averageHintsPerGame =
      progress.hintsUsageStats.totalHintsUsed / progress.totalGamesPlayed;

    // Store updated progress
    await redis.hSet(key, {
      totalGamesPlayed: progress.totalGamesPlayed.toString(),
      totalScore: progress.totalScore.toString(),
      bestScoreEasy: progress.bestScores.easy.toString(),
      bestScoreMedium: progress.bestScores.medium.toString(),
      bestScoreHard: progress.bestScores.hard.toString(),
      avgTimeEasy: progress.averageTime.easy.toString(),
      avgTimeMedium: progress.averageTime.medium.toString(),
      avgTimeHard: progress.averageTime.hard.toString(),
      totalHintsUsed: progress.hintsUsageStats.totalHintsUsed.toString(),
      avgHintsPerGame: progress.hintsUsageStats.averageHintsPerGame.toString(),
      lastPlayedDate: progress.lastPlayedDate.toISOString(),
      [`gamesPlayed${gameResult.difficulty}`]: gamesForDifficulty.toString(),
    });

    // Set expiration (90 days)
    await redis.expire(key, 7776000);
  }

  /**
   * Get user progress statistics
   */
  async getUserProgress(userId: string): Promise<UserProgress | null> {
    const key = RedisManager.KEYS.USER_PROGRESS + userId;
    const data = await redis.hGetAll(key);

    if (!data.totalGamesPlayed) {
      return null;
    }

    return {
      userId,
      totalGamesPlayed: parseInt(data.totalGamesPlayed),
      totalScore: parseInt(data.totalScore),
      bestScores: {
        easy: parseInt(data.bestScoreEasy || '0'),
        medium: parseInt(data.bestScoreMedium || '0'),
        hard: parseInt(data.bestScoreHard || '0'),
      },
      averageTime: {
        easy: parseFloat(data.avgTimeEasy || '0'),
        medium: parseFloat(data.avgTimeMedium || '0'),
        hard: parseFloat(data.avgTimeHard || '0'),
      },
      hintsUsageStats: {
        totalHintsUsed: parseInt(data.totalHintsUsed || '0'),
        averageHintsPerGame: parseFloat(data.avgHintsPerGame || '0'),
      },
      lastPlayedDate: new Date(data.lastPlayedDate || Date.now()),
    };
  }

  /**
   * Create and manage game sessions
   */
  async createGameSession(
    sessionId: string,
    puzzleId: string,
    userId: string,
    difficulty: DifficultyLevel
  ): Promise<void> {
    const key = RedisManager.KEYS.GAME_SESSION + sessionId;

    const session: GameSession = {
      sessionId,
      puzzleId,
      userId,
      startTime: new Date(),
      difficulty,
      hintsUsed: [],
      isActive: true,
      lastActivity: new Date(),
    };

    await redis.setEx(key, RedisManager.SESSION_EXPIRY, JSON.stringify(session));
  }

  /**
   * Get game session
   */
  async getGameSession(sessionId: string): Promise<GameSession | null> {
    const key = RedisManager.KEYS.GAME_SESSION + sessionId;
    const data = await redis.get(key);

    return data ? JSON.parse(data) : null;
  }

  /**
   * Update game session with hint usage
   */
  async updateGameSession(sessionId: string, hintsUsed: number[]): Promise<void> {
    const session = await this.getGameSession(sessionId);
    if (!session) return;

    session.hintsUsed = hintsUsed;
    session.lastActivity = new Date();

    const key = RedisManager.KEYS.GAME_SESSION + sessionId;
    await redis.setEx(key, RedisManager.SESSION_EXPIRY, JSON.stringify(session));
  }

  /**
   * End game session
   */
  async endGameSession(sessionId: string): Promise<void> {
    const session = await this.getGameSession(sessionId);
    if (!session) return;

    session.isActive = false;
    session.lastActivity = new Date();

    const key = RedisManager.KEYS.GAME_SESSION + sessionId;
    await redis.setEx(key, 3600, JSON.stringify(session)); // Keep for 1 hour after completion
  }

  /**
   * Track hint usage patterns
   */
  async trackHintUsage(puzzleId: string, userId: string, quadrant: number): Promise<void> {
    const key = RedisManager.KEYS.HINT_USAGE + puzzleId;

    // Increment hint usage counter for this quadrant
    await redis.hIncrBy(key, `quadrant_${quadrant}`, 1);
    await redis.hIncrBy(key, 'total_hints', 1);

    // Set expiration (7 days)
    await redis.expire(key, 604800);

    // Track user-specific hint usage
    const userKey = `${key}:user:${userId}`;
    await redis.hIncrBy(userKey, `quadrant_${quadrant}`, 1);
    await redis.expire(userKey, 604800);
  }

  /**
   * Get hint usage statistics for a puzzle
   */
  async getHintUsageStats(puzzleId: string): Promise<Record<string, number>> {
    const key = RedisManager.KEYS.HINT_USAGE + puzzleId;
    const stats = await redis.hGetAll(key);

    const result: Record<string, number> = {};
    Object.entries(stats).forEach(([field, value]) => {
      result[field] = parseInt(value);
    });

    return result;
  }

  /**
   * Update puzzle metadata and statistics
   */
  private async updatePuzzleMetadata(puzzleId: string, difficulty: DifficultyLevel): Promise<void> {
    const key = RedisManager.KEYS.PUZZLE_METADATA + puzzleId;

    await redis.hSet(key, {
      puzzleId,
      difficulty,
      createdAt: new Date().toISOString(),
      totalAttempts: '0',
      successfulAttempts: '0',
      averageTime: '0',
      averageHints: '0',
    });

    // Set expiration (30 days)
    await redis.expire(key, 2592000);
  }

  /**
   * Update puzzle attempt statistics
   */
  async updatePuzzleStats(
    puzzleId: string,
    isSuccess: boolean,
    timeElapsed: number,
    hintsUsed: number
  ): Promise<void> {
    const key = RedisManager.KEYS.PUZZLE_METADATA + puzzleId;

    // Use transaction for atomic updates
    const txn = await redis.watch(key);

    try {
      const currentData = await redis.hGetAll(key);
      const totalAttempts = parseInt(currentData.totalAttempts || '0') + 1;
      const successfulAttempts =
        parseInt(currentData.successfulAttempts || '0') + (isSuccess ? 1 : 0);
      const currentAvgTime = parseFloat(currentData.averageTime || '0');
      const currentAvgHints = parseFloat(currentData.averageHints || '0');

      // Calculate new averages
      const newAvgTime = (currentAvgTime * (totalAttempts - 1) + timeElapsed) / totalAttempts;
      const newAvgHints = (currentAvgHints * (totalAttempts - 1) + hintsUsed) / totalAttempts;

      await txn.multi();
      await txn.hSet(key, {
        totalAttempts: totalAttempts.toString(),
        successfulAttempts: successfulAttempts.toString(),
        averageTime: newAvgTime.toString(),
        averageHints: newAvgHints.toString(),
      });
      await txn.exec();
    } catch (error) {
      await txn.discard();
      throw error;
    }
  }

  /**
   * Get global game statistics
   */
  async getGlobalStats(): Promise<Record<string, any>> {
    const key = RedisManager.KEYS.GLOBAL_STATS;
    const stats = await redis.hGetAll(key);

    return {
      totalGamesPlayed: parseInt(stats.totalGamesPlayed || '0'),
      totalPlayers: parseInt(stats.totalPlayers || '0'),
      averageScore: parseFloat(stats.averageScore || '0'),
      mostPopularDifficulty: stats.mostPopularDifficulty || 'medium',
      totalHintsUsed: parseInt(stats.totalHintsUsed || '0'),
    };
  }

  /**
   * Update global statistics
   */
  async updateGlobalStats(gameResult: {
    difficulty: DifficultyLevel;
    score: number;
    hintsUsed: number;
    isNewPlayer: boolean;
  }): Promise<void> {
    const key = RedisManager.KEYS.GLOBAL_STATS;

    // Use transaction for atomic updates
    const txn = await redis.watch(key);

    try {
      await txn.multi();
      await txn.hIncrBy(key, 'totalGamesPlayed', 1);
      await txn.hIncrBy(key, 'totalHintsUsed', gameResult.hintsUsed);
      await txn.hIncrBy(key, `difficulty_${gameResult.difficulty}`, 1);

      if (gameResult.isNewPlayer) {
        await txn.hIncrBy(key, 'totalPlayers', 1);
      }

      await txn.exec();
    } catch (error) {
      await txn.discard();
      throw error;
    }
  }

  /**
   * Clean up expired sessions and old data
   */
  async cleanupExpiredData(): Promise<void> {
    // This would typically be called by a scheduled job
    // For now, we rely on Redis TTL for automatic cleanup
    console.log('Cleanup completed - relying on Redis TTL for automatic expiration');
  }
}

// Export singleton instance
export const redisManager = new RedisManager();
