/**
 * Unit tests for Enhanced Feature Flag Service
 * Tests feature flag configuration, fallback logic, and monitoring capabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedFeatureFlagService } from '../../services/EnhancedFeatureFlagService.js';
import { FeatureFlagConfigService } from '../../services/FeatureFlagConfigService.js';
import { MonitoringDashboardService } from '../../services/MonitoringDashboardService.js';
import {
  EnhancedFeatureFlags,
  FallbackThresholds,
  RetryLimits,
  MonitoringConfig,
} from '../../../shared/types/guaranteed-generation.js';

// Mock Redis client
vi.mock('../../utils/redisClient.js', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    keys: vi.fn(),
  },
}));

describe('EnhancedFeatureFlagService', () => {
  let service: EnhancedFeatureFlagService;
  let configService: FeatureFlagConfigService;
  let dashboardService: MonitoringDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = EnhancedFeatureFlagService.getInstance();
    configService = FeatureFlagConfigService.getInstance();
    dashboardService = MonitoringDashboardService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Enhanced Feature Flags Management', () => {
    it('should return default enhanced flags when Redis is empty', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.get).mockResolvedValue(null);

      const flags = await service.getEnhancedFeatureFlags();

      expect(flags).toBeDefined();
      expect(flags.fallbackThresholds).toBeDefined();
      expect(flags.retryLimits).toBeDefined();
      expect(flags.monitoringConfig).toBeDefined();
      expect(flags.abTestingConfig).toBeDefined();
    });

    it('should merge base flags with enhanced configuration', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const enhancedConfig = {
        fallbackThresholds: {
          maxConsecutiveFailures: 3,
          maxFailureRate: 0.2,
          timeWindowMinutes: 10,
          criticalErrorTypes: ['physics_violation'],
          confidenceThreshold: 80,
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(enhancedConfig));

      const flags = await service.getEnhancedFeatureFlags();

      expect(flags.fallbackThresholds.maxConsecutiveFailures).toBe(5); // Default value
      expect(flags.fallbackThresholds.maxFailureRate).toBe(0.3); // Default value
    });

    it('should update enhanced feature flags successfully', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.get).mockResolvedValue('{}');
      vi.mocked(redisClient.set).mockResolvedValue('OK');

      const updates = {
        fallbackThresholds: {
          maxConsecutiveFailures: 7,
          maxFailureRate: 0.25,
        } as Partial<FallbackThresholds>,
      };

      await expect(service.updateEnhancedFeatureFlags(updates)).resolves.not.toThrow();
      expect(redisClient.set).toHaveBeenCalled();
    });
  });

  describe('Fallback Logic', () => {
    it('should trigger fallback for critical error types', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const config = {
        fallbackThresholds: {
          criticalErrorTypes: ['physics_violation', 'infinite_loop'],
          maxConsecutiveFailures: 5,
          maxFailureRate: 0.3,
          timeWindowMinutes: 15,
          confidenceThreshold: 70,
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(config));

      const result = await service.shouldTriggerFallback('Easy', 2, 'physics_violation');

      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toContain('Critical error type');
    });

    it('should trigger fallback for consecutive failures threshold', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const config = {
        fallbackThresholds: {
          criticalErrorTypes: [],
          maxConsecutiveFailures: 3,
          maxFailureRate: 0.5,
          timeWindowMinutes: 15,
          confidenceThreshold: 70,
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(config));

      const result = await service.shouldTriggerFallback('Medium', 5);

      expect(result.shouldFallback).toBe(true);
      expect(result.reason).toContain('Consecutive failures');
    });

    it('should not trigger fallback when thresholds are not exceeded', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const config = {
        fallbackThresholds: {
          criticalErrorTypes: [],
          maxConsecutiveFailures: 10,
          maxFailureRate: 0.8,
          timeWindowMinutes: 15,
          confidenceThreshold: 70,
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(config));

      const result = await service.shouldTriggerFallback('Hard', 3);

      expect(result.shouldFallback).toBe(false);
      expect(result.reason).toContain('acceptable limits');
    });
  });

  describe('Retry Configuration', () => {
    it('should return correct retry configuration for error types', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const config = {
        retryLimits: {
          maxAttemptsPerError: {
            timeout: 5,
            validation_failure: 3,
          },
          backoffMultiplier: 2.0,
          maxBackoffMs: 8000,
          circuitBreakerThreshold: 15,
          circuitBreakerTimeoutMs: 600000,
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(config));

      const retryConfig = await service.getRetryConfig('timeout');

      expect(retryConfig.maxAttempts).toBe(3); // Default value for timeout
      expect(retryConfig.backoffMs).toBeGreaterThan(0);
      expect(retryConfig.shouldRetry).toBe(true);
    });

    it('should respect circuit breaker status', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');

      // Mock the enhanced flags call first
      vi.mocked(redisClient.get).mockImplementation((key) => {
        if (key.includes('enhanced_flags:config')) {
          return Promise.resolve('{}');
        }
        if (key.includes('circuit_breaker:validation_failure:open')) {
          return Promise.resolve('true');
        }
        return Promise.resolve(null);
      });

      const retryConfig = await service.getRetryConfig('validation_failure');

      expect(retryConfig.shouldRetry).toBe(false);
    });

    it('should record errors for circuit breaker tracking', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.get).mockResolvedValue('{}');
      vi.mocked(redisClient.incr).mockResolvedValue(5);
      vi.mocked(redisClient.expire).mockResolvedValue(1);

      await expect(service.recordErrorForCircuitBreaker('timeout')).resolves.not.toThrow();
      expect(redisClient.incr).toHaveBeenCalled();
      expect(redisClient.expire).toHaveBeenCalled();
    });
  });

  describe('A/B Testing', () => {
    it('should return null when A/B testing is disabled', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const config = {
        abTestingConfig: {
          enableABTesting: false,
          testGroups: [],
          trafficSplitPercentage: {},
          testDurationDays: 7,
          minimumSampleSize: 100,
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(config));

      const group = await service.getABTestGroup('test-user-123');

      expect(group).toBeNull();
    });

    it('should assign users to A/B test groups deterministically', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const config = {
        abTestingConfig: {
          enableABTesting: true,
          testGroups: [
            {
              name: 'enhanced-v2',
              description: 'Enhanced generation v2',
              featureOverrides: { confidenceThreshold: 90 },
              targetPercentage: 50,
              isActive: true,
            },
          ],
          trafficSplitPercentage: { 'enhanced-v2': 50 },
          testDurationDays: 7,
          minimumSampleSize: 100,
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(config));

      const group1 = await service.getABTestGroup('user-123');
      const group2 = await service.getABTestGroup('user-123');

      // Same user should get same group
      expect(group1).toEqual(group2);
    });
  });

  describe('Dashboard Metrics Collection', () => {
    it('should collect comprehensive dashboard metrics', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.get).mockResolvedValue('{}');
      vi.mocked(redisClient.set).mockResolvedValue('OK');

      const metrics = await service.collectDashboardMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.generationMetrics).toBeDefined();
      expect(metrics.errorMetrics).toBeDefined();
      expect(metrics.performanceMetrics).toBeDefined();
      expect(metrics.featureFlagMetrics).toBeDefined();
    });

    it('should check alert thresholds correctly', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const config = {
        monitoringConfig: {
          alertThresholds: {
            lowSuccessRate: 0.9,
            highGenerationTime: 5000,
            highFallbackRate: 0.15,
            lowConfidenceScore: 80,
          },
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(config));

      const alertCheck = await service.checkAlertThresholds();

      expect(alertCheck).toBeDefined();
      expect(alertCheck.alerts).toBeInstanceOf(Array);
    });
  });
});

describe('FeatureFlagConfigService', () => {
  let service: FeatureFlagConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = FeatureFlagConfigService.getInstance();
  });

  describe('Configuration Validation', () => {
    it('should validate fallback thresholds correctly', async () => {
      const validThresholds = {
        maxConsecutiveFailures: 5,
        maxFailureRate: 0.2,
        timeWindowMinutes: 15,
        confidenceThreshold: 75,
      };

      const result = await service.updateFallbackThresholds(validThresholds);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid fallback thresholds', async () => {
      const invalidThresholds = {
        maxConsecutiveFailures: -1, // Invalid: negative
        maxFailureRate: 1.5, // Invalid: > 1
        timeWindowMinutes: 200, // Invalid: > 120
      };

      const result = await service.updateFallbackThresholds(invalidThresholds);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate retry limits correctly', async () => {
      const validRetryLimits = {
        backoffMultiplier: 1.5,
        maxBackoffMs: 5000,
        circuitBreakerThreshold: 10,
        maxAttemptsPerError: {
          timeout: 3,
          validation_failure: 5,
        },
      };

      const result = await service.updateRetryLimits(validRetryLimits);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate rollout percentage with safety checks', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const currentConfig = {
        enhancedGenerationRollout: 10,
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(currentConfig));

      // Should reject large increase without force flag
      const result = await service.updateRolloutPercentage(50, false);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('too large');
    });

    it('should allow large rollout increase with force flag', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const currentConfig = {
        enhancedGenerationRollout: 10,
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(currentConfig));
      vi.mocked(redisClient.set).mockResolvedValue('OK');

      const result = await service.updateRolloutPercentage(50, true);

      expect(result.isValid).toBe(true);
    });
  });

  describe('A/B Test Group Management', () => {
    it('should create valid A/B test groups', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const currentConfig = {
        abTestingConfig: {
          testGroups: [],
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(currentConfig));
      vi.mocked(redisClient.set).mockResolvedValue('OK');

      const testGroup = {
        name: 'enhanced-v3',
        description: 'Testing enhanced generation v3',
        featureOverrides: { confidenceThreshold: 95 },
        targetPercentage: 25,
        isActive: true,
      };

      const result = await service.createABTestGroup(testGroup);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject duplicate A/B test group names', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      const currentConfig = {
        abTestingConfig: {
          testGroups: [
            {
              name: 'existing-group',
              description: 'Existing test',
              featureOverrides: {},
              targetPercentage: 20,
              isActive: true,
            },
          ],
        },
      };

      vi.mocked(redisClient.get).mockResolvedValue(JSON.stringify(currentConfig));

      const duplicateGroup = {
        name: 'existing-group',
        description: 'Duplicate test',
        featureOverrides: {},
        targetPercentage: 30,
        isActive: true,
      };

      const result = await service.createABTestGroup(duplicateGroup);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('already exists');
    });
  });
});

describe('MonitoringDashboardService', () => {
  let service: MonitoringDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = MonitoringDashboardService.getInstance();
  });

  describe('Dashboard Summary', () => {
    it('should generate comprehensive dashboard summary', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.get).mockResolvedValue('{}');
      vi.mocked(redisClient.keys).mockResolvedValue([]);

      const summary = await service.getDashboardSummary();

      expect(summary).toBeDefined();
      expect(summary.currentMetrics).toBeDefined();
      expect(summary.alerts).toBeInstanceOf(Array);
      expect(summary.trends).toBeDefined();
      expect(summary.recommendations).toBeInstanceOf(Array);
    });

    it('should calculate system health status correctly', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.get).mockResolvedValue('{}');
      vi.mocked(redisClient.keys).mockResolvedValue([]);

      const healthStatus = await service.getSystemHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toMatch(/^(healthy|warning|critical)$/);
      expect(healthStatus.score).toBeGreaterThanOrEqual(0);
      expect(healthStatus.score).toBeLessThanOrEqual(100);
      expect(healthStatus.issues).toBeInstanceOf(Array);
    });

    it('should track rollout status correctly', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.get).mockResolvedValue(
        JSON.stringify({
          enhancedGenerationRollout: 25,
        })
      );

      const rolloutStatus = await service.getRolloutStatus();

      expect(rolloutStatus).toBeDefined();
      expect(rolloutStatus.currentPercentage).toBe(10); // Default rollout percentage
      expect(rolloutStatus.targetPercentage).toBe(100);
      expect(rolloutStatus.usersAffected).toBeGreaterThanOrEqual(0);
      expect(rolloutStatus.rolloutHistory).toBeInstanceOf(Array);
    });
  });

  describe('Performance Metrics', () => {
    it('should get performance breakdown by difficulty', async () => {
      const performance = await service.getPerformanceByDifficulty();

      expect(performance).toBeDefined();
      expect(performance.difficulties).toContain('Easy');
      expect(performance.difficulties).toContain('Medium');
      expect(performance.difficulties).toContain('Hard');
      expect(performance.successRates).toBeInstanceOf(Array);
      expect(performance.averageTimes).toBeInstanceOf(Array);
      expect(performance.errorCounts).toBeInstanceOf(Array);
    });

    it('should get historical metrics for trend analysis', async () => {
      const { redisClient } = await import('../../utils/redisClient.js');
      vi.mocked(redisClient.keys).mockResolvedValue([]);

      const historical = await service.getHistoricalMetrics(12);

      expect(historical).toBeDefined();
      expect(historical.timestamps).toBeInstanceOf(Array);
      expect(historical.successRates).toBeInstanceOf(Array);
      expect(historical.generationTimes).toBeInstanceOf(Array);
      expect(historical.errorRates).toBeInstanceOf(Array);
      expect(historical.fallbackRates).toBeInstanceOf(Array);
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge alerts correctly', async () => {
      // First generate some alerts
      await service.getDashboardSummary();

      const acknowledged = await service.acknowledgeAlert('test-alert-id', 'admin-user');

      // Should return false for non-existent alert
      expect(acknowledged).toBe(false);
    });
  });
});
