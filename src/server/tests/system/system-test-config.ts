/**
 * System Test Configuration
 * Provides shared configuration and utilities for comprehensive system tests
 */

import { vi } from 'vitest';

// Test configuration constants
export const SYSTEM_TEST_CONFIG = {
  // Timeouts
  DEFAULT_TIMEOUT: 30000,
  LOAD_TEST_TIMEOUT: 120000,
  LIFECYCLE_TEST_TIMEOUT: 90000,

  // Test data
  TEST_DATE_PREFIX: '2025-system-test',
  TEST_USER_PREFIX: 'system-test-user',
  TEST_SESSION_PREFIX: 'system-test-session',

  // Performance thresholds
  MAX_GENERATION_TIME: 8000, // 8 seconds
  MIN_CONFIDENCE_SCORE: 70,
  MIN_SUCCESS_RATE: 80, // 80%

  // Load testing parameters
  CONCURRENT_REQUESTS: 10,
  SUSTAINED_REQUESTS: 15,
  RAPID_REQUESTS: 8,

  // Memory thresholds
  MAX_MEMORY_INCREASE_PERCENT: 100, // 100% increase allowed
  MAX_MEMORY_INCREASE_MB: 50, // 50MB absolute increase
} as const;

// Mock service factory for consistent test setup
export class SystemTestMockFactory {
  static createMockRedis() {
    return {
      get: vi.fn(),
      set: vi.fn(),
      setEx: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      hGet: vi.fn(),
      hSet: vi.fn(),
      hGetAll: vi.fn(),
      hDel: vi.fn(),
      hExists: vi.fn(),
      hKeys: vi.fn(),
      hLen: vi.fn(),
      hIncrBy: vi.fn(),
      zAdd: vi.fn(),
      zRange: vi.fn(),
      zRank: vi.fn(),
      zRem: vi.fn(),
      zCard: vi.fn(),
      zScore: vi.fn(),
      zIncrBy: vi.fn(),
      zScan: vi.fn(),
      zRemRangeByRank: vi.fn(),
      zRemRangeByScore: vi.fn(),
      multi: vi.fn(),
      exec: vi.fn(),
      watch: vi.fn(),
      discard: vi.fn(),
    };
  }

  static createMockDevvitContext() {
    return {
      postId: 'system-test-post-123',
      userId: 'system-test-user-123',
      subredditName: 'system-test-subreddit',
    };
  }

  static createMockRedditAPI() {
    return {
      getCurrentUsername: vi.fn(() => Promise.resolve('system-test-user')),
      getSubredditInfoByName: vi.fn(),
      submitPost: vi.fn(),
      getPostById: vi.fn(),
    };
  }
}

// Test data generators
export class SystemTestDataGenerator {
  static generateTestDate(suffix: string = ''): string {
    const timestamp = Date.now();
    return `${SYSTEM_TEST_CONFIG.TEST_DATE_PREFIX}-${timestamp}${suffix ? '-' + suffix : ''}`;
  }

  static generateTestUserId(suffix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${SYSTEM_TEST_CONFIG.TEST_USER_PREFIX}-${timestamp}-${random}${suffix ? '-' + suffix : ''}`;
  }

  static generateTestSessionId(suffix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${SYSTEM_TEST_CONFIG.TEST_SESSION_PREFIX}-${timestamp}-${random}${suffix ? '-' + suffix : ''}`;
  }

  static generateMultipleTestUsers(
    count: number,
    prefix: string = ''
  ): Array<{
    userId: string;
    sessionId: string;
  }> {
    return Array.from({ length: count }, (_, i) => ({
      userId: this.generateTestUserId(`${prefix}${i}`),
      sessionId: this.generateTestSessionId(`${prefix}${i}`),
    }));
  }
}

// Performance monitoring utilities
export class SystemTestPerformanceMonitor {
  private startTime: number = 0;
  private memorySnapshots: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
  }> = [];

  startMonitoring(): void {
    this.startTime = Date.now();
    this.takeMemorySnapshot();
  }

  takeMemorySnapshot(): void {
    if (process.memoryUsage) {
      const memory = process.memoryUsage();
      this.memorySnapshots.push({
        timestamp: Date.now(),
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      });
    }
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  getMemoryIncrease(): {
    absoluteIncrease: number;
    percentIncrease: number;
    snapshots: typeof this.memorySnapshots;
  } {
    if (this.memorySnapshots.length < 2) {
      return {
        absoluteIncrease: 0,
        percentIncrease: 0,
        snapshots: this.memorySnapshots,
      };
    }

    const initial = this.memorySnapshots[0];
    const final = this.memorySnapshots[this.memorySnapshots.length - 1];
    const absoluteIncrease = final.heapUsed - initial.heapUsed;
    const percentIncrease = (absoluteIncrease / initial.heapUsed) * 100;

    return {
      absoluteIncrease,
      percentIncrease,
      snapshots: this.memorySnapshots,
    };
  }

  reset(): void {
    this.startTime = 0;
    this.memorySnapshots = [];
  }
}

