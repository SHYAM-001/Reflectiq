# Puzzle Operations Metrics

## Overview

The puzzle metrics system provides comprehensive monitoring and logging for all puzzle operations in ReflectIQ. This system tracks puzzle generation, Redis storage, retrieval operations, and errors to ensure system health and performance.

## Requirements Addressed

- **9.1**: Log puzzle generation with ID, difficulty, and generation time
- **9.2**: Log Redis storage operations with TTL information
- **9.3**: Log puzzle retrieval with cache hit/miss status
- **9.4**: Track error types and fallback actions
- **9.5**: Implement metrics tracking for success rates and latency

## Metrics Categories

### 1. Puzzle Generation Metrics

Tracks all puzzle generation operations including:

- **Puzzle ID**: Unique identifier for the puzzle
- **Difficulty**: Easy, Medium, or Hard
- **Generation Time**: Time taken to generate the puzzle (ms)
- **Success Status**: Whether generation succeeded
- **Source**: Enhanced, Legacy, or Backup
- **Error Type**: If generation failed

**Example Log Output:**

```
📊 [METRICS] Puzzle generated: 2024-01-15_easy_1234567890_abc123 | Difficulty: Easy | Time: 1250ms | Source: enhanced
```

### 2. Redis Storage Metrics

Tracks all Redis operations including:

- **Puzzle ID**: Identifier for the stored puzzle
- **Operation**: Store or Retrieve
- **Latency**: Time taken for the operation (ms)
- **TTL**: Time-to-live for stored puzzles (seconds)
- **Success Status**: Whether operation succeeded
- **Error Type**: If operation failed

**Example Log Output:**

```
📊 [METRICS] Redis store: 2024-01-15_easy_1234567890_abc123 | Latency: 45ms | TTL: 7776000s (90 days)
```

### 3. Puzzle Retrieval Metrics

Tracks puzzle retrieval operations including:

- **Puzzle ID**: Identifier for the retrieved puzzle
- **Difficulty**: Puzzle difficulty level
- **Source**: Cache, Generated, or Backup
- **Cache Hit**: Whether puzzle was found in cache
- **Latency**: Time taken to retrieve (ms)
- **Success Status**: Whether retrieval succeeded

**Example Log Output:**

```
📊 [METRICS] Puzzle retrieved: 2024-01-15_easy_1234567890_abc123 | ✓ CACHE HIT | Source: cache | Latency: 120ms
```

### 4. Error and Fallback Tracking

Tracks errors and fallback actions including:

- **Error Type**: Classification of the error
- **Message**: Detailed error message
- **Context**: Where the error occurred
- **Fallback Action**: What fallback was triggered
- **Fallback Success**: Whether fallback succeeded

**Example Log Output:**

```
📊 [METRICS] Error tracked: REDIS_ERROR | Context: getPuzzleById | Connection timeout
📊 [METRICS] Fallback triggered: getPuzzleById | Original Error: Redis unavailable | Fallback: Return null for generation fallback | ✓ SUCCESS
```

## Aggregated Metrics

The system provides aggregated metrics for monitoring:

### Generation Metrics

- Total operations
- Success/failure counts
- Success rate percentage
- Average generation time
- Breakdown by difficulty (Easy, Medium, Hard)
- Breakdown by source (Enhanced, Legacy, Backup)

### Storage Metrics

- Total operations
- Success/failure counts
- Success rate percentage
- Average latency
- Breakdown by operation type (Store, Retrieve)

### Retrieval Metrics

- Total operations
- Success/failure counts
- Success rate percentage
- Cache hit rate
- Average latency
- Breakdown by source (Cache, Generated, Backup)

### Error Metrics

- Total errors
- Breakdown by error type
- Recent error history

## Usage

### Recording Metrics in Code

```typescript
import { puzzleMetrics } from '../utils/puzzleMetrics.js';

// Record puzzle generation
puzzleMetrics.recordGeneration(puzzleId, difficulty, generationTime, success, source, errorType);

// Record Redis storage
puzzleMetrics.recordStorage(puzzleId, operation, latency, success, ttl, errorType);

// Record puzzle retrieval
puzzleMetrics.recordRetrieval(puzzleId, difficulty, source, latency, success, errorType);

// Record errors
puzzleMetrics.recordError(errorType, message, context);

// Record fallback actions
puzzleMetrics.recordFallback(operation, originalError, fallbackAction, success);
```

### Accessing Metrics

```typescript
import { PuzzleService } from '../services/PuzzleService.js';

const puzzleService = PuzzleService.getInstance();

// Get aggregated metrics
const metrics = puzzleService.getMetrics();

// Log metrics summary
puzzleService.logMetricsSummary();

// Reset metrics (for testing or periodic reset)
puzzleService.resetMetrics();
```

## Metrics Summary Output

The system provides a formatted metrics summary:

```
📊 Puzzle Metrics Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generation:
  Total: 100 | Success: 98 | Failed: 2
  Success Rate: 98%
  Average Time: 2150ms
  By Difficulty:
    Easy: 32/33 (1250ms avg)
    Medium: 33/33 (2100ms avg)
    Hard: 33/34 (3200ms avg)
  By Source:
    Enhanced: 95 | Legacy: 3 | Backup: 2

Storage:
  Total: 200 | Success: 198 | Failed: 2
  Success Rate: 99%
  Average Latency: 48ms
  Store Operations: 99/100
  Retrieve Operations: 99/100

Retrieval:
  Total: 150 | Success: 148 | Failed: 2
  Success Rate: 99%
  Cache Hit Rate: 92.0%
  Average Latency: 135ms
  By Source:
    Cache: 136 | Generated: 12 | Backup: 2

Errors:
  Total: 6
  By Type: REDIS_ERROR: 3, GENERATION_FAILED: 2, PUZZLE_NOT_FOUND: 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Performance Targets

Based on requirements, the system monitors against these targets:

- **Puzzle Generation**: < 5 seconds (target: < 2s for most cases)
- **Redis Storage**: < 500ms (target: < 100ms)
- **Puzzle Retrieval**: < 500ms from cache
- **Cache Hit Rate**: > 95%
- **Success Rate**: > 99%

## Monitoring Best Practices

1. **Regular Review**: Check metrics summary daily to identify trends
2. **Alert Thresholds**: Set up alerts for:
   - Success rate < 95%
   - Average latency > 500ms
   - Cache hit rate < 90%
   - Error count spike
3. **Performance Optimization**: Use metrics to identify bottlenecks
4. **Capacity Planning**: Track growth trends for Redis usage
5. **Error Analysis**: Review error types to improve reliability

## Integration with Error Monitoring

The puzzle metrics system integrates with the existing error monitoring system (`errorMonitor`) to provide comprehensive observability:

- All errors are logged to both systems
- Circuit breaker events are tracked
- Fallback actions are recorded
- Health status includes puzzle metrics

## Testing

Run the demonstration script to see metrics in action:

```bash
npm run test:metrics
```

This will simulate various puzzle operations and display the metrics tracking.

## Future Enhancements

Potential improvements to the metrics system:

1. **Persistent Storage**: Store metrics in Redis for historical analysis
2. **Dashboard Integration**: Create a web dashboard for real-time monitoring
3. **Alerting**: Implement automated alerts for threshold violations
4. **Trend Analysis**: Add time-series analysis for performance trends
5. **User Metrics**: Track per-user puzzle completion metrics
6. **A/B Testing**: Support metrics for feature flag experiments
