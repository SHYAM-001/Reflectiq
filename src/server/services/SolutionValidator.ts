/**
 * Solution Validation Engine for ReflectIQ
 * Implements comprehensive solution validation with physics simulation capabilities
 * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import {
  GridPosition,
  Material,
  MaterialType,
  Difficulty,
  LaserPath,
  Puzzle,
} from '../../shared/types/puzzle.js';

import {
  ValidationResult,
  ValidationIssue,
  AlternativePath,
  PhysicsValidation,
  MaterialInteractionResult,
} from '../../shared/types/guaranteed-generation.js';

import { performanceOptimization } from './PerformanceOptimizationService.js';

import { DIFFICULTY_CONFIGS, MATERIAL_PROPERTIES } from '../../shared/physics/constants.js';
import {
  isWithinBounds,
  getAllExitPositions,
  positionsEqual,
  getManhattanDistance,
  positionToKey,
} from '../../shared/physics/grid.js';

/**
 * Comprehensive solution validation engine for guaranteed puzzle generation
 */
export class SolutionValidator {
  private static instance: SolutionValidator;

  public static getInstance(): SolutionValidator {
    if (!SolutionValidator.instance) {
      SolutionValidator.instance = new SolutionValidator();
    }
    return SolutionValidator.instance;
  }

  /**
   * Verify that a puzzle has exactly one unique solution
   * Uses intelligent caching for performance optimization
   * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 4.5
   */
  public async verifyUniqueSolution(puzzle: Puzzle): Promise<ValidationResult> {
    // Use performance optimization caching
    return await performanceOptimization.getOptimizedValidationResult(puzzle, () =>
      this.performValidation(puzzle)
    );
  }

  /**
   * Perform validation without caching (internal method)
   */
  private async performValidation(puzzle: Puzzle): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: ValidationIssue[] = [];

