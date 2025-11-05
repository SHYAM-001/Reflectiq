/**
 * Monitoring Dashboard Service for ReflectIQ
 * Collects and aggregates data for monitoring dashboard
 * Requirements: 1.4, 1.5, 5.1
 */

import {
  DashboardMetrics,
  ErrorMetrics,
  PerformanceMetrics,
  FeatureFlagMetrics,
  GenerationMetrics,
} from '../../shared/types/guaranteed-generation.js';
import { Difficulty } from '../../shared/types/puzzle.js';
import { EnhancedFeatureFlagService } from './EnhancedFeatureFlagService.js';
import { GenerationMetricsService } from './GenerationMetricsService.js';
import { redisClient } from '../utils/redisClient.js';

export interface DashboardAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface DashboardSummary {
  currentMetrics: DashboardMetrics;
  alerts: DashboardAlert[];
  trends: {
    successRateTrend: 'up' | 'down' | 'stable';
    performanceTrend: 'up' | 'down' | 'stable';
    errorRateTrend: 'up' | 'down' | 'stable';
  };
  recommendations: string[];
}

export class MonitoringDashboardService {
  private static instance: MonitoringDashboardService;
  private enhancedFlagService: EnhancedFeatureFlagService;
  private metricsService: GenerationMetricsService;
  private readonly REDIS_KEY_PREFIX = 'reflectiq:dashboard';
  private alertHistory: DashboardAlert[] = [];

  private constructor() {
    this.enhancedFlagService = EnhancedFeatureFlagService.getInstance();
    this.metricsService = GenerationMetricsService.getInstance();
  }

  public static getInstance(): MonitoringDashboardService {
    if (!MonitoringDashboardService.instance) {
      MonitoringDashboardService.instance = new MonitoringDashboardService();
    }
    return MonitoringDashboardService.instance;
  }

  /**
   * Get complete dashboard summary with metrics, alerts, and recommendations
   */
  public async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      // Collect current metrics
      const currentMetrics = await this.enhancedFlagService.collectDashboardMetrics();

      // Check for alerts
      const alertCheck = await this.enhancedFlagService.checkAlertThresholds();
      const alerts = await this.processAlerts(alertCheck.alerts);

      // Calculate trends
      const trends = await this.calculateTrends();

      // Generate recommendations
      const recommendations = await this.generateRecommendations(currentMetrics, alerts);

