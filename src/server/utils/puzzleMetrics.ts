/**
 * Puzzle Operations Metrics Tracking
 * Comprehensive monitoring for puzzle generation, storage, and retrieval
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { Difficulty } from '../../shared/types/puzzle.js';

/**
 * Metrics for puzzle generation operations
 */
interface PuzzleGenerationMetrics {
  puzzleId: string;
  difficulty: Difficulty;
  generationTime: number;
  timestamp: Date;
  success: boolean;
  source: 'enhanced' | 'legacy' | 'backup';
  errorType?: string;
}

/**
 * Metrics for Redis storage operations
 */
interface PuzzleStorageMetrics {
  puzzleId: string;
  operation: 'store' | 'retrieve';
  ttl?: number;
  timestamp: Date;
  success: boolean;
  latency: number;
  errorType?: string;
}

/**
 * Metrics for puzzle retrieval operations
 */
interface PuzzleRetrievalMetrics {
  puzzleId: string;
  difficulty: Difficulty;
  source: 'cache' | 'generated' | 'backup';
  cacheHit: boolean;
  latency: number;
  timestamp: Date;
  success: boolean;
  errorType?: string;
}

/**
 * Aggregated metrics for monitoring dashboard
 */
interface AggregatedMetrics {
  generation: {
    total: number;
    successful: number;
    failed: number;
    averageTime: number;
    byDifficulty: Record<Difficulty, { total: number; successful: number; averageTime: number }>;
    bySource: Record<'enhanced' | 'legacy' | 'backup', number>;
  };
  storage: {
    total: number;
    successful: number;
    failed: number;
    averageLatency: number;
    operations: Record<'store' | 'retrieve', { total: number; successful: number }>;
  };
  retrieval: {
    total: number;
    successful: number;
    failed: number;
    cacheHitRate: number;
    averageLatency: number;
    bySource: Record<'cache' | 'generated' | 'backup', number>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    recentErrors: Array<{ type: string; message: string; timestamp: Date; context: string }>;
  };
}

/**
 * Puzzle Metrics Monitor
 * Tracks and aggregates metrics for puzzle operations
 */
class PuzzleMetricsMonitor {
  private generationMetrics: PuzzleGenerationMetrics[] = [];
  private storageMetrics: PuzzleStorageMetrics[] = [];
  private retrievalMetrics: PuzzleRetrievalMetrics[] = [];
  private maxHistorySize = 1000; // Keep last 1000 operations

  /**
   * Record puzzle generation metrics
   * Requirement 9.1: Log puzzle generation with ID, difficulty, and generation time
   */
  recordGeneration(
    puzzleId: string,
    difficulty: Difficulty,
    generationTime: number,
    success: boolean,
    source: 'enhanced' | 'legacy' | 'backup' = 'enhanced',
    errorType?: string
  ): void {
    const metric: PuzzleGenerationMetrics = {
      puzzleId,
      difficulty,
      generationTime,
      timestamp: new Date(),
      success,
      source,
      errorType,
    };

    this.generationMetrics.push(metric);
    this.trimHistory(this.generationMetrics);

    // Log generation event
    if (success) {
      console.log(
        `📊 [METRICS] Puzzle generated: ${puzzleId} | Difficulty: ${difficulty} | Time: ${generationTime}ms | Source: ${source}`
      );
    } else {
      console.error(
        `📊 [METRICS] Puzzle generation failed: ${puzzleId} | Difficulty: ${difficulty} | Error: ${errorType || 'Unknown'}`
      );
    }
  }

  /**
   * Record Redis storage operation metrics
   * Requirement 9.2: Log Redis storage operations with TTL information
   */
  recordStorage(
    puzzleId: string,
    operation: 'store' | 'retrieve',
    latency: number,
    success: boolean,
    ttl?: number,
    errorType?: string
  ): void {
    const metric: PuzzleStorageMetrics = {
      puzzleId,
      operation,
      ttl,
      timestamp: new Date(),
      success,
      latency,
      errorType,
    };

    this.storageMetrics.push(metric);
    this.trimHistory(this.storageMetrics);

    // Log storage event
    if (success) {
      const ttlInfo = ttl ? ` | TTL: ${ttl}s (${Math.round(ttl / 86400)} days)` : '';
      console.log(`📊 [METRICS] Redis ${operation}: ${puzzleId} | Latency: ${latency}ms${ttlInfo}`);
    } else {
      console.error(
        `📊 [METRICS] Redis ${operation} failed: ${puzzleId} | Error: ${errorType || 'Unknown'}`
      );
    }
  }

