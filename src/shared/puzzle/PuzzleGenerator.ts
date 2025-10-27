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
  LaserPath,
} from '../types/puzzle.js';

import { DIFFICULTY_CONFIGS, MATERIAL_PROPERTIES } from '../physics/constants.js';

import {
  isWithinBounds,
  getAllExitPositions,
  getRandomPosition,
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
  public async generateDailyPuzzles(date: string): Promise<DailyPuzzleSet> {
    const puzzles = {
      easy: await this.createPuzzle('Easy', date),
      medium: await this.createPuzzle('Medium', date),
      hard: await this.createPuzzle('Hard', date),
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
  public async createPuzzle(difficulty: Difficulty, date: string): Promise<Puzzle> {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const puzzleId = `puzzle_${difficulty.toLowerCase()}_${date}`;

    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      try {
        // Generate grid with materials
        const { materials, entry } = this.generatePuzzleGrid(
          config.gridSize,
          config.materialDensity,
          config.allowedMaterials
        );

        // Calculate the complete solution path
        const solutionPath = await this.calculateSolutionPath(materials, entry, config.gridSize);

        // Validate the puzzle has exactly one solution
        if (
          solutionPath &&
          solutionPath.exit &&
          (await this.validatePuzzleSolution(materials, entry, solutionPath.exit, config.gridSize))
        ) {
          // Generate progressive hint paths from the complete solution
          const hints = this.generateProgressiveHints(solutionPath);

          const puzzle: Puzzle = {
            id: puzzleId,
            difficulty,
            gridSize: config.gridSize,
            materials,
            entry,
            solution: solutionPath.exit,
            solutionPath,
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
  ): { materials: Material[]; entry: GridPosition } {
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

    return { materials, entry };
  }

  /**
   * Generate entry point on the grid boundary
   */
  private generateEntryPoint(gridSize: number): GridPosition {
    const boundaryPositions = getAllExitPositions(gridSize);

    // Prefer entry points on left or top edges for better UX
    const preferredPositions = boundaryPositions.filter(([x, y]) => x === 0 || y === 0);

    if (preferredPositions.length > 0) {
      const selected = preferredPositions[Math.floor(Math.random() * preferredPositions.length)];
      if (selected) return selected;
    }

    const selected = boundaryPositions[Math.floor(Math.random() * boundaryPositions.length)];
    if (!selected) {
      throw new Error('No boundary positions available for entry point');
    }
    return selected;
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
    const fallback = allowedMaterials[0];
    if (!fallback) {
      throw new Error('No allowed materials provided');
    }
    return fallback;
  }

  /**
   * Generate a random angle for mirror materials
   */
  private generateMirrorAngle(): number {
    // Generate angles in 15-degree increments for cleaner reflections
    const angleIncrements = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165];
    const selected = angleIncrements[Math.floor(Math.random() * angleIncrements.length)];
    return selected ?? 45; // Default to 45 degrees if undefined
  }

  /**
   * Calculate the actual material density of the generated puzzle
   */
  private calculateActualDensity(materials: Material[], gridSize: number): number {
    const totalCells = gridSize * gridSize;
    return materials.length / totalCells;
  }

  /**
   * Calculate the complete solution path by tracing the laser
   */
  private async calculateSolutionPath(
    materials: Material[],
    entry: GridPosition,
    gridSize: number
  ): Promise<LaserPath | null> {
    try {
      // Import ReflectionEngine dynamically to avoid circular dependencies
      const { ReflectionEngine } = await import('./ReflectionEngine.js');
      const reflectionEngine = ReflectionEngine.getInstance();

      // Trace complete laser path from entry point
      return reflectionEngine.traceLaserPath(materials, entry, gridSize);
    } catch (error) {
      console.error('Error calculating solution path:', error);
      return null;
    }
  }

  /**
   * Validate that the puzzle has exactly one valid solution
   */
  private async validatePuzzleSolution(
    materials: Material[],
    entry: GridPosition,
    solution: GridPosition,
    gridSize: number
  ): Promise<boolean> {
    if (!solution || !isWithinBounds(solution, gridSize)) {
      return false;
    }

    try {
      // Import ReflectionEngine dynamically to avoid circular dependencies
      const { ReflectionEngine } = await import('./ReflectionEngine.js');
      const reflectionEngine = ReflectionEngine.getInstance();

      // Validate that the calculated solution matches the expected solution
      return reflectionEngine.validateSolution(materials, entry, solution, gridSize);
    } catch (error) {
      console.error('Error validating puzzle solution:', error);
      return false;
    }
  }

  /**
   * Generate progressive hints from the complete solution path
   */
  private generateProgressiveHints(solutionPath: LaserPath): HintPath[] {
    const hints: HintPath[] = [];
    const totalSegments = solutionPath.segments.length;

    if (totalSegments === 0) {
      // No path segments, return empty hints
      return [
        { hintLevel: 1, segments: [], revealedCells: [], percentage: 25 },
        { hintLevel: 2, segments: [], revealedCells: [], percentage: 50 },
        { hintLevel: 3, segments: [], revealedCells: [], percentage: 75 },
        { hintLevel: 4, segments: [], revealedCells: [], percentage: 100 },
      ];
    }

    // Calculate how many segments to reveal at each hint level
    const segmentsPerHint = [
      Math.ceil(totalSegments * 0.25), // 25% for hint 1
      Math.ceil(totalSegments * 0.5), // 50% for hint 2
      Math.ceil(totalSegments * 0.75), // 75% for hint 3
      totalSegments, // 100% for hint 4
    ];

    for (let hintLevel = 1; hintLevel <= 4; hintLevel++) {
      const segmentsToReveal = segmentsPerHint[hintLevel - 1] || 0;
      const segments = solutionPath.segments.slice(0, segmentsToReveal);

      // Extract all unique cells from the revealed segments
      const revealedCells: GridPosition[] = [];
      const cellSet = new Set<string>();

      for (const segment of segments) {
        const startKey = positionToKey(segment.start);
        const endKey = positionToKey(segment.end);

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
}
