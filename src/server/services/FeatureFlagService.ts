/**
 * Feature Flag Service for ReflectIQ
 * Manages feature flags for gradual rollout of enhanced puzzle generation
 * Requirements: 1.4, 1.5, 5.1
 */

import { redisClient } from '../utils/redisClient.js';
import { GenerationFeatureFlags } from '../../shared/types/guaranteed-generation.js';

export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minute cache

  private constructor() {}

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Get feature flags with caching
   */
  public async getFeatureFlags(): Promise<GenerationFeatureFlags> {
    const cacheKey = 'feature_flags';
    const now = Date.now();

    // Check cache first
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey)! > now) {
      return this.cache.get(cacheKey);
    }

    try {
      // Try to get from Redis
      const flagsData = await redisClient.get('reflectiq:feature_flags');

      let flags: GenerationFeatureFlags;
      if (flagsData) {
        flags = JSON.parse(flagsData);
      } else {
        // Default flags for initial rollout
        flags = this.getDefaultFlags();
        // Store defaults in Redis
        await redisClient.set('reflectiq:feature_flags', JSON.stringify(flags), { ttl: 3600 });
      }

      // Update cache
      this.cache.set(cacheKey, flags);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      return flags;
    } catch (error) {
      console.warn('Failed to get feature flags from Redis, using defaults:', error);
      return this.getDefaultFlags();
    }
  }

  /**
   * Update feature flags
   */
  public async updateFeatureFlags(flags: Partial<GenerationFeatureFlags>): Promise<void> {
    try {
      const currentFlags = await this.getFeatureFlags();
      const updatedFlags = { ...currentFlags, ...flags };

      await redisClient.set('reflectiq:feature_flags', JSON.stringify(updatedFlags), { ttl: 3600 });

      // Clear cache to force refresh
      this.cache.clear();
      this.cacheExpiry.clear();

      console.log('Feature flags updated:', updatedFlags);
    } catch (error) {
      console.error('Failed to update feature flags:', error);
      throw error;
    }
  }

  /**
   * Check if enhanced generation is enabled
   */
  public async isEnhancedGenerationEnabled(): Promise<boolean> {
    const flags = await this.getFeatureFlags();
    return flags.enableGuaranteedGeneration;
  }

  /**
   * Check if fallback to legacy is enabled
   */
  public async shouldFallbackToLegacy(): Promise<boolean> {
    const flags = await this.getFeatureFlags();
    return flags.fallbackToLegacy;
  }

  /**
   * Get rollout percentage for enhanced generation
   */
  public async getEnhancedGenerationRollout(): Promise<number> {
    const flags = await this.getFeatureFlags();
    return flags.enhancedGenerationRollout || 0;
  }

  /**
   * Check if enhanced generation should be used based on rollout percentage
   */
  public async shouldUseEnhancedGeneration(identifier?: string): Promise<boolean> {
    const flags = await this.getFeatureFlags();

    if (!flags.enableGuaranteedGeneration) {
      return false;
    }

    const rolloutPercentage = flags.enhancedGenerationRollout || 0;

    if (rolloutPercentage >= 100) {
      return true;
    }

    if (rolloutPercentage <= 0) {
      return false;
    }

    // Use deterministic rollout based on identifier (date for daily puzzles)
    const hash = this.simpleHash(identifier || new Date().toISOString().split('T')[0]);
    return hash % 100 < rolloutPercentage;
  }

  /**
   * Get default feature flags for initial deployment
   */
  private getDefaultFlags(): GenerationFeatureFlags {
    return {
      enableGuaranteedGeneration: true,
      fallbackToLegacy: true,
      enableAdvancedValidation: true,
      enablePerformanceLogging: true,
      maxGenerationAttempts: 10,
      enhancedGenerationRollout: 100, // Use enhanced generation for all puzzles
      confidenceThreshold: 85,
      timeoutMs: 5000,
    };
  }

  /**
   * Simple hash function for deterministic rollout
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get performance metrics for monitoring
   */
  public async getPerformanceMetrics(): Promise<{
    enhancedGenerationUsage: number;
    fallbackUsage: number;
    averageGenerationTime: number;
    successRate: number;
  }> {
    try {
      const metricsData = await redisClient.get('reflectiq:metrics:generation');
      if (metricsData) {
        return JSON.parse(metricsData);
      }
    } catch (error) {
      console.warn('Failed to get performance metrics:', error);
    }

    return {
      enhancedGenerationUsage: 0,
      fallbackUsage: 0,
      averageGenerationTime: 0,
      successRate: 0,
    };
  }

  /**
   * Record generation metrics for monitoring
   */
  public async recordGenerationMetrics(
    algorithm: 'enhanced' | 'legacy',
    generationTime: number,
    success: boolean
  ): Promise<void> {
    try {
      const metrics = await this.getPerformanceMetrics();

      if (algorithm === 'enhanced') {
        metrics.enhancedGenerationUsage++;
      } else {
        metrics.fallbackUsage++;
      }

      // Update running averages
      const totalGenerations = metrics.enhancedGenerationUsage + metrics.fallbackUsage;
      metrics.averageGenerationTime =
        (metrics.averageGenerationTime * (totalGenerations - 1) + generationTime) /
        totalGenerations;

      // Update success rate
      const currentSuccesses = metrics.successRate * (totalGenerations - 1);
      metrics.successRate = (currentSuccesses + (success ? 1 : 0)) / totalGenerations;

      await redisClient.set('reflectiq:metrics:generation', JSON.stringify(metrics), {
        ttl: 86400,
      });
    } catch (error) {
      console.warn('Failed to record generation metrics:', error);
    }
  }
}