// Test result aggregation utilities
export class SystemTestResultAggregator {
  private results: Array<{
    testName: string;
    success: boolean;
    duration: number;
    metadata?: any;
  }> = [];

  addResult(testName: string, success: boolean, duration: number, metadata?: any): void {
    this.results.push({
      testName,
      success,
      duration,
      metadata,
    });
  }

  getSuccessRate(): number {
    if (this.results.length === 0) return 0;
    const successful = this.results.filter((r) => r.success).length;
    return (successful / this.results.length) * 100;
  }

  getAverageDuration(): number {
    if (this.results.length === 0) return 0;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    return totalDuration / this.results.length;
  }

  getFailedTests(): Array<{ testName: string; metadata?: any }> {
    return this.results
      .filter((r) => !r.success)
      .map((r) => ({ testName: r.testName, metadata: r.metadata }));
  }

  getSummary(): {
    totalTests: number;
    successful: number;
    failed: number;
    successRate: number;
    averageDuration: number;
    totalDuration: number;
  } {
    const successful = this.results.filter((r) => r.success).length;
    const failed = this.results.length - successful;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalTests: this.results.length,
      successful,
      failed,
      successRate: this.getSuccessRate(),
      averageDuration: this.getAverageDuration(),
      totalDuration,
    };
  }

  reset(): void {
    this.results = [];
  }
}

// Assertion helpers for system tests
export class SystemTestAssertions {
  static assertPuzzleQuality(puzzle: any, difficulty: string): void {
    expect(puzzle).toBeDefined();
    expect(puzzle.id).toBeDefined();
    expect(puzzle.difficulty).toBe(difficulty);
    expect(puzzle.materials).toBeDefined();
    expect(puzzle.materials.length).toBeGreaterThan(0);
    expect(puzzle.entry).toBeDefined();
    expect(puzzle.solution).toBeDefined();
    expect(puzzle.solutionPath).toBeDefined();
    expect(puzzle.solutionPath.segments).toBeDefined();
    expect(puzzle.hints).toBeDefined();
    expect(puzzle.hints.length).toBe(4);
  }

  static assertValidationResult(validation: any): void {
    expect(validation).toBeDefined();
    expect(validation.isValid).toBe(true);
    expect(validation.hasUniqueSolution).toBe(true);
    expect(validation.confidenceScore).toBeGreaterThan(SYSTEM_TEST_CONFIG.MIN_CONFIDENCE_SCORE);
    expect(validation.alternativeCount).toBe(0);
  }

  static assertPerformanceMetrics(
    duration: number,
    maxDuration: number = SYSTEM_TEST_CONFIG.MAX_GENERATION_TIME
  ): void {
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(maxDuration);
  }

  static assertMemoryUsage(memoryIncrease: {
    absoluteIncrease: number;
    percentIncrease: number;
  }): void {
    const { absoluteIncrease, percentIncrease } = memoryIncrease;

    if (absoluteIncrease > 0) {
      expect(percentIncrease).toBeLessThan(SYSTEM_TEST_CONFIG.MAX_MEMORY_INCREASE_PERCENT);
      expect(absoluteIncrease).toBeLessThan(
        SYSTEM_TEST_CONFIG.MAX_MEMORY_INCREASE_MB * 1024 * 1024
      );
    }
  }

  static assertSuccessRate(
    successRate: number,
    minRate: number = SYSTEM_TEST_CONFIG.MIN_SUCCESS_RATE
  ): void {
    expect(successRate).toBeGreaterThanOrEqual(minRate);
  }
}

// Test environment setup utilities
export class SystemTestEnvironment {
  static async setupTestEnvironment(): Promise<void> {
    // Set test-specific environment variables
    process.env.NODE_ENV = 'test';
    process.env.SYSTEM_TEST_MODE = 'true';

    // Configure test timeouts
    vi.setConfig({
      testTimeout: SYSTEM_TEST_CONFIG.DEFAULT_TIMEOUT,
      hookTimeout: 10000,
    });
  }

  static async cleanupTestEnvironment(): Promise<void> {
    // Clean up test-specific environment
    delete process.env.SYSTEM_TEST_MODE;

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  static isSystemTestMode(): boolean {
    return process.env.SYSTEM_TEST_MODE === 'true';
  }
}

// Export all utilities
export {
  SYSTEM_TEST_CONFIG as default,
  SystemTestMockFactory,
  SystemTestDataGenerator,
  SystemTestPerformanceMonitor,
  SystemTestResultAggregator,
  SystemTestAssertions,
  SystemTestEnvironment,
};
