// Laser physics engine for Logic Reflections game

import type {
  Coordinate,
  Direction,
  GridCell,
  LaserPath,
  PathSegment,
  MaterialType,
  DifficultyLevel,
} from '../types/game.js';
import { DIRECTION_VECTORS, GRID_SIZES, REFLECTION_BEHAVIORS } from '../constants.js';
import { createCoordinate, isValidCoordinate } from '../utils.js';

export class LaserEngine {
  /**
   * Simulate laser path through the grid
   */
  static simulateLaserPath(
    grid: GridCell[][],
    entryPoint: Coordinate,
    initialDirection: Direction,
    difficulty: DifficultyLevel
  ): LaserPath {
    const segments: PathSegment[] = [];
    let currentPosition = { ...entryPoint };
    let currentDirection = initialDirection;
    let isComplete = false;
    let exitPoint: Coordinate | null = null;

    // Maximum iterations to prevent infinite loops
    const maxIterations = GRID_SIZES[difficulty] * GRID_SIZES[difficulty] * 4;
    let iterations = 0;

    while (!isComplete && iterations < maxIterations) {
      iterations++;

      // Calculate next position
      const nextPosition = this.getNextPosition(currentPosition, currentDirection);

      // Check if we've exited the grid
      if (!isValidCoordinate(nextPosition.row, nextPosition.col, difficulty)) {
        exitPoint = nextPosition;
        isComplete = true;

        // Add final segment to exit point
        segments.push({
          start: currentPosition,
          end: exitPoint,
          direction: currentDirection,
          material: 'empty',
        });
        break;
      }

      // Get the material at the next position
      const targetCell = grid[nextPosition.row]?.[nextPosition.col];
      if (!targetCell) {
        // Invalid grid position, treat as exit
        exitPoint = nextPosition;
        isComplete = true;
        break;
      }
      const material = targetCell.material;

      // Create segment to the current cell
      segments.push({
        start: currentPosition,
        end: nextPosition,
        direction: currentDirection,
        material,
      });

      // Handle material interaction
      const interaction = this.handleMaterialInteraction(
        material,
        currentDirection,
        nextPosition,
        difficulty
      );

      if (interaction.absorbed) {
        isComplete = true;
        break;
      }

      if (interaction.newDirection) {
        currentDirection = interaction.newDirection;
      }

      if (interaction.newPosition) {
        currentPosition = interaction.newPosition;
      } else {
        currentPosition = nextPosition;
      }
    }

    return {
      segments,
      exitPoint,
      isComplete,
    };
  }

  /**
   * Calculate the next position based on current position and direction
   */
  private static getNextPosition(position: Coordinate, direction: Direction): Coordinate {
    const vector = DIRECTION_VECTORS[direction];
    return createCoordinate(position.row + vector.row, position.col + vector.col);
  }

  /**
   * Handle interaction between laser and material
   */
  private static handleMaterialInteraction(
    material: MaterialType,
    direction: Direction,
    position: Coordinate,
    difficulty: DifficultyLevel
  ): MaterialInteractionResult {
    const behavior = REFLECTION_BEHAVIORS[material];

    switch (behavior.behavior) {
      case 'absorb':
        return { absorbed: true };

      case 'reflect':
        return {
          absorbed: false,
          newDirection: this.calculateReflection(direction, material),
        };

      case 'reverse':
        return {
          absorbed: false,
          newDirection: this.reverseDirection(direction),
        };

      case 'diffuse':
        return {
          absorbed: false,
          newDirection: this.calculateDiffusion(direction, behavior.diffusionRange || 1),
          newPosition: this.applyDiffusionOffset(position, difficulty),
        };

      case 'split':
        // For glass, we'll simulate the reflection path (50% behavior)
        // The pass-through behavior would be handled separately in a full implementation
        return {
          absorbed: false,
          newDirection: this.calculateReflection(direction, material),
        };

      default:
        // Empty cells - laser passes through
        return { absorbed: false };
    }
  }

