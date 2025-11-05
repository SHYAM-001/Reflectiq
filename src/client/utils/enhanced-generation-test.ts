/**
 * Enhanced Generation Test Utilities
 * Provides functions to test and validate the enhanced puzzle generation system
 */

import EnhancedApiService from '../services/enhanced-api';
import { Difficulty } from '../types/api';

export interface GenerationTestResult {
  success: boolean;
  puzzleId?: string;
  generationType: 'enhanced' | 'legacy' | 'unknown';
  generationTime: number;
  error?: string;
  validationPassed?: boolean;
}

/**
 * Test enhanced puzzle generation for a specific difficulty
 */
export async function testEnhancedGeneration(
  difficulty: Difficulty
): Promise<GenerationTestResult> {
  const startTime = Date.now();

  try {
    const apiService = EnhancedApiService.getInstance();

    // Force generation of a new puzzle
    const puzzle = await apiService.generateEnhancedPuzzle(difficulty, {
      forceRegeneration: true,
      maxAttempts: 5,
    });

    const generationTime = Date.now() - startTime;

    // Determine generation type from puzzle ID
    let generationType: 'enhanced' | 'legacy' | 'unknown' = 'unknown';
    if (puzzle.id?.includes('enhanced_')) {
      generationType = 'enhanced';
    } else if (puzzle.id?.includes('puzzle_')) {
      generationType = 'legacy';
    }

    // Basic validation
    const validationPassed = !!(
      puzzle.id &&
      puzzle.difficulty === difficulty &&
      puzzle.materials &&
      puzzle.materials.length > 0 &&
      puzzle.entry &&
      puzzle.solution &&
      puzzle.solutionPath
    );

    return {
      success: true,
      puzzleId: puzzle.id,
      generationType,
      generationTime,
      validationPassed,
    };
  } catch (error) {
    const generationTime = Date.now() - startTime;

    return {
      success: false,
      generationType: 'unknown',
      generationTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test enhanced generation for all difficulties
 */
export async function testAllDifficulties(): Promise<Record<Difficulty, GenerationTestResult>> {
  const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
  const results: Record<string, GenerationTestResult> = {};

  for (const difficulty of difficulties) {
    console.log(`Testing enhanced generation for ${difficulty}...`);
    results[difficulty] = await testEnhancedGeneration(difficulty);
  }

  return results as Record<Difficulty, GenerationTestResult>;
}

/**
 * Test puzzle validation endpoint
 */
export async function testPuzzleValidation(puzzleId: string): Promise<{
  success: boolean;
  validationResult?: any;
  error?: string;
}> {
  try {
    const apiService = EnhancedApiService.getInstance();
    const validationResult = await apiService.validatePuzzle(puzzleId);

    return {
      success: true,
      validationResult,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get feature flag status
 */
export async function getFeatureFlagStatus(): Promise<{
  success: boolean;
  status?: any;
  error?: string;
}> {
  try {
    const response = await fetch('/api/feature-flags');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        status: data.data,
      };
    } else {
      throw new Error(data.error?.message || 'Failed to fetch feature flags');
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a comprehensive test of the enhanced generation system
 */
export async function runComprehensiveTest(): Promise<{
  featureFlags: any;
  generationTests: Record<Difficulty, GenerationTestResult>;
  validationTests: Record<string, any>;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    enhancedGenerationWorking: boolean;
    averageGenerationTime: number;
  };
}> {
  console.log('🧪 Running comprehensive enhanced generation test...');

  // Test feature flags
  const featureFlagsResult = await getFeatureFlagStatus();

  // Test generation for all difficulties
  const generationTests = await testAllDifficulties();

  // Test validation for generated puzzles
  const validationTests: Record<string, any> = {};
  for (const [difficulty, result] of Object.entries(generationTests)) {
    if (result.success && result.puzzleId) {
      validationTests[difficulty] = await testPuzzleValidation(result.puzzleId);
    }
  }

  // Calculate summary
  const testResults = Object.values(generationTests);
  const totalTests = testResults.length;
  const passed = testResults.filter((r) => r.success && r.validationPassed).length;
  const failed = totalTests - passed;
  const enhancedGenerationWorking = testResults.some((r) => r.generationType === 'enhanced');
  const averageGenerationTime =
    testResults.reduce((sum, r) => sum + r.generationTime, 0) / totalTests;

  const summary = {
    totalTests,
    passed,
    failed,
    enhancedGenerationWorking,
    averageGenerationTime,
  };

  console.log('📊 Test Summary:', summary);

  return {
    featureFlags: featureFlagsResult.status,
    generationTests,
    validationTests,
    summary,
  };
}

/**
 * Log test results in a readable format
 */
export function logTestResults(results: Awaited<ReturnType<typeof runComprehensiveTest>>): void {
  console.log('\n🔍 Enhanced Generation Test Results');
  console.log('=====================================');

  // Feature Flags Status
  if (results.featureFlags) {
    console.log('\n📋 Feature Flags:');
    console.log(
      `  Enhanced Generation: ${results.featureFlags.status.enhancedGenerationEnabled ? '✅' : '❌'}`
    );
    console.log(`  Rollout Percentage: ${results.featureFlags.status.rolloutPercentage}%`);
    console.log(`  Fallback Enabled: ${results.featureFlags.status.fallbackEnabled ? '✅' : '❌'}`);
  }

  // Generation Tests
  console.log('\n🎯 Generation Tests:');
  for (const [difficulty, result] of Object.entries(results.generationTests)) {
    const status = result.success ? '✅' : '❌';
    const type =
      result.generationType === 'enhanced'
        ? '🚀'
        : result.generationType === 'legacy'
          ? '🔧'
          : '❓';
    console.log(`  ${difficulty}: ${status} ${type} (${result.generationTime}ms)`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  // Summary
  console.log('\n📈 Summary:');
  console.log(`  Total Tests: ${results.summary.totalTests}`);
  console.log(`  Passed: ${results.summary.passed}`);
  console.log(`  Failed: ${results.summary.failed}`);
  console.log(
    `  Enhanced Generation Working: ${results.summary.enhancedGenerationWorking ? '✅' : '❌'}`
  );
  console.log(`  Average Generation Time: ${results.summary.averageGenerationTime.toFixed(0)}ms`);

  console.log('\n=====================================\n');
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testEnhancedGeneration = {
    testEnhancedGeneration,
    testAllDifficulties,
    testPuzzleValidation,
    getFeatureFlagStatus,
    runComprehensiveTest,
    logTestResults,
  };
}
