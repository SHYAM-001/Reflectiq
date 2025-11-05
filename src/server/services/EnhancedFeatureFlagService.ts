/**
 * Enhanced Feature Flag Service for ReflectIQ
 * Extends basic feature flags with advanced configuration, monitoring, and A/B testing
 * Requirements: 1.4, 1.5, 5.1
 */

import { redisClient } from '../utils/redisClient.js';
import {
  EnhancedFeatureFlags,
  FallbackThresholds,
  RetryLimits,
  MonitoringConfig,
  ABTestingConfig,
  ABTestGroup,
  DashboardMetrics,
  ErrorMetrics,
  PerformanceMetrics,
  FeatureFlagMetrics,
  GenerationFeatureFlags,
} from '../../shared/types/guaranteed-generation.js';
import { Difficulty } from '../../shared/types/puzzle.js';
import { FeatureFlagService } from './FeatureFlagService.js';
import { GenerationMetricsService } from './GenerationMetricsService.js';

export class EnhancedFeatureFlagService {
  private static instance: EnhancedFeatureFlagService;
  private baseService: FeatureFlagService;
  private metricsService: GenerationMetricsService;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds cache for enhanced flags
  private readonly REDIS_KEY_PREFIX = 'reflectiq:enhanced_flags';

  private constructor() {
    this.baseService = FeatureFlagService.getInstance();
    this.metricsService = GenerationMetricsService.getInstance();
  }

  public static getInstance(): EnhancedFeatureFlagService {
    if (!EnhancedFeatureFlagService.instance) {
      EnhancedFeatureFlagService.instance = new EnhancedFeatureFlagService();
    }
    return EnhancedFeatureFlagService.instance;
  }