  /**
   * Calculate reflection direction based on material type
   */
  private static calculateReflection(direction: Direction, material: MaterialType): Direction {
    // Mirror reflects at 90-degree angles
    if (material === 'mirror') {
      return this.calculateMirrorReflection(direction);
    }

    // Glass and other materials use similar reflection logic
    return this.calculateMirrorReflection(direction);
  }

  /**
   * Calculate mirror reflection (90-degree angle reflection)
   */
  private static calculateMirrorReflection(direction: Direction): Direction {
    const reflectionMap: Record<Direction, Direction> = {
      north: 'east',
      south: 'west',
      east: 'north',
      west: 'south',
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
  private static reverseDirection(direction: Direction): Direction {
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
   * Calculate diffusion for water materials
   */
  private static calculateDiffusion(direction: Direction, diffusionRange: number): Direction {
    // For water, add slight randomness to the reflection
    const baseReflection = this.calculateMirrorReflection(direction);

    // Add random variation within diffusion range
    const directions: Direction[] = [
      'north',
      'south',
      'east',
      'west',
      'northeast',
      'northwest',
      'southeast',
      'southwest',
    ];
    const baseIndex = directions.indexOf(baseReflection);

    if (baseIndex === -1) return baseReflection;

    // Random offset within diffusion range
    const offset = Math.floor(Math.random() * (diffusionRange * 2 + 1)) - diffusionRange;
    const newIndex = (baseIndex + offset + directions.length) % directions.length;

    return directions[newIndex];
  }

  /**
   * Apply position offset for water diffusion
   */
  private static applyDiffusionOffset(
    position: Coordinate,
    difficulty: DifficultyLevel
  ): Coordinate {
    // Random offset of one cell for water diffusion
    const offsetRow = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const offsetCol = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1

    const newRow = Math.max(0, Math.min(GRID_SIZES[difficulty] - 1, position.row + offsetRow));
    const newCol = Math.max(0, Math.min(GRID_SIZES[difficulty] - 1, position.col + offsetCol));

    return createCoordinate(newRow, newCol);
  }

  /**
   * Get entry direction based on entry point position
   */
  static getEntryDirection(entryPoint: Coordinate, difficulty: DifficultyLevel): Direction {
    const gridSize = GRID_SIZES[difficulty];

    // Determine entry direction based on which edge the entry point is on
    if (entryPoint.row === 0) return 'south'; // Top edge
    if (entryPoint.row === gridSize - 1) return 'north'; // Bottom edge
    if (entryPoint.col === 0) return 'east'; // Left edge
    if (entryPoint.col === gridSize - 1) return 'west'; // Right edge

    // Default to south if entry point is inside grid
    return 'south';
  }

  /**
   * Validate if a laser path is solvable (has a valid exit)
   */
  static isPathSolvable(laserPath: LaserPath): boolean {
    return laserPath.isComplete && laserPath.exitPoint !== null;
  }

  /**
   * Get path segments within a specific quadrant
   */
  static getQuadrantSegments(
    laserPath: LaserPath,
    quadrant: number,
    difficulty: DifficultyLevel
  ): PathSegment[] {
    const gridSize = GRID_SIZES[difficulty];
    const midRow = Math.floor(gridSize / 2);
    const midCol = Math.floor(gridSize / 2);

    return laserPath.segments.filter((segment) => {
      const segmentQuadrant = this.getSegmentQuadrant(segment, midRow, midCol);
      return segmentQuadrant === quadrant;
    });
  }

  /**
   * Determine which quadrant a path segment belongs to
   */
  private static getSegmentQuadrant(segment: PathSegment, midRow: number, midCol: number): number {
    const { start, end } = segment;

    // Use the midpoint of the segment to determine quadrant
    const midSegmentRow = (start.row + end.row) / 2;
    const midSegmentCol = (start.col + end.col) / 2;

    if (midSegmentRow < midRow && midSegmentCol < midCol) return 0; // Top-left
    if (midSegmentRow < midRow && midSegmentCol >= midCol) return 1; // Top-right
    if (midSegmentRow >= midRow && midSegmentCol < midCol) return 2; // Bottom-left
    return 3; // Bottom-right
  }
}

interface MaterialInteractionResult {
  absorbed: boolean;
  newDirection?: Direction;
  newPosition?: Coordinate;
}
