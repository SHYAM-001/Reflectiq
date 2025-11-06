/**
 * Redis Client and Connection Management for ReflectIQ
 * Provides centralized Redis operations with error handling, retry logic, and connection pooling
 * Following Devvit Web best practices for Redis integration
 */

import { redis } from '@devvit/web/server';
import { logger } from './logger.js';

export interface RedisConfig {
  keyPrefix: string;
  defaultTTL: number;
  retryAttempts: number;
  retryDelay: number;
  enableLogging: boolean;
}

export interface RedisOperationOptions {
  ttl?: number;
  retryAttempts?: number;
  logOperation?: boolean;
}

export interface RedisConnectionStatus {
  isConnected: boolean;
  lastPing?: Date;
  operationsCount: number;
  errorCount: number;
  lastError?: string;
}

/**
 * Enhanced Redis Client wrapper for Devvit Web
 * Provides connection management, error handling, and operation logging
 */
class RedisClientManager {
  private static instance: RedisClientManager;
  private config: RedisConfig;
  private connectionStatus: RedisConnectionStatus;
  private operationMetrics: Map<string, { count: number; totalTime: number; errors: number }>;

  private constructor(config?: Partial<RedisConfig>) {
    this.config = {
      keyPrefix: 'reflectiq',
      defaultTTL: 3600, // 1 hour default
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      enableLogging: process.env.NODE_ENV !== 'production',
      ...config,
    };

    this.connectionStatus = {
      isConnected: false,
      operationsCount: 0,
      errorCount: 0,
    };

    this.operationMetrics = new Map();

    // Note: Connection initialization is disabled for Devvit compatibility
    // Redis operations can only be performed within request context
    // Health checks will be performed lazily when needed
    logger.info('Redis client initialized - health check will be performed lazily');
  }

  public static getInstance(config?: Partial<RedisConfig>): RedisClientManager {
    if (!RedisClientManager.instance) {
      RedisClientManager.instance = new RedisClientManager(config);
    }
    return RedisClientManager.instance;
  }

  /**
   * Initialize Redis connection and perform health check
   * Note: This method is disabled for Devvit compatibility
   * Redis operations can only be performed within request context
   */
  private async initializeConnection(): Promise<void> {
    // Disabled for Devvit compatibility - Redis only works in request context
    logger.info('Redis connection initialization skipped for Devvit compatibility');
  }

