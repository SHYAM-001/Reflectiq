// Laser beam simulation engine optimized for Devvit Web serverless environment

import type {
  Coordinate,
  Direction,
  GridCell,
  LaserPath,
  PathSegment,
  MaterialType,
  PuzzleConfiguration,
} from '../types/game.js';
import { DIRECTION_VECTORS, REFLECTION_BEHAVIORS } from '../constants.js';

export class LaserEngine {
  private maxIterations = 1000; // Prevent infinite loops in serverless environment

  /**
   * Simulate laser path through the puzzle grid
   * Optimized for Devvit Web's 30-second timeout constraint
   */
  simulateLaserPath(puzzle: PuzzleConfiguration): LaserPath {
    const { grid, laserEntry } = puzzle;
    const path: LaserPath = {
      segments: [],
      exitPoint: null,
      isComplete: false,
    };

    let currentPos = { ...laserEntry };
    let currentDirection = this.getInitialDirection(laserEntry, grid);
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;

      // Get next position
      const nextPos = this.getNextPosition(currentPos, currentDirection);

      // Check if we've exited the grid
      if (this.isOutOfBounds(nextPos, grid)) {
        path.exitPoint = this.getExitCoordinate(currentPos, currentDirection, grid);
        path.isComplete = true;
        break;
      }

      // Get the cell we're entering
      const cell = grid[nextPos.row][nextPos.col];

      // Create path segment
      const segment: PathSegment = {
        start: { ...currentPos },
        end: { ...nextPos },
        direction: currentDirection,
        material: cell.material,
      };
      path.segments.push(segment);

      // Handle material interaction
      const interaction = this.handleMaterialInteraction(nextPos, currentDirection, cell.material);

      if (interaction.absorbed) {
        path.isComplete = true;
        break;
      }

      // Update position and direction
      currentPos = nextPos;
      currentDirection = interaction.newDirection;
    }

    // Handle timeout case (shouldn't happen with proper puzzle generation)
    if (iterations >= this.maxIterations) {
      console.warn('Laser simulation exceeded maximum iterations');
      path.isComplete = true;
    }

