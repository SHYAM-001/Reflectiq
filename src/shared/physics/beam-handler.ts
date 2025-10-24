// Beam termination and special case handling

import type {
  Coordinate,
  Direction,
  GridCell,
  LaserPath,
  PathSegment,
  DifficultyLevel,
} from '../types/game.js';
import { GRID_SIZES } from '../constants.js';
import { createCoordinate, isValidCoordinate } from '../utils.js';

export class BeamHandler {
  /**
   * Handle beam exit from grid boundaries
   */
  static handleGridExit(
    position: Coordinate,
    direction: Direction,
    difficulty: DifficultyLevel
  ): ExitResult {
    const gridSize = GRID_SIZES[difficulty];
    const nextPos = this.calculateNextPosition(position, direction);

    // Check which boundary the beam is exiting from
    if (nextPos.row < 0) {
      return {
        hasExited: true,
        exitPoint: createCoordinate(-1, position.col),
        exitEdge: 'top',
      };
    }

    if (nextPos.row >= gridSize) {
      return {
        hasExited: true,
        exitPoint: createCoordinate(gridSize, position.col),
        exitEdge: 'bottom',
      };
    }

    if (nextPos.col < 0) {
      return {
        hasExited: true,
        exitPoint: createCoordinate(position.row, -1),
        exitEdge: 'left',
      };
    }

    if (nextPos.col >= gridSize) {
      return {
        hasExited: true,
        exitPoint: createCoordinate(position.row, gridSize),
        exitEdge: 'right',
      };
    }

    return {
      hasExited: false,
      exitPoint: null,
      exitEdge: null,
    };
  }

  /**
   * Calculate next position based on direction
   */
  private static calculateNextPosition(position: Coordinate, direction: Direction): Coordinate {
    const directionMap: Record<Direction, { row: number; col: number }> = {
      north: { row: -1, col: 0 },
      south: { row: 1, col: 0 },
      east: { row: 0, col: 1 },
      west: { row: 0, col: -1 },
      northeast: { row: -1, col: 1 },
      northwest: { row: -1, col: -1 },
      southeast: { row: 1, col: 1 },
      southwest: { row: 1, col: -1 },
    };

    const vector = directionMap[direction];
    return createCoordinate(position.row + vector.row, position.col + vector.col);
  }

  /**
   * Handle infinite loop detection
   */
  static detectInfiniteLoop(segments: PathSegment[], maxIterations: number): boolean {
    if (segments.length < maxIterations) return false;

    // Check for repeating position-direction combinations
    const stateHistory = new Set<string>();

    for (const segment of segments.slice(-20)) {
      // Check last 20 segments
      const state = `${segment.end.row},${segment.end.col},${segment.direction}`;
      if (stateHistory.has(state)) {
        return true; // Found repeating state
      }
      stateHistory.add(state);
    }

    return false;
  }

  /**
   * Handle beam absorption by materials
   */
  static handleAbsorption(
    position: Coordinate,
    material: string,
    segments: PathSegment[]
  ): AbsorptionResult {
    return {
      isAbsorbed: material === 'absorber',
      absorptionPoint: material === 'absorber' ? position : null,
      finalSegments: segments,
    };
  }

  /**
   * Handle glass material split behavior (simplified)
   */
  static handleGlassSplit(
    position: Coordinate,
    direction: Direction,
    probability: number = 0.5
  ): SplitResult {
    const shouldReflect = Math.random() < probability;

    if (shouldReflect) {
      return {
        behavior: 'reflect',
        newDirection: this.calculateGlassReflection(direction),
        passThrough: false,
      };
    } else {
      return {
        behavior: 'pass-through',
        newDirection: direction, // Continue in same direction
        passThrough: true,
      };
    }
  }

  /**
   * Calculate glass reflection direction
   */
  private static calculateGlassReflection(direction: Direction): Direction {
    // Glass reflects similar to mirrors but with slight variation
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
   * Validate beam path integrity
   */
  static validatePathIntegrity(laserPath: LaserPath): PathIntegrityResult {
    const issues: string[] = [];

    // Check for disconnected segments
    for (let i = 1; i < laserPath.segments.length; i++) {
      const prevEnd = laserPath.segments[i - 1].end;
      const currentStart = laserPath.segments[i].start;

      if (prevEnd.row !== currentStart.row || prevEnd.col !== currentStart.col) {
        issues.push(`Disconnected segments at index ${i}`);
      }
    }

    // Check for invalid coordinates
    laserPath.segments.forEach((segment, index) => {
      if (segment.start.row < -1 || segment.start.col < -1) {
        issues.push(`Invalid start coordinate at segment ${index}`);
      }
      if (segment.end.row < -1 || segment.end.col < -1) {
        issues.push(`Invalid end coordinate at segment ${index}`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Calculate beam energy loss (for future features)
   */
  static calculateEnergyLoss(segments: PathSegment[]): number {
    let energyLoss = 0;

    for (const segment of segments) {
      switch (segment.material) {
        case 'water':
          energyLoss += 0.1; // Water causes slight energy loss
          break;
        case 'glass':
          energyLoss += 0.05; // Glass causes minimal loss
          break;
        case 'absorber':
          energyLoss += 1.0; // Complete absorption
          break;
        default:
          energyLoss += 0.01; // Minimal loss for other materials
      }
    }

    return Math.min(energyLoss, 1.0); // Cap at 100% loss
  }
}

export interface ExitResult {
  hasExited: boolean;
  exitPoint: Coordinate | null;
  exitEdge: 'top' | 'bottom' | 'left' | 'right' | null;
}

export interface AbsorptionResult {
  isAbsorbed: boolean;
  absorptionPoint: Coordinate | null;
  finalSegments: PathSegment[];
}

export interface SplitResult {
  behavior: 'reflect' | 'pass-through';
  newDirection: Direction;
  passThrough: boolean;
}

export interface PathIntegrityResult {
  isValid: boolean;
  issues: string[];
}