  /**
   * Perform Redis health check
   * Note: This only works within Devvit request context
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();

      // Use a simple set/get/del operation for health check
      const testKey = this.buildKey('health_check');
      const testValue = Date.now().toString();

      await redis.set(testKey, testValue);
      const retrievedValue = await redis.get(testKey);
      await redis.del(testKey);

      const isHealthy = retrievedValue === testValue;
      const latency = Date.now() - startTime;

      this.connectionStatus.isConnected = isHealthy;
      this.connectionStatus.lastPing = new Date();

      if (this.config.enableLogging) {
        logger.debug('Redis health check completed', {
          healthy: isHealthy,
          latency: `${latency}ms`,
        });
      }

      return isHealthy;
    } catch (error) {
      this.connectionStatus.isConnected = false;
      this.connectionStatus.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.connectionStatus.errorCount++;

      // Check if this is the "No context found" error from Devvit
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('No context found')) {
        logger.debug(
          'Redis health check called outside request context - this is expected during startup'
        );
        return false; // Return false but don't log as error
      }

      logger.error('Redis health check failed', { error });
      return false;
    }
  }

  /**
   * Build Redis key with prefix
   */
  private buildKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }

  /**
   * Record operation metrics
   */
  private recordMetrics(operation: string, duration: number, success: boolean): void {
    if (!this.operationMetrics.has(operation)) {
      this.operationMetrics.set(operation, { count: 0, totalTime: 0, errors: 0 });
    }

    const metrics = this.operationMetrics.get(operation)!;
    metrics.count++;
    metrics.totalTime += duration;

    if (!success) {
      metrics.errors++;
    }
  }

  /**
   * Execute Redis operation with retry logic and error handling
   */
  private async executeWithRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    options: RedisOperationOptions = {}
  ): Promise<T> {
    const maxAttempts = options.retryAttempts ?? this.config.retryAttempts;
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.connectionStatus.operationsCount++;

        const result = await fn();
        const duration = Date.now() - startTime;

        this.recordMetrics(operation, duration, true);

        if (options.logOperation ?? this.config.enableLogging) {
          logger.debug(`Redis ${operation} completed`, {
            duration: `${duration}ms`,
            attempt: attempt > 1 ? attempt : undefined,
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown Redis error');
        this.connectionStatus.errorCount++;

        if (attempt === maxAttempts) {
          const duration = Date.now() - startTime;
          this.recordMetrics(operation, duration, false);

          logger.error(`Redis ${operation} failed after ${maxAttempts} attempts`, {
            error: lastError.message,
            duration: `${duration}ms`,
            attempts: maxAttempts,
          });

          throw lastError;
        }

        // Wait before retry
        if (attempt < maxAttempts) {
          const delay = this.config.retryDelay * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));

          logger.warn(`Redis ${operation} failed, retrying`, {
            attempt,
            maxAttempts,
            error: lastError.message,
            retryDelay: `${delay}ms`,
          });
        }
      }
    }

    throw lastError || new Error('Redis operation failed');
  }

  /**
   * Set a key-value pair with optional TTL
   */
  public async set(key: string, value: string, options: RedisOperationOptions = {}): Promise<void> {
    const redisKey = this.buildKey(key);
    const ttl = options.ttl ?? this.config.defaultTTL;

    return this.executeWithRetry(
      'SET',
      async () => {
        await redis.set(redisKey, value);
        if (ttl > 0) {
          await redis.expire(redisKey, ttl);
        }
      },
      options
    );
  }

  /**
   * Get a value by key
   */
  public async get(key: string, options: RedisOperationOptions = {}): Promise<string | null> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'GET',
      async () => {
        return await redis.get(redisKey);
      },
      options
    );
  }

  /**
   * Delete one or more keys
   */
  public async del(keys: string | string[], options: RedisOperationOptions = {}): Promise<number> {
    const redisKeys = Array.isArray(keys)
      ? keys.map((key) => this.buildKey(key))
      : [this.buildKey(keys)];

    return this.executeWithRetry(
      'DEL',
      async () => {
        return await redis.del(...redisKeys);
      },
      options
    );
  }

  /**
   * Check if key exists
   */
  public async exists(key: string, options: RedisOperationOptions = {}): Promise<boolean> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'EXISTS',
      async () => {
        const count = await redis.exists(redisKey);
        return count > 0;
      },
      options
    );
  }

  /**
   * Set expiration on a key
   */
  public async expire(
    key: string,
    seconds: number,
    options: RedisOperationOptions = {}
  ): Promise<boolean> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'EXPIRE',
      async () => {
        const result = await redis.expire(redisKey, seconds);
        return result === 1;
      },
      options
    );
  }

  /**
   * Increment a numeric value
   */
  public async incr(key: string, options: RedisOperationOptions = {}): Promise<number> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'INCR',
      async () => {
        return await redis.incrBy(redisKey, 1);
      },
      options
    );
  }

  /**
   * Increment by a specific amount
   */
  public async incrBy(
    key: string,
    increment: number,
    options: RedisOperationOptions = {}
  ): Promise<number> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'INCRBY',
      async () => {
        return await redis.incrBy(redisKey, increment);
      },
      options
    );
  }

  /**
   * Hash operations - Set field in hash
   */
  public async hSet(
    key: string,
    field: string,
    value: string,
    options: RedisOperationOptions = {}
  ): Promise<number>;
  public async hSet(
    key: string,
    fieldValues: Record<string, string>,
    options?: RedisOperationOptions
  ): Promise<number>;
  public async hSet(
    key: string,
    fieldOrValues: string | Record<string, string>,
    valueOrOptions?: string | RedisOperationOptions,
    options: RedisOperationOptions = {}
  ): Promise<number> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'HSET',
      async () => {
        if (typeof fieldOrValues === 'string') {
          // Single field-value pair
          const field = fieldOrValues;
          const value = valueOrOptions as string;
          return await redis.hSet(redisKey, { [field]: value });
        } else {
          // Multiple field-value pairs
          const fieldValues = fieldOrValues;
          const opts = (valueOrOptions as RedisOperationOptions) || options;
          return await redis.hSet(redisKey, fieldValues);
        }
      },
      typeof valueOrOptions === 'object' ? valueOrOptions : options
    );
  }

  /**
   * Hash operations - Get field from hash
   */
  public async hGet(
    key: string,
    field: string,
    options: RedisOperationOptions = {}
  ): Promise<string | null> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'HGET',
      async () => {
        return await redis.hGet(redisKey, field);
      },
      options
    );
  }

  /**
   * Hash operations - Get all fields from hash
   */
  public async hGetAll(
    key: string,
    options: RedisOperationOptions = {}
  ): Promise<Record<string, string>> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'HGETALL',
      async () => {
        const result = await redis.hGetAll(redisKey);
        return result || {};
      },
      options
    );
  }

  /**
   * Hash operations - Delete field from hash
   */
  public async hDel(
    key: string,
    field: string,
    options: RedisOperationOptions = {}
  ): Promise<number> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'HDEL',
      async () => {
        return await redis.hDel(redisKey, field);
      },
      options
    );
  }

  /**
   * Sorted set operations - Add member with score
   */
  public async zAdd(
    key: string,
    member: string,
    score: number,
    options: RedisOperationOptions = {}
  ): Promise<number> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'ZADD',
      async () => {
        return await redis.zAdd(redisKey, { member, score });
      },
      options
    );
  }

  /**
   * Sorted set operations - Get range by rank
   */
  public async zRange(
    key: string,
    start: number,
    stop: number,
    options: RedisOperationOptions = {}
  ): Promise<string[]> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'ZRANGE',
      async () => {
        return await redis.zRange(redisKey, start, stop);
      },
      options
    );
  }

  /**
   * Sorted set operations - Get range by rank with scores
   */
  public async zRangeWithScores(
    key: string,
    start: number,
    stop: number,
    options: RedisOperationOptions = {}
  ): Promise<Array<{ member: string; score: number }>> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'ZRANGE_WITHSCORES',
      async () => {
        return await redis.zRangeWithScores(redisKey, start, stop);
      },
      options
    );
  }

  /**
   * Sorted set operations - Remove member
   */
  public async zRem(
    key: string,
    member: string,
    options: RedisOperationOptions = {}
  ): Promise<number> {
    const redisKey = this.buildKey(key);

    return this.executeWithRetry(
      'ZREM',
      async () => {
        return await redis.zRem(redisKey, member);
      },
      options
    );
  }

  /**
   * Get connection status and metrics
   */
  public getConnectionStatus(): RedisConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get operation metrics
   */
  public getMetrics(): Record<string, { count: number; avgTime: number; errorRate: number }> {
    const metrics: Record<string, { count: number; avgTime: number; errorRate: number }> = {};

    for (const [operation, data] of this.operationMetrics.entries()) {
      metrics[operation] = {
        count: data.count,
        avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
        errorRate: data.count > 0 ? Math.round((data.errors / data.count) * 100) : 0,
      };
    }

    return metrics;
  }

  /**
   * Reset metrics (useful for monitoring)
   */
  public resetMetrics(): void {
    this.operationMetrics.clear();
    this.connectionStatus.operationsCount = 0;
    this.connectionStatus.errorCount = 0;
    logger.info('Redis metrics reset');
  }

  /**
   * Cleanup and close connections (for graceful shutdown)
   */
  public async cleanup(): Promise<void> {
    try {
      // Devvit Web handles connection cleanup automatically
      // Just log the cleanup
      logger.info('Redis client cleanup completed', {
        totalOperations: this.connectionStatus.operationsCount,
        totalErrors: this.connectionStatus.errorCount,
      });
    } catch (error) {
      logger.error('Error during Redis cleanup', { error });
    }
  }
}

