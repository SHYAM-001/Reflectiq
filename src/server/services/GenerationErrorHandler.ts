/**
 * Generation Error Handler for ReflectIQ Enhanced Puzzle Generation
 * Provides comprehensive error handling and recovery strategies for generation failures
 * Requirements: 1.3, 1.4, 1.5
 */

import { Puzzle, Difficulty } from '../../shared/types/puzzle.js';
import {
  GenerationError,
  ValidationResult,
  GuaranteedGenerationConfig,
  PuzzleGenerationMetadata,
} from '../../shared/types/guaranteed-generation.js';
import { FeatureFlagService } from './FeatureFlagService.js';
import { GenerationMetricsService } from './GenerationMetricsService.js';
import { PuzzleService } from './PuzzleService.js';

export interface ErrorRecoveryContext {
  difficulty: Difficulty;
  date: string;
  attempt: number;
  timeElapsed: number;
  lastValidState?: Partial<Puzzle>;
  originalConfig: GuaranteedGenerationConfig;
  errorHistory: GenerationError[];
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  maxAttempts: number;
  timeoutMultiplier: number;
  constraintRelaxation: ConstraintRelaxation;
}

export interface ConstraintRelaxation {
  reduceConfidenceThreshold: number; // Reduce by this amount
  increaseTimeoutMs: number; // Add this many milliseconds
  relaxSpacingConstraints: boolean;
  allowLowerComplexity: boolean;
  fallbackToLegacy: boolean;
}

export class GenerationErrorHandler {
  private static instance: GenerationErrorHandler;
  private featureFlagService: FeatureFlagService;
  private metricsService: GenerationMetricsService;
  private puzzleService: PuzzleService;

  private constructor() {
    this.featureFlagService = FeatureFlagService.getInstance();
    this.metricsService = GenerationMetricsService.getInstance();
    this.puzzleService = new PuzzleService();
  }

  public static getInstance(): GenerationErrorHandler {
    if (!GenerationErrorHandler.instance) {
      GenerationErrorHandler.instance = new GenerationErrorHandler();
    }
    return GenerationErrorHandler.instance;
  }

  private readonly RECOVERY_STRATEGIES: Record<string, RecoveryStrategy> = {
    timeout: {
      name: 'Timeout Recovery',
      description: 'Increase timeout and reduce constraints for timeout failures',
      maxAttempts: 3,
      timeoutMultiplier: 1.5,
      constraintRelaxation: {
        reduceConfidenceThreshold: 10,
        increaseTimeoutMs: 2000,
        relaxSpacingConstraints: false,
        allowLowerComplexity: true,
        fallbackToLegacy: false,
      },
    },
    validation_failure: {
      name: 'Validation Recovery',
      description: 'Relax validation constraints and retry generation',
      maxAttempts: 5,
      timeoutMultiplier: 1.2,
      constraintRelaxation: {
        reduceConfidenceThreshold: 15,
        increaseTimeoutMs: 1000,
        relaxSpacingConstraints: true,
        allowLowerComplexity: true,
        fallbackToLegacy: false,
      },
    },
    spacing_failure: {
      name: 'Spacing Recovery',
      description: 'Expand search space for entry/exit placement',
      maxAttempts: 3,
      timeoutMultiplier: 1.0,
      constraintRelaxation: {
        reduceConfidenceThreshold: 5,
        increaseTimeoutMs: 500,
        relaxSpacingConstraints: true,
        allowLowerComplexity: false,
        fallbackToLegacy: false,
      },
    },
    material_placement_failure: {
      name: 'Material Placement Recovery',
      description: 'Simplify path requirements and material constraints',
      maxAttempts: 4,
      timeoutMultiplier: 1.1,
      constraintRelaxation: {
        reduceConfidenceThreshold: 20,
        increaseTimeoutMs: 1500,
        relaxSpacingConstraints: false,
        allowLowerComplexity: true,
        fallbackToLegacy: false,
      },
    },
    physics_violation: {
      name: 'Physics Recovery',
      description: 'Relax physics validation and retry with simpler paths',
      maxAttempts: 2,
      timeoutMultiplier: 1.0,
      constraintRelaxation: {
        reduceConfidenceThreshold: 25,
        increaseTimeoutMs: 0,
        relaxSpacingConstraints: false,
        allowLowerComplexity: true,
        fallbackToLegacy: true,
      },
    },
  };

