/**
 * Performance Monitoring Routes
 * Provides endpoints for performance metrics and monitoring
 * Requirements: 10.3, 10.4
 */

import express from 'express';
import { performanceMonitor } from '../services/PerformanceMonitoringService.js';
import { cacheWarmingService } from '../services/CacheWarmingService.js';
import { puzzleMetrics } from '../utils/puzzleMetrics.js';

const router = express.Router();

/**
 * Get performance summary
 */
router.get('/performance/summary', async (_req, res): Promise<void> => {
  try {
    const summary = performanceMonitor.getPerformanceSummary();

    res.json({
      success: true,
      data: summary,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error getting performance summary:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get performance summary',
      },
    });
  }
});

/**
 * Get performance report (formatted text)
 */
router.get('/performance/report', async (_req, res): Promise<void> => {
  try {
    const report = performanceMonitor.generatePerformanceReport();

    res.type('text/plain').send(report);
  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate performance report',
      },
    });
  }
});

/**
 * Get cache metrics
 */
router.get('/performance/cache', async (_req, res): Promise<void> => {
  try {
    const cacheMetrics = performanceMonitor.getCacheMetrics();

    res.json({
      success: true,
      data: cacheMetrics,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error getting cache metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get cache metrics',
      },
    });
  }
});

/**
 * Get recent performance alerts
 */
router.get('/performance/alerts', async (req, res): Promise<void> => {
  try {
    const count = parseInt(req.query.count as string) || 20;
    const alerts = performanceMonitor.getRecentAlerts(count);

    res.json({
      success: true,
      data: alerts,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error getting performance alerts:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get performance alerts',
      },
    });
  }
});

/**
 * Get puzzle metrics
 */
router.get('/performance/puzzle-metrics', async (_req, res): Promise<void> => {
  try {
    const metrics = puzzleMetrics.getAggregatedMetrics();

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error getting puzzle metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get puzzle metrics',
      },
    });
  }
});

/**
 * Get cache warming status
 */
router.get('/performance/cache-warming/status', async (_req, res): Promise<void> => {
  try {
    const status = cacheWarmingService.getStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error getting cache warming status:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to get cache warming status',
      },
    });
  }
});

/**
 * Trigger cache warming manually
 */
router.post('/performance/cache-warming/trigger', async (req, res): Promise<void> => {
  try {
    const date = req.body.date as string | undefined;

    console.log(`Manual cache warming triggered${date ? ` for ${date}` : ''}`);

    const result = await cacheWarmingService.warmCacheForScheduledPosts(date);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error triggering cache warming:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to trigger cache warming',
      },
    });
  }
});

/**
 * Reset performance metrics
 */
router.post('/performance/reset', async (_req, res): Promise<void> => {
  try {
    performanceMonitor.resetMetrics();
    puzzleMetrics.reset();

    res.json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error resetting performance metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to reset performance metrics',
      },
    });
  }
});

export default router;