  /**
   * Get enhanced feature flags with fallback configuration
   */
  public async getEnhancedFeatureFlags(): Promise<EnhancedFeatureFlags> {
    const cacheKey = 'enhanced_feature_flags';
    const now = Date.now();

    // Check cache first
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey)! > now) {
      return this.cache.get(cacheKey);
    }

    try {
      // Get base flags first
      const baseFlags = await this.baseService.getFeatureFlags();

      // Try to get enhanced configuration from Redis
      const enhancedData = await redisClient.get(`${this.REDIS_KEY_PREFIX}:config`);

      let enhancedFlags: EnhancedFeatureFlags;
      if (enhancedData) {
        const enhancedConfig = JSON.parse(enhancedData);
        const defaultEnhanced = this.createDefaultEnhancedFlags(baseFlags);
        enhancedFlags = this.mergeFlags(defaultEnhanced, enhancedConfig);
      } else {
        // Create default enhanced configuration
        enhancedFlags = this.createDefaultEnhancedFlags(baseFlags);
        // Store defaults in Redis
        await this.storeEnhancedFlags(enhancedFlags);
      }

      // Update cache
      this.cache.set(cacheKey, enhancedFlags);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      return enhancedFlags;
    } catch (error) {
      console.warn('Failed to get enhanced feature flags from Redis, using defaults:', error);
      const baseFlags = await this.baseService.getFeatureFlags();
      return this.createDefaultEnhancedFlags(baseFlags);
    }
  }

  /**
   * Update enhanced feature flags configuration
   */
  public async updateEnhancedFeatureFlags(updates: Partial<EnhancedFeatureFlags>): Promise<void> {
    try {
      const currentFlags = await this.getEnhancedFeatureFlags();
      const updatedFlags = this.mergeFlags(currentFlags, updates);

      await this.storeEnhancedFlags(updatedFlags);

      // Clear cache to force refresh
      this.cache.clear();
      this.cacheExpiry.clear();

      console.log('Enhanced feature flags updated:', {
        fallbackThresholds: updatedFlags.fallbackThresholds,
        retryLimits: updatedFlags.retryLimits,
        monitoringConfig: updatedFlags.monitoringConfig,
      });
    } catch (error) {
      console.error('Failed to update enhanced feature flags:', error);
      throw error;
    }
  }

  /**
   * Check if fallback should be triggered based on current metrics
   */
  public async shouldTriggerFallback(
    difficulty: Difficulty,
    consecutiveFailures: number,
    errorType?: string
  ): Promise<{ shouldFallback: boolean; reason: string }> {
    try {
      const flags = await this.getEnhancedFeatureFlags();
      const thresholds = flags.fallbackThresholds;

      // Check for critical error types that trigger immediate fallback
      if (errorType && thresholds.criticalErrorTypes.includes(errorType)) {
        return {
          shouldFallback: true,
          reason: `Critical error type: ${errorType}`,
        };
      }

      // Check consecutive failures threshold
      if (consecutiveFailures >= thresholds.maxConsecutiveFailures) {
        return {
          shouldFallback: true,
          reason: `Consecutive failures (${consecutiveFailures}) exceeded threshold (${thresholds.maxConsecutiveFailures})`,
        };
      }

      // Check failure rate over time window
      const failureRate = await this.calculateFailureRate(difficulty, thresholds.timeWindowMinutes);
      if (failureRate >= thresholds.maxFailureRate) {
        return {
          shouldFallback: true,
          reason: `Failure rate (${(failureRate * 100).toFixed(1)}%) exceeded threshold (${(thresholds.maxFailureRate * 100).toFixed(1)}%)`,
        };
      }

      return { shouldFallback: false, reason: 'All thresholds within acceptable limits' };
    } catch (error) {
      console.error('Error checking fallback conditions:', error);
      // Default to fallback on error to be safe
      return { shouldFallback: true, reason: 'Error checking fallback conditions' };
    }
  }

  /**
   * Get retry configuration for specific error type
   */
  public async getRetryConfig(errorType: string): Promise<{
    maxAttempts: number;
    backoffMs: number;
    shouldRetry: boolean;
  }> {
    try {
      const flags = await this.getEnhancedFeatureFlags();
      const retryLimits = flags.retryLimits;

      const maxAttempts = retryLimits?.maxAttemptsPerError?.[errorType] || 3;
      const backoffMs = Math.min(
        1000 * Math.pow(retryLimits?.backoffMultiplier || 1.5, 1),
        retryLimits?.maxBackoffMs || 10000
      );

      // Check circuit breaker status
      const circuitBreakerOpen = await this.isCircuitBreakerOpen(errorType);

      return {
        maxAttempts,
        backoffMs,
        shouldRetry: !circuitBreakerOpen,
      };
    } catch (error) {
      console.error('Error getting retry configuration:', error);
      return {
        maxAttempts: 3,
        backoffMs: 1000,
        shouldRetry: true,
      };
    }
  }

  /**
   * Record error for circuit breaker tracking
   */
  public async recordErrorForCircuitBreaker(errorType: string): Promise<void> {
    try {
      const key = `${this.REDIS_KEY_PREFIX}:circuit_breaker:${errorType}`;
      const flags = await this.getEnhancedFeatureFlags();

      // Increment error count
      const errorCount = await redisClient.incr(key);
      await redisClient.expire(key, 300); // 5 minute window

      // Check if circuit breaker should open
      if (errorCount >= (flags.retryLimits?.circuitBreakerThreshold || 10)) {
        const breakerKey = `${this.REDIS_KEY_PREFIX}:circuit_breaker:${errorType}:open`;
        await redisClient.set(breakerKey, 'true', {
          ttl: Math.floor((flags.retryLimits?.circuitBreakerTimeoutMs || 300000) / 1000),
        });

        console.warn(`Circuit breaker opened for ${errorType} after ${errorCount} failures`);
      }
    } catch (error) {
      console.error('Failed to record error for circuit breaker:', error);
    }
  }

  /**
   * Get A/B test group for user/session
   */
  public async getABTestGroup(identifier: string): Promise<ABTestGroup | null> {
    try {
      const flags = await this.getEnhancedFeatureFlags();

      if (!flags.abTestingConfig?.enableABTesting) {
        return null;
      }

      const activeGroups =
        flags.abTestingConfig?.testGroups?.filter((group) => group.isActive) || [];

      if (activeGroups.length === 0) {
        return null;
      }

      // Use deterministic assignment based on identifier
      const hash = this.simpleHash(identifier);
      const percentage = hash % 100;

      let cumulativePercentage = 0;
      for (const group of activeGroups) {
        cumulativePercentage += group.targetPercentage;
        if (percentage < cumulativePercentage) {
          return group;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting A/B test group:', error);
      return null;
    }
  }

  /**
   * Collect dashboard metrics for monitoring
   */
  public async collectDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const timestamp = new Date();
      const generationMetrics = this.metricsService.getAggregatedMetrics();

      // Calculate error metrics
      const errorMetrics = await this.calculateErrorMetrics();

      // Calculate performance metrics
      const performanceMetrics = await this.calculatePerformanceMetrics();

      // Calculate feature flag metrics
      const featureFlagMetrics = await this.calculateFeatureFlagMetrics();

      const dashboardMetrics: DashboardMetrics = {
        timestamp,
        generationMetrics,
        errorMetrics,
        performanceMetrics,
        featureFlagMetrics,
      };

      // Store metrics for historical tracking
      await this.storeDashboardMetrics(dashboardMetrics);

      return dashboardMetrics;
    } catch (error) {
      console.error('Error collecting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Check if monitoring alerts should be triggered
   */
  public async checkAlertThresholds(): Promise<{
    alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }>;
  }> {
    try {
      const flags = await this.getEnhancedFeatureFlags();
      const thresholds = flags.monitoringConfig?.alertThresholds;
      const metrics = this.metricsService.getAggregatedMetrics();

      const alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> =
        [];

      // Check success rate
      if (thresholds && metrics.successRate < thresholds.lowSuccessRate) {
        alerts.push({
          type: 'low_success_rate',
          message: `Success rate (${(metrics.successRate * 100).toFixed(1)}%) below threshold (${(thresholds.lowSuccessRate * 100).toFixed(1)}%)`,
          severity: 'high',
        });
      }

      // Check generation time
      if (thresholds && metrics.averageGenerationTime > thresholds.highGenerationTime) {
        alerts.push({
          type: 'high_generation_time',
          message: `Average generation time (${metrics.averageGenerationTime}ms) above threshold (${thresholds.highGenerationTime}ms)`,
          severity: 'medium',
        });
      }

      // Check fallback rate
      if (thresholds && metrics.fallbackUsageRate > thresholds.highFallbackRate) {
        alerts.push({
          type: 'high_fallback_rate',
          message: `Fallback usage rate (${(metrics.fallbackUsageRate * 100).toFixed(1)}%) above threshold (${(thresholds.highFallbackRate * 100).toFixed(1)}%)`,
          severity: 'medium',
        });
      }

      // Check confidence score
      if (thresholds && metrics.averageConfidenceScore < thresholds.lowConfidenceScore) {
        alerts.push({
          type: 'low_confidence_score',
          message: `Average confidence score (${metrics.averageConfidenceScore.toFixed(1)}) below threshold (${thresholds.lowConfidenceScore})`,
          severity: 'low',
        });
      }

      return { alerts };
    } catch (error) {
      console.error('Error checking alert thresholds:', error);
      return { alerts: [] };
    }
  }

  // Private helper methods

  private createDefaultEnhancedFlags(baseFlags: GenerationFeatureFlags): EnhancedFeatureFlags {
    return {
      ...baseFlags,
      fallbackThresholds: {
        maxConsecutiveFailures: 5,
        maxFailureRate: 0.3, // 30%
        timeWindowMinutes: 15,
        criticalErrorTypes: ['physics_violation', 'infinite_loop'],
        confidenceThreshold: 70,
      },
      retryLimits: {
        maxAttemptsPerError: {
          timeout: 3,
          validation_failure: 5,
          spacing_failure: 3,
          material_placement_failure: 4,
          physics_violation: 2,
        },
        backoffMultiplier: 1.5,
        maxBackoffMs: 10000,
        circuitBreakerThreshold: 10,
        circuitBreakerTimeoutMs: 300000, // 5 minutes
      },
      monitoringConfig: {
        enableDetailedLogging: true,
        logLevel: 'info',
        metricsCollectionInterval: 5, // 5 minutes
        alertThresholds: {
          lowSuccessRate: 0.85, // 85%
          highGenerationTime: 8000, // 8 seconds
          highFallbackRate: 0.2, // 20%
          lowConfidenceScore: 75,
        },
        dashboardDataRetention: 7, // 7 days
      },
      abTestingConfig: {
        enableABTesting: false,
        testGroups: [],
        trafficSplitPercentage: {},
        testDurationDays: 7,
        minimumSampleSize: 100,
      },
    };
  }

  private mergeFlags(
    current: EnhancedFeatureFlags,
    updates: Partial<EnhancedFeatureFlags>
  ): EnhancedFeatureFlags {
    return {
      ...current,
      ...updates,
      fallbackThresholds: {
        ...current.fallbackThresholds,
        ...(updates.fallbackThresholds || {}),
      },
      retryLimits: {
        ...current.retryLimits,
        ...(updates.retryLimits || {}),
        maxAttemptsPerError: {
          ...(current.retryLimits?.maxAttemptsPerError || {}),
          ...(updates.retryLimits?.maxAttemptsPerError || {}),
        },
      },
      monitoringConfig: {
        ...current.monitoringConfig,
        ...(updates.monitoringConfig || {}),
        alertThresholds: {
          ...(current.monitoringConfig?.alertThresholds || {}),
          ...(updates.monitoringConfig?.alertThresholds || {}),
        },
      },
      abTestingConfig: {
        ...current.abTestingConfig,
        ...(updates.abTestingConfig || {}),
      },
    };
  }

  private async storeEnhancedFlags(flags: EnhancedFeatureFlags): Promise<void> {
    const enhancedConfig = {
      fallbackThresholds: flags.fallbackThresholds,
      retryLimits: flags.retryLimits,
      monitoringConfig: flags.monitoringConfig,
      abTestingConfig: flags.abTestingConfig,
    };

    await redisClient.set(`${this.REDIS_KEY_PREFIX}:config`, JSON.stringify(enhancedConfig), {
      ttl: 3600,
    });
  }

  private async calculateFailureRate(
    difficulty: Difficulty,
    timeWindowMinutes: number
  ): Promise<number> {
    try {
      const difficultyMetrics = this.metricsService.getDifficultyMetrics(difficulty);

      if (difficultyMetrics.generated === 0) {
        return 0;
      }

      const failureRate = 1 - difficultyMetrics.successful / difficultyMetrics.generated;
      return failureRate;
    } catch (error) {
      console.error('Error calculating failure rate:', error);
      return 0;
    }
  }

  private async isCircuitBreakerOpen(errorType: string): Promise<boolean> {
    try {
      const breakerKey = `${this.REDIS_KEY_PREFIX}:circuit_breaker:${errorType}:open`;
      const isOpen = await redisClient.get(breakerKey);
      return isOpen === 'true';
    } catch (error) {
      console.error('Error checking circuit breaker status:', error);
      return false;
    }
  }

  private async calculateErrorMetrics(): Promise<ErrorMetrics> {
    try {
      const recentFailures = this.metricsService.getRecentFailures(100);
      const totalErrors = recentFailures.length;

      const errorsByType: Record<string, number> = {};
      let criticalErrors = 0;

      for (const failure of recentFailures) {
        const errorType = failure.fallbackUsed ? 'fallback_used' : 'generation_failure';
        errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

        if (!failure.validationPassed) {
          criticalErrors++;
        }
      }

      const totalGenerated = this.metricsService.getAggregatedMetrics().totalGenerated;
      const errorRate = totalGenerated > 0 ? totalErrors / totalGenerated : 0;

      // Calculate recovery success rate (simplified)
      const recoverySuccessRate = 0.8; // This would need more sophisticated tracking

      return {
        totalErrors,
        errorsByType,
        errorRate,
        criticalErrors,
        recoverySuccessRate,
      };
    } catch (error) {
      console.error('Error calculating error metrics:', error);
      return {
        totalErrors: 0,
        errorsByType: {},
        errorRate: 0,
        criticalErrors: 0,
        recoverySuccessRate: 0,
      };
    }
  }

  private async calculatePerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const metrics = this.metricsService.getAggregatedMetrics();
      const trends = this.metricsService.getPerformanceTrends(1); // Last hour

      const p95GenerationTime =
        trends.averageTimes.length > 0
          ? Math.max(...trends.averageTimes)
          : metrics.averageGenerationTime;

      const p99GenerationTime = p95GenerationTime * 1.2; // Approximation

      // Get system metrics (simplified - in real implementation would use actual system monitoring)
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
      const cpuUsage = 0; // Would need actual CPU monitoring

      return {
        averageGenerationTime: metrics.averageGenerationTime,
        p95GenerationTime,
        p99GenerationTime,
        memoryUsage,
        cpuUsage,
      };
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      return {
        averageGenerationTime: 0,
        p95GenerationTime: 0,
        p99GenerationTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      };
    }
  }

  private async calculateFeatureFlagMetrics(): Promise<FeatureFlagMetrics> {
    try {
      const flags = await this.getEnhancedFeatureFlags();
      const metrics = this.metricsService.getAggregatedMetrics();

      const enhancedGenerationUsage =
        metrics.totalGenerated - metrics.fallbackUsageRate * metrics.totalGenerated;
      const fallbackUsage = metrics.fallbackUsageRate * metrics.totalGenerated;

      const abTestParticipation: Record<string, number> = {};
      if (flags.abTestingConfig?.enableABTesting) {
        for (const group of flags.abTestingConfig?.testGroups || []) {
          abTestParticipation[group.name] = 0; // Would need actual tracking
        }
      }

      return {
        enhancedGenerationUsage,
        fallbackUsage,
        abTestParticipation,
        rolloutPercentage: flags.enhancedGenerationRollout,
      };
    } catch (error) {
      console.error('Error calculating feature flag metrics:', error);
      return {
        enhancedGenerationUsage: 0,
        fallbackUsage: 0,
        abTestParticipation: {},
        rolloutPercentage: 0,
      };
    }
  }

  private async storeDashboardMetrics(metrics: DashboardMetrics): Promise<void> {
    try {
      const key = `${this.REDIS_KEY_PREFIX}:dashboard:${metrics.timestamp.getTime()}`;
      await redisClient.set(key, JSON.stringify(metrics), { ttl: 7 * 24 * 3600 }); // 7 days
    } catch (error) {
      console.error('Error storing dashboard metrics:', error);
    }
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
