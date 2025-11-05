/**
 * Health Check and Monitoring Routes for ReflectIQ
 * Provides system health status and monitoring endpoints
 * Following Devvit Web best practices for observability
 */

import { Router } from 'express';
import { redisClient } from '../utils/redisClient.js';
import { FeatureFlagService } from '../services/FeatureFlagService.js';
import {
  asyncHandler,
  sendSuccessResponse,
  sendErrorResponse,
  errorMonitor,
  enhancedAsyncHandler,
} from '../utils/errorHandler.js';

const router = Router();

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get(
  '/health',
  asyncHandler(async (req, res) => {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    sendSuccessResponse(res, healthStatus);
  })
);

/**
 * GET /api/health/detailed
 * Detailed health check including dependencies and error monitoring
 */
router.get(
  '/health/detailed',
  enhancedAsyncHandler(async (req, res) => {
    const startTime = Date.now();

    // Get error monitoring health status
    const errorHealthStatus = errorMonitor.getHealthStatus();

    // Check Redis connectivity
    let redisStatus = 'healthy';
    let redisLatency = 0;

    try {
      const isHealthy = await redisClient.healthCheck();
      redisStatus = isHealthy ? 'healthy' : 'unhealthy';
      redisLatency = Date.now() - startTime;
    } catch (error) {
      redisStatus = 'unhealthy';
      console.error('Redis health check failed:', error);
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    // Determine overall health status
    const overallStatus =
      redisStatus === 'healthy' && errorHealthStatus.status === 'healthy' ? 'healthy' : 'degraded';

    const healthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      dependencies: {
        redis: {
          status: redisStatus,
          latency: redisLatency,
        },
      },
      system: {
        memory: memoryUsageMB,
        nodeVersion: process.version,
        platform: process.platform,
      },
      errorMonitoring: errorHealthStatus,
      responseTime: Date.now() - startTime,
    };

    if (healthStatus.status === 'healthy') {
      sendSuccessResponse(res, healthStatus);
    } else {
      res.status(503).json({
        success: false,
        error: {
          type: 'REDIS_ERROR',
          message: 'System is in degraded state',
        },
        data: healthStatus,
        timestamp: new Date(),
      });
    }
  })
);

/**
 * GET /api/metrics
 * Enhanced application metrics with error monitoring
 */
router.get(
  '/metrics',
  enhancedAsyncHandler(async (req, res) => {
    // Get Redis connection status and metrics
    const redisStatus = redisClient.getConnectionStatus();
    const redisMetrics = redisClient.getMetrics();

    // Get error monitoring metrics
    const errorMetrics = errorMonitor.getMetrics();
    const errorHealthStatus = errorMonitor.getHealthStatus();

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      redis: {
        connectionStatus: redisStatus,
        operationMetrics: redisMetrics,
      },
      errors: {
        total: errorMetrics.totalErrors,
        byType: errorMetrics.errorsByType,
        recentCount: errorMetrics.recentErrors.length,
        redisFailures: errorMetrics.redisFailures,
        circuitBreakerTrips: errorMetrics.circuitBreakerTrips,
        healthStatus: errorHealthStatus.status,
        circuitBreakers: errorHealthStatus.circuitBreakers,
      },
      // Add more application-specific metrics here
      puzzles: {
        // These would be populated from actual usage data
        totalGenerated: 0,
        totalSolved: 0,
        averageTime: 0,
      },
    };

    sendSuccessResponse(res, metrics);
  })
);

/**
 * GET /api/errors
 * Detailed error information for debugging
 */
router.get(
  '/errors',
  enhancedAsyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const errorMetrics = errorMonitor.getMetrics();

    const errorData = {
      summary: {
        totalErrors: errorMetrics.totalErrors,
        errorsByType: errorMetrics.errorsByType,
        redisFailures: errorMetrics.redisFailures,
        circuitBreakerTrips: errorMetrics.circuitBreakerTrips,
      },
      recentErrors: errorMetrics.recentErrors.slice(0, limit),
      healthStatus: errorMonitor.getHealthStatus(),
    };

    sendSuccessResponse(res, errorData);
  })
);

/**
 * POST /api/errors/reset
 * Reset error monitoring metrics (for testing/maintenance)
 */
router.post(
  '/errors/reset',
  enhancedAsyncHandler(async (req, res) => {
    errorMonitor.reset();

    sendSuccessResponse(res, {
      message: 'Error monitoring metrics have been reset',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/feature-flags
 * Get current feature flag configuration and status
 */
router.get(
  '/feature-flags',
  enhancedAsyncHandler(async (req, res) => {
    const featureFlagService = FeatureFlagService.getInstance();

    try {
      const flags = await featureFlagService.getFeatureFlags();
      const performanceMetrics = await featureFlagService.getPerformanceMetrics();
      const enhancedEnabled = await featureFlagService.isEnhancedGenerationEnabled();
      const rolloutPercentage = await featureFlagService.getEnhancedGenerationRollout();

      const flagStatus = {
        flags,
        status: {
          enhancedGenerationEnabled: enhancedEnabled,
          rolloutPercentage,
          fallbackEnabled: flags.fallbackToLegacy,
        },
        metrics: performanceMetrics,
        timestamp: new Date().toISOString(),
      };

      sendSuccessResponse(res, flagStatus);
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      sendErrorResponse(res, 'INTERNAL_ERROR', 'Failed to fetch feature flags');
    }
  })
);

/**
 * POST /api/feature-flags/update
 * Update feature flag configuration (for development/testing)
 */
router.post(
  '/feature-flags/update',
  enhancedAsyncHandler(async (req, res) => {
    const featureFlagService = FeatureFlagService.getInstance();

    try {
      const updates = req.body;

      // Validate updates
      if (!updates || typeof updates !== 'object') {
        return sendErrorResponse(res, 'VALIDATION_ERROR', 'Invalid update payload');
      }

      await featureFlagService.updateFeatureFlags(updates);
      const updatedFlags = await featureFlagService.getFeatureFlags();

      sendSuccessResponse(res, {
        message: 'Feature flags updated successfully',
        flags: updatedFlags,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating feature flags:', error);
      sendErrorResponse(res, 'INTERNAL_ERROR', 'Failed to update feature flags');
    }
  })
);

export default router;