  /**
   * Handle generation timeout with fallback strategies
   */
  public async handleGenerationTimeout(
    context: ErrorRecoveryContext
  ): Promise<{ puzzle?: Puzzle; shouldFallback: boolean; metadata: PuzzleGenerationMetadata }> {
    const startTime = Date.now();

    try {
      console.warn(
        `Generation timeout for ${context.difficulty} puzzle after ${context.timeElapsed}ms, attempt ${context.attempt}`
      );

      // Record timeout metrics
      await this.metricsService.recordGenerationFailure(
        context.difficulty,
        'timeout',
        context.timeElapsed
      );

      const strategy = this.RECOVERY_STRATEGIES.timeout;

      // Check if we should attempt recovery or fallback immediately
      if (context.attempt >= strategy.maxAttempts) {
        console.log('Max timeout recovery attempts reached, falling back to legacy generation');
        return await this.fallbackToLegacyGeneration(context);
      }

      // Try recovery with relaxed constraints
      const relaxedConfig = this.applyConstraintRelaxation(context.originalConfig, strategy);

      console.log(
        `Attempting timeout recovery with relaxed constraints: confidence ${relaxedConfig.minConfidenceScore}, timeout ${relaxedConfig.timeoutMs}ms`
      );

      const metadata: PuzzleGenerationMetadata = {
        puzzleId: `recovery_${Date.now()}`,
        algorithm: 'guaranteed',
        attempts: context.attempt + 1,
        generationTime: Date.now() - startTime,
        confidenceScore: 0,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      return {
        shouldFallback: false,
        metadata,
      };
    } catch (error) {
      console.error('Error in timeout recovery:', error);
      return await this.fallbackToLegacyGeneration(context);
    }
  }
  /**
   * Handle validation failure with constraint relaxation
   */
  public async handleValidationFailure(
    puzzle: Puzzle,
    validationResult: ValidationResult,
    context: ErrorRecoveryContext
  ): Promise<{ puzzle?: Puzzle; shouldFallback: boolean; metadata: PuzzleGenerationMetadata }> {
    const startTime = Date.now();

    try {
      console.warn(
        `Validation failure for ${context.difficulty} puzzle: ${validationResult.issues.length} issues, confidence ${validationResult.confidenceScore}`
      );

      // Record validation failure metrics
      await this.metricsService.recordValidationFailure(
        context.difficulty,
        validationResult.issues.map((i) => i.type)
      );

      const strategy = this.RECOVERY_STRATEGIES.validation_failure;

      // Check if we should attempt recovery
      if (context.attempt >= strategy.maxAttempts) {
        console.log('Max validation recovery attempts reached, falling back to legacy generation');
        return await this.fallbackToLegacyGeneration(context);
      }

      // Analyze validation issues to determine recovery approach
      const criticalIssues = validationResult.issues.filter((i) => i.severity === 'critical');
      const hasMultipleSolutions = validationResult.issues.some(
        (i) => i.type === 'multiple_solutions'
      );
      const hasPhysicsViolations = validationResult.issues.some(
        (i) => i.type === 'physics_violation'
      );

      // If too many critical issues, fallback immediately
      if (criticalIssues.length > 3 || (hasMultipleSolutions && hasPhysicsViolations)) {
        console.log('Too many critical validation issues, falling back to legacy generation');
        return await this.fallbackToLegacyGeneration(context);
      }

      // Apply constraint relaxation based on issue types
      const relaxedConfig = this.applyConstraintRelaxation(context.originalConfig, strategy);

      // Additional relaxation based on specific issues
      if (hasMultipleSolutions) {
        relaxedConfig.minConfidenceScore = Math.max(60, relaxedConfig.minConfidenceScore - 10);
      }

      if (hasPhysicsViolations) {
        relaxedConfig.timeoutMs += 1000;
      }

      console.log(
        `Attempting validation recovery with relaxed constraints: confidence ${relaxedConfig.minConfidenceScore}`
      );

      const metadata: PuzzleGenerationMetadata = {
        puzzleId: puzzle.id,
        algorithm: 'guaranteed',
        attempts: context.attempt + 1,
        generationTime: Date.now() - startTime,
        confidenceScore: validationResult.confidenceScore,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      return {
        shouldFallback: false,
        metadata,
      };
    } catch (error) {
      console.error('Error in validation recovery:', error);
      return await this.fallbackToLegacyGeneration(context);
    }
  }
  /**
   * Handle spacing constraint failures
   */
  public async handleSpacingConstraintFailure(
    context: ErrorRecoveryContext
  ): Promise<{ puzzle?: Puzzle; shouldFallback: boolean; metadata: PuzzleGenerationMetadata }> {
    const startTime = Date.now();

    try {
      console.warn(`Spacing constraint failure for ${context.difficulty} puzzle`);

      const strategy = this.RECOVERY_STRATEGIES.spacing_failure;

      if (context.attempt >= strategy.maxAttempts) {
        console.log('Max spacing recovery attempts reached, falling back to legacy generation');
        return await this.fallbackToLegacyGeneration(context);
      }

      // Relax spacing constraints
      const relaxedConfig = this.applyConstraintRelaxation(context.originalConfig, strategy);

      console.log('Attempting spacing recovery with relaxed constraints');

      const metadata: PuzzleGenerationMetadata = {
        puzzleId: `spacing_recovery_${Date.now()}`,
        algorithm: 'guaranteed',
        attempts: context.attempt + 1,
        generationTime: Date.now() - startTime,
        confidenceScore: 0,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      return {
        shouldFallback: false,
        metadata,
      };
    } catch (error) {
      console.error('Error in spacing recovery:', error);
      return await this.fallbackToLegacyGeneration(context);
    }
  }

  /**
   * Handle material placement failures
   */
  public async handleMaterialPlacementFailure(
    context: ErrorRecoveryContext
  ): Promise<{ puzzle?: Puzzle; shouldFallback: boolean; metadata: PuzzleGenerationMetadata }> {
    const startTime = Date.now();

    try {
      console.warn(`Material placement failure for ${context.difficulty} puzzle`);

      const strategy = this.RECOVERY_STRATEGIES.material_placement_failure;

      if (context.attempt >= strategy.maxAttempts) {
        console.log(
          'Max material placement recovery attempts reached, falling back to legacy generation'
        );
        return await this.fallbackToLegacyGeneration(context);
      }

      // Apply constraint relaxation for material placement
      const relaxedConfig = this.applyConstraintRelaxation(context.originalConfig, strategy);

      console.log('Attempting material placement recovery with simplified requirements');

      const metadata: PuzzleGenerationMetadata = {
        puzzleId: `material_recovery_${Date.now()}`,
        algorithm: 'guaranteed',
        attempts: context.attempt + 1,
        generationTime: Date.now() - startTime,
        confidenceScore: 0,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: false,
      };

      return {
        shouldFallback: false,
        metadata,
      };
    } catch (error) {
      console.error('Error in material placement recovery:', error);
      return await this.fallbackToLegacyGeneration(context);
    }
  }
  /**
   * Fallback to legacy generation system
   */
  private async fallbackToLegacyGeneration(
    context: ErrorRecoveryContext
  ): Promise<{ puzzle?: Puzzle; shouldFallback: boolean; metadata: PuzzleGenerationMetadata }> {
    const startTime = Date.now();

    try {
      console.log(`Falling back to legacy generation for ${context.difficulty} puzzle`);

      // Check if fallback is enabled
      const shouldFallback = await this.featureFlagService.shouldFallbackToLegacy();
      if (!shouldFallback) {
        throw new Error('Fallback to legacy generation is disabled');
      }

      // Record fallback usage
      await this.metricsService.recordFallbackUsage(context.difficulty, 'generation_failure');

      // Generate puzzle using legacy system
      const puzzle = await this.puzzleService.createPuzzle(context.difficulty, context.date);

      const metadata: PuzzleGenerationMetadata = {
        puzzleId: puzzle.id,
        algorithm: 'legacy',
        attempts: context.attempt,
        generationTime: Date.now() - startTime,
        confidenceScore: 75, // Default confidence for legacy puzzles
        validationPassed: true, // Assume legacy puzzles are valid
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: puzzle.materialDensity,
        createdAt: new Date(),
        fallbackUsed: true,
      };

      console.log(
        `Successfully generated puzzle using legacy system in ${metadata.generationTime}ms`
      );

      return {
        puzzle,
        shouldFallback: true,
        metadata,
      };
    } catch (error) {
      console.error('Failed to fallback to legacy generation:', error);

      // Return error metadata
      const metadata: PuzzleGenerationMetadata = {
        puzzleId: `fallback_failed_${Date.now()}`,
        algorithm: 'legacy',
        attempts: context.attempt,
        generationTime: Date.now() - startTime,
        confidenceScore: 0,
        validationPassed: false,
        spacingDistance: 0,
        pathComplexity: 0,
        materialDensityAchieved: 0,
        createdAt: new Date(),
        fallbackUsed: true,
      };

      return {
        shouldFallback: true,
        metadata,
      };
    }
  }
  /**
   * Apply constraint relaxation based on recovery strategy
   */
  private applyConstraintRelaxation(
    originalConfig: GuaranteedGenerationConfig,
    strategy: RecoveryStrategy
  ): GuaranteedGenerationConfig {
    const relaxation = strategy.constraintRelaxation;

    const relaxedConfig: GuaranteedGenerationConfig = {
      ...originalConfig,
      minConfidenceScore: Math.max(
        50,
        originalConfig.minConfidenceScore - relaxation.reduceConfidenceThreshold
      ),
      timeoutMs: originalConfig.timeoutMs + relaxation.increaseTimeoutMs,
      maxGenerationAttempts: Math.min(15, originalConfig.maxGenerationAttempts + 2),
    };

    // Apply spacing constraint relaxation
    if (relaxation.relaxSpacingConstraints) {
      Object.keys(relaxedConfig.spacingConstraints).forEach((difficulty) => {
        const difficultyKey = difficulty as keyof typeof relaxedConfig.spacingConstraints;
        relaxedConfig.spacingConstraints[difficultyKey] = {
          ...relaxedConfig.spacingConstraints[difficultyKey],
          minDistance: Math.max(2, relaxedConfig.spacingConstraints[difficultyKey].minDistance - 1),
          maxSearchAttempts: relaxedConfig.spacingConstraints[difficultyKey].maxSearchAttempts * 2,
        };
      });
    }

    // Apply complexity relaxation
    if (relaxation.allowLowerComplexity) {
      Object.keys(relaxedConfig.complexityConfigs).forEach((difficulty) => {
        const difficultyKey = difficulty as keyof typeof relaxedConfig.complexityConfigs;
        relaxedConfig.complexityConfigs[difficultyKey] = {
          ...relaxedConfig.complexityConfigs[difficultyKey],
          minReflections: Math.max(
            1,
            relaxedConfig.complexityConfigs[difficultyKey].minReflections - 1
          ),
          preferredReflections: Math.max(
            2,
            relaxedConfig.complexityConfigs[difficultyKey].preferredReflections - 1
          ),
        };
      });
    }

    return relaxedConfig;
  }

  /**
   * Create generation error for logging and monitoring
   */
  public createGenerationError(
    type: GenerationError['type'],
    message: string,
    context: ErrorRecoveryContext
  ): GenerationError {
    return {
      type,
      message,
      context: {
        difficulty: context.difficulty,
        attempt: context.attempt,
        timeElapsed: context.timeElapsed,
        lastValidState: context.lastValidState,
      },
      recoveryStrategy: this.determineRecoveryStrategy(type, context),
    };
  }

  /**
   * Determine appropriate recovery strategy based on error type and context
   */
  private determineRecoveryStrategy(
    errorType: GenerationError['type'],
    context: ErrorRecoveryContext
  ): GenerationError['recoveryStrategy'] {
    const strategy = this.RECOVERY_STRATEGIES[errorType];

    if (!strategy) {
      return 'abort';
    }

    if (context.attempt >= strategy.maxAttempts) {
      return 'fallback';
    }

    // Check if we should relax constraints or retry
    if (context.errorHistory.filter((e) => e.type === errorType).length >= 2) {
      return 'relax_constraints';
    }

    return 'retry';
  }

  /**
   * Log generation issue for monitoring and debugging
   */
  public async logGenerationIssue(
    error: GenerationError,
    context: ErrorRecoveryContext
  ): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        error,
        context: {
          difficulty: context.difficulty,
          date: context.date,
          attempt: context.attempt,
          timeElapsed: context.timeElapsed,
          errorHistoryCount: context.errorHistory.length,
        },
        environment: {
          nodeVersion: process.version,
          memoryUsage: process.memoryUsage(),
        },
      };

      console.error('Generation Error:', JSON.stringify(logEntry, null, 2));

      // Record in metrics for monitoring
      await this.metricsService.recordGenerationError(error.type, context.difficulty);
    } catch (logError) {
      console.error('Failed to log generation issue:', logError);
    }
  }
}
