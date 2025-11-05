/**
 * Feature Flag Configuration Service for ReflectIQ
 * Manages configuration updates and validation for enhanced feature flags
 * Requirements: 1.4, 1.5, 5.1
 */

import {
  EnhancedFeatureFlags,
  FallbackThresholds,
  RetryLimits,
  MonitoringConfig,
  ABTestingConfig,
  ABTestGroup,
} from '../../shared/types/guaranteed-generation.js';
import { EnhancedFeatureFlagService } from './EnhancedFeatureFlagService.js';

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigUpdateRequest {
  fallbackThresholds?: Partial<FallbackThresholds>;
  retryLimits?: Partial<RetryLimits>;
  monitoringConfig?: Partial<MonitoringConfig>;
  abTestingConfig?: Partial<ABTestingConfig>;
  rolloutPercentage?: number;
}

export class FeatureFlagConfigService {
  private static instance: FeatureFlagConfigService;
  private enhancedService: EnhancedFeatureFlagService;

  private constructor() {
    this.enhancedService = EnhancedFeatureFlagService.getInstance();
  }

  public static getInstance(): FeatureFlagConfigService {
    if (!FeatureFlagConfigService.instance) {
      FeatureFlagConfigService.instance = new FeatureFlagConfigService();
    }
    return FeatureFlagConfigService.instance;
  }

