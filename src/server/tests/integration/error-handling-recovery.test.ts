/**
 * Integration tests for error handling and recovery mechanisms
 * Tests timeout scenarios, fallback behavior, and feature flag functionality
 * Requirements: 1.3, 1.4, 1.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GenerationErrorHandler,
  ErrorRecoveryContext,
} from '../../services/GenerationErrorHandler.js';
import { FeatureFlagService } from '../../services/FeatureFlagService.js';
import { GenerationMetricsService } from '../../services/GenerationMetricsService.js';
import { PuzzleService } from '../../services/PuzzleService.js';
import { EnhancedFeatureFlagService } from '../../services/EnhancedFeatureFlagService.js';
import {
  Difficulty,
  Puzzle,
  Material,
  MaterialType,
  GridPosition,
  LaserPath,
  HintPath,
} from '../../../shared/types/puzzle.js';
import {
  ValidationResult,
  ValidationIssue,
  GuaranteedGenerationConfig,
  PuzzleGenerationMetadata,
  GenerationError,
  GenerationFeatureFlags,
  EnhancedFeatureFlags,
} from '../../../shared/types/guaranteed-generation.js';
import { GUARANTEED_GENERATION_CONFIG } from '../../../shared/constants/guaranteed-generation.js';

// Mock services
vi.mock('../../services/FeatureFlagService.js');
vi.mock('../../services/GenerationMetricsService.js');
vi.mock('../../services/EnhancedFeatureFlagService.js');

// Mock PuzzleService constructor
vi.mock('../../services/PuzzleService.js', () => ({
  PuzzleService: vi.fn().mockImplementation(() => ({})),
}));

describe('Error Handling and Recovery Mechanisms', () => {
  let errorHandler: GenerationErrorHandler;
  let mockFeatureFlagService: vi.Mocked<FeatureFlagService>;
  let mockMetricsService: vi.Mocked<GenerationMetricsService>;
  let mockPuzzleService: vi.Mocked<PuzzleService>;
  let mockEnhancedFeatureFlagService: vi.Mocked<EnhancedFeatureFlagService>;

  const mockPuzzle: Puzzle = {
    id: 'test-puzzle-123',
    difficulty: 'Medium' as Difficulty,
    gridSize: 8,
    materials: [
      {
        id: 'material-1',
        type: 'mirror' as MaterialType,
        position: [2, 3] as GridPosition,
        angle: 45,
      },
    ] as Material[],
    entry: [0, 4] as GridPosition,
    solution: [7, 2] as GridPosition,
    solutionPath: {
      segments: [
        { start: [0, 4], end: [2, 3], materialId: 'material-1' },
        { start: [2, 3], end: [7, 2], materialId: null },
      ],
      totalLength: 8.5,
    } as LaserPath,
    hints: [] as HintPath[],
    createdAt: new Date(),
    materialDensity: 0.75,
  };

  const mockValidationResult: ValidationResult = {
    isValid: false,
    hasUniqueSolution: false,
    alternativeCount: 2,
    physicsCompliant: true,
    confidenceScore: 65,
    issues: [
      {
        type: 'multiple_solutions',
        description: 'Puzzle has 2 alternative solution paths',
        affectedPositions: [
          [3, 4],
          [5, 6],
        ] as GridPosition[],
        severity: 'critical',
      },
    ] as ValidationIssue[],
  };

  const mockErrorContext: ErrorRecoveryContext = {
    difficulty: 'Medium' as Difficulty,
    date: '2024-01-15',
    attempt: 1,
    timeElapsed: 3500,
    originalConfig: GUARANTEED_GENERATION_CONFIG,
    errorHistory: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton instances
    (GenerationErrorHandler as any).instance = undefined;

    // Setup mocked services
    mockFeatureFlagService = {
      shouldFallbackToLegacy: vi.fn(),
      recordGenerationMetrics: vi.fn(),
      shouldUseEnhancedGeneration: vi.fn(),
      getFeatureFlags: vi.fn(),
    } as any;

    mockMetricsService = {
      recordGenerationFailure: vi.fn(),
      recordValidationFailure: vi.fn(),
      recordFallbackUsage: vi.fn(),
      recordGenerationError: vi.fn(),
    } as any;

    mockPuzzleService = {
      createPuzzle: vi.fn(),
      generateDailyPuzzles: vi.fn(),
    } as any;

    mockEnhancedFeatureFlagService = {
      getEnhancedFeatureFlags: vi.fn(),
      updateEnhancedFeatureFlags: vi.fn(),
      shouldUseEnhancedGeneration: vi.fn(),
      recordGenerationMetrics: vi.fn(),
    } as any;

    // Mock service instances
    vi.mocked(FeatureFlagService.getInstance).mockReturnValue(mockFeatureFlagService);
    vi.mocked(GenerationMetricsService.getInstance).mockReturnValue(mockMetricsService);
    vi.mocked(EnhancedFeatureFlagService.getInstance).mockReturnValue(
      mockEnhancedFeatureFlagService
    );

    // Mock PuzzleService constructor to return our mock
    vi.mocked(PuzzleService).mockImplementation(() => mockPuzzleService as any);

    // Create error handler instance
    errorHandler = GenerationErrorHandler.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Timeout Scenarios and Fallback Behavior', () => {
    it('should handle generation timeout with retry strategy', async () => {
      // Setup: Enable fallback but allow retry first
      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(true);
      mockMetricsService.recordGenerationFailure.mockResolvedValue();

      const timeoutContext: ErrorRecoveryContext = {
        ...mockErrorContext,
        timeElapsed: 6000, // Exceeds 5 second timeout
        attempt: 1, // First attempt, should retry
      };

      // Execute timeout handling
      const result = await errorHandler.handleGenerationTimeout(timeoutContext);

      // Verify retry behavior
      expect(result.shouldFallback).toBe(false); // Should retry, not fallback immediately
      expect(result.metadata.algorithm).toBe('guaranteed');
      expect(result.metadata.attempts).toBe(2); // Incremented attempt count
      expect(mockMetricsService.recordGenerationFailure).toHaveBeenCalledWith(
        'Medium',
        'timeout',
        6000
      );
    });

    it('should fallback to legacy generation after max timeout attempts', async () => {
      // Setup: Max attempts reached
      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(true);
      mockPuzzleService.createPuzzle.mockResolvedValue(mockPuzzle);
      mockMetricsService.recordFallbackUsage.mockResolvedValue();

      const maxAttemptsContext: ErrorRecoveryContext = {
        ...mockErrorContext,
        timeElapsed: 8000,
        attempt: 3, // Exceeds max attempts for timeout strategy
      };

      // Execute timeout handling
      const result = await errorHandler.handleGenerationTimeout(maxAttemptsContext);

      // Verify fallback behavior
      expect(result.shouldFallback).toBe(true);
      expect(result.puzzle).toEqual(mockPuzzle);
      expect(result.metadata.algorithm).toBe('legacy');
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(mockPuzzleService.createPuzzle).toHaveBeenCalledWith('Medium', '2024-01-15');
      expect(mockMetricsService.recordFallbackUsage).toHaveBeenCalledWith(
        'Medium',
        'generation_failure'
      );
    });

    it('should handle fallback disabled scenario', async () => {
      // Setup: Fallback disabled
      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(false);

      const maxAttemptsContext: ErrorRecoveryContext = {
        ...mockErrorContext,
        attempt: 5, // Exceeds max attempts
      };

      // Execute timeout handling
      const result = await errorHandler.handleGenerationTimeout(maxAttemptsContext);

      // Verify error handling when fallback is disabled
      expect(result.shouldFallback).toBe(true);
      expect(result.puzzle).toBeUndefined();
      expect(result.metadata.validationPassed).toBe(false);
      expect(result.metadata.fallbackUsed).toBe(true);
    });

    it('should handle concurrent timeout scenarios', async () => {
      // Setup multiple concurrent timeout scenarios
      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(true);
      mockPuzzleService.createPuzzle.mockResolvedValue(mockPuzzle);

      const contexts = [
        { ...mockErrorContext, difficulty: 'Easy' as Difficulty, attempt: 1 },
        { ...mockErrorContext, difficulty: 'Medium' as Difficulty, attempt: 2 },
        { ...mockErrorContext, difficulty: 'Hard' as Difficulty, attempt: 3 },
      ];

      // Execute concurrent timeout handling
      const results = await Promise.all(
        contexts.map((context) => errorHandler.handleGenerationTimeout(context))
      );

      // Verify all scenarios handled appropriately
      expect(results).toHaveLength(3);
      expect(results[0].shouldFallback).toBe(false); // Easy, attempt 1 - retry
      expect(results[1].shouldFallback).toBe(false); // Medium, attempt 2 - retry
      expect(results[2].shouldFallback).toBe(true); // Hard, attempt 3 - fallback
    });
  });

  describe('Error Recovery Strategies Effectiveness', () => {
    it('should handle validation failure with constraint relaxation', async () => {
      // Setup validation failure scenario
      mockMetricsService.recordValidationFailure.mockResolvedValue();

      const validationContext: ErrorRecoveryContext = {
        ...mockErrorContext,
        attempt: 1, // First attempt, should retry with relaxed constraints
      };

      // Execute validation failure handling
      const result = await errorHandler.handleValidationFailure(
        mockPuzzle,
        mockValidationResult,
        validationContext
      );

      // Verify constraint relaxation strategy
      expect(result.shouldFallback).toBe(false);
      expect(result.metadata.confidenceScore).toBe(65); // From validation result
      expect(result.metadata.validationPassed).toBe(false);
      expect(mockMetricsService.recordValidationFailure).toHaveBeenCalledWith('Medium', [
        'multiple_solutions',
      ]);
    });

    it('should fallback on critical validation issues', async () => {
      // Setup critical validation failure
      const criticalValidationResult: ValidationResult = {
        ...mockValidationResult,
        issues: [
          {
            type: 'multiple_solutions',
            description: 'Multiple solution paths detected',
            affectedPositions: [
              [1, 1],
              [2, 2],
            ] as GridPosition[],
            severity: 'critical',
          },
          {
            type: 'physics_violation',
            description: 'Physics rules violated',
            affectedPositions: [[3, 3]] as GridPosition[],
            severity: 'critical',
          },
          {
            type: 'infinite_loop',
            description: 'Infinite reflection loop detected',
            affectedPositions: [[4, 4]] as GridPosition[],
            severity: 'critical',
          },
          {
            type: 'no_solution',
            description: 'No valid solution path',
            affectedPositions: [] as GridPosition[],
            severity: 'critical',
          },
        ] as ValidationIssue[],
      };

      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(true);
      mockPuzzleService.createPuzzle.mockResolvedValue(mockPuzzle);
      mockMetricsService.recordFallbackUsage.mockResolvedValue();

      // Execute validation failure handling
      const result = await errorHandler.handleValidationFailure(
        mockPuzzle,
        criticalValidationResult,
        mockErrorContext
      );

      // Verify immediate fallback on critical issues
      expect(result.shouldFallback).toBe(true);
      expect(result.puzzle).toEqual(mockPuzzle);
      expect(mockMetricsService.recordFallbackUsage).toHaveBeenCalled();
    });

    it('should handle spacing constraint failures with expanded search', async () => {
      // Setup spacing constraint failure
      const spacingContext: ErrorRecoveryContext = {
        ...mockErrorContext,
        attempt: 1,
      };

      // Execute spacing constraint failure handling
      const result = await errorHandler.handleSpacingConstraintFailure(spacingContext);

      // Verify expanded search strategy
      expect(result.shouldFallback).toBe(false);
      expect(result.metadata.attempts).toBe(2);
      expect(result.metadata.algorithm).toBe('guaranteed');
    });

    it('should handle material placement failures with simplified requirements', async () => {
      // Setup material placement failure
      const materialContext: ErrorRecoveryContext = {
        ...mockErrorContext,
        attempt: 2,
      };

      // Execute material placement failure handling
      const result = await errorHandler.handleMaterialPlacementFailure(materialContext);

      // Verify simplified requirements strategy
      expect(result.shouldFallback).toBe(false);
      expect(result.metadata.attempts).toBe(3);
      expect(result.metadata.algorithm).toBe('guaranteed');
    });

    it('should create and log generation errors properly', async () => {
      // Setup error logging
      mockMetricsService.recordGenerationError.mockResolvedValue();

      // Create generation error
      const error = errorHandler.createGenerationError(
        'timeout',
        'Generation exceeded timeout limit',
        mockErrorContext
      );

      // Verify error structure
      expect(error.type).toBe('timeout');
      expect(error.message).toBe('Generation exceeded timeout limit');
      expect(error.context.difficulty).toBe('Medium');
      expect(error.context.attempt).toBe(1);
      expect(error.recoveryStrategy).toBe('retry'); // First attempt should retry

      // Log the error
      await errorHandler.logGenerationIssue(error, mockErrorContext);

      // Verify logging
      expect(mockMetricsService.recordGenerationError).toHaveBeenCalledWith('timeout', 'Medium');
    });
  });

  describe('Feature Flag Functionality and Gradual Rollout', () => {
    it('should respect feature flags for enhanced generation', async () => {
      // Setup feature flags
      const mockFlags: GenerationFeatureFlags = {
        enableGuaranteedGeneration: true,
        fallbackToLegacy: true,
        enableAdvancedValidation: true,
        enablePerformanceLogging: false,
        maxGenerationAttempts: 10,
      };

      mockFeatureFlagService.getFeatureFlags.mockResolvedValue(mockFlags);
      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(true);

      // Test fallback behavior with flags enabled
      const result = await errorHandler.handleGenerationTimeout({
        ...mockErrorContext,
        attempt: 5, // Exceeds max attempts
      });

      expect(mockFeatureFlagService.shouldFallbackToLegacy).toHaveBeenCalled();
      expect(result.shouldFallback).toBe(true);
    });

    it('should handle enhanced feature flags for gradual rollout', async () => {
      // Setup enhanced feature flags
      const mockEnhancedFlags: EnhancedFeatureFlags = {
        enableGuaranteedGeneration: true,
        fallbackToLegacy: true,
        enableAdvancedValidation: true,
        enablePerformanceLogging: true,
        maxGenerationAttempts: 12,
        enhancedGenerationRollout: 50, // 50% rollout
        fallbackThresholds: {
          maxConsecutiveFailures: 3,
          maxFailureRate: 0.1,
          timeWindowMinutes: 60,
        },
        retryLimits: {
          maxTimeoutRetries: 3,
          maxValidationRetries: 5,
          maxSpacingRetries: 3,
          maxMaterialRetries: 4,
        },
        monitoringConfig: {
          enableDetailedLogging: true,
          logLevel: 'info',
          metricsCollectionInterval: 300,
        },
        abTestingConfig: {
          enabled: true,
          testGroups: [],
        },
      };

      mockEnhancedFeatureFlagService.getEnhancedFeatureFlags.mockResolvedValue(mockEnhancedFlags);
      mockEnhancedFeatureFlagService.shouldUseEnhancedGeneration.mockResolvedValue(true);

      // Test enhanced generation decision
      const shouldUse =
        await mockEnhancedFeatureFlagService.shouldUseEnhancedGeneration('2024-01-15');
      expect(shouldUse).toBe(true);
      expect(mockEnhancedFeatureFlagService.getEnhancedFeatureFlags).toHaveBeenCalled();
    });

    it('should handle feature flag updates during rollout', async () => {
      // Setup initial flags
      const initialFlags: EnhancedFeatureFlags = {
        enableGuaranteedGeneration: true,
        fallbackToLegacy: true,
        enableAdvancedValidation: true,
        enablePerformanceLogging: true,
        maxGenerationAttempts: 10,
        enhancedGenerationRollout: 25, // 25% rollout
        fallbackThresholds: {
          maxConsecutiveFailures: 3,
          maxFailureRate: 0.1,
          timeWindowMinutes: 60,
        },
        retryLimits: {
          maxTimeoutRetries: 3,
          maxValidationRetries: 5,
          maxSpacingRetries: 3,
          maxMaterialRetries: 4,
        },
        monitoringConfig: {
          enableDetailedLogging: true,
          logLevel: 'info',
          metricsCollectionInterval: 300,
        },
        abTestingConfig: {
          enabled: false,
          testGroups: [],
        },
      };

      // Updated flags with increased rollout
      const updatedFlags: Partial<EnhancedFeatureFlags> = {
        enhancedGenerationRollout: 75, // Increased to 75%
        abTestingConfig: {
          enabled: true,
          testGroups: [
            {
              name: 'enhanced_validation_test',
              description: 'Testing enhanced validation algorithms',
              featureOverrides: {
                enableAdvancedValidation: true,
              },
              targetPercentage: 10,
              isActive: true,
            },
          ],
        },
      };

      mockEnhancedFeatureFlagService.getEnhancedFeatureFlags
        .mockResolvedValueOnce(initialFlags)
        .mockResolvedValueOnce({ ...initialFlags, ...updatedFlags });

      mockEnhancedFeatureFlagService.updateEnhancedFeatureFlags.mockResolvedValue();

      // Test flag update
      await mockEnhancedFeatureFlagService.updateEnhancedFeatureFlags(updatedFlags);
      const newFlags = await mockEnhancedFeatureFlagService.getEnhancedFeatureFlags();

      expect(mockEnhancedFeatureFlagService.updateEnhancedFeatureFlags).toHaveBeenCalledWith(
        updatedFlags
      );
      expect(newFlags.enhancedGenerationRollout).toBe(75);
      expect(newFlags.abTestingConfig.enabled).toBe(true);
    });

    it('should handle A/B testing groups correctly', async () => {
      // Setup A/B testing configuration
      const abTestFlags: EnhancedFeatureFlags = {
        enableGuaranteedGeneration: true,
        fallbackToLegacy: true,
        enableAdvancedValidation: true,
        enablePerformanceLogging: true,
        maxGenerationAttempts: 10,
        enhancedGenerationRollout: 100,
        fallbackThresholds: {
          maxConsecutiveFailures: 3,
          maxFailureRate: 0.1,
          timeWindowMinutes: 60,
        },
        retryLimits: {
          maxTimeoutRetries: 3,
          maxValidationRetries: 5,
          maxSpacingRetries: 3,
          maxMaterialRetries: 4,
        },
        monitoringConfig: {
          enableDetailedLogging: true,
          logLevel: 'debug',
          metricsCollectionInterval: 300,
        },
        abTestingConfig: {
          enabled: true,
          testGroups: [
            {
              name: 'aggressive_timeout_test',
              description: 'Testing shorter timeout limits',
              featureOverrides: {
                maxGenerationAttempts: 15,
              },
              targetPercentage: 20,
              isActive: true,
            },
            {
              name: 'conservative_fallback_test',
              description: 'Testing conservative fallback thresholds',
              featureOverrides: {
                fallbackToLegacy: false,
              },
              targetPercentage: 10,
              isActive: true,
            },
          ],
        },
      };

      mockEnhancedFeatureFlagService.getEnhancedFeatureFlags.mockResolvedValue(abTestFlags);

      // Test A/B testing configuration
      const flags = await mockEnhancedFeatureFlagService.getEnhancedFeatureFlags();

      expect(flags.abTestingConfig.enabled).toBe(true);
      expect(flags.abTestingConfig.testGroups).toHaveLength(2);
      expect(flags.abTestingConfig.testGroups[0].name).toBe('aggressive_timeout_test');
      expect(flags.abTestingConfig.testGroups[0].featureOverrides.maxGenerationAttempts).toBe(15);
      expect(flags.abTestingConfig.testGroups[1].featureOverrides.fallbackToLegacy).toBe(false);
    });

    it('should handle feature flag service failures gracefully', async () => {
      // Setup service failure
      mockFeatureFlagService.shouldFallbackToLegacy.mockRejectedValue(
        new Error('Feature flag service unavailable')
      );

      // Test error handling during timeout
      const result = await errorHandler.handleGenerationTimeout({
        ...mockErrorContext,
        attempt: 5,
      });

      // Should handle service failure gracefully
      expect(result.shouldFallback).toBe(true);
      expect(result.metadata.fallbackUsed).toBe(true);
      expect(result.metadata.validationPassed).toBe(false);
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid successive error scenarios', async () => {
      // Setup rapid error scenarios
      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(true);
      mockPuzzleService.createPuzzle.mockResolvedValue(mockPuzzle);

      const errorScenarios = Array.from({ length: 10 }, (_, i) => ({
        ...mockErrorContext,
        attempt: i + 1,
        timeElapsed: 1000 * (i + 1),
      }));

      // Execute rapid error handling
      const startTime = Date.now();
      const results = await Promise.all(
        errorScenarios.map((context) => errorHandler.handleGenerationTimeout(context))
      );
      const executionTime = Date.now() - startTime;

      // Verify performance and correctness
      expect(results).toHaveLength(10);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify appropriate fallback behavior
      const fallbackResults = results.filter((r) => r.shouldFallback);
      expect(fallbackResults.length).toBeGreaterThan(0); // Some should fallback due to high attempt counts
    });

    it('should maintain memory efficiency during error handling', async () => {
      // Setup memory monitoring
      const initialMemory = process.memoryUsage();

      // Execute multiple error scenarios
      const scenarios = Array.from({ length: 50 }, (_, i) => ({
        ...mockErrorContext,
        attempt: 1,
        errorHistory: Array.from({ length: i % 5 }, () => ({
          type: 'timeout' as const,
          message: 'Test error',
          context: mockErrorContext,
          recoveryStrategy: 'retry' as const,
        })),
      }));

      mockFeatureFlagService.shouldFallbackToLegacy.mockResolvedValue(true);
      mockMetricsService.recordGenerationFailure.mockResolvedValue();

      for (const scenario of scenarios) {
        await errorHandler.handleGenerationTimeout(scenario);
      }

      // Check memory usage
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB for 50 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
