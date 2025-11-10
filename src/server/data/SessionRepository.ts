/**
 * Session Data Repository for ReflectIQ
 * Handles CRUD operations for user sessions using Redis with automatic expiration
 * Following Devvit Web best practices for session management
 */

import { redisClient, RedisOperationOptions } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';
import { SessionData } from '../../shared/types/puzzle.js';

export interface SessionQueryOptions {
  includeSubmissions?: boolean;
  extendExpiration?: boolean;
}

export interface SessionStats {
  totalActiveSessions: number;
  sessionsByDifficulty: Record<string, number>;
  averageSessionDuration: number;
  oldestSession?: string;
}

/**
 * Repository for session data operations
 */
export class SessionRepository {
  private static instance: SessionRepository;
  private readonly SESSION_KEY_PREFIX = 'sessions';
  private readonly SESSION_INDEX_KEY = 'session_index';
  private readonly DEFAULT_SESSION_TTL = 3600; // 1 hour
  private readonly EXTENDED_SESSION_TTL = 7200; // 2 hours

  private constructor() {}

  public static getInstance(): SessionRepository {
    if (!SessionRepository.instance) {
      SessionRepository.instance = new SessionRepository();
    }
    return SessionRepository.instance;
  }

  /**
   * Create a new session
   */
  public async createSession(
    sessionData: SessionData,
    options: RedisOperationOptions = {}
  ): Promise<void> {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}:${sessionData.sessionId}`;
      const sessionJson = JSON.stringify(sessionData);

      // Store session with automatic expiration
      await redisClient.set(sessionKey, sessionJson, {
        ttl: this.DEFAULT_SESSION_TTL,
        ...options,
      });

      // Update session index for quick lookups and stats
      await this.updateSessionIndex(sessionData);

      logger.debug('Session created successfully', {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        puzzleId: sessionData.puzzleId,
        difficulty: sessionData.difficulty,
      });
    } catch (error) {
      logger.error('Failed to create session', {
        sessionId: sessionData.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to create session ${sessionData.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieve a session by ID
   */
  public async getSession(
    sessionId: string,
    options: SessionQueryOptions = {}
  ): Promise<SessionData | null> {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}:${sessionId}`;
      const sessionJson = await redisClient.get(sessionKey);

      if (!sessionJson) {
        logger.debug('Session not found', { sessionId });
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionJson);

      // Extend expiration if requested and session is active
      if (options.extendExpiration && !sessionData.completedAt) {
        await redisClient.expire(sessionKey, this.EXTENDED_SESSION_TTL);
        logger.debug('Session expiration extended', { sessionId });
      }

      // Filter submissions if not requested
      if (!options.includeSubmissions) {
        sessionData.submissions = [];
      }

      logger.debug('Session retrieved successfully', {
        sessionId,
        userId: sessionData.userId,
        isCompleted: !!sessionData.completedAt,
        hintsUsed: sessionData.hintsUsed,
      });

