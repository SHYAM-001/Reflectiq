/**
 * Performance Monitoring Service for ReflectIQ
 * Tracks and reports on performance metrics for puzzle operations
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { Difficulty } from '../../shared/types/puzzle.js';

/**
 * Performance thresholds for monitoring
 */
const PERFORMANCE_THRESHOLDS = {
  PUZZLE_GENERATION_MS: 5000, // 5 seconds max
  PUZZLE_RETRIEVAL_MS: 500, // 500ms max
  REDIS_OPERATION_MS: 100, // 100ms max
  CACHE_HIT_RATE_MIN: 0.8, // 80% minimum cache hit rate
};

/**
 * Performance metrics for operations
 */
interface OperationMetrics {
  operationName: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  thresholdViolations: number;
  lastUpdated: Date;
}

/**
 * Cache performance metrics
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  averageRetrievalTime: number;
}

/**
 * Performance alert
 */
interface PerformanceAlert {
  severity: 'warning' | 'critical';
  metric: string;
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: Date;
}

/**
 * Performance Monitoring Service
 * Tracks and analyzes performance metrics for puzzle operations
 */
export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private operationMetrics: Map<string, OperationMetrics> = new Map();
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0,
    averageRetrievalTime: 0,
  };
  private alerts: PerformanceAlert[] = [];
  private maxAlertsHistory = 100;

  private constructor() {
    // Initialize monitoring
    this.startPeriodicReporting();
  }

  public static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  /**
   * Record puzzle generation performance
   * Requirement 10.3: Add performance monitoring for puzzle generation (<5s target)
   */
  recordPuzzleGeneration(
    puzzleId: string,
    difficulty: Difficulty,
    duration: number,
    success: boolean,
    source: 'enhanced' | 'legacy' | 'backup'
  ): void {
    const operationName = `puzzle_generation_${difficulty.toLowerCase()}_${source}`;
    this.recordOperation(operationName, duration, success);

    // Check against threshold
    if (duration > PERFORMANCE_THRESHOLDS.PUZZLE_GENERATION_MS) {
      this.createAlert(
        'warning',
        'puzzle_generation_slow',
        `Puzzle generation exceeded 5s threshold: ${puzzleId} took ${duration}ms`,
        PERFORMANCE_THRESHOLDS.PUZZLE_GENERATION_MS,
        duration
      );
    }

    // Log performance
    const status = success ? '✓' : '✗';
    const performanceIndicator =
      duration > PERFORMANCE_THRESHOLDS.PUZZLE_GENERATION_MS ? '⚠️' : '✓';
    console.log(
      `${performanceIndicator} [PERF] Generation ${status}: ${puzzleId} | ${difficulty} | ${duration}ms | ${source}`
    );
  }

  /**
   * Record puzzle retrieval performance
   * Requirement 10.4: Optimize puzzle retrieval from Redis (<500ms target)
   */
  recordPuzzleRetrieval(
    puzzleId: string,
    duration: number,
    success: boolean,
    cacheHit: boolean
  ): void {
    const operationName = cacheHit ? 'puzzle_retrieval_cache_hit' : 'puzzle_retrieval_cache_miss';
    this.recordOperation(operationName, duration, success);

    // Update cache metrics
    if (success) {
      if (cacheHit) {
        this.cacheMetrics.hits++;
      } else {
        this.cacheMetrics.misses++;
      }
      this.cacheMetrics.totalRequests++;
      this.cacheMetrics.hitRate = this.cacheMetrics.hits / this.cacheMetrics.totalRequests;

      // Update average retrieval time
      const totalTime =
        this.cacheMetrics.averageRetrievalTime * (this.cacheMetrics.totalRequests - 1) + duration;
      this.cacheMetrics.averageRetrievalTime = totalTime / this.cacheMetrics.totalRequests;
    }

    // Check against threshold
    if (duration > PERFORMANCE_THRESHOLDS.PUZZLE_RETRIEVAL_MS) {
      this.createAlert(
        'warning',
        'puzzle_retrieval_slow',
        `Puzzle retrieval exceeded 500ms threshold: ${puzzleId} took ${duration}ms`,
        PERFORMANCE_THRESHOLDS.PUZZLE_RETRIEVAL_MS,
        duration
      );
    }

    // Check cache hit rate
    if (
      this.cacheMetrics.totalRequests > 10 &&
      this.cacheMetrics.hitRate < PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_MIN
    ) {
      this.createAlert(
        'warning',
        'cache_hit_rate_low',
        `Cache hit rate below 80%: ${(this.cacheMetrics.hitRate * 100).toFixed(1)}%`,
        PERFORMANCE_THRESHOLDS.CACHE_HIT_RATE_MIN,
        this.cacheMetrics.hitRate
      );
    }

    // Log performance
    const status = success ? '✓' : '✗';
    const hitStatus = cacheHit ? 'HIT' : 'MISS';
    const performanceIndicator = duration > PERFORMANCE_THRESHOLDS.PUZZLE_RETRIEVAL_MS ? '⚠️' : '✓';
    console.log(
      `${performanceIndicator} [PERF] Retrieval ${status}: ${puzzleId} | ${hitStatus} | ${duration}ms`
    );
  }

  /**
   * Record Redis operation performance
   * Requirement 10.2: Implement circuit breaker patterns for Redis operations
   */
  recordRedisOperation(
    operation: 'get' | 'set' | 'del' | 'expire',
    key: string,
    duration: number,
    success: boolean
  ): void {
    const operationName = `redis_${operation}`;
    this.recordOperation(operationName, duration, success);

    // Check against threshold
    if (duration > PERFORMANCE_THRESHOLDS.REDIS_OPERATION_MS) {
      this.createAlert(
        'warning',
        'redis_operation_slow',
        `Redis ${operation} exceeded 100ms threshold: ${key} took ${duration}ms`,
        PERFORMANCE_THRESHOLDS.REDIS_OPERATION_MS,
        duration
      );
    }

    // Log slow operations
    if (duration > PERFORMANCE_THRESHOLDS.REDIS_OPERATION_MS) {
      console.warn(`⚠️ [PERF] Slow Redis ${operation}: ${key} | ${duration}ms`);
    }
  }

  /**
   * Record cache warming performance
   * Requirement 10.5: Add cache warming for scheduled post creation
   */
  recordCacheWarmup(
    cacheType: string,
    itemsWarmed: number,
    duration: number,
    success: boolean
  ): void {
    const operationName = `cache_warmup_${cacheType}`;
    this.recordOperation(operationName, duration, success);

    const status = success ? '✓' : '✗';
    console.log(
      `${status} [PERF] Cache warmup: ${cacheType} | ${itemsWarmed} items | ${duration}ms`
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    operations: OperationMetrics[];
    cache: CacheMetrics;
    alerts: PerformanceAlert[];
    health: 'healthy' | 'degraded' | 'critical';
  } {
    const operations = Array.from(this.operationMetrics.values());
    const recentAlerts = this.alerts.slice(-20);

    // Determine health status
    const criticalAlerts = recentAlerts.filter((a) => a.severity === 'critical').length;
    const warningAlerts = recentAlerts.filter((a) => a.severity === 'warning').length;

    let health: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalAlerts > 0) {
      health = 'critical';
    } else if (warningAlerts > 5) {
      health = 'degraded';
    }

    return {
      operations,
      cache: this.cacheMetrics,
      alerts: recentAlerts,
      health,
    };
  }

  /**
   * Get detailed metrics for specific operation
   */
  getOperationMetrics(operationName: string): OperationMetrics | null {
    return this.operationMetrics.get(operationName) || null;
  }

  /**
   * Get cache performance metrics
   */
  getCacheMetrics(): CacheMetrics {
    return { ...this.cacheMetrics };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count: number = 20): PerformanceAlert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.operationMetrics.clear();
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      averageRetrievalTime: 0,
    };
    this.alerts = [];
    console.log('🔄 [PERF] All performance metrics reset');
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const summary = this.getPerformanceSummary();

    let report = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PERFORMANCE MONITORING REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Health: ${summary.health.toUpperCase()}

