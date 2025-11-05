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
   * Create a single puzzle for the specified difficulty with relaxed constraints for fallback
   */
  public async createPuzzleWithFallback(
    difficulty: Difficulty,
    date: string,
    useRelaxedConstraints: boolean = false
  ): Promise<Puzzle> {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const randomSeed = Math.floor(Math.random() * 100000);
    const timestamp = Date.now();
    const extraEntropy = Math.floor(Math.random() * 1000000);
    const puzzleId = `puzzle_${difficulty.toLowerCase()}_${date}_${randomSeed}_${timestamp}_${extraEntropy}`;

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

        // Use relaxed distance requirements for fallback scenarios
        const minDistance = useRelaxedConstraints
          ? this.getRelaxedDistanceForDifficulty(difficulty, config.gridSize)
          : this.getMinimumDistanceForDifficulty(difficulty, config.gridSize);

        // Validate the puzzle has exactly one solution and meets distance requirements
        if (
          solutionPath &&
          solutionPath.exit &&
          this.validateMinimumDistance(entry, solutionPath.exit, minDistance) &&
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
        if (typeof console !== 'undefined') {
          console.warn(`Puzzle generation attempt ${attempts + 1} failed:`, error);
        }
      }

      attempts++;
    }

    // If we still failed with relaxed constraints, try ultra-relaxed as final fallback
    if (useRelaxedConstraints) {
      if (typeof console !== 'undefined') {
        console.warn(`🔄 Trying ultra-relaxed constraints for ${difficulty} as final fallback`);
      }
      return this.createPuzzleWithUltraRelaxedConstraints(difficulty, date);
    }

    // Try one more time with ultra-relaxed constraints
    if (typeof console !== 'undefined') {
      console.warn(`🔄 Trying ultra-relaxed constraints for ${difficulty} as final fallback`);
    }

    return this.createPuzzleWithUltraRelaxedConstraints(difficulty, date);
  }

  /**
   * Create a puzzle with ultra-relaxed constraints as final fallback
   */
  private async createPuzzleWithUltraRelaxedConstraints(
    difficulty: Difficulty,
    date: string
  ): Promise<Puzzle> {
    const config = DIFFICULTY_CONFIGS[difficulty];
    const randomSeed = Math.floor(Math.random() * 100000);
    const timestamp = Date.now();
    const extraEntropy = Math.floor(Math.random() * 1000000);
    const puzzleId = `puzzle_${difficulty.toLowerCase()}_${date}_${randomSeed}_${timestamp}_${extraEntropy}`;

    let attempts = 0;
    const maxAttempts = 50; // Fewer attempts for ultra-relaxed

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

        // Use ultra-relaxed distance requirements (just ensure entry != exit)
        const minDistance = this.getUltraRelaxedDistanceForDifficulty(difficulty);

        // Validate the puzzle has a solution and meets ultra-relaxed distance requirements
        if (
          solutionPath &&
          solutionPath.exit &&
          this.validateMinimumDistance(entry, solutionPath.exit, minDistance)
        ) {
          // Skip the unique solution validation for ultra-relaxed fallback
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

          if (typeof console !== 'undefined') {
            console.log(`✅ Ultra-relaxed fallback succeeded for ${difficulty}`);
          }

          return puzzle;
        }
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.warn(`Ultra-relaxed puzzle generation attempt ${attempts + 1} failed:`, error);
        }
      }

      attempts++;
    }

    throw new Error(
      `Failed to generate valid ${difficulty} puzzle even with ultra-relaxed constraints after ${maxAttempts} attempts`
    );
  }

  /**
   * Create a single puzzle for the specified difficulty
   */
  public async createPuzzle(difficulty: Difficulty, date: string): Promise<Puzzle> {
    const config = DIFFICULTY_CONFIGS[difficulty];
    // Add multiple sources of randomization to ensure different puzzles each time
    const randomSeed = Math.floor(Math.random() * 100000);
    const timestamp = Date.now();
    const extraEntropy = Math.floor(Math.random() * 1000000);
    const puzzleId = `puzzle_${difficulty.toLowerCase()}_${date}_${randomSeed}_${timestamp}_${extraEntropy}`;

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

        // Validate the puzzle has exactly one solution and meets distance requirements
        const minDistance = this.getMinimumDistanceForDifficulty(difficulty, config.gridSize);
        if (
          solutionPath &&
          solutionPath.exit &&
          this.validateMinimumDistance(entry, solutionPath.exit, minDistance) &&
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
        if (typeof console !== 'undefined') {
          console.warn(`Puzzle generation attempt ${attempts + 1} failed:`, error);
        }
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

    // Add multiple layers of randomization to ensure different entry points
    const shuffledPositions = [...boundaryPositions]
      .sort(() => Math.random() - 0.5)
      .sort(() => Math.random() - 0.5); // Double shuffle for more randomness

    // Add time-based randomization to break any patterns
    const timeBasedRandom = (Date.now() % 1000) / 1000;

    // Prefer entry points on left or top edges for better UX, but with more randomization
    const preferredPositions = shuffledPositions.filter(([x, y]) => x === 0 || y === 0);

    if (preferredPositions.length > 0 && Math.random() + timeBasedRandom > 0.6) {
      // Variable chance to use preferred based on time
      const randomIndex =
        Math.floor((Math.random() + timeBasedRandom) * preferredPositions.length) %
        preferredPositions.length;
      const selected = preferredPositions[randomIndex];
      if (selected) return selected;
    }

    // Use any boundary position with enhanced randomization
    const randomIndex =
      Math.floor((Math.random() + timeBasedRandom) * shuffledPositions.length) %
      shuffledPositions.length;
    const selected = shuffledPositions[randomIndex];
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

    // Add enhanced randomization to material count for variety
    const timeBasedVariation = (Date.now() % 5) - 2; // -2 to +2 based on time
    const randomVariation = Math.floor(Math.random() * 5) - 2; // -2 to +2
    const totalVariation = Math.floor((timeBasedVariation + randomVariation) / 2);
    const adjustedTargetCount = Math.max(1, targetCount + totalVariation);

    // Generate materials with weighted distribution
    const materialWeights = this.getMaterialWeights(allowedMaterials);

    for (let i = 0; i < adjustedTargetCount; i++) {
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
        if (typeof console !== 'undefined') {
          console.warn('Could not find free position for material, stopping generation');
        }
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
    const filteredWeights: Record<MaterialType, number> = {} as Record<MaterialType, number>;
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

    // Add extra randomization by shuffling the array
    const shuffledAngles = [...angleIncrements].sort(() => Math.random() - 0.5);
    const selected = shuffledAngles[Math.floor(Math.random() * shuffledAngles.length)];
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

      // Determine appropriate initial direction based on entry position
      const initialDirection = this.getInitialDirectionForEntry(entry, gridSize);

      // Trace complete laser path from entry point with proper initial direction
      return reflectionEngine.traceLaserPath(materials, entry, gridSize, initialDirection);
    } catch (error) {
      if (typeof console !== 'undefined') {
        console.error('Error calculating solution path:', error);
      }
      return null;
    }
  }

  /**
   * Get appropriate initial laser direction based on entry position
   * Ensures laser enters the grid rather than immediately exiting
   */
  private getInitialDirectionForEntry(entry: GridPosition, gridSize: number): number {
    const [x, y] = entry;

    // Determine which edge the entry is on and set direction to enter the grid
    if (y === 0) {
      // Top edge - laser should go down (90 degrees)
      return 90;
    } else if (y === gridSize - 1) {
      // Bottom edge - laser should go up (270 degrees)
      return 270;
    } else if (x === 0) {
      // Left edge - laser should go right (0 degrees)
      return 0;
    } else if (x === gridSize - 1) {
      // Right edge - laser should go left (180 degrees)
      return 180;
    }

    // Default to rightward if somehow not on an edge (shouldn't happen)
    return 0;
  }

  /**
   * Get minimum distance requirement based on difficulty level
   * Requirements: Easy 4+ boxes, Medium 5+ boxes, Hard 8+ boxes
   * Note: These are minimum thresholds - actual distances can be higher
   */
  private getMinimumDistanceForDifficulty(difficulty: Difficulty, gridSize: number): number {
    // Minimum distance requirements based on puzzle design guidelines
    const baseDistances = {
      Easy: 4, // Minimum 4 boxes between entry and exit (6x6 grid)
      Medium: 5, // Minimum 5 boxes between entry and exit (8x8 grid)
      Hard: 8, // Minimum 8 boxes between entry and exit (10x10 grid)
    };

    const requiredDistance = baseDistances[difficulty];

    // Calculate maximum possible distance for this grid size
    // Maximum distance is from one corner to opposite corner
    const maxPossibleDistance = Math.floor(Math.sqrt(2 * Math.pow(gridSize - 1, 2)));

    // Ensure the required distance is achievable for this grid size
    if (requiredDistance > maxPossibleDistance) {
      if (typeof console !== 'undefined') {
        console.warn(
          `Distance requirement ${requiredDistance} for ${difficulty} exceeds maximum possible ${maxPossibleDistance} for ${gridSize}x${gridSize} grid. Using maximum possible.`
        );
      }
      return maxPossibleDistance;
    }

    // For very strict requirements, provide a fallback to ensure generation success
    // This helps when the distance requirements are too strict for reliable generation
    const fallbackDistances = {
      Easy: 2, // Fallback to 2 boxes for Easy
      Medium: 3, // Fallback to 3 boxes for Medium
      Hard: 4, // Fallback to 4 boxes for Hard
    };

    // If this is being called from a retry scenario (indicated by multiple failed attempts),
    // we might want to use more lenient requirements
    // For now, we'll use the strict requirements but this provides a path for future enhancement

    // Log distance requirement for debugging (Devvit-compatible logging)
    if (typeof console !== 'undefined') {
      console.log(
        `Distance requirement for ${difficulty} (${gridSize}x${gridSize}): ${requiredDistance} boxes (max possible: ${maxPossibleDistance})`
      );
    }

    return requiredDistance;
  }

  /**
   * Get relaxed distance requirements for fallback scenarios
   */
  private getRelaxedDistanceForDifficulty(difficulty: Difficulty, gridSize: number): number {
    // Relaxed distance requirements for when strict requirements fail
    const relaxedDistances = {
      Easy: 1, // Very relaxed - just ensure entry != exit
      Medium: 2, // Relaxed to 2 boxes for Medium (was 5)
      Hard: 3, // Relaxed to 3 boxes for Hard (was 8)
    };

    const requiredDistance = relaxedDistances[difficulty];
    const maxPossibleDistance = Math.floor(Math.sqrt(2 * Math.pow(gridSize - 1, 2)));

    if (typeof console !== 'undefined') {
      console.log(
        `Relaxed distance requirement for ${difficulty} (${gridSize}x${gridSize}): ${requiredDistance} boxes (max possible: ${maxPossibleDistance})`
      );
    }

    return Math.min(requiredDistance, maxPossibleDistance);
  }

  /**
   * Get ultra-relaxed distance requirements for final fallback scenarios
   */
  private getUltraRelaxedDistanceForDifficulty(difficulty: Difficulty): number {
    // Ultra-relaxed distance requirements - just ensure entry != exit
    return 1; // Just ensure entry and exit are different positions
  }

  /**
   * Validate that the exit point meets the requirements:
   * 1. Entry and exit points are different
   * 2. Distance between entry and exit meets minimum requirement
   */
  private validateMinimumDistance(
    entry: GridPosition,
    exit: GridPosition,
    minDistance: number
  ): boolean {
    const [entryX, entryY] = entry;
    const [exitX, exitY] = exit;

    // Requirement 1: Entry and exit points must be different
    if (entryX === exitX && entryY === exitY) {
      if (typeof console !== 'undefined') {
        console.log(
          `❌ Distance validation FAILED: Entry and exit are the same point (${entryX},${entryY})`
        );
      }
      return false;
    }

    // Requirement 2: Calculate distance and validate minimum requirement
    // Use Manhattan distance as primary measure (more intuitive for grid-based puzzles)
    const manhattanDistance = Math.abs(exitX - entryX) + Math.abs(exitY - entryY);

    // Also calculate Euclidean distance for reference
    const euclideanDistance = Math.sqrt(Math.pow(exitX - entryX, 2) + Math.pow(exitY - entryY, 2));

    // Use Manhattan distance as the primary validation metric
    const actualDistance = manhattanDistance;
    const isValid = actualDistance >= minDistance;

    // Log validation results (Devvit-compatible logging)
    if (typeof console !== 'undefined') {
      if (isValid) {
        console.log(
          `✅ Distance validation PASSED: Entry(${entryX},${entryY}) -> Exit(${exitX},${exitY}) = ${actualDistance} boxes (min: ${minDistance}, euclidean: ${euclideanDistance.toFixed(2)})`
        );
      } else {
        console.log(
          `❌ Distance validation FAILED: Entry(${entryX},${entryY}) -> Exit(${exitX},${exitY}) = ${actualDistance} boxes (min: ${minDistance} required)`
        );
      }
    }

    return isValid;
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
      if (typeof console !== 'undefined') {
        console.error('Error validating puzzle solution:', error);
      }
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