  /**
   * Update fallback thresholds with validation
   */
  public async updateFallbackThresholds(
    thresholds: Partial<FallbackThresholds>
  ): Promise<ConfigValidationResult> {
    const validation = this.validateFallbackThresholds(thresholds);

    if (!validation.isValid) {
      return validation;
    }

    try {
      await this.enhancedService.updateEnhancedFeatureFlags({
        fallbackThresholds: thresholds,
      });

      console.log('Fallback thresholds updated successfully:', thresholds);
      return { isValid: true, errors: [], warnings: validation.warnings };
    } catch (error) {
      console.error('Failed to update fallback thresholds:', error);
      return {
        isValid: false,
        errors: [`Failed to update configuration: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Update retry limits with validation
   */
  public async updateRetryLimits(
    retryLimits: Partial<RetryLimits>
  ): Promise<ConfigValidationResult> {
    const validation = this.validateRetryLimits(retryLimits);

    if (!validation.isValid) {
      return validation;
    }

    try {
      await this.enhancedService.updateEnhancedFeatureFlags({
        retryLimits,
      });

      console.log('Retry limits updated successfully:', retryLimits);
      return { isValid: true, errors: [], warnings: validation.warnings };
    } catch (error) {
      console.error('Failed to update retry limits:', error);
      return {
        isValid: false,
        errors: [`Failed to update configuration: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Update monitoring configuration with validation
   */
  public async updateMonitoringConfig(
    monitoringConfig: Partial<MonitoringConfig>
  ): Promise<ConfigValidationResult> {
    const validation = this.validateMonitoringConfig(monitoringConfig);

    if (!validation.isValid) {
      return validation;
    }

    try {
      await this.enhancedService.updateEnhancedFeatureFlags({
        monitoringConfig,
      });

      console.log('Monitoring configuration updated successfully:', monitoringConfig);
      return { isValid: true, errors: [], warnings: validation.warnings };
    } catch (error) {
      console.error('Failed to update monitoring configuration:', error);
      return {
        isValid: false,
        errors: [`Failed to update configuration: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Update A/B testing configuration with validation
   */
  public async updateABTestingConfig(
    abTestingConfig: Partial<ABTestingConfig>
  ): Promise<ConfigValidationResult> {
    const validation = this.validateABTestingConfig(abTestingConfig);

    if (!validation.isValid) {
      return validation;
    }

    try {
      await this.enhancedService.updateEnhancedFeatureFlags({
        abTestingConfig,
      });

      console.log('A/B testing configuration updated successfully:', abTestingConfig);
      return { isValid: true, errors: [], warnings: validation.warnings };
    } catch (error) {
      console.error('Failed to update A/B testing configuration:', error);
      return {
        isValid: false,
        errors: [`Failed to update configuration: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Update rollout percentage with gradual rollout safety checks
   */
  public async updateRolloutPercentage(
    newPercentage: number,
    force: boolean = false
  ): Promise<ConfigValidationResult> {
    const validation = this.validateRolloutPercentage(newPercentage);

    if (!validation.isValid) {
      return validation;
    }

    try {
      const currentFlags = await this.enhancedService.getEnhancedFeatureFlags();
      const currentPercentage = currentFlags.enhancedGenerationRollout;

      // Safety check for large increases
      if (!force && newPercentage > currentPercentage + 25) {
        return {
          isValid: false,
          errors: [
            `Rollout increase too large: ${currentPercentage}% -> ${newPercentage}%. Maximum increase is 25% without force flag.`,
          ],
          warnings: [],
        };
      }

      await this.enhancedService.updateEnhancedFeatureFlags({
        enhancedGenerationRollout: newPercentage,
      });

      console.log(`Rollout percentage updated: ${currentPercentage}% -> ${newPercentage}%`);
      return { isValid: true, errors: [], warnings: validation.warnings };
    } catch (error) {
      console.error('Failed to update rollout percentage:', error);
      return {
        isValid: false,
        errors: [`Failed to update rollout percentage: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Create A/B test group with validation
   */
  public async createABTestGroup(group: ABTestGroup): Promise<ConfigValidationResult> {
    const validation = this.validateABTestGroup(group);

    if (!validation.isValid) {
      return validation;
    }

    try {
      const currentFlags = await this.enhancedService.getEnhancedFeatureFlags();
      const existingGroups = currentFlags.abTestingConfig.testGroups;

      // Check for duplicate names
      if (existingGroups.some((g) => g.name === group.name)) {
        return {
          isValid: false,
          errors: [`A/B test group with name '${group.name}' already exists`],
          warnings: [],
        };
      }

      // Check total percentage allocation
      const totalPercentage =
        existingGroups.filter((g) => g.isActive).reduce((sum, g) => sum + g.targetPercentage, 0) +
        group.targetPercentage;

      if (totalPercentage > 100) {
        return {
          isValid: false,
          errors: [`Total A/B test allocation would exceed 100% (current: ${totalPercentage}%)`],
          warnings: [],
        };
      }

      const updatedGroups = [...existingGroups, group];
      await this.enhancedService.updateEnhancedFeatureFlags({
        abTestingConfig: {
          ...currentFlags.abTestingConfig,
          testGroups: updatedGroups,
        },
      });

      console.log(`A/B test group '${group.name}' created successfully`);
      return { isValid: true, errors: [], warnings: validation.warnings };
    } catch (error) {
      console.error('Failed to create A/B test group:', error);
      return {
        isValid: false,
        errors: [`Failed to create A/B test group: ${error}`],
        warnings: [],
      };
    }
  }

  /**
   * Get current configuration summary for dashboard
   */
  public async getConfigurationSummary(): Promise<{
    fallbackThresholds: FallbackThresholds;
    retryLimits: RetryLimits;
    monitoringConfig: MonitoringConfig;
    abTestingConfig: ABTestingConfig;
    rolloutPercentage: number;
    lastUpdated: Date;
  }> {
    try {
      const flags = await this.enhancedService.getEnhancedFeatureFlags();

      return {
        fallbackThresholds: flags.fallbackThresholds,
        retryLimits: flags.retryLimits,
        monitoringConfig: flags.monitoringConfig,
        abTestingConfig: flags.abTestingConfig,
        rolloutPercentage: flags.enhancedGenerationRollout,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Failed to get configuration summary:', error);
      throw error;
    }
  }

  // Validation methods

  private validateFallbackThresholds(
    thresholds: Partial<FallbackThresholds>
  ): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (thresholds.maxConsecutiveFailures !== undefined) {
      if (thresholds.maxConsecutiveFailures < 1 || thresholds.maxConsecutiveFailures > 20) {
        errors.push('maxConsecutiveFailures must be between 1 and 20');
      }
      if (thresholds.maxConsecutiveFailures < 3) {
        warnings.push('maxConsecutiveFailures below 3 may cause frequent fallbacks');
      }
    }

    if (thresholds.maxFailureRate !== undefined) {
      if (thresholds.maxFailureRate < 0 || thresholds.maxFailureRate > 1) {
        errors.push('maxFailureRate must be between 0 and 1');
      }
      if (thresholds.maxFailureRate < 0.1) {
        warnings.push('maxFailureRate below 10% may cause frequent fallbacks');
      }
    }

    if (thresholds.timeWindowMinutes !== undefined) {
      if (thresholds.timeWindowMinutes < 1 || thresholds.timeWindowMinutes > 120) {
        errors.push('timeWindowMinutes must be between 1 and 120');
      }
    }

    if (thresholds.confidenceThreshold !== undefined) {
      if (thresholds.confidenceThreshold < 0 || thresholds.confidenceThreshold > 100) {
        errors.push('confidenceThreshold must be between 0 and 100');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateRetryLimits(retryLimits: Partial<RetryLimits>): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (retryLimits.backoffMultiplier !== undefined) {
      if (retryLimits.backoffMultiplier < 1 || retryLimits.backoffMultiplier > 5) {
        errors.push('backoffMultiplier must be between 1 and 5');
      }
    }

    if (retryLimits.maxBackoffMs !== undefined) {
      if (retryLimits.maxBackoffMs < 1000 || retryLimits.maxBackoffMs > 60000) {
        errors.push('maxBackoffMs must be between 1000 and 60000');
      }
    }

    if (retryLimits.circuitBreakerThreshold !== undefined) {
      if (retryLimits.circuitBreakerThreshold < 5 || retryLimits.circuitBreakerThreshold > 50) {
        errors.push('circuitBreakerThreshold must be between 5 and 50');
      }
    }

    if (retryLimits.circuitBreakerTimeoutMs !== undefined) {
      if (
        retryLimits.circuitBreakerTimeoutMs < 60000 ||
        retryLimits.circuitBreakerTimeoutMs > 1800000
      ) {
        errors.push('circuitBreakerTimeoutMs must be between 60000 and 1800000 (1-30 minutes)');
      }
    }

    if (retryLimits.maxAttemptsPerError !== undefined) {
      for (const [errorType, maxAttempts] of Object.entries(retryLimits.maxAttemptsPerError)) {
        if (maxAttempts < 1 || maxAttempts > 10) {
          errors.push(`maxAttemptsPerError.${errorType} must be between 1 and 10`);
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateMonitoringConfig(config: Partial<MonitoringConfig>): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.logLevel !== undefined) {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      if (!validLevels.includes(config.logLevel)) {
        errors.push(`logLevel must be one of: ${validLevels.join(', ')}`);
      }
    }

    if (config.metricsCollectionInterval !== undefined) {
      if (config.metricsCollectionInterval < 1 || config.metricsCollectionInterval > 60) {
        errors.push('metricsCollectionInterval must be between 1 and 60 minutes');
      }
    }

    if (config.dashboardDataRetention !== undefined) {
      if (config.dashboardDataRetention < 1 || config.dashboardDataRetention > 30) {
        errors.push('dashboardDataRetention must be between 1 and 30 days');
      }
    }

    if (config.alertThresholds !== undefined) {
      const thresholds = config.alertThresholds;

      if (
        thresholds.lowSuccessRate !== undefined &&
        (thresholds.lowSuccessRate < 0 || thresholds.lowSuccessRate > 1)
      ) {
        errors.push('alertThresholds.lowSuccessRate must be between 0 and 1');
      }

      if (
        thresholds.highGenerationTime !== undefined &&
        (thresholds.highGenerationTime < 1000 || thresholds.highGenerationTime > 30000)
      ) {
        errors.push('alertThresholds.highGenerationTime must be between 1000 and 30000 ms');
      }

      if (
        thresholds.highFallbackRate !== undefined &&
        (thresholds.highFallbackRate < 0 || thresholds.highFallbackRate > 1)
      ) {
        errors.push('alertThresholds.highFallbackRate must be between 0 and 1');
      }

      if (
        thresholds.lowConfidenceScore !== undefined &&
        (thresholds.lowConfidenceScore < 0 || thresholds.lowConfidenceScore > 100)
      ) {
        errors.push('alertThresholds.lowConfidenceScore must be between 0 and 100');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateABTestingConfig(config: Partial<ABTestingConfig>): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.testDurationDays !== undefined) {
      if (config.testDurationDays < 1 || config.testDurationDays > 30) {
        errors.push('testDurationDays must be between 1 and 30');
      }
    }

    if (config.minimumSampleSize !== undefined) {
      if (config.minimumSampleSize < 10 || config.minimumSampleSize > 10000) {
        errors.push('minimumSampleSize must be between 10 and 10000');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateABTestGroup(group: ABTestGroup): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!group.name || group.name.trim().length === 0) {
      errors.push('A/B test group name is required');
    }

    if (group.name && group.name.length > 50) {
      errors.push('A/B test group name must be 50 characters or less');
    }

    if (!group.description || group.description.trim().length === 0) {
      errors.push('A/B test group description is required');
    }

    if (group.targetPercentage < 0 || group.targetPercentage > 100) {
      errors.push('targetPercentage must be between 0 and 100');
    }

    if (group.targetPercentage < 5) {
      warnings.push('targetPercentage below 5% may not provide statistically significant results');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateRolloutPercentage(percentage: number): ConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (percentage < 0 || percentage > 100) {
      errors.push('Rollout percentage must be between 0 and 100');
    }

    if (percentage > 90) {
      warnings.push('Rollout percentage above 90% affects most users - ensure thorough testing');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }
}
