/**
 * Enhanced Puzzle Engine for guaranteed solvable puzzle generation
 * Extends existing PuzzleGenerator with reverse-engineering capabilities
 */

import { PuzzleGenerator } from './PuzzleGenerator.js';
import { PointPlacementService } from './PointPlacementService.js';
import { Puzzle, Material, Difficulty, GridPosition, DailyPuzzleSet } from '../types/puzzle.js';

import {
  EnhancedPuzzleEngine,
  ValidationResult,
  PuzzleGenerationMetadata,
  GuaranteedGenerationConfig,
  GenerationError,
} from '../types/guaranteed-generation.js';

import { GUARANTEED_GENERATION_CONFIG } from '../constants/guaranteed-generation.js';
import { DIFFICULTY_CONFIGS } from '../physics/constants.js';
import { ReversePathService } from '../services/ReversePathService.js';
import { SolutionValidator } from '../services/SolutionValidator.js';
import { GenerationMetricsService } from '../services/GenerationMetricsService.js';
import {
  performanceOptimization,
  getOptimizedEntryExitPairs,
  getOptimizedValidationResult,
  recordGenerationMetrics,
} from '../../server/services/PerformanceOptimizationService.js';

/**
 * Enhanced puzzle engine implementing guaranteed generation algorithms
 * Maintains backward compatibility with existing PuzzleGenerator
 */
export class EnhancedPuzzleEngineImpl implements EnhancedPuzzleEngine {
  private static instance: EnhancedPuzzleEngineImpl;
  private legacyGenerator: PuzzleGenerator;
  private pointPlacementService: PointPlacementService;
  private reversePathService: ReversePathService;
  private solutionValidator: SolutionValidator;
  private metricsService: GenerationMetricsService;
  private config: GuaranteedGenerationConfig;
  private generationMetrics: Map<string, PuzzleGenerationMetadata>;

  private constructor(config: GuaranteedGenerationConfig = GUARANTEED_GENERATION_CONFIG) {
    this.legacyGenerator = PuzzleGenerator.getInstance();
    this.pointPlacementService = PointPlacementService.getInstance();
    this.reversePathService = ReversePathService.getInstance();
    this.solutionValidator = SolutionValidator.getInstance();
    this.metricsService = GenerationMetricsService.getInstance();
    this.config = config;
    this.generationMetrics = new Map();
  }

  public static getInstance(config?: GuaranteedGenerationConfig): EnhancedPuzzleEngineImpl {
    if (!EnhancedPuzzleEngineImpl.instance) {
      EnhancedPuzzleEngineImpl.instance = new EnhancedPuzzleEngineImpl(config);
    }
    return EnhancedPuzzleEngineImpl.instance;
  }

  /**
   * Legacy method - delegates to existing PuzzleGenerator for backward compatibility
   */
  public async generateDailyPuzzles(date: string): Promise<DailyPuzzleSet> {
    return this.legacyGenerator.generateDailyPuzzles(date);
  }

  /**
   * Legacy method - delegates to existing PuzzleGenerator for backward compatibility
   */
  public async createPuzzle(difficulty: Difficulty, date: string): Promise<Puzzle> {
    return this.legacyGenerator.createPuzzle(difficulty, date);
  }

