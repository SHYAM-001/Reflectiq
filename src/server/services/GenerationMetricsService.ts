/**
 * Generation Metrics Service for ReflectIQ
 * Tracks performance metrics and analytics for puzzle generation
 * Requirements: 1.4, 1.5, 5.1
 */

import {
  PuzzleGenerationMetadata,
  GenerationMetrics,
  DifficultyMetrics,
} from '../../shared/types/guaranteed-generation.js';
import { Difficulty } from '../../shared/types/puzzle.js';

/**
 * Service for tracking and aggregating puzzle generation metrics
 */
export class GenerationMetricsService {
  private static instance: GenerationMetricsService;
  private metricsHistory: PuzzleGenerationMetadata[] = [];
  private readonly maxHistorySize = 10000; // Keep last 10k generations

  public static getInstance(): GenerationMetricsService {
    if (!GenerationMetricsService.instance) {
      GenerationMetricsService.instance = new GenerationMetricsService();
    }
    return GenerationMetricsService.instance;
  }

  /**
   * Record generation metadata for analytics
   */
  public recordGeneration(metadata: PuzzleGenerationMetadata): void {
    this.metricsHistory.push(metadata);

    // Maintain history size limit
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }

    if (typeof console !== 'undefined') {
      console.log(
        `📊 Recorded generation metrics: ${metadata.algorithm} ${metadata.puzzleId} (${metadata.generationTime}ms, confidence: ${metadata.confidenceScore})`
      );
    }
  }

  /**
   * Get aggregated generation metrics
   */
  public getAggregatedMetrics(): GenerationMetrics {
    const now = new Date();
    const recentMetrics = this.getRecentMetrics(24 * 60 * 60 * 1000); // Last 24 hours

    if (recentMetrics.length === 0) {
      return this.createEmptyMetrics(now);
    }

    const totalGenerated = recentMetrics.length;
    const successful = recentMetrics.filter((m) => m.validationPassed).length;
    const successRate = successful / totalGenerated;

    const totalTime = recentMetrics.reduce((sum, m) => sum + m.generationTime, 0);
    const averageGenerationTime = totalTime / totalGenerated;

    const totalConfidence = recentMetrics.reduce((sum, m) => sum + m.confidenceScore, 0);
    const averageConfidenceScore = totalConfidence / totalGenerated;

    const fallbackCount = recentMetrics.filter((m) => m.fallbackUsed).length;
    const fallbackUsageRate = fallbackCount / totalGenerated;

    // Calculate difficulty breakdown
    const difficultyBreakdown: Record<Difficulty, DifficultyMetrics> = {
      Easy: this.calculateDifficultyMetrics(recentMetrics, 'Easy'),
      Medium: this.calculateDifficultyMetrics(recentMetrics, 'Medium'),
      Hard: this.calculateDifficultyMetrics(recentMetrics, 'Hard'),
    };

    return {
      totalGenerated,
      successRate,
      averageGenerationTime,
      averageConfidenceScore,
      difficultyBreakdown,
      fallbackUsageRate,
      lastUpdated: now,
    };
  }

  /**
   * Get metrics for a specific difficulty level
   */
  public getDifficultyMetrics(difficulty: Difficulty): DifficultyMetrics {
    const recentMetrics = this.getRecentMetrics(24 * 60 * 60 * 1000);
    return this.calculateDifficultyMetrics(recentMetrics, difficulty);
  }

  /**
   * Get performance trends over time
   */
  public getPerformanceTrends(hoursBack: number = 24): {
    timestamps: Date[];
    successRates: number[];
    averageTimes: number[];
    confidenceScores: number[];
  } {
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
    const relevantMetrics = this.metricsHistory.filter((m) => m.createdAt.getTime() >= cutoffTime);

    // Group by hour
    const hourlyData = new Map<number, PuzzleGenerationMetadata[]>();

    for (const metric of relevantMetrics) {
      const hour = Math.floor(metric.createdAt.getTime() / (60 * 60 * 1000));
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(metric);
    }

    const timestamps: Date[] = [];
    const successRates: number[] = [];
    const averageTimes: number[] = [];
    const confidenceScores: number[] = [];

    for (const [hour, metrics] of hourlyData.entries()) {
      timestamps.push(new Date(hour * 60 * 60 * 1000));

      const successful = metrics.filter((m) => m.validationPassed).length;
      successRates.push(successful / metrics.length);

      const totalTime = metrics.reduce((sum, m) => sum + m.generationTime, 0);
      averageTimes.push(totalTime / metrics.length);

      const totalConfidence = metrics.reduce((sum, m) => sum + m.confidenceScore, 0);
      confidenceScores.push(totalConfidence / metrics.length);
    }

    return {
      timestamps,
      successRates,
      averageTimes,
      confidenceScores,
    };
  }

  /**
   * Get recent generation failures for debugging
   */
  public getRecentFailures(limit: number = 10): PuzzleGenerationMetadata[] {
    return this.metricsHistory
      .filter((m) => !m.validationPassed || m.fallbackUsed)
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Get top performing puzzles by confidence score
   */
  public getTopPerformingPuzzles(limit: number = 10): PuzzleGenerationMetadata[] {
    return [...this.metricsHistory]
      .filter((m) => m.validationPassed && !m.fallbackUsed)
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, limit);
  }

  /**
   * Clear old metrics to manage memory
   */
  public clearOldMetrics(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - olderThanMs;
    const initialCount = this.metricsHistory.length;

    this.metricsHistory = this.metricsHistory.filter((m) => m.createdAt.getTime() >= cutoffTime);

    const removedCount = initialCount - this.metricsHistory.length;

    if (typeof console !== 'undefined' && removedCount > 0) {
      console.log(`🧹 Cleared ${removedCount} old generation metrics`);
    }

    return removedCount;
  }

  /**
   * Export metrics for external analysis
   */
  public exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.exportToCsv();
    }

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalRecords: this.metricsHistory.length,
        aggregatedMetrics: this.getAggregatedMetrics(),
        detailedMetrics: this.metricsHistory,
      },
      null,
      2
    );
  }

  // Private helper methods

  private getRecentMetrics(timeWindowMs: number): PuzzleGenerationMetadata[] {
    const cutoffTime = Date.now() - timeWindowMs;
    return this.metricsHistory.filter((m) => m.createdAt.getTime() >= cutoffTime);
  }

  private calculateDifficultyMetrics(
    metrics: PuzzleGenerationMetadata[],
    difficulty: Difficulty
  ): DifficultyMetrics {
    const difficultyMetrics = metrics.filter((m) =>
      m.puzzleId.toLowerCase().includes(difficulty.toLowerCase())
    );

    if (difficultyMetrics.length === 0) {
      return {
        generated: 0,
        successful: 0,
        averageTime: 0,
        averageConfidence: 0,
        averageAttempts: 0,
      };
    }

    const successful = difficultyMetrics.filter((m) => m.validationPassed).length;
    const totalTime = difficultyMetrics.reduce((sum, m) => sum + m.generationTime, 0);
    const totalConfidence = difficultyMetrics.reduce((sum, m) => sum + m.confidenceScore, 0);
    const totalAttempts = difficultyMetrics.reduce((sum, m) => sum + m.attempts, 0);

    return {
      generated: difficultyMetrics.length,
      successful,
      averageTime: totalTime / difficultyMetrics.length,
      averageConfidence: totalConfidence / difficultyMetrics.length,
      averageAttempts: totalAttempts / difficultyMetrics.length,
    };
  }

  private createEmptyMetrics(timestamp: Date): GenerationMetrics {
    const emptyDifficultyMetrics: DifficultyMetrics = {
      generated: 0,
      successful: 0,
      averageTime: 0,
      averageConfidence: 0,
      averageAttempts: 0,
    };

    return {
      totalGenerated: 0,
      successRate: 0,
      averageGenerationTime: 0,
      averageConfidenceScore: 0,
      difficultyBreakdown: {
        Easy: emptyDifficultyMetrics,
        Medium: emptyDifficultyMetrics,
        Hard: emptyDifficultyMetrics,
      },
      fallbackUsageRate: 0,
      lastUpdated: timestamp,
    };
  }

  private exportToCsv(): string {
    const headers = [
      'puzzleId',
      'algorithm',
      'attempts',
      'generationTime',
      'confidenceScore',
      'validationPassed',
      'spacingDistance',
      'pathComplexity',
      'materialDensityAchieved',
      'fallbackUsed',
      'createdAt',
    ];

    const rows = this.metricsHistory.map((m) => [
      m.puzzleId,
      m.algorithm,
      m.attempts.toString(),
      m.generationTime.toString(),
      m.confidenceScore.toString(),
      m.validationPassed.toString(),
      m.spacingDistance.toString(),
      m.pathComplexity.toString(),
      m.materialDensityAchieved.toString(),
      m.fallbackUsed.toString(),
      m.createdAt.toISOString(),
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Record generation failure for error tracking
   */
  public async recordGenerationFailure(
    difficulty: Difficulty,
    errorType: string,
    timeElapsed: number
  ): Promise<void> {
    try {
      const failureMetadata: PuzzleGenerationMetadata = {
        puzzleId: `failure_${Date.now()}_${difficulty}`,
        algorithm: 'guaranteed',
        attempts: 1,
        generationTime: timeElapsed,
        confidenceScore: 0,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      this.recordGeneration(failureMetadata);

      console.warn(
        `🚨 Generation failure recorded: ${errorType} for ${difficulty} (${timeElapsed}ms)`
      );
    } catch (error) {
      console.error('Failed to record generation failure:', error);
    }
  }

  /**
   * Record validation failure for error tracking
   */
  public async recordValidationFailure(
    difficulty: Difficulty,
    issueTypes: string[]
  ): Promise<void> {
    try {
      const failureMetadata: PuzzleGenerationMetadata = {
        puzzleId: `validation_failure_${Date.now()}_${difficulty}`,
        algorithm: 'guaranteed',
        attempts: 1,
        generationTime: 0,
        confidenceScore: 0,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      this.recordGeneration(failureMetadata);

      console.warn(`🚨 Validation failure recorded: ${issueTypes.join(', ')} for ${difficulty}`);
    } catch (error) {
      console.error('Failed to record validation failure:', error);
    }
  }

  /**
   * Record fallback usage for monitoring
   */
  public async recordFallbackUsage(difficulty: Difficulty, reason: string): Promise<void> {
    try {
      const fallbackMetadata: PuzzleGenerationMetadata = {
        puzzleId: `fallback_${Date.now()}_${difficulty}`,
        algorithm: 'legacy',
        attempts: 1,
        generationTime: 0,
        confidenceScore: 75, // Default for legacy
        validationPassed: true,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: true,
      };

      this.recordGeneration(fallbackMetadata);

      console.log(`🔄 Fallback usage recorded: ${reason} for ${difficulty}`);
    } catch (error) {
      console.error('Failed to record fallback usage:', error);
    }
  }

  /**
   * Record generation error for monitoring
   */
  public async recordGenerationError(errorType: string, difficulty: Difficulty): Promise<void> {
    try {
      const errorMetadata: PuzzleGenerationMetadata = {
        puzzleId: `error_${Date.now()}_${difficulty}_${errorType}`,
        algorithm: 'guaranteed',
        attempts: 1,
        generationTime: 0,
        confidenceScore: 0,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      this.recordGeneration(errorMetadata);

      console.error(`❌ Generation error recorded: ${errorType} for ${difficulty}`);
    } catch (error) {
      console.error('Failed to record generation error:', error);
    }
  }
}