// Export singleton instance
export const redisClient = RedisClientManager.getInstance();

// Export convenience functions for common operations
export const redisGet = (key: string, options?: RedisOperationOptions) =>
  redisClient.get(key, options);

export const redisSet = (key: string, value: string, options?: RedisOperationOptions) =>
  redisClient.set(key, value, options);

export const redisDel = (keys: string | string[], options?: RedisOperationOptions) =>
  redisClient.del(keys, options);

export const redisExists = (key: string, options?: RedisOperationOptions) =>
  redisClient.exists(key, options);

export const redisHSet = (
  key: string,
  field: string,
  value: string,
  options?: RedisOperationOptions
) => redisClient.hSet(key, field, value, options);

export const redisHGet = (key: string, field: string, options?: RedisOperationOptions) =>
  redisClient.hGet(key, field, options);

export const redisHGetAll = (key: string, options?: RedisOperationOptions) =>
  redisClient.hGetAll(key, options);

export const redisZAdd = (
  key: string,
  member: string,
  score: number,
  options?: RedisOperationOptions
) => redisClient.zAdd(key, member, score, options);

export const redisZRange = (
  key: string,
  start: number,
  stop: number,
  options?: RedisOperationOptions
) => redisClient.zRange(key, start, stop, options);

export const redisZRangeWithScores = (
  key: string,
  start: number,
  stop: number,
  options?: RedisOperationOptions
) => redisClient.zRangeWithScores(key, start, stop, options);

export default redisClient;
