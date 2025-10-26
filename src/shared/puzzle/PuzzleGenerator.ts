/**
 * Puzzle Generation Engine for ReflectIQ
 * Generates daily puzzles with appropriate difficulty and material density
 */

import {
  Puzzle,
  Material,
  MaterialType,
  Difficulty,
  GridPosition,
  DailyPuzzleSet,
  HintPath,
} from '../types/puzzle.js';

import { DIFFICULTY_CONFIGS, MATERIAL_PROPERTIES, GRID_UTILS } from '../physics/constants.js';

import {
  isWithinBounds,
  getAllExitPositions,
  getRandomPosition,
  getRandomBoundaryPosition,
  positionsEqual,
  positionToKey,
} from '../physics/grid.js';

export class PuzzleGenerator {
  private static instance: PuzzleGenerator;

  public static getInstance(): PuzzleGenerator {
    if (!PuzzleGenerator.instance) {
      PuzzleGenerator.instance = new PuzzleGenerator();
    }
    return PuzzleGenerator.instance;
  }

  /**
   * Generate a complete daily puzzle set with Easy, Medium, and Hard difficulties
   */
  public generateDailyPuzzles(date: string): DailyPuzzleSet {
    const puzzles = {
      easy: this.createPuzzle('Easy', date),
      medium: this.createPuzzle('Medium', date),
      hard: this.createPuzzle('Hard', date),
    };

    return {
      date,
      puzzles,
      status: 'active',
      createdAt: new Date(),
    };
  }

  /**
   * Create a single puzzle for the specified difficulty
   */
  public createPuzzle(difficulty: Difficulty, date: string): Puzzle {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const puzzleId = `puzzle_${difficulty.toLowerCase()}_${date}`;

    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      try {
        // Generate grid with materials
        const { materials, entry, solution } = this.generatePuzzleGrid(
          config.gridSize,
          config.materialDensity,
          config.allowedMaterials
        );

        // Validate the puzzle has exactly one solution
        if (this.validatePuzzleSolution(materials, entry, solution, config.gridSize)) {
          // Generate hint paths
          const hints = this.generateHintPaths(materials, entry, solution, config.gridSize);

          const puzzle: Puzzle = {
            id: puzzleId,
            difficulty,
            gridSize: config.gridSize,
            materials,
            entry,
            solution,
            hints,
            createdAt: new Date(),
            materialDensity: this.calculateActualDensity(materials, config.gridSize),
          };

          return puzzle;
        }
      } catch (error) {
        console.warn(`Puzzle generation attempt ${attempts + 1} failed:`, error);
      }

      attempts++;
    }