  /**
   * Record puzzle retrieval metrics
   * Requirement 9.3: Log puzzle retrieval with cache hit/miss status
   */
  recordRetrieval(
    puzzleId: string,
    difficulty: Difficulty,
    source: 'cache' | 'generated' | 'backup',
    latency: number,
    success: boolean,
    errorType?: string
  ): void {
    const cacheHit = source === 'cache';
    const metric: PuzzleRetrievalMetrics = {
      puzzleId,
      difficulty,
      source,
      cacheHit,
      latency,
      timestamp: new Date(),
      success,
      errorType,
    };

    this.retrievalMetrics.push(metric);
    this.trimHistory(this.retrievalMetrics);

    // Log retrieval event
    if (success) {
      const hitStatus = cacheHit ? '✓ CACHE HIT' : '✗ CACHE MISS';
      console.log(
        `📊 [METRICS] Puzzle retrieved: ${puzzleId} | ${hitStatus} | Source: ${source} | Latency: ${latency}ms`
      );
    } else {
      console.error(
        `📊 [METRICS] Puzzle retrieval failed: ${puzzleId} | Error: ${errorType || 'Unknown'}`
      );
    }
  }

  /**
   * Record error with context
   * Requirement 9.4: Track error types and fallback actions
   */
  recordError(errorType: string, message: string, context: string): void {
    console.error(`📊 [METRICS] Error tracked: ${errorType} | Context: ${context} | ${message}`);
  }

  /**
   * Record fallback action
   * Requirement 9.4: Track error types and fallback actions
   */
  recordFallback(
    operation: string,
    originalError: string,
    fallbackAction: string,
    success: boolean
  ): void {
    const status = success ? '✓ SUCCESS' : '✗ FAILED';
    console.log(
      `📊 [METRICS] Fallback triggered: ${operation} | Original Error: ${originalError} | Fallback: ${fallbackAction} | ${status}`
    );
  }

  /**
   * Get aggregated metrics
   * Requirement 9.5: Implement metrics tracking for success rates and latency
   */
  getAggregatedMetrics(): AggregatedMetrics {
    return {
      generation: this.aggregateGenerationMetrics(),
      storage: this.aggregateStorageMetrics(),
      retrieval: this.aggregateRetrievalMetrics(),
      errors: this.aggregateErrorMetrics(),
    };
  }

  /**
   * Aggregate generation metrics
   */
  private aggregateGenerationMetrics() {
    const total = this.generationMetrics.length;
    const successful = this.generationMetrics.filter((m) => m.success).length;
    const failed = total - successful;

    const totalTime = this.generationMetrics
      .filter((m) => m.success)
      .reduce((sum, m) => sum + m.generationTime, 0);
    const averageTime = successful > 0 ? Math.round(totalTime / successful) : 0;

    // By difficulty
    const byDifficulty: Record<
      Difficulty,
      { total: number; successful: number; averageTime: number }
    > = {
      Easy: { total: 0, successful: 0, averageTime: 0 },
      Medium: { total: 0, successful: 0, averageTime: 0 },
      Hard: { total: 0, successful: 0, averageTime: 0 },
    };

    for (const metric of this.generationMetrics) {
      byDifficulty[metric.difficulty].total++;
      if (metric.success) {
        byDifficulty[metric.difficulty].successful++;
      }
    }

    // Calculate average times
    for (const difficulty of ['Easy', 'Medium', 'Hard'] as Difficulty[]) {
      const diffMetrics = this.generationMetrics.filter(
        (m) => m.difficulty === difficulty && m.success
      );
      const diffTotal = diffMetrics.reduce((sum, m) => sum + m.generationTime, 0);
      byDifficulty[difficulty].averageTime =
        diffMetrics.length > 0 ? Math.round(diffTotal / diffMetrics.length) : 0;
    }

    // By source
    const bySource: Record<'enhanced' | 'legacy' | 'backup', number> = {
      enhanced: this.generationMetrics.filter((m) => m.source === 'enhanced').length,
      legacy: this.generationMetrics.filter((m) => m.source === 'legacy').length,
      backup: this.generationMetrics.filter((m) => m.source === 'backup').length,
    };

    return {
      total,
      successful,
      failed,
      averageTime,
      byDifficulty,
      bySource,
    };
  }

  /**
   * Aggregate storage metrics
   */
  private aggregateStorageMetrics() {
    const total = this.storageMetrics.length;
    const successful = this.storageMetrics.filter((m) => m.success).length;
    const failed = total - successful;

    const totalLatency = this.storageMetrics
      .filter((m) => m.success)
      .reduce((sum, m) => sum + m.latency, 0);
    const averageLatency = successful > 0 ? Math.round(totalLatency / successful) : 0;

    // By operation
    const operations: Record<'store' | 'retrieve', { total: number; successful: number }> = {
      store: {
        total: this.storageMetrics.filter((m) => m.operation === 'store').length,
        successful: this.storageMetrics.filter((m) => m.operation === 'store' && m.success).length,
      },
      retrieve: {
        total: this.storageMetrics.filter((m) => m.operation === 'retrieve').length,
        successful: this.storageMetrics.filter((m) => m.operation === 'retrieve' && m.success)
          .length,
      },
    };

    return {
      total,
      successful,
      failed,
      averageLatency,
      operations,
    };
  }