      return {
        currentMetrics,
        alerts,
        trends,
        recommendations,
      };
    } catch (error) {
      console.error('Error getting dashboard summary:', error);
      throw error;
    }
  }

  /**
   * Get historical metrics for trend analysis
   */
  public async getHistoricalMetrics(hoursBack: number = 24): Promise<{
    timestamps: Date[];
    successRates: number[];
    generationTimes: number[];
    errorRates: number[];
    fallbackRates: number[];
  }> {
    try {
      const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;
      const keys = await redisClient.keys(`${this.REDIS_KEY_PREFIX}:*`);

      const historicalData: DashboardMetrics[] = [];

      for (const key of keys) {
        const timestamp = parseInt(key.split(':').pop() || '0');
        if (timestamp >= cutoffTime) {
          try {
            const data = await redisClient.get(key);
            if (data) {
              historicalData.push(JSON.parse(data));
            }
          } catch (parseError) {
            console.warn(`Failed to parse historical data for key ${key}:`, parseError);
          }
        }
      }

      // Sort by timestamp
      historicalData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const timestamps = historicalData.map((d) => new Date(d.timestamp));
      const successRates = historicalData.map((d) => d.generationMetrics.successRate);
      const generationTimes = historicalData.map((d) => d.generationMetrics.averageGenerationTime);
      const errorRates = historicalData.map((d) => d.errorMetrics.errorRate);
      const fallbackRates = historicalData.map((d) => d.generationMetrics.fallbackUsageRate);

      return {
        timestamps,
        successRates,
        generationTimes,
        errorRates,
        fallbackRates,
      };
    } catch (error) {
      console.error('Error getting historical metrics:', error);
      return {
        timestamps: [],
        successRates: [],
        generationTimes: [],
        errorRates: [],
        fallbackRates: [],
      };
    }
  }

  /**
   * Get performance breakdown by difficulty
   */
  public async getPerformanceByDifficulty(): Promise<{
    difficulties: Difficulty[];
    successRates: number[];
    averageTimes: number[];
    errorCounts: number[];
  }> {
    try {
      const metrics = this.metricsService.getAggregatedMetrics();
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      const successRates = difficulties.map((d) => {
        const diffMetrics = metrics.difficultyBreakdown[d];
        return diffMetrics.generated > 0 ? diffMetrics.successful / diffMetrics.generated : 0;
      });

      const averageTimes = difficulties.map((d) => metrics.difficultyBreakdown[d].averageTime);

      const errorCounts = difficulties.map(
        (d) => metrics.difficultyBreakdown[d].generated - metrics.difficultyBreakdown[d].successful
      );

      return {
        difficulties,
        successRates,
        averageTimes,
        errorCounts,
      };
    } catch (error) {
      console.error('Error getting performance by difficulty:', error);
      return {
        difficulties: [],
        successRates: [],
        averageTimes: [],
        errorCounts: [],
      };
    }
  }

  /**
   * Get current system health status
   */
  public async getSystemHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number; // 0-100
    issues: Array<{ type: string; severity: string; description: string }>;
  }> {
    try {
      const summary = await this.getDashboardSummary();
      const metrics = summary.currentMetrics;

      let score = 100;
      const issues: Array<{ type: string; severity: string; description: string }> = [];

      // Check success rate (30% weight)
      const successRate = metrics.generationMetrics.successRate;
      if (successRate < 0.8) {
        const penalty = (0.8 - successRate) * 30;
        score -= penalty;
        issues.push({
          type: 'success_rate',
          severity: successRate < 0.7 ? 'critical' : 'warning',
          description: `Success rate is ${(successRate * 100).toFixed(1)}% (target: 80%+)`,
        });
      }

      // Check generation time (25% weight)
      const avgTime = metrics.generationMetrics.averageGenerationTime;
      if (avgTime > 5000) {
        const penalty = Math.min(25, ((avgTime - 5000) / 1000) * 5);
        score -= penalty;
        issues.push({
          type: 'generation_time',
          severity: avgTime > 8000 ? 'critical' : 'warning',
          description: `Average generation time is ${avgTime}ms (target: <5000ms)`,
        });
      }

      // Check error rate (25% weight)
      const errorRate = metrics.errorMetrics.errorRate;
      if (errorRate > 0.1) {
        const penalty = Math.min(25, (errorRate - 0.1) * 250);
        score -= penalty;
        issues.push({
          type: 'error_rate',
          severity: errorRate > 0.2 ? 'critical' : 'warning',
          description: `Error rate is ${(errorRate * 100).toFixed(1)}% (target: <10%)`,
        });
      }

      // Check fallback usage (20% weight)
      const fallbackRate = metrics.generationMetrics.fallbackUsageRate;
      if (fallbackRate > 0.15) {
        const penalty = Math.min(20, (fallbackRate - 0.15) * 100);
        score -= penalty;
        issues.push({
          type: 'fallback_rate',
          severity: fallbackRate > 0.3 ? 'critical' : 'warning',
          description: `Fallback usage is ${(fallbackRate * 100).toFixed(1)}% (target: <15%)`,
        });
      }

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical';
      if (score >= 90) {
        status = 'healthy';
      } else if (score >= 70) {
        status = 'warning';
      } else {
        status = 'critical';
      }

      return { status, score: Math.max(0, score), issues };
    } catch (error) {
      console.error('Error getting system health status:', error);
      return {
        status: 'critical',
        score: 0,
        issues: [
          {
            type: 'system_error',
            severity: 'critical',
            description: 'Failed to assess system health',
          },
        ],
      };
    }
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    try {
      const alert = this.alertHistory.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        console.log(`Alert ${alertId} acknowledged by ${userId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return false;
    }
  }

  /**
   * Get feature flag rollout status
   */
  public async getRolloutStatus(): Promise<{
    currentPercentage: number;
    targetPercentage: number;
    usersAffected: number;
    rolloutHistory: Array<{ timestamp: Date; percentage: number; reason: string }>;
  }> {
    try {
      const flags = await this.enhancedFlagService.getEnhancedFeatureFlags();
      const currentPercentage = flags.enhancedGenerationRollout;

      // In a real implementation, this would track actual rollout history
      const rolloutHistory = [
        {
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          percentage: 10,
          reason: 'Initial rollout',
        },
        {
          timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          percentage: 25,
          reason: 'Increased after successful monitoring',
        },
        {
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          percentage: currentPercentage,
          reason: 'Current stable rollout',
        },
      ];

      // Estimate users affected (simplified calculation)
      const dailyActiveUsers = 1000; // This would come from actual user metrics
      const usersAffected = Math.floor(dailyActiveUsers * (currentPercentage / 100));

      return {
        currentPercentage,
        targetPercentage: 100, // Ultimate target
        usersAffected,
        rolloutHistory,
      };
    } catch (error) {
      console.error('Error getting rollout status:', error);
      return {
        currentPercentage: 0,
        targetPercentage: 100,
        usersAffected: 0,
        rolloutHistory: [],
      };
    }
  }

  // Private helper methods

  private async processAlerts(
    newAlerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }>
  ): Promise<DashboardAlert[]> {
    const processedAlerts: DashboardAlert[] = [];

    for (const alert of newAlerts) {
      const alertId = `${alert.type}_${Date.now()}`;
      const dashboardAlert: DashboardAlert = {
        id: alertId,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: new Date(),
        acknowledged: false,
      };

      processedAlerts.push(dashboardAlert);
      this.alertHistory.push(dashboardAlert);
    }

    // Keep only recent alerts (last 24 hours)
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    this.alertHistory = this.alertHistory.filter((a) => a.timestamp.getTime() >= cutoffTime);

    return this.alertHistory.filter((a) => !a.acknowledged).slice(-10); // Return last 10 unacknowledged alerts
  }

  private async calculateTrends(): Promise<{
    successRateTrend: 'up' | 'down' | 'stable';
    performanceTrend: 'up' | 'down' | 'stable';
    errorRateTrend: 'up' | 'down' | 'stable';
  }> {
    try {
      const historical = await this.getHistoricalMetrics(6); // Last 6 hours

      if (historical.timestamps.length < 2) {
        return {
          successRateTrend: 'stable',
          performanceTrend: 'stable',
          errorRateTrend: 'stable',
        };
      }

      const recentData = historical.successRates.slice(-3); // Last 3 data points
      const olderData = historical.successRates.slice(0, 3); // First 3 data points

      const recentAvg = recentData.reduce((sum, val) => sum + val, 0) / recentData.length;
      const olderAvg = olderData.reduce((sum, val) => sum + val, 0) / olderData.length;

      const successRateTrend = this.determineTrend(recentAvg, olderAvg, 0.05);

      // Similar calculations for performance and error rates
      const recentPerf = historical.generationTimes.slice(-3);
      const olderPerf = historical.generationTimes.slice(0, 3);
      const recentPerfAvg = recentPerf.reduce((sum, val) => sum + val, 0) / recentPerf.length;
      const olderPerfAvg = olderPerf.reduce((sum, val) => sum + val, 0) / olderPerf.length;
      const performanceTrend = this.determineTrend(olderPerfAvg, recentPerfAvg, 500); // Lower is better for performance

      const recentErrors = historical.errorRates.slice(-3);
      const olderErrors = historical.errorRates.slice(0, 3);
      const recentErrorAvg = recentErrors.reduce((sum, val) => sum + val, 0) / recentErrors.length;
      const olderErrorAvg = olderErrors.reduce((sum, val) => sum + val, 0) / olderErrors.length;
      const errorRateTrend = this.determineTrend(olderErrorAvg, recentErrorAvg, 0.02); // Lower is better for errors

      return {
        successRateTrend,
        performanceTrend,
        errorRateTrend,
      };
    } catch (error) {
      console.error('Error calculating trends:', error);
      return {
        successRateTrend: 'stable',
        performanceTrend: 'stable',
        errorRateTrend: 'stable',
      };
    }
  }

  private determineTrend(
    recent: number,
    older: number,
    threshold: number
  ): 'up' | 'down' | 'stable' {
    const difference = recent - older;
    if (Math.abs(difference) < threshold) {
      return 'stable';
    }
    return difference > 0 ? 'up' : 'down';
  }

  private async generateRecommendations(
    metrics: DashboardMetrics,
    alerts: DashboardAlert[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Success rate recommendations
    if (metrics.generationMetrics.successRate < 0.9) {
      recommendations.push('Consider adjusting fallback thresholds to improve success rate');
    }

    // Performance recommendations
    if (metrics.generationMetrics.averageGenerationTime > 5000) {
      recommendations.push('Review timeout configurations and consider performance optimizations');
    }

    // Error rate recommendations
    if (metrics.errorMetrics.errorRate > 0.1) {
      recommendations.push('Investigate common error patterns and adjust retry limits');
    }

    // Fallback recommendations
    if (metrics.generationMetrics.fallbackUsageRate > 0.2) {
      recommendations.push('High fallback usage detected - review enhanced generation constraints');
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical alerts immediately to prevent service degradation');
    }

    // Rollout recommendations
    const flags = await this.enhancedFlagService.getEnhancedFeatureFlags();
    if (flags.enhancedGenerationRollout < 50 && metrics.generationMetrics.successRate > 0.95) {
      recommendations.push('System performance is stable - consider increasing rollout percentage');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }
}