    throw new Error(`Failed to generate valid ${difficulty} puzzle after ${maxAttempts} attempts`);
  }

  /**
   * Generate the puzzle grid with materials, entry point, and solution
   */
  private generatePuzzleGrid(
    gridSize: number,
    targetDensity: number,
    allowedMaterials: MaterialType[]
  ): { materials: Material[]; entry: GridPosition; solution: GridPosition } {
    const totalCells = gridSize * gridSize;
    const targetMaterialCount = Math.floor(totalCells * targetDensity);

    // Generate entry point (always on the boundary)
    const entry = this.generateEntryPoint(gridSize);

    // Generate materials with proper density
    const materials = this.generateMaterials(
      gridSize,
      targetMaterialCount,
      allowedMaterials,
      entry
    );

    // Calculate solution by tracing laser path
    const solution = this.calculateSolution(materials, entry, gridSize);

    if (!solution) {
      throw new Error('No valid solution found for generated puzzle');
    }

    return { materials, entry, solution };
  }

  /**
   * Generate entry point on the grid boundary
   */
  private generateEntryPoint(gridSize: number): GridPosition {
    const boundaryPositions = getAllExitPositions(gridSize);

    // Prefer entry points on left or top edges for better UX
    const preferredPositions = boundaryPositions.filter(([x, y]) => x === 0 || y === 0);

    if (preferredPositions.length > 0) {
      return preferredPositions[Math.floor(Math.random() * preferredPositions.length)];
    }

    return boundaryPositions[Math.floor(Math.random() * boundaryPositions.length)];
  }

  /**
   * Generate materials for the puzzle grid
   */
  private generateMaterials(
    gridSize: number,
    targetCount: number,
    allowedMaterials: MaterialType[],
    entry: GridPosition
  ): Material[] {
    const materials: Material[] = [];
    const occupiedPositions = new Set<string>();

    // Reserve entry position
    occupiedPositions.add(positionToKey(entry));

    // Generate materials with weighted distribution
    const materialWeights = this.getMaterialWeights(allowedMaterials);

    for (let i = 0; i < targetCount; i++) {
      let position: GridPosition;
      let attempts = 0;

      // Find an unoccupied position
      do {
        position = getRandomPosition(gridSize);
        attempts++;
      } while (
        (occupiedPositions.has(positionToKey(position)) || positionsEqual(position, entry)) &&
        attempts < 50
      );

      if (attempts >= 50) {
        console.warn('Could not find free position for material, stopping generation');
        break;
      }

      // Select material type based on weights
      const materialType = this.selectWeightedMaterial(allowedMaterials, materialWeights);

      // Create material with appropriate properties
      const material: Material = {
        type: materialType,
        position,
        properties: MATERIAL_PROPERTIES[materialType],
      };

      // Add angle for mirrors
      if (materialType === 'mirror') {
        material.angle = this.generateMirrorAngle();
      }

      materials.push(material);
      occupiedPositions.add(positionToKey(position));
    }

    return materials;
  }

  /**
   * Get material distribution weights for different difficulty levels
   */
  private getMaterialWeights(allowedMaterials: MaterialType[]): Record<MaterialType, number> {
    const baseWeights: Record<MaterialType, number> = {
      mirror: 0.4, // 40% - Primary puzzle element
      water: 0.2, // 20% - Adds complexity with diffusion
      glass: 0.15, // 15% - Interesting pass-through mechanic
      metal: 0.1, // 10% - Powerful reversal effect
      absorber: 0.15, // 15% - Creates dead ends and strategy
    };

    // Filter to only allowed materials and normalize
    const filteredWeights: Record<MaterialType, number> = {} as any;
    let totalWeight = 0;

    for (const material of allowedMaterials) {
      filteredWeights[material] = baseWeights[material];
      totalWeight += baseWeights[material];
    }

    // Normalize weights to sum to 1
    for (const material of allowedMaterials) {
      filteredWeights[material] /= totalWeight;
    }

    return filteredWeights;
  }

  /**
   * Select a material type based on weighted probabilities
   */
  private selectWeightedMaterial(
    allowedMaterials: MaterialType[],
    weights: Record<MaterialType, number>
  ): MaterialType {
    const random = Math.random();
    let cumulativeWeight = 0;

    for (const material of allowedMaterials) {
      cumulativeWeight += weights[material];
      if (random <= cumulativeWeight) {
        return material;
      }
    }

    // Fallback to first material
    return allowedMaterials[0];
  }

  /**
   * Generate a random angle for mirror materials
   */
  private generateMirrorAngle(): number {
    // Generate angles in 15-degree increments for cleaner reflections
    const angleIncrements = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165];
    return angleIncrements[Math.floor(Math.random() * angleIncrements.length)];
  }

  /**
   * Calculate the actual material density of the generated puzzle
   */
  private calculateActualDensity(materials: Material[], gridSize: number): number {
    const totalCells = gridSize * gridSize;
    return materials.length / totalCells;
  }

  /**
   * Calculate the solution by tracing the laser path
   */
  private calculateSolution(
    materials: Material[],
    entry: GridPosition,
    gridSize: number
  ): GridPosition | null {
    // Import ReflectionEngine dynamically to avoid circular dependencies
    const { ReflectionEngine } = require('./ReflectionEngine.js');
    const reflectionEngine = ReflectionEngine.getInstance();

    // Trace laser path from entry point
    const laserPath = reflectionEngine.traceLaserPath(materials, entry, gridSize);

    // Return the exit point
    return reflectionEngine.calculateExit(laserPath);
  }

  /**
   * Validate that the puzzle has exactly one valid solution
   */
  private validatePuzzleSolution(
    materials: Material[],
    entry: GridPosition,
    solution: GridPosition,
    gridSize: number
  ): boolean {
    if (!solution || !isWithinBounds(solution, gridSize)) {
      return false;
    }

    // Import ReflectionEngine dynamically to avoid circular dependencies
    const { ReflectionEngine } = require('./ReflectionEngine.js');
    const reflectionEngine = ReflectionEngine.getInstance();

    // Validate that the calculated solution matches the expected solution
    return reflectionEngine.validateSolution(materials, entry, solution, gridSize);
  }

  /**
   * Generate hint paths for the puzzle (placeholder)
   */
  private generateHintPaths(
    materials: Material[],
    entry: GridPosition,
    solution: GridPosition,
    gridSize: number
  ): HintPath[] {
    // TODO: Implement actual hint path generation
    // For now, return empty hint paths
    return [
      { quadrant: 1, segments: [], revealedCells: [] },
      { quadrant: 2, segments: [], revealedCells: [] },
      { quadrant: 3, segments: [], revealedCells: [] },
      { quadrant: 4, segments: [], revealedCells: [] },
    ];
  }
}
