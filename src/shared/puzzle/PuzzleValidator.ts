/**
 * Puzzle Validation Service for ReflectIQ
 * Validates puzzle integrity, solution uniqueness, and difficulty requirements
 */

import { Puzzle, Material, Difficulty, GridPosition, DailyPuzzleSet } from '../types/puzzle.js';

import { PhysicsValidation } from '../types/physics.js';

import { DIFFICULTY_CONFIGS } from '../physics/constants.js';

import {
  isWithinBounds,
  isBoundaryPosition,
  getAllExitPositions,
  positionsEqual,
  positionToKey,
} from '../physics/grid.js';

import { ReflectionEngine } from './ReflectionEngine.js';

export class PuzzleValidator {
  private static instance: PuzzleValidator;
  private reflectionEngine: ReflectionEngine;

  private constructor() {
    this.reflectionEngine = ReflectionEngine.getInstance();
  }

  public static getInstance(): PuzzleValidator {
    if (!PuzzleValidator.instance) {
      PuzzleValidator.instance = new PuzzleValidator();
    }
    return PuzzleValidator.instance;
  }

  /**
   * Validate a complete puzzle for correctness and difficulty requirements
   */
  public validatePuzzle(puzzle: Puzzle): PhysicsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic puzzle structure
    this.validatePuzzleStructure(puzzle, errors);

    // Validate grid constraints
    this.validateGridConstraints(puzzle, errors, warnings);

    // Validate material placement
    this.validateMaterialPlacement(puzzle, errors, warnings);

    // Validate difficulty requirements
    this.validateDifficultyRequirements(puzzle, errors, warnings);

    // Validate solution uniqueness and correctness
    const solutionValidation = this.validateSolution(puzzle);
    if (!solutionValidation.valid) {
      errors.push(...solutionValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      solutionPath: solutionValidation.solutionPath,
    };
  }

  /**
   * Validate basic puzzle structure
   */
  private validatePuzzleStructure(puzzle: Puzzle, errors: string[]): void {
    if (!puzzle.id || typeof puzzle.id !== 'string') {
      errors.push('Puzzle must have a valid ID');
    }

    if (!['Easy', 'Medium', 'Hard'].includes(puzzle.difficulty)) {
      errors.push('Puzzle difficulty must be Easy, Medium, or Hard');
    }

    if (![6, 8, 10].includes(puzzle.gridSize)) {
      errors.push('Grid size must be 6, 8, or 10');
    }

    if (!Array.isArray(puzzle.materials)) {
      errors.push('Puzzle must have a materials array');
    }

    if (!Array.isArray(puzzle.entry) || puzzle.entry.length !== 2) {
      errors.push('Puzzle must have a valid entry point [x, y]');
    }

    if (!Array.isArray(puzzle.solution) || puzzle.solution.length !== 2) {
      errors.push('Puzzle must have a valid solution point [x, y]');
    }

    if (!Array.isArray(puzzle.hints) || puzzle.hints.length !== 4) {
      errors.push('Puzzle must have exactly 4 hint paths');
    }
  }

  /**
   * Validate grid constraints and viewport optimization
   */
  private validateGridConstraints(puzzle: Puzzle, errors: string[], warnings: string[]): void {
    const { gridSize, entry, solution } = puzzle;

    // Validate entry point is on boundary
    if (!isWithinBounds(entry, gridSize)) {
      errors.push('Entry point must be within grid bounds');
    } else if (!isBoundaryPosition(entry, gridSize)) {
      errors.push('Entry point must be on grid boundary');
    }

    // Validate solution point is on boundary
    if (!isWithinBounds(solution, gridSize)) {
      errors.push('Solution point must be within grid bounds');
    } else if (!isBoundaryPosition(solution, gridSize)) {
      errors.push('Solution point must be on grid boundary');
    }

    // Validate entry and solution are different
    if (positionsEqual(entry, solution)) {
      errors.push('Entry and solution points must be different');
    }

    // Check for viewport optimization
    if (gridSize > 10) {
      warnings.push('Grid size larger than 10 may not fit in mobile viewport');
    }
  }

  /**
   * Validate material placement and density
   */
  private validateMaterialPlacement(puzzle: Puzzle, errors: string[], warnings: string[]): void {
    const { materials, gridSize, entry, solution } = puzzle;
    const occupiedPositions = new Set<string>();

    // Check each material
    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];

      // Validate material structure
      if (!material.type || !material.position || !material.properties) {
        errors.push(`Material ${i} has invalid structure`);
        continue;
      }

      // Validate position is within bounds
      if (!isWithinBounds(material.position, gridSize)) {
        errors.push(`Material ${i} position is out of bounds`);
        continue;
      }

      // Check for position conflicts
      const posKey = positionToKey(material.position);
      if (occupiedPositions.has(posKey)) {
        errors.push(`Multiple materials at position ${material.position}`);
      }
      occupiedPositions.add(posKey);

      // Check material doesn't block entry or solution
      if (positionsEqual(material.position, entry)) {
        errors.push('Material cannot be placed at entry point');
      }
      if (positionsEqual(material.position, solution)) {
        errors.push('Material cannot be placed at solution point');
      }