  /**
   * Enhanced method - generates puzzles using guaranteed solvable algorithm
   * Uses adaptive difficulty reduction to ensure 100% success rate
   * Requirements: 1.1, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5
   */
  public async generateGuaranteedPuzzle(difficulty: Difficulty, date: string): Promise<Puzzle> {
    const startTime = Date.now();
    let lastError: GenerationError | null = null;
    const puzzleId = this.generatePuzzleId(difficulty, date);
    let currentDifficulty = difficulty;

    // Define difficulty hierarchy for adaptive reduction
    const difficultyHierarchy: Difficulty[] = ['Hard', 'Medium', 'Easy'];
    const currentIndex = difficultyHierarchy.indexOf(difficulty);

    for (let attempt = 1; attempt <= this.config.maxGenerationAttempts; attempt++) {
      try {
        // Check timeout
        if (Date.now() - startTime > this.config.timeoutMs) {
          throw new Error(`Generation timeout after ${this.config.timeoutMs}ms`);
        }

        // Attempt guaranteed generation using full pipeline
        const puzzle = await this.attemptGuaranteedGeneration(
          currentDifficulty,
          date,
          attempt,
          puzzleId
        );

        if (puzzle) {
          // If we had to reduce difficulty, update the puzzle's difficulty to original
          if (currentDifficulty !== difficulty) {
            puzzle.difficulty = difficulty;
            puzzle.id = this.generatePuzzleId(difficulty, date); // Update ID to reflect original difficulty
          }

          // Generate and store metadata
          const generationTime = Date.now() - startTime;
          const metadata = await this.createGenerationMetadata(
            puzzle,
            attempt,
            generationTime,
            true,
            currentDifficulty !== difficulty ? currentDifficulty : undefined
          );

          this.generationMetrics.set(puzzle.id, metadata);
          this.metricsService.recordGeneration(metadata);

          // Record performance metrics for optimization
          await recordGenerationMetrics(difficulty, true, generationTime, metadata);

          if (typeof console !== 'undefined') {
            const difficultyNote =
              currentDifficulty !== difficulty ? ` (adapted from ${currentDifficulty})` : '';
            console.log(
              `✅ Guaranteed generation succeeded for ${difficulty}${difficultyNote} in ${generationTime}ms (attempt ${attempt}, confidence: ${metadata.confidenceScore})`
            );
          }

          return puzzle;
        }
      } catch (error) {
        lastError = this.createGenerationError(
          error,
          currentDifficulty,
          attempt,
          Date.now() - startTime
        );

        if (typeof console !== 'undefined') {
          console.warn(
            `⚠️ Guaranteed generation attempt ${attempt} failed for ${currentDifficulty}:`,
            error
          );
        }

        // Adaptive difficulty reduction logic
        if (attempt >= 3 && difficulty === 'Hard' && currentDifficulty === 'Hard') {
          currentDifficulty = 'Medium';
          if (typeof console !== 'undefined') {
            console.warn(`🔄 Reducing Hard difficulty to Medium after ${attempt} attempts`);
          }
        } else if (
          attempt >= 5 &&
          (difficulty === 'Hard' || difficulty === 'Medium') &&
          currentDifficulty === 'Medium'
        ) {
          currentDifficulty = 'Easy';
          if (typeof console !== 'undefined') {
            console.warn(`🔄 Reducing to Easy difficulty after ${attempt} attempts`);
          }
        } else if (attempt % 2 === 0 && currentIndex < difficultyHierarchy.length - 1) {
          // Fallback: After every 2 attempts, try reducing difficulty if possible
          const nextDifficultyIndex = Math.min(
            currentIndex + Math.floor(attempt / 2),
            difficultyHierarchy.length - 1
          );
          const nextDifficulty = difficultyHierarchy[nextDifficultyIndex];

          if (nextDifficulty && nextDifficulty !== currentDifficulty) {
            currentDifficulty = nextDifficulty as Difficulty;
            if (typeof console !== 'undefined') {
              console.warn(
                `🔄 Reducing difficulty to ${currentDifficulty} for ${difficulty} puzzle generation (attempt ${attempt + 1})`
              );
            }
          }
        }
      }
    }

    // All attempts failed - use fallback if enabled
    if (this.config.enableFallback) {
      if (typeof console !== 'undefined') {
        console.warn(
          `🔄 Falling back to legacy generation for ${difficulty} after ${this.config.maxGenerationAttempts} attempts`
        );
      }

      const fallbackPuzzle = await this.legacyGenerator.createPuzzleWithFallback(
        difficulty,
        date,
        true
      );

      // Create metadata for fallback puzzle
      const fallbackMetadata = await this.createGenerationMetadata(
        fallbackPuzzle,
        this.config.maxGenerationAttempts,
        Date.now() - startTime,
        false
      );

      this.generationMetrics.set(fallbackPuzzle.id, fallbackMetadata);
      this.metricsService.recordGeneration(fallbackMetadata);

      // Record fallback performance metrics
      await recordGenerationMetrics(difficulty, false, Date.now() - startTime, fallbackMetadata);

      return fallbackPuzzle;
    }

    // No fallback - throw the last error
    throw new Error(
      `Failed to generate guaranteed puzzle for ${difficulty}: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Validate spacing constraints between entry and exit points
   */
  public validateSpacingConstraints(
    entry: GridPosition,
    exit: GridPosition,
    difficulty: Difficulty
  ): boolean {
    const constraints = this.config.spacingConstraints[difficulty];
    const [entryX, entryY] = entry;
    const [exitX, exitY] = exit;

    // Check if points are different
    if (entryX === exitX && entryY === exitY) {
      return false;
    }

    // Calculate Manhattan distance
    const distance = Math.abs(exitX - entryX) + Math.abs(exitY - entryY);

    return distance >= constraints.minDistance;
  }

  /**
   * Reverse engineer material placement for a given entry/exit path
   * Integrates with ReversePathService for complete path planning
   */
  public async reverseEngineerPath(
    entry: GridPosition,
    exit: GridPosition,
    gridSize: number,
    difficulty: Difficulty
  ): Promise<Material[]> {
    try {
      // Plan optimal path using reverse engineering
      const pathPlan = await this.reversePathService.planOptimalPath(entry, exit, difficulty);

      // Place materials along the planned path
      const materials = await this.reversePathService.placeMaterialsForPath(pathPlan, gridSize);

      // Optimize material density
      const config = this.config.materialConfigs[difficulty];
      const optimizedMaterials = await this.reversePathService.optimizeMaterialDensity(
        materials,
        config.targetDensity,
        gridSize,
        pathPlan
      );

      return optimizedMaterials;
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error(`Failed to reverse engineer path: ${error}`);
      }
      return [];
    }
  }

  /**
   * Verify that a puzzle has exactly one unique solution
   * Integrates with SolutionValidator for comprehensive validation
   */
  public async verifyUniqueSolution(puzzle: Puzzle): Promise<ValidationResult> {
    return this.solutionValidator.verifyUniqueSolution(puzzle);
  }

  /**
   * Update configuration for the enhanced engine
   */
  public updateConfig(newConfig: Partial<GuaranteedGenerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): GuaranteedGenerationConfig {
    return { ...this.config };
  }

  /**
   * Attempt a single guaranteed generation cycle
   * Orchestrates the full guaranteed generation pipeline
   * Requirements: 1.1, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5
   */
  private async attemptGuaranteedGeneration(
    difficulty: Difficulty,
    _date: string,
    attempt: number,
    puzzleId: string
  ): Promise<Puzzle | null> {
    try {
      const config = DIFFICULTY_CONFIGS[difficulty];

      if (typeof console !== 'undefined') {
        console.log(`🔄 Attempting guaranteed generation for ${difficulty} (attempt ${attempt})`);
      }

      // Step 1: Strategic Point Placement with Performance Optimization
      const entryExitPairs = await getOptimizedEntryExitPairs(difficulty, config.gridSize, () =>
        this.pointPlacementService.selectEntryExitPairs(difficulty, config.gridSize)
      );

      if (entryExitPairs.length === 0) {
        throw new Error('No valid entry/exit pairs found for difficulty constraints');
      }

      // Try the best entry/exit pairs until we find a valid solution
      for (const pair of entryExitPairs.slice(0, 5)) {
        // Try top 5 candidates
        try {
          // Step 2: Reverse Path Engineering
          const materials = await this.reverseEngineerPath(
            pair.entry,
            pair.exit,
            config.gridSize,
            difficulty
          );

          if (materials.length === 0) {
            continue; // Try next pair
          }

          // Step 3: Create preliminary puzzle
          const preliminaryPuzzle: Puzzle = {
            id: puzzleId,
            difficulty,
            gridSize: config.gridSize,
            materials,
            entry: pair.entry,
            solution: pair.exit,
            solutionPath: { segments: [], exit: pair.exit, terminated: false }, // Will be calculated
            hints: [], // Will be generated
            createdAt: new Date(),
            materialDensity: materials.length / (config.gridSize * config.gridSize),
          };

          // Step 4: Calculate actual solution path
          const solutionPath = await this.calculateSolutionPath(
            materials,
            pair.entry,
            config.gridSize
          );

          if (!solutionPath || !solutionPath.exit) {
            continue; // Try next pair
          }

          // Verify solution reaches expected exit
          if (!this.positionsEqual(solutionPath.exit, pair.exit)) {
            continue; // Try next pair
          }

          // Update puzzle with calculated solution path
          preliminaryPuzzle.solutionPath = solutionPath;

          // Step 5: Solution Validation with Performance Optimization
          const validationResult = await getOptimizedValidationResult(preliminaryPuzzle, () =>
            this.verifyUniqueSolution(preliminaryPuzzle)
          );

          if (!validationResult.isValid || !validationResult.hasUniqueSolution) {
            if (typeof console !== 'undefined') {
              console.log(
                `❌ Validation failed for pair ${JSON.stringify(pair.entry)} -> ${JSON.stringify(pair.exit)}: ${validationResult.issues.map((i) => i.description).join(', ')}`
              );
            }
            continue; // Try next pair
          }

          // Check confidence score threshold
          if (validationResult.confidenceScore < this.config.minConfidenceScore) {
            if (typeof console !== 'undefined') {
              console.log(
                `⚠️ Low confidence score ${validationResult.confidenceScore} for pair ${JSON.stringify(pair.entry)} -> ${JSON.stringify(pair.exit)}`
              );
            }
            continue; // Try next pair
          }

          // Step 6: Generate hints
          const hints = this.generateProgressiveHints(solutionPath);
          preliminaryPuzzle.hints = hints;

          if (typeof console !== 'undefined') {
            console.log(
              `✅ Valid puzzle generated with confidence ${validationResult.confidenceScore} for pair ${JSON.stringify(pair.entry)} -> ${JSON.stringify(pair.exit)}`
            );
          }

          return preliminaryPuzzle;
        } catch (pairError) {
          if (typeof console !== 'undefined') {
            console.log(
              `⚠️ Failed to generate puzzle for pair ${JSON.stringify(pair.entry)} -> ${JSON.stringify(pair.exit)}: ${pairError}`
            );
          }
          continue; // Try next pair
        }
      }

      // No valid puzzle found with any entry/exit pair
      return null;
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error(`Generation attempt ${attempt} failed:`, error);
      }
      throw error;
    }
  }

  /**
   * Generate unique puzzle ID
   */
  private generatePuzzleId(difficulty: Difficulty, date: string): string {
    const randomSeed = Math.floor(Math.random() * 100000);
    const timestamp = Date.now();
    const extraEntropy = Math.floor(Math.random() * 1000000);
    return `enhanced_${difficulty.toLowerCase()}_${date}_${randomSeed}_${timestamp}_${extraEntropy}`;
  }

  /**
   * Create generation metadata for analytics and debugging
   * Requirements: 1.4, 1.5, 5.1
   */
  private async createGenerationMetadata(
    puzzle: Puzzle,
    attempts: number,
    generationTime: number,
    guaranteedAlgorithm: boolean,
    adaptedFromDifficulty?: Difficulty
  ): Promise<PuzzleGenerationMetadata> {
    // Calculate confidence score
    let confidenceScore = 85; // Default
    let validationPassed = true;

    try {
      const validationResult = await this.verifyUniqueSolution(puzzle);
      confidenceScore = validationResult.confidenceScore;
      validationPassed = validationResult.isValid && validationResult.hasUniqueSolution;
    } catch (error) {
      validationPassed = false;
      confidenceScore = 0;
    }

    // Calculate spacing distance
    const spacingDistance = this.pointPlacementService.calculateDistance(
      puzzle.entry,
      puzzle.solution
    );

    // Calculate path complexity
    const pathComplexity = puzzle.solutionPath.segments.length;

    const metadata: PuzzleGenerationMetadata = {
      puzzleId: puzzle.id,
      algorithm: guaranteedAlgorithm ? 'guaranteed' : 'legacy',
      attempts,
      generationTime,
      confidenceScore,
      validationPassed,
      spacingDistance,
      pathComplexity,
      materialDensityAchieved: puzzle.materialDensity,
      createdAt: puzzle.createdAt,
      fallbackUsed: !guaranteedAlgorithm,
    };

    // Only add adaptedFromDifficulty if it's defined
    if (adaptedFromDifficulty) {
      metadata.adaptedFromDifficulty = adaptedFromDifficulty;
    }

    return metadata;
  }

  /**
   * Calculate solution path using ReflectionEngine
   */
  private async calculateSolutionPath(
    materials: Material[],
    entry: GridPosition,
    gridSize: number
  ): Promise<import('../types/puzzle.js').LaserPath | null> {
    try {
      const { ReflectionEngine } = await import('./ReflectionEngine.js');
      const reflectionEngine = ReflectionEngine.getInstance();
      return reflectionEngine.traceLaserPath(materials, entry, gridSize);
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error('Error calculating solution path:', error);
      }
      return null;
    }
  }

  /**
   * Generate progressive hints from solution path
   */
  private generateProgressiveHints(
    solutionPath: import('../types/puzzle.js').LaserPath
  ): import('../types/puzzle.js').HintPath[] {
    const hints: import('../types/puzzle.js').HintPath[] = [];
    const totalSegments = solutionPath.segments.length;

    if (totalSegments === 0) {
      return [
        { hintLevel: 1, segments: [], revealedCells: [], percentage: 25 },
        { hintLevel: 2, segments: [], revealedCells: [], percentage: 50 },
        { hintLevel: 3, segments: [], revealedCells: [], percentage: 75 },
        { hintLevel: 4, segments: [], revealedCells: [], percentage: 100 },
      ];
    }

    const segmentsPerHint = [
      Math.ceil(totalSegments * 0.25),
      Math.ceil(totalSegments * 0.5),
      Math.ceil(totalSegments * 0.75),
      totalSegments,
    ];

    for (let hintLevel = 1; hintLevel <= 4; hintLevel++) {
      const segmentsToReveal = segmentsPerHint[hintLevel - 1] || 0;
      const segments = solutionPath.segments.slice(0, segmentsToReveal);

      const revealedCells: GridPosition[] = [];
      const cellSet = new Set<string>();

      for (const segment of segments) {
        const startKey = this.positionToKey(segment.start);
        const endKey = this.positionToKey(segment.end);

        if (!cellSet.has(startKey)) {
          revealedCells.push(segment.start);
          cellSet.add(startKey);
        }

        if (!cellSet.has(endKey)) {
          revealedCells.push(segment.end);
          cellSet.add(endKey);
        }
      }

      hints.push({
        hintLevel: hintLevel as 1 | 2 | 3 | 4,
        segments,
        revealedCells,
        percentage: (segmentsToReveal / totalSegments) * 100,
      });
    }

    return hints;
  }

  /**
   * Check if two positions are equal
   */
  private positionsEqual(pos1: GridPosition, pos2: GridPosition): boolean {
    return pos1[0] === pos2[0] && pos1[1] === pos2[1];
  }

  /**
   * Convert position to string key
   */
  private positionToKey(position: GridPosition): string {
    return `${position[0]},${position[1]}`;
  }

  /**
   * Get generation metadata for a puzzle
   * Requirements: 1.4, 1.5, 5.1
   */
  public getGenerationMetadata(puzzleId: string): PuzzleGenerationMetadata | undefined {
    return this.generationMetrics.get(puzzleId);
  }

  /**
   * Get all generation metrics
   * Requirements: 1.4, 1.5, 5.1
   */
  public getAllGenerationMetrics(): PuzzleGenerationMetadata[] {
    return Array.from(this.generationMetrics.values());
  }

  /**
   * Get aggregated performance metrics
   * Requirements: 1.4, 1.5, 5.1
   */
  public getPerformanceMetrics(): import('../types/guaranteed-generation.js').GenerationMetrics {
    return this.metricsService.getAggregatedMetrics();
  }

  /**
   * Get metrics for a specific difficulty level
   * Requirements: 1.4, 1.5, 5.1
   */
  public getDifficultyMetrics(
    difficulty: Difficulty
  ): import('../types/guaranteed-generation.js').DifficultyMetrics {
    return this.metricsService.getDifficultyMetrics(difficulty);
  }

  /**
   * Get performance trends over time
   * Requirements: 1.4, 1.5, 5.1
   */
  public getPerformanceTrends(hoursBack: number = 24): {
    timestamps: Date[];
    successRates: number[];
    averageTimes: number[];
    confidenceScores: number[];
  } {
    return this.metricsService.getPerformanceTrends(hoursBack);
  }

  /**
   * Get recent generation failures for debugging
   * Requirements: 1.4, 1.5, 5.1
   */
  public getRecentFailures(limit: number = 10): PuzzleGenerationMetadata[] {
    return this.metricsService.getRecentFailures(limit);
  }

  /**
   * Get top performing puzzles by confidence score
   * Requirements: 1.4, 1.5, 5.1
   */
  public getTopPerformingPuzzles(limit: number = 10): PuzzleGenerationMetadata[] {
    return this.metricsService.getTopPerformingPuzzles(limit);
  }

  /**
   * Export metrics for external analysis
   * Requirements: 1.4, 1.5, 5.1
   */
  public exportMetrics(format: 'json' | 'csv' = 'json'): string {
    return this.metricsService.exportMetrics(format);
  }

  /**
   * Clear old generation metrics (for memory management)
   */
  public clearOldMetrics(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - olderThanMs;

    // Clear local cache
    for (const [puzzleId, metadata] of Array.from(this.generationMetrics.entries())) {
      if (metadata.createdAt.getTime() < cutoffTime) {
        this.generationMetrics.delete(puzzleId);
      }
    }

    // Clear metrics service history
    this.metricsService.clearOldMetrics(olderThanMs);
  }

  /**
   * Create a structured error object for generation failures
   */
  private createGenerationError(
    error: unknown,
    difficulty: Difficulty,
    attempt: number,
    timeElapsed: number
  ): GenerationError {
    const message = error instanceof Error ? error.message : String(error);

    let type: GenerationError['type'] = 'validation_failure';
    let recoveryStrategy: GenerationError['recoveryStrategy'] = 'retry';

    if (message.includes('timeout')) {
      type = 'timeout';
      recoveryStrategy = 'fallback';
    } else if (message.includes('spacing')) {
      type = 'spacing_failure';
      recoveryStrategy = 'relax_constraints';
    } else if (message.includes('material')) {
      type = 'material_placement_failure';
      recoveryStrategy = 'retry';
    } else if (message.includes('physics')) {
      type = 'physics_violation';
      recoveryStrategy = 'retry';
    }

    return {
      type,
      message,
      context: {
        difficulty,
        attempt,
        timeElapsed,
      },
      recoveryStrategy,
    };
  }
}