Cache Performance:
  Hit Rate: ${(summary.cache.hitRate * 100).toFixed(1)}% (Target: ≥80%)
  Total Requests: ${summary.cache.totalRequests}
  Cache Hits: ${summary.cache.hits}
  Cache Misses: ${summary.cache.misses}
  Avg Retrieval Time: ${Math.round(summary.cache.averageRetrievalTime)}ms

Operation Metrics:
`;

    // Group operations by type
    const generationOps = summary.operations.filter((op) =>
      op.operationName.startsWith('puzzle_generation')
    );
    const retrievalOps = summary.operations.filter((op) =>
      op.operationName.startsWith('puzzle_retrieval')
    );
    const redisOps = summary.operations.filter((op) => op.operationName.startsWith('redis_'));

    if (generationOps.length > 0) {
      report += '\n  Puzzle Generation:\n';
      for (const op of generationOps) {
        const indicator =
          op.averageDuration > PERFORMANCE_THRESHOLDS.PUZZLE_GENERATION_MS ? '⚠️' : '✓';
        report += `    ${indicator} ${op.operationName}: ${op.count} ops, avg ${Math.round(op.averageDuration)}ms, ${(op.successRate * 100).toFixed(1)}% success\n`;
      }
    }

    if (retrievalOps.length > 0) {
      report += '\n  Puzzle Retrieval:\n';
      for (const op of retrievalOps) {
        const indicator =
          op.averageDuration > PERFORMANCE_THRESHOLDS.PUZZLE_RETRIEVAL_MS ? '⚠️' : '✓';
        report += `    ${indicator} ${op.operationName}: ${op.count} ops, avg ${Math.round(op.averageDuration)}ms, ${(op.successRate * 100).toFixed(1)}% success\n`;
      }
    }

    if (redisOps.length > 0) {
      report += '\n  Redis Operations:\n';
      for (const op of redisOps) {
        const indicator =
          op.averageDuration > PERFORMANCE_THRESHOLDS.REDIS_OPERATION_MS ? '⚠️' : '✓';
        report += `    ${indicator} ${op.operationName}: ${op.count} ops, avg ${Math.round(op.averageDuration)}ms, ${(op.successRate * 100).toFixed(1)}% success\n`;
      }
    }

    if (summary.alerts.length > 0) {
      report += '\nRecent Alerts:\n';
      for (const alert of summary.alerts.slice(-10)) {
        const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
        report += `  ${icon} [${alert.severity.toUpperCase()}] ${alert.message}\n`;
      }
    }

    report += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    return report;
  }

  /**
   * Private helper methods
   */
  private recordOperation(operationName: string, duration: number, success: boolean): void {
    let metrics = this.operationMetrics.get(operationName);

    if (!metrics) {
      metrics = {
        operationName,
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        thresholdViolations: 0,
        lastUpdated: new Date(),
      };
      this.operationMetrics.set(operationName, metrics);
    }

    // Update metrics
    metrics.count++;
    metrics.totalDuration += duration;
    metrics.averageDuration = metrics.totalDuration / metrics.count;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    metrics.successRate = metrics.successCount / metrics.count;
    metrics.lastUpdated = new Date();

    // Check threshold violations
    const threshold = this.getThresholdForOperation(operationName);
    if (threshold && duration > threshold) {
      metrics.thresholdViolations++;
    }
  }

  private getThresholdForOperation(operationName: string): number | null {
    if (operationName.startsWith('puzzle_generation')) {
      return PERFORMANCE_THRESHOLDS.PUZZLE_GENERATION_MS;
    } else if (operationName.startsWith('puzzle_retrieval')) {
      return PERFORMANCE_THRESHOLDS.PUZZLE_RETRIEVAL_MS;
    } else if (operationName.startsWith('redis_')) {
      return PERFORMANCE_THRESHOLDS.REDIS_OPERATION_MS;
    }
    return null;
  }

  private createAlert(
    severity: 'warning' | 'critical',
    metric: string,
    message: string,
    threshold: number,
    actualValue: number
  ): void {
    const alert: PerformanceAlert = {
      severity,
      metric,
      message,
      threshold,
      actualValue,
      timestamp: new Date(),
    };

    this.alerts.push(alert);

    // Trim alerts history
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }

    // Log alert
    const icon = severity === 'critical' ? '🔴' : '⚠️';
    console.warn(`${icon} [PERF ALERT] ${severity.toUpperCase()}: ${message}`);
  }

  private startPeriodicReporting(): void {
    // Report performance summary every 5 minutes
    setInterval(
      () => {
        const summary = this.getPerformanceSummary();

        // Only log if there's activity
        if (summary.operations.length > 0 || summary.cache.totalRequests > 0) {
          console.log(this.generatePerformanceReport());
        }
      },
      5 * 60 * 1000
    ); // 5 minutes
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitoringService.getInstance();