      // Validate material-specific properties
      this.validateMaterialProperties(material, i, errors, warnings);
    }

    // Validate material density
    this.validateMaterialDensity(puzzle, warnings);
  }

  /**
   * Validate material-specific properties
   */
  private validateMaterialProperties(
    material: Material,
    index: number,
    errors: string[],
    warnings: string[]
  ): void {
    const { type, properties, angle } = material;

    // Validate material type
    if (!['mirror', 'water', 'glass', 'metal', 'absorber'].includes(type)) {
      errors.push(`Material ${index} has invalid type: ${type}`);
    }

    // Validate mirror angle
    if (type === 'mirror') {
      if (angle === undefined || angle < 0 || angle >= 360) {
        errors.push(`Mirror material ${index} must have valid angle (0-359)`);
      }
    }

    // Validate properties
    if (properties.reflectivity < 0 || properties.reflectivity > 1) {
      errors.push(`Material ${index} reflectivity must be between 0 and 1`);
    }

    if (properties.transparency < 0 || properties.transparency > 1) {
      errors.push(`Material ${index} transparency must be between 0 and 1`);
    }

    if (properties.diffusion < 0 || properties.diffusion > 1) {
      errors.push(`Material ${index} diffusion must be between 0 and 1`);
    }
  }

  /**
   * Validate material density meets difficulty requirements
   */
  private validateMaterialDensity(puzzle: Puzzle, warnings: string[]): void {
    const config = DIFFICULTY_CONFIGS[puzzle.difficulty];
    const totalCells = puzzle.gridSize * puzzle.gridSize;
    const actualDensity = puzzle.materials.length / totalCells;
    const targetDensity = config.materialDensity;

    // Allow 10% variance from target density
    const tolerance = 0.1;
    if (Math.abs(actualDensity - targetDensity) > tolerance) {
      warnings.push(
        `Material density ${(actualDensity * 100).toFixed(1)}% differs from target ${(targetDensity * 100).toFixed(1)}%`
      );
    }
  }

  /**
   * Validate difficulty-specific requirements
   */
  private validateDifficultyRequirements(
    puzzle: Puzzle,
    errors: string[],
    warnings: string[]
  ): void {
    const config = DIFFICULTY_CONFIGS[puzzle.difficulty];

    // Validate grid size matches difficulty
    if (puzzle.gridSize !== config.gridSize) {
      errors.push(
        `${puzzle.difficulty} puzzles must have ${config.gridSize}x${config.gridSize} grid`
      );
    }

    // Validate allowed materials
    const allowedMaterials = new Set(config.allowedMaterials);
    for (const material of puzzle.materials) {
      if (!allowedMaterials.has(material.type)) {
        errors.push(
          `Material type '${material.type}' not allowed in ${puzzle.difficulty} difficulty`
        );
      }
    }

    // Check material variety for higher difficulties
    const materialTypes = new Set(puzzle.materials.map((m) => m.type));
    if (puzzle.difficulty === 'Medium' && materialTypes.size < 3) {
      warnings.push('Medium puzzles should use at least 3 different material types');
    }
    if (puzzle.difficulty === 'Hard' && materialTypes.size < 4) {
      warnings.push('Hard puzzles should use at least 4 different material types');
    }
  }

  /**
   * Validate solution uniqueness and correctness
   */
  private validateSolution(puzzle: Puzzle): {
    valid: boolean;
    errors: string[];
    solutionPath?: any;
  } {
    const errors: string[] = [];

    try {
      // Trace laser path from entry point
      const laserPath = this.reflectionEngine.traceLaserPath(
        puzzle.materials,
        puzzle.entry,
        puzzle.gridSize
      );

      const calculatedSolution = this.reflectionEngine.calculateExit(laserPath);

      // Check if solution exists
      if (!calculatedSolution) {
        errors.push('Puzzle has no solution - laser beam is absorbed or trapped');
        return { valid: false, errors };
      }

      // Check if calculated solution matches expected solution
      if (!positionsEqual(calculatedSolution, puzzle.solution)) {
        errors.push(
          `Solution mismatch: expected ${puzzle.solution}, calculated ${calculatedSolution}`
        );
        return { valid: false, errors, solutionPath: laserPath };
      }

      // Validate solution is unique by checking alternative paths
      const isUnique = this.validateSolutionUniqueness(puzzle);
      if (!isUnique) {
        errors.push('Puzzle has multiple possible solutions');
        return { valid: false, errors, solutionPath: laserPath };
      }

      return { valid: true, errors: [], solutionPath: laserPath };
    } catch (error) {
      errors.push(`Solution validation failed: ${error.message}`);
      return { valid: false, errors };
    }
  }

  /**
   * Validate that the puzzle has exactly one solution
   */
  private validateSolutionUniqueness(puzzle: Puzzle): boolean {
    // For now, assume solution is unique if it exists
    // In a more sophisticated implementation, we could:
    // 1. Try different starting angles
    // 2. Check for probabilistic materials (water, glass) multiple times
    // 3. Verify no alternative paths lead to different exits
    return true;
  }

  /**
   * Validate a complete daily puzzle set
   */
  public validateDailyPuzzleSet(puzzleSet: DailyPuzzleSet): PhysicsValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate puzzle set structure
    if (!puzzleSet.date || !puzzleSet.puzzles) {
      errors.push('Daily puzzle set must have date and puzzles');
      return { valid: false, errors, warnings };
    }

    // Validate each puzzle
    const difficulties: (keyof typeof puzzleSet.puzzles)[] = ['easy', 'medium', 'hard'];

    for (const difficulty of difficulties) {
      const puzzle = puzzleSet.puzzles[difficulty];
      if (!puzzle) {
        errors.push(`Missing ${difficulty} puzzle in daily set`);
        continue;
      }

      const validation = this.validatePuzzle(puzzle);
      if (!validation.valid) {
        errors.push(`${difficulty} puzzle validation failed: ${validation.errors.join(', ')}`);
      }
      warnings.push(...validation.warnings.map((w) => `${difficulty}: ${w}`));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