      return sessionData;
    } catch (error) {
      logger.error('Failed to retrieve session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to retrieve session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing session
   */
  public async updateSession(
    sessionData: SessionData,
    options: RedisOperationOptions = {}
  ): Promise<void> {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}:${sessionData.sessionId}`;
      const sessionJson = JSON.stringify(sessionData);

      // Check if session exists first
      const exists = await redisClient.exists(sessionKey);
      if (!exists) {
        throw new Error(`Session ${sessionData.sessionId} does not exist`);
      }

      // Update session data
      await redisClient.set(sessionKey, sessionJson, {
        ttl: sessionData.completedAt ? this.DEFAULT_SESSION_TTL : this.EXTENDED_SESSION_TTL,
        ...options,
      });

      // Update session index
      await this.updateSessionIndex(sessionData);

      logger.debug('Session updated successfully', {
        sessionId: sessionData.sessionId,
        isCompleted: !!sessionData.completedAt,
        hintsUsed: sessionData.hintsUsed,
        submissionsCount: sessionData.submissions.length,
      });
    } catch (error) {
      logger.error('Failed to update session', {
        sessionId: sessionData.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to update session ${sessionData.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a session
   */
  public async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = `${this.SESSION_KEY_PREFIX}:${sessionId}`;

      // Remove from main storage
      const deletedCount = await redisClient.del(sessionKey);

      // Remove from index
      await this.removeFromSessionIndex(sessionId);

      const success = deletedCount > 0;

      logger.debug('Session deletion completed', {
        sessionId,
        success,
        deletedCount,
      });

      return success;
    } catch (error) {
      logger.error('Failed to delete session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get sessions by user ID
   */
  public async getSessionsByUser(
    userId: string,
    limit: number = 10,
    options: SessionQueryOptions = {}
  ): Promise<SessionData[]> {
    try {
      // Get session IDs from index
      const indexData = await redisClient.hGetAll(this.SESSION_INDEX_KEY);
      const userSessions: Array<{ sessionId: string; createdAt: Date }> = [];

      for (const [sessionId, dataStr] of Object.entries(indexData)) {
        try {
          const indexEntry = JSON.parse(dataStr);
          if (indexEntry.userId === userId) {
            userSessions.push({
              sessionId,
              createdAt: new Date(indexEntry.createdAt),
            });
          }
        } catch (parseError) {
          logger.warn('Failed to parse session index entry', { sessionId, dataStr });
        }
      }

      // Sort by creation date (newest first) and limit
      userSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const limitedSessions = userSessions.slice(0, limit);

      // Fetch full session data
      const sessions: SessionData[] = [];
      for (const { sessionId } of limitedSessions) {
        const session = await this.getSession(sessionId, options);
        if (session) {
          sessions.push(session);
        }
      }

      logger.debug('User sessions retrieved', {
        userId,
        totalFound: userSessions.length,
        returned: sessions.length,
        limit,
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get sessions by user', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to get sessions for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get active sessions (not completed)
   */
  public async getActiveSessions(limit: number = 50): Promise<SessionData[]> {
    try {
      const indexData = await redisClient.hGetAll(this.SESSION_INDEX_KEY);
      const activeSessions: Array<{ sessionId: string; createdAt: Date }> = [];

      for (const [sessionId, dataStr] of Object.entries(indexData)) {
        try {
          const indexEntry = JSON.parse(dataStr);
          if (!indexEntry.completedAt) {
            activeSessions.push({
              sessionId,
              createdAt: new Date(indexEntry.createdAt),
            });
          }
        } catch (parseError) {
          logger.warn('Failed to parse session index entry', { sessionId, dataStr });
        }
      }

      // Sort by creation date (newest first) and limit
      activeSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const limitedSessions = activeSessions.slice(0, limit);

      // Fetch full session data
      const sessions: SessionData[] = [];
      for (const { sessionId } of limitedSessions) {
        const session = await this.getSession(sessionId, { includeSubmissions: false });
        if (session) {
          sessions.push(session);
        }
      }

      logger.debug('Active sessions retrieved', {
        totalActive: activeSessions.length,
        returned: sessions.length,
        limit,
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get active sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to get active sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(): Promise<SessionStats> {
    try {
      const indexData = await redisClient.hGetAll(this.SESSION_INDEX_KEY);

      const stats: SessionStats = {
        totalActiveSessions: 0,
        sessionsByDifficulty: {},
        averageSessionDuration: 0,
      };

      let totalDuration = 0;
      let completedSessions = 0;
      let oldestDate: Date | null = null;

      for (const [sessionId, dataStr] of Object.entries(indexData)) {
        try {
          const indexEntry = JSON.parse(dataStr);

          if (!indexEntry.completedAt) {
            stats.totalActiveSessions++;
          }

          // Count by difficulty
          const difficulty = indexEntry.difficulty || 'Unknown';
          stats.sessionsByDifficulty[difficulty] =
            (stats.sessionsByDifficulty[difficulty] || 0) + 1;

          // Calculate duration for completed sessions
          if (indexEntry.completedAt) {
            const duration =
              new Date(indexEntry.completedAt).getTime() - new Date(indexEntry.createdAt).getTime();
            totalDuration += duration;
            completedSessions++;
          }

          // Track oldest session
          const createdAt = new Date(indexEntry.createdAt);
          if (!oldestDate || createdAt < oldestDate) {
            oldestDate = createdAt;
            stats.oldestSession = sessionId;
          }
        } catch (parseError) {
          logger.warn('Failed to parse session index entry for stats', { sessionId, dataStr });
        }
      }

      // Calculate average duration in seconds
      if (completedSessions > 0) {
        stats.averageSessionDuration = Math.round(totalDuration / completedSessions / 1000);
      }

      logger.debug('Session stats calculated', {
        totalActive: stats.totalActiveSessions,
        totalCompleted: completedSessions,
        avgDuration: stats.averageSessionDuration,
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get session stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return default stats on error
      return {
        totalActiveSessions: 0,
        sessionsByDifficulty: {},
        averageSessionDuration: 0,
      };
    }
  }

  /**
   * Cleanup expired sessions
   */
  public async cleanupExpiredSessions(): Promise<number> {
    try {
      const indexData = await redisClient.hGetAll(this.SESSION_INDEX_KEY);
      let cleanedCount = 0;
      const batchSize = 20;
      const sessionIds = Object.keys(indexData);

      for (let i = 0; i < sessionIds.length; i += batchSize) {
        const batch = sessionIds.slice(i, i + batchSize);

        for (const sessionId of batch) {
          try {
            const sessionKey = `${this.SESSION_KEY_PREFIX}:${sessionId}`;
            const exists = await redisClient.exists(sessionKey);

            if (!exists) {
              // Session expired, remove from index
              await this.removeFromSessionIndex(sessionId);
              cleanedCount++;
            }
          } catch (error) {
            logger.warn('Failed to check session existence during cleanup', {
              sessionId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Small delay between batches
        if (i + batchSize < sessionIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      logger.info('Session cleanup completed', {
        totalChecked: sessionIds.length,
        cleanedCount,
      });

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to cleanup expired sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate that a session's puzzle ID matches the expected puzzle ID
   * Requirement 6.2: Update session validation to verify puzzle ID matches
   */
  public async validateSessionPuzzleId(
    sessionId: string,
    expectedPuzzleId: string
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        logger.warn('Session not found for puzzle ID validation', { sessionId });
        return false;
      }

      const isValid = session.puzzleId === expectedPuzzleId;

      if (!isValid) {
        logger.warn('Puzzle ID mismatch detected', {
          sessionId,
          sessionPuzzleId: session.puzzleId,
          expectedPuzzleId,
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Failed to validate session puzzle ID', {
        sessionId,
        expectedPuzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get sessions by puzzle ID
   * Requirement 6.5: Maintain session isolation between different puzzle IDs
   */
  public async getSessionsByPuzzleId(puzzleId: string, limit: number = 50): Promise<SessionData[]> {
    try {
      const indexData = await redisClient.hGetAll(this.SESSION_INDEX_KEY);
      const puzzleSessions: Array<{ sessionId: string; createdAt: Date }> = [];

      for (const [sessionId, dataStr] of Object.entries(indexData)) {
        try {
          const indexEntry = JSON.parse(dataStr);
          if (indexEntry.puzzleId === puzzleId) {
            puzzleSessions.push({
              sessionId,
              createdAt: new Date(indexEntry.createdAt),
            });
          }
        } catch (parseError) {
          logger.warn('Failed to parse session index entry', { sessionId, dataStr });
        }
      }

      // Sort by creation date (newest first) and limit
      puzzleSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const limitedSessions = puzzleSessions.slice(0, limit);

      // Fetch full session data
      const sessions: SessionData[] = [];
      for (const { sessionId } of limitedSessions) {
        const session = await this.getSession(sessionId, { includeSubmissions: false });
        if (session) {
          sessions.push(session);
        }
      }

      logger.debug('Puzzle sessions retrieved', {
        puzzleId,
        totalFound: puzzleSessions.length,
        returned: sessions.length,
        limit,
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get sessions by puzzle ID', {
        puzzleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to get sessions for puzzle ${puzzleId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update session index for quick lookups
   */
  private async updateSessionIndex(sessionData: SessionData): Promise<void> {
    try {
      const indexEntry = {
        userId: sessionData.userId,
        puzzleId: sessionData.puzzleId,
        difficulty: sessionData.difficulty,
        createdAt: sessionData.startTime, // Use startTime as createdAt
        completedAt: sessionData.status === 'submitted' ? new Date() : undefined,
        hintsUsed: sessionData.hintsUsed,
      };

      await redisClient.hSet(
        this.SESSION_INDEX_KEY,
        sessionData.sessionId,
        JSON.stringify(indexEntry)
      );
    } catch (error) {
      logger.warn('Failed to update session index', {
        sessionId: sessionData.sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - index update is not critical
    }
  }

  /**
   * Remove session from index
   */
  private async removeFromSessionIndex(sessionId: string): Promise<void> {
    try {
      await redisClient.hDel(this.SESSION_INDEX_KEY, sessionId);
    } catch (error) {
      logger.warn('Failed to remove session from index', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - index cleanup is not critical
    }
  }
}

export default SessionRepository;
