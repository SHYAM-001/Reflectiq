/**
 * Health Check and Monitoring Routes for ReflectIQ
 * Provides system health status and monitoring endpoints
 * Following Devvit Web best practices for observability
 */

import { Router } from 'express';
import { redisClient } from '../utils/redisClient.js';
import { asyncHandler, sendSuccessResponse, sendErrorResponse } from '../utils/errorHandler.js';

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
 * Detailed health check including dependencies
 */
router.get(
  '/health/detailed',
  asyncHandler(async (req, res) => {
    const startTime = Date.now();

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

    const healthStatus = {
      status: redisStatus === 'healthy' ? 'healthy' : 'degraded',
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
 * Basic application metrics
 */
router.get(
  '/metrics',
  asyncHandler(async (req, res) => {
    // Get Redis connection status and metrics
    const redisStatus = redisClient.getConnectionStatus();
    const redisMetrics = redisClient.getMetrics();

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      redis: {
        connectionStatus: redisStatus,
        operationMetrics: redisMetrics,
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

export default router;