    return path;
  }

  /**
   * Get initial laser direction based on entry point
   */
  private getInitialDirection(entry: Coordinate, grid: GridCell[][]): Direction {
    const gridSize = grid.length;

    // Determine direction based on entry position
    if (entry.row === 0) return 'south';
    if (entry.row === gridSize - 1) return 'north';
    if (entry.col === 0) return 'east';
    if (entry.col === gridSize - 1) return 'west';

    // Default to south if entry is somehow in the middle
    return 'south';
  }

  /**
   * Calculate next position based on current position and direction
   */
  private getNextPosition(pos: Coordinate, direction: Direction): Coordinate {
    const vector = DIRECTION_VECTORS[direction];
    return {
      row: pos.row + vector.row,
      col: pos.col + vector.col,
      label: this.coordinateToLabel(pos.row + vector.row, pos.col + vector.col),
    };
  }

  /**
   * Check if position is outside the grid bounds
   */
  private isOutOfBounds(pos: Coordinate, grid: GridCell[][]): boolean {
    return pos.row < 0 || pos.row >= grid.length || pos.col < 0 || pos.col >= grid[0].length;
  }

  /**
   * Get exit coordinate when laser leaves the grid
   */
  private getExitCoordinate(pos: Coordinate, direction: Direction, grid: GridCell[][]): Coordinate {
    const vector = DIRECTION_VECTORS[direction];
    const exitPos = {
      row: pos.row + vector.row,
      col: pos.col + vector.col,
    };

    // Clamp to grid boundaries for exit coordinate
    const clampedRow = Math.max(0, Math.min(grid.length - 1, exitPos.row));
    const clampedCol = Math.max(0, Math.min(grid[0].length - 1, exitPos.col));

    return {
      row: clampedRow,
      col: clampedCol,
      label: this.coordinateToLabel(clampedRow, clampedCol),
    };
  }

  /**
   * Handle laser interaction with different materials
   * Optimized for deterministic behavior in serverless environment
   */
  private handleMaterialInteraction(
    pos: Coordinate,
    direction: Direction,
    material: MaterialType
  ): { newDirection: Direction; absorbed: boolean } {
    const behavior = REFLECTION_BEHAVIORS[material];

    switch (behavior.behavior) {
      case 'absorb':
        return { newDirection: direction, absorbed: true };

      case 'reflect':
        return { newDirection: this.calculateReflection(direction, material), absorbed: false };

      case 'reverse':
        return { newDirection: this.reverseDirection(direction), absorbed: false };

      case 'split':
        // For glass, use deterministic behavior instead of random
        // In serverless environment, we want predictable results
        return { newDirection: this.calculateGlassBehavior(direction, pos), absorbed: false };

      case 'diffuse':
        // Water diffusion - use deterministic offset based on position
        return { newDirection: this.calculateWaterDiffusion(direction, pos), absorbed: false };

      default:
        // Empty cells - laser passes through
        return { newDirection: direction, absorbed: false };
    }
  }

  /**
   * Calculate reflection for mirrors (90-degree reflection)
   */
  private calculateReflection(direction: Direction, material: MaterialType): Direction {
    if (material !== 'mirror') return direction;

    // Mirror reflection logic - 90-degree turns
    const reflectionMap: Record<Direction, Direction> = {
      north: 'east',
      south: 'west',
      east: 'south',
      west: 'north',
      northeast: 'southeast',
      northwest: 'southwest',
      southeast: 'northeast',
      southwest: 'northwest',
    };

    return reflectionMap[direction] || direction;
  }

  /**
   * Reverse direction for metal materials
   */
  private reverseDirection(direction: Direction): Direction {
    const reverseMap: Record<Direction, Direction> = {
      north: 'south',
      south: 'north',
      east: 'west',
      west: 'east',
      northeast: 'southwest',
      northwest: 'southeast',
      southeast: 'northwest',
      southwest: 'northeast',
    };

    return reverseMap[direction] || direction;
  }

  /**
   * Calculate glass behavior (deterministic split based on position)
   */
  private calculateGlassBehavior(direction: Direction, pos: Coordinate): Direction {
    // Use position-based deterministic behavior instead of random
    const positionHash = (pos.row + pos.col) % 2;

    if (positionHash === 0) {
      // Pass through
      return direction;
    } else {
      // Reflect
      return this.calculateReflection(direction, 'mirror');
    }
  }

  /**
   * Calculate water diffusion (deterministic offset based on position)
   */
  private calculateWaterDiffusion(direction: Direction, pos: Coordinate): Direction {
    // Use position-based deterministic offset
    const positionHash = (pos.row * 3 + pos.col * 7) % 8;
    const directions: Direction[] = [
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest',
    ];

    // Apply slight directional change based on position
    const currentIndex = directions.indexOf(direction);
    const offset = (positionHash % 3) - 1; // -1, 0, or 1
    const newIndex = (currentIndex + offset + directions.length) % directions.length;

    return directions[newIndex];
  }

  /**
   * Convert row/col to grid label (A1, B2, etc.)
   */
  private coordinateToLabel(row: number, col: number): string {
    const colLetter = String.fromCharCode(65 + col); // A, B, C, etc.
    const rowNumber = row + 1; // 1-based indexing
    return `${colLetter}${rowNumber}`;
  }

  /**
   * Validate if a puzzle has a unique solution
   * Critical for Devvit Web's deterministic requirements
   */
  validatePuzzleSolution(puzzle: PuzzleConfiguration): boolean {
    try {
      const path = this.simulateLaserPath(puzzle);

      // Check if simulation completed successfully
      if (!path.isComplete || !path.exitPoint) {
        return false;
      }

      // Verify the exit point matches the expected solution
      return (
        path.exitPoint.row === puzzle.correctExit.row &&
        path.exitPoint.col === puzzle.correctExit.col
      );
    } catch (error) {
      console.error('Error validating puzzle solution:', error);
      return false;
    }
  }

  /**
   * Get laser path for a specific quadrant (for hints)
   * Optimized for Devvit Web's response size limits
   */
  getQuadrantPath(puzzle: PuzzleConfiguration, quadrant: number): PathSegment[] {
    const fullPath = this.simulateLaserPath(puzzle);
    const gridSize = puzzle.grid.length;
    const halfSize = Math.floor(gridSize / 2);

    // Define quadrant boundaries
    const quadrantBounds = {
      0: { minRow: 0, maxRow: halfSize, minCol: 0, maxCol: halfSize }, // Top-left
      1: { minRow: 0, maxRow: halfSize, minCol: halfSize, maxCol: gridSize }, // Top-right
      2: { minRow: halfSize, maxRow: gridSize, minCol: 0, maxCol: halfSize }, // Bottom-left
      3: { minRow: halfSize, maxRow: gridSize, minCol: halfSize, maxCol: gridSize }, // Bottom-right
    };

    const bounds = quadrantBounds[quadrant as keyof typeof quadrantBounds];
    if (!bounds) return [];

    // Filter segments that pass through the specified quadrant
    return fullPath.segments.filter((segment) => {
      const { start, end } = segment;
      return (
        this.isInBounds(start, bounds) ||
        this.isInBounds(end, bounds) ||
        this.segmentCrossesBounds(start, end, bounds)
      );
    });
  }

  /**
   * Check if coordinate is within bounds
   */
  private isInBounds(
    coord: Coordinate,
    bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
  ): boolean {
    return (
      coord.row >= bounds.minRow &&
      coord.row < bounds.maxRow &&
      coord.col >= bounds.minCol &&
      coord.col < bounds.maxCol
    );
  }

  /**
   * Check if segment crosses through bounds
   */
  private segmentCrossesBounds(
    start: Coordinate,
    end: Coordinate,
    bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number }
  ): boolean {
    // Simple line-rectangle intersection check
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    return !(
      maxRow < bounds.minRow ||
      minRow >= bounds.maxRow ||
      maxCol < bounds.minCol ||
      minCol >= bounds.maxCol
    );
  }
}