    try {
      // Import ReflectionEngine dynamically to avoid circular dependencies
      const { ReflectionEngine } = await import('../../shared/puzzle/ReflectionEngine.js');
      const reflectionEngine = ReflectionEngine.getInstance();

      // Trace the primary solution path
      const primaryPath = reflectionEngine.traceLaserPath(
        puzzle.materials,
        puzzle.entry,
        puzzle.gridSize
      );

      if (!primaryPath) {
        issues.push({
          type: 'no_solution',
          description: 'Failed to trace laser path from entry point',
          affectedPositions: [puzzle.entry],
          severity: 'critical',
          suggestedFix: 'Check material placement and entry point validity',
        });

        return this.createValidationResult(false, 0, issues, startTime);
      }

      // Check if primary path reaches the expected solution
      const reachesExpectedSolution =
        primaryPath.exit !== null && positionsEqual(primaryPath.exit, puzzle.solution);

      if (!reachesExpectedSolution) {
        issues.push({
          type: 'no_solution',
          description: `Primary path does not reach expected solution. Expected: [${puzzle.solution}], Actual: ${primaryPath.exit}`,
          affectedPositions: [puzzle.solution, ...(primaryPath.exit ? [primaryPath.exit] : [])],
          severity: 'critical',
          suggestedFix: 'Adjust material placement to guide laser to correct exit',
        });

        return this.createValidationResult(false, 0, issues, startTime, primaryPath);
      }

      // Check for alternative solution paths
      const alternativePaths = await this.checkAlternativePaths(puzzle);

      if (alternativePaths.length > 0) {
        issues.push({
          type: 'multiple_solutions',
          description: `Found ${alternativePaths.length} alternative solution paths`,
          affectedPositions: alternativePaths.flatMap((alt) =>
            alt.path.exit ? [alt.path.exit] : []
          ),
          severity: 'critical',
          suggestedFix: 'Add materials to block alternative paths or adjust existing materials',
        });
      }

      // Validate physics compliance
      const physicsValidation = await this.validatePhysicsCompliance(puzzle);

      if (!physicsValidation.valid) {
        issues.push({
          type: 'physics_violation',
          description: 'Physics validation failed',
          affectedPositions: physicsValidation.materialInteractions
            .filter((interaction) => !interaction.compliant)
            .map((interaction) => interaction.material.position),
          severity: 'critical',
          suggestedFix: 'Review material angles and positions for physics compliance',
        });
      }

      // Check for infinite loops
      const hasInfiniteLoop = this.detectInfiniteLoop(primaryPath);
      if (hasInfiniteLoop) {
        issues.push({
          type: 'infinite_loop',
          description: 'Detected potential infinite reflection loop',
          affectedPositions: this.getLoopPositions(primaryPath),
          severity: 'critical',
          suggestedFix: 'Add absorber materials or adjust reflection angles to break loops',
        });
      }

      // Generate confidence score
      const confidenceScore = this.generateConfidenceScore(
        puzzle,
        primaryPath,
        alternativePaths,
        physicsValidation
      );

      const isValid = issues.filter((issue) => issue.severity === 'critical').length === 0;
      const hasUniqueSolution = alternativePaths.length === 0 && reachesExpectedSolution;

      return {
        isValid,
        hasUniqueSolution,
        alternativeCount: alternativePaths.length,
        physicsCompliant: physicsValidation.valid,
        confidenceScore,
        issues,
        solutionPath: primaryPath,
        validationTime: Date.now() - startTime,
      };
    } catch (error) {
      issues.push({
        type: 'physics_violation',
        description: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        affectedPositions: [],
        severity: 'critical',
        suggestedFix: 'Check puzzle structure and material configuration',
      });

      return this.createValidationResult(false, 0, issues, startTime);
    }
  }

  /**
   * Check for alternative solution paths by testing different entry angles and positions
   * Requirements: 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 4.5
   */
  public async checkAlternativePaths(puzzle: Puzzle): Promise<AlternativePath[]> {
    const alternativePaths: AlternativePath[] = [];

    try {
      const { ReflectionEngine } = await import('../../shared/puzzle/ReflectionEngine.js');
      const reflectionEngine = ReflectionEngine.getInstance();

      // Test different entry angles from the same entry point
      const testAngles = [0, 45, 90, 135, 180, 225, 270, 315]; // 8 directions

      for (const angle of testAngles) {
        if (angle === 0) continue; // Skip default angle (already tested)

        const alternativePath = reflectionEngine.traceLaserPath(
          puzzle.materials,
          puzzle.entry,
          puzzle.gridSize,
          angle
        );

        if (
          alternativePath &&
          alternativePath.exit &&
          !positionsEqual(alternativePath.exit, puzzle.solution) &&
          this.isValidExitPoint(alternativePath.exit, puzzle.gridSize)
        ) {
          const confidence = this.calculateAlternativePathConfidence(alternativePath, puzzle);
          const differenceFromPrimary = this.calculatePathDifference(
            alternativePath,
            puzzle.solutionPath
          );

          alternativePaths.push({
            path: alternativePath,
            confidence,
            differenceFromPrimary,
          });
        }
      }

      // Test alternative entry points (if materials create multiple valid paths)
      const allExitPositions = getAllExitPositions(puzzle.gridSize);

      for (const entryPoint of allExitPositions) {
        if (positionsEqual(entryPoint, puzzle.entry)) continue; // Skip original entry

        const alternativePath = reflectionEngine.traceLaserPath(
          puzzle.materials,
          entryPoint,
          puzzle.gridSize
        );

        if (
          alternativePath &&
          alternativePath.exit &&
          positionsEqual(alternativePath.exit, puzzle.solution)
        ) {
          const confidence = this.calculateAlternativePathConfidence(alternativePath, puzzle);
          const differenceFromPrimary = this.calculatePathDifference(
            alternativePath,
            puzzle.solutionPath
          );

          alternativePaths.push({
            path: alternativePath,
            confidence,
            differenceFromPrimary,
          });
        }
      }

      // Remove duplicates and low-confidence alternatives
      return this.filterAndRankAlternatives(alternativePaths);
    } catch (error) {
      // Return empty array if alternative path checking fails
      return [];
    }
  }

  /**
   * Validate physics compliance for all material interactions
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  public async validatePhysicsCompliance(puzzle: Puzzle): Promise<PhysicsValidation> {
    try {
      const { ReflectionEngine } = await import('../../shared/puzzle/ReflectionEngine.js');
      const reflectionEngine = ReflectionEngine.getInstance();

      // Trace the laser path
      const laserPath = reflectionEngine.traceLaserPath(
        puzzle.materials,
        puzzle.entry,
        puzzle.gridSize
      );

      if (!laserPath) {
        return {
          valid: false,
          materialInteractions: [],
          reflectionAccuracy: 0,
          pathContinuity: false,
          terminationCorrect: false,
          errors: ['Failed to trace laser path'],
          warnings: [],
        };
      }

      // Validate material interactions
      const materialInteractions = this.validateMaterialInteractions(laserPath, puzzle.materials);

      // Calculate reflection accuracy
      const reflectionAccuracy = this.calculateReflectionAccuracy(materialInteractions);

      // Check path continuity
      const pathContinuity = this.validatePathContinuity(laserPath);

      // Check termination correctness
      const terminationCorrect =
        laserPath.exit !== null && positionsEqual(laserPath.exit, puzzle.solution);

      const errors: string[] = [];
      const warnings: string[] = [];

      if (!terminationCorrect) {
        errors.push(
          `Path does not reach expected exit. Expected: [${puzzle.solution}], Actual: ${laserPath.exit}`
        );
      }

      if (reflectionAccuracy < 0.9) {
        warnings.push(`Low reflection accuracy: ${(reflectionAccuracy * 100).toFixed(1)}%`);
      }

      if (!pathContinuity) {
        errors.push('Path has continuity issues');
      }

      // Check for physics violations in material interactions
      const violatingInteractions = materialInteractions.filter(
        (interaction) => !interaction.compliant
      );
      if (violatingInteractions.length > 0) {
        errors.push(`${violatingInteractions.length} material interactions violate physics rules`);
      }

      return {
        valid: errors.length === 0,
        materialInteractions,
        reflectionAccuracy,
        pathContinuity,
        terminationCorrect,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        valid: false,
        materialInteractions: [],
        reflectionAccuracy: 0,
        pathContinuity: false,
        terminationCorrect: false,
        errors: [
          `Physics validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
      };
    }
  }

  /**
   * Generate confidence score rating puzzle quality (0-100)
   * Requirements: 1.1, 1.4, 4.1, 4.5
   */
  public generateConfidenceScore(
    puzzle: Puzzle,
    primaryPath?: LaserPath,
    alternativePaths?: AlternativePath[],
    physicsValidation?: PhysicsValidation
  ): number {
    let score = 100; // Start with perfect score

    // Deduct points for critical issues
    if (!primaryPath || !primaryPath.exit) {
      score -= 50; // Major deduction for no path
    } else if (!positionsEqual(primaryPath.exit, puzzle.solution)) {
      score -= 30; // Deduction for wrong solution
    }

    if (alternativePaths && alternativePaths.length > 0) {
      score -= Math.min(30, alternativePaths.length * 10); // Deduct for alternative solutions
    }

    if (physicsValidation && !physicsValidation.valid) {
      score -= 20; // Deduct for physics violations
    }

    if (physicsValidation && physicsValidation.reflectionAccuracy < 0.9) {
      score -= Math.floor((0.9 - physicsValidation.reflectionAccuracy) * 100); // Deduct for poor accuracy
    }

    // Bonus points for good characteristics
    if (primaryPath && this.hasGoodPathComplexity(primaryPath, puzzle.difficulty)) {
      score += 5; // Bonus for appropriate complexity
    }

    if (this.hasGoodMaterialDistribution(puzzle)) {
      score += 5; // Bonus for good material distribution
    }

    if (this.hasStrategicEntryExitPlacement(puzzle)) {
      score += 5; // Bonus for strategic placement
    }

    // Additional bonus for having a valid solution path
    if (primaryPath && primaryPath.exit && positionsEqual(primaryPath.exit, puzzle.solution)) {
      score += 10; // Bonus for correct solution
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, score));
  }

  // Private helper methods

  private createValidationResult(
    isValid: boolean,
    alternativeCount: number,
    issues: ValidationIssue[],
    startTime: number,
    solutionPath?: LaserPath
  ): ValidationResult {
    return {
      isValid,
      hasUniqueSolution: isValid && alternativeCount === 0,
      alternativeCount,
      physicsCompliant: isValid,
      confidenceScore: isValid ? 85 : 0, // Default confidence scores
      issues,
      solutionPath,
      validationTime: Date.now() - startTime,
    };
  }

  private detectInfiniteLoop(laserPath: LaserPath): boolean {
    if (!laserPath || laserPath.segments.length === 0) return false;

    // Check for repeated position patterns that might indicate loops
    const positionHistory = new Set<string>();
    const maxReasonableSegments = 100; // Reasonable upper bound for path segments

    for (const segment of laserPath.segments) {
      const posKey = positionToKey(segment.start);

      if (positionHistory.has(posKey)) {
        return true; // Found repeated position
      }

      positionHistory.add(posKey);
    }

    // Also check if path is unreasonably long
    return laserPath.segments.length > maxReasonableSegments;
  }

  private getLoopPositions(laserPath: LaserPath): GridPosition[] {
    if (!laserPath || laserPath.segments.length === 0) return [];

    const positions: GridPosition[] = [];
    const positionCounts = new Map<string, number>();

    // Count position occurrences
    for (const segment of laserPath.segments) {
      const posKey = positionToKey(segment.start);
      positionCounts.set(posKey, (positionCounts.get(posKey) || 0) + 1);
    }

    // Return positions that appear multiple times
    for (const [posKey, count] of positionCounts.entries()) {
      if (count > 1) {
        const [x, y] = posKey.split(',').map(Number);
        positions.push([x, y]);
      }
    }

    return positions;
  }

  private isValidExitPoint(position: GridPosition, gridSize: number): boolean {
    return (
      isWithinBounds(position, gridSize) &&
      (position[0] === 0 ||
        position[0] === gridSize - 1 ||
        position[1] === 0 ||
        position[1] === gridSize - 1)
    );
  }

  private calculateAlternativePathConfidence(alternativePath: LaserPath, puzzle: Puzzle): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence if path is significantly different
    if (alternativePath.segments.length !== puzzle.solutionPath.segments.length) {
      confidence += 0.2;
    }

    // Higher confidence if it uses different materials
    const altMaterials = new Set(
      alternativePath.segments.filter((seg) => seg.material).map((seg) => seg.material!.type)
    );

    const primaryMaterials = new Set(
      puzzle.solutionPath.segments.filter((seg) => seg.material).map((seg) => seg.material!.type)
    );

    const materialOverlap = [...altMaterials].filter((mat) => primaryMaterials.has(mat)).length;
    const totalUniqueMaterials = altMaterials.size + primaryMaterials.size - materialOverlap;

    if (totalUniqueMaterials > materialOverlap) {
      confidence += 0.2;
    }

    return Math.min(1.0, confidence);
  }

  private calculatePathDifference(alternativePath: LaserPath, primaryPath: LaserPath): number {
    // Simple difference calculation based on path length and material usage
    const lengthDiff = Math.abs(alternativePath.segments.length - primaryPath.segments.length);
    const maxLength = Math.max(alternativePath.segments.length, primaryPath.segments.length);

    return maxLength > 0 ? lengthDiff / maxLength : 0;
  }

  private filterAndRankAlternatives(alternatives: AlternativePath[]): AlternativePath[] {
    // Filter out low-confidence alternatives
    const filtered = alternatives.filter((alt) => alt.confidence > 0.3);

    // Sort by confidence (highest first)
    filtered.sort((a, b) => b.confidence - a.confidence);

    // Return top 5 alternatives to avoid overwhelming results
    return filtered.slice(0, 5);
  }

  private validateMaterialInteractions(
    laserPath: LaserPath,
    materials: Material[]
  ): MaterialInteractionResult[] {
    const interactions: MaterialInteractionResult[] = [];
    const materialMap = new Map<string, Material>();

    // Create position-to-material mapping
    materials.forEach((material) => {
      materialMap.set(positionToKey(material.position), material);
    });

    // Check each path segment for material interactions
    for (let i = 0; i < laserPath.segments.length; i++) {
      const segment = laserPath.segments[i];

      if (segment.material) {
        const material = segment.material;
        const incidentAngle = segment.direction;

        // Calculate expected reflection based on material properties
        const expectedReflection = this.calculateExpectedReflection(incidentAngle, material);

        // Find the next segment to get actual reflection
        const nextSegment = laserPath.segments[i + 1];
        const actualReflection = nextSegment ? nextSegment.direction : incidentAngle;

        // Calculate accuracy
        const angleDifference = Math.abs(
          this.normalizeAngle(expectedReflection - actualReflection)
        );
        const accuracyScore = Math.max(0, 1 - angleDifference / 180); // 0-1 scale

        interactions.push({
          material,
          incidentAngle,
          expectedReflection,
          actualReflection,
          accuracyScore,
          compliant: accuracyScore > 0.9, // 90% accuracy threshold
        });
      }
    }

    return interactions;
  }

  private calculateExpectedReflection(incidentAngle: number, material: Material): number {
    switch (material.type) {
      case 'mirror':
        // Mirror reflection: angle of incidence equals angle of reflection
        const mirrorAngle = material.angle || 0;
        const surfaceNormal = mirrorAngle + 90; // Normal is perpendicular to mirror surface
        return this.calculateReflectionAngle(incidentAngle, surfaceNormal);

      case 'metal':
        // Metal reverses direction
        return this.normalizeAngle(incidentAngle + 180);

      case 'water':
        // Water has some diffusion but generally reflects
        const baseReflection = this.calculateReflectionAngle(incidentAngle, 0);
        // Add small random variation for diffusion (simplified)
        const diffusionVariation = (Math.random() - 0.5) * 30; // ±15 degrees
        return this.normalizeAngle(baseReflection + diffusionVariation);

      case 'glass':
        // Glass can reflect or pass through - for validation, assume reflection
        return this.calculateReflectionAngle(incidentAngle, 0);

      case 'absorber':
        // Absorber stops the beam - no reflection
        return incidentAngle; // Beam terminates

      default:
        return incidentAngle;
    }
  }

  private calculateReflectionAngle(incidentAngle: number, surfaceNormal: number): number {
    const normalizedIncident = this.normalizeAngle(incidentAngle);
    const normalizedNormal = this.normalizeAngle(surfaceNormal);

    // Angle of incidence equals angle of reflection
    const angleOfIncidence = normalizedIncident - normalizedNormal;
    const angleOfReflection = -angleOfIncidence;

    return this.normalizeAngle(normalizedNormal + angleOfReflection);
  }

  private normalizeAngle(angle: number): number {
    while (angle < 0) {
      angle += 360;
    }
    while (angle >= 360) {
      angle -= 360;
    }
    return angle;
  }

  private calculateReflectionAccuracy(interactions: MaterialInteractionResult[]): number {
    if (interactions.length === 0) return 1.0;

    const totalAccuracy = interactions.reduce(
      (sum, interaction) => sum + interaction.accuracyScore,
      0
    );
    return totalAccuracy / interactions.length;
  }

  private validatePathContinuity(laserPath: LaserPath): boolean {
    if (laserPath.segments.length === 0) return false;

    // Check that each segment connects to the next
    for (let i = 0; i < laserPath.segments.length - 1; i++) {
      const currentSegment = laserPath.segments[i];
      const nextSegment = laserPath.segments[i + 1];

      // End of current segment should match start of next segment
      if (!positionsEqual(currentSegment.end, nextSegment.start)) {
        return false;
      }
    }

    return true;
  }

  private hasGoodPathComplexity(laserPath: LaserPath, difficulty: Difficulty): boolean {
    const reflectionCount = laserPath.segments.filter((seg) => seg.material).length;

    const complexityRanges = {
      Easy: { min: 2, max: 4 },
      Medium: { min: 3, max: 6 },
      Hard: { min: 4, max: 8 },
    };

    const range = complexityRanges[difficulty];
    return reflectionCount >= range.min && reflectionCount <= range.max;
  }

  private hasGoodMaterialDistribution(puzzle: Puzzle): boolean {
    const config = DIFFICULTY_CONFIGS[puzzle.difficulty];
    const actualDensity = puzzle.materials.length / (puzzle.gridSize * puzzle.gridSize);
    const targetDensity = config.materialDensity;

    // Allow 10% variance from target density
    return Math.abs(actualDensity - targetDensity) <= 0.1;
  }

  private hasStrategicEntryExitPlacement(puzzle: Puzzle): boolean {
    // Check if entry and exit are on different sides or corners
    const entryIsCorner = this.isCornerPosition(puzzle.entry, puzzle.gridSize);
    const exitIsCorner = this.isCornerPosition(puzzle.solution, puzzle.gridSize);

    // Prefer corner positions or positions on different sides
    const distance = getManhattanDistance(puzzle.entry, puzzle.solution);
    const minDistance = DIFFICULTY_CONFIGS[puzzle.difficulty].gridSize / 2;

    return (entryIsCorner || exitIsCorner) && distance >= minDistance;
  }

  private isCornerPosition(position: GridPosition, gridSize: number): boolean {
    const [x, y] = position;
    return (x === 0 || x === gridSize - 1) && (y === 0 || y === gridSize - 1);
  }
}
