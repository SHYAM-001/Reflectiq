/**
 * Manual test script to demonstrate puzzle metrics tracking
 * This script shows how metrics are collected and reported
 *
 * Usage: Run this to see metrics in action (for demonstration purposes)
 */

import { puzzleMetrics } from '../src/server/utils/puzzleMetrics.js';

// Simulate puzzle generation operations
console.log('🧪 Testing Puzzle Metrics Tracking\n');

// Test 1: Successful puzzle generation
console.log('Test 1: Simulating successful puzzle generation...');
puzzleMetrics.recordGeneration('2024-01-15_easy_1234567890_abc123', 'Easy', 1250, true, 'enhanced');

puzzleMetrics.recordGeneration(
  '2024-01-15_medium_1234567891_def456',
  'Medium',
  2100,
  true,
  'enhanced'
);

puzzleMetrics.recordGeneration('2024-01-15_hard_1234567892_ghi789', 'Hard', 3500, true, 'enhanced');

// Test 2: Failed generation with backup
console.log('\nTest 2: Simulating failed generation with backup fallback...');
puzzleMetrics.recordGeneration(
  '2024-01-15_medium_1234567893_jkl012',
  'Medium',
  500,
  true,
  'backup'
);

puzzleMetrics.recordFallback(
  'generatePuzzleWithId',
  'Enhanced generation timeout',
  'Using backup puzzle template',
  true
);

// Test 3: Redis storage operations
console.log('\nTest 3: Simulating Redis storage operations...');
puzzleMetrics.recordStorage(
  '2024-01-15_easy_1234567890_abc123',
  'store',
  45,
  true,
  7776000 // 90 days in seconds
);

puzzleMetrics.recordStorage('2024-01-15_medium_1234567891_def456', 'store', 52, true, 7776000);

// Test 4: Puzzle retrieval with cache hits
console.log('\nTest 4: Simulating puzzle retrieval operations...');
puzzleMetrics.recordRetrieval('2024-01-15_easy_1234567890_abc123', 'Easy', 'cache', 120, true);

puzzleMetrics.recordStorage('2024-01-15_easy_1234567890_abc123', 'retrieve', 115, true);

// Test 5: Cache miss with generation
console.log('\nTest 5: Simulating cache miss with generation...');
puzzleMetrics.recordRetrieval('2024-01-15_hard_1234567894_mno345', 'Hard', 'generated', 3200, true);

// Test 6: Error scenarios
console.log('\nTest 6: Simulating error scenarios...');
puzzleMetrics.recordError('REDIS_ERROR', 'Connection timeout', 'getPuzzleById');
puzzleMetrics.recordFallback(
  'getPuzzleById',
  'Redis unavailable',
  'Return null for generation fallback',
  true
);

// Display metrics summary
console.log('\n' + '='.repeat(80));
console.log(puzzleMetrics.getMetricsSummary());
console.log('='.repeat(80));

// Display aggregated metrics as JSON
console.log('\n📊 Aggregated Metrics (JSON):');
console.log(JSON.stringify(puzzleMetrics.getAggregatedMetrics(), null, 2));

console.log('\n✅ Metrics tracking demonstration complete!');