  /**
   * Aggregate retrieval metrics
   */
  private aggregateRetrievalMetrics() {
    const total = this.retrievalMetrics.length;
    const successful = this.retrievalMetrics.filter((m) => m.success).length;
    const failed = total - successful;

    const cacheHits = this.retrievalMetrics.filter((m) => m.cacheHit && m.success).length;
    const cacheHitRate = successful > 0 ? Math.round((cacheHits / successful) * 100) / 100 : 0;

    const totalLatency = this.retrievalMetrics
      .filter((m) => m.success)
      .reduce((sum, m) => sum + m.latency, 0);
    const averageLatency = successful > 0 ? Math.round(totalLatency / successful) : 0;

    // By source
    const bySource: Record<'cache' | 'generated' | 'backup', number> = {
      cache: this.retrievalMetrics.filter((m) => m.source === 'cache').length,
      generated: this.retrievalMetrics.filter((m) => m.source === 'generated').length,
      backup: this.retrievalMetrics.filter((m) => m.source === 'backup').length,
    };

    return {
      total,
      successful,
      failed,
      cacheHitRate,
      averageLatency,
      bySource,
    };
  }

  /**
   * Aggregate error metrics
   */
  private aggregateErrorMetrics() {
    const allErrors = [
      ...this.generationMetrics.filter((m) => !m.success),
      ...this.storageMetrics.filter((m) => !m.success),
      ...this.retrievalMetrics.filter((m) => !m.success),
    ];

    const total = allErrors.length;
    const byType: Record<string, number> = {};

    for (const error of allErrors) {
      const errorType = (error as any).errorType || 'Unknown';
      byType[errorType] = (byType[errorType] || 0) + 1;
    }

    const recentErrors = allErrors.slice(-20).map((error) => ({
      type: (error as any).errorType || 'Unknown',
      message: `Operation failed for ${(error as any).puzzleId}`,
      timestamp: (error as any).timestamp,
      context: 'puzzleId' in error ? 'generation' : 'storage',
    }));

    return {
      total,
      byType,
      recentErrors,
    };
  }

  /**
   * Trim history to prevent memory bloat
   */
  private trimHistory(metrics: any[]): void {
    if (metrics.length > this.maxHistorySize) {
      metrics.splice(0, metrics.length - this.maxHistorySize);
    }
  }

  /**
   * Get metrics summary for logging
   */
  getMetricsSummary(): string {
    const metrics = this.getAggregatedMetrics();

    return `
📊 Puzzle Metrics Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generation:
  Total: ${metrics.generation.total} | Success: ${metrics.generation.successful} | Failed: ${metrics.generation.failed}
  Success Rate: ${metrics.generation.total > 0 ? Math.round((metrics.generation.successful / metrics.generation.total) * 100) : 0}%
  Average Time: ${metrics.generation.averageTime}ms
  By Difficulty:
    Easy: ${metrics.generation.byDifficulty.Easy.successful}/${metrics.generation.byDifficulty.Easy.total} (${metrics.generation.byDifficulty.Easy.averageTime}ms avg)
    Medium: ${metrics.generation.byDifficulty.Medium.successful}/${metrics.generation.byDifficulty.Medium.total} (${metrics.generation.byDifficulty.Medium.averageTime}ms avg)
    Hard: ${metrics.generation.byDifficulty.Hard.successful}/${metrics.generation.byDifficulty.Hard.total} (${metrics.generation.byDifficulty.Hard.averageTime}ms avg)
  By Source:
    Enhanced: ${metrics.generation.bySource.enhanced} | Legacy: ${metrics.generation.bySource.legacy} | Backup: ${metrics.generation.bySource.backup}

Storage:
  Total: ${metrics.storage.total} | Success: ${metrics.storage.successful} | Failed: ${metrics.storage.failed}
  Success Rate: ${metrics.storage.total > 0 ? Math.round((metrics.storage.successful / metrics.storage.total) * 100) : 0}%
  Average Latency: ${metrics.storage.averageLatency}ms
  Store Operations: ${metrics.storage.operations.store.successful}/${metrics.storage.operations.store.total}
  Retrieve Operations: ${metrics.storage.operations.retrieve.successful}/${metrics.storage.operations.retrieve.total}

Retrieval:
  Total: ${metrics.retrieval.total} | Success: ${metrics.retrieval.successful} | Failed: ${metrics.retrieval.failed}
  Success Rate: ${metrics.retrieval.total > 0 ? Math.round((metrics.retrieval.successful / metrics.retrieval.total) * 100) : 0}%
  Cache Hit Rate: ${(metrics.retrieval.cacheHitRate * 100).toFixed(1)}%
  Average Latency: ${metrics.retrieval.averageLatency}ms
  By Source:
    Cache: ${metrics.retrieval.bySource.cache} | Generated: ${metrics.retrieval.bySource.generated} | Backup: ${metrics.retrieval.bySource.backup}

Errors:
  Total: ${metrics.errors.total}
  By Type: ${
    Object.entries(metrics.errors.byType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ') || 'None'
  }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.generationMetrics = [];
    this.storageMetrics = [];
    this.retrievalMetrics = [];
    console.log('📊 [METRICS] All puzzle metrics reset');
  }
}

// Export singleton instance
export const puzzleMetrics = new PuzzleMetricsMonitor();
