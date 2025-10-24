// Unit tests for PathValidator

import { describe, it, expect, beforeEach } from 'vitest';
import { PathValidator } from '../path-validator.js';
import type { GridCell, Coordinate, DifficultyLevel, LaserPath } from '../../types/game.js';
import { createCoordinate } from '../../utils.js';
import { MATERIAL_COLORS, REFLECTION_BEHAVIORS } from '../../constants.js';

describe('PathValidator', () => {
  let testGrid: GridCell[][];
  const difficulty: DifficultyLevel = 'easy';

  beforeEach(() => {
    // Create a 6x6 test grid (easy difficulty)
    testGrid = [];
    for (let row = 0; row < 6; row++) {
      testGrid[row] = [];
      for (let col = 0; col < 6; col++) {
        testGrid[row][col] = {
          material: 'empty',
          coordinate: createCoordinate(row, col),
          color: MATERIAL_COLORS.empty,
          reflectionBehavior: REFLECTION_BEHAVIORS.empty,
        };
      }
    }
  });

  describe('validatePuzzleSolvability', () => {
    it('should validate solvable puzzle with clear path', () => {
      const entryPoint = createCoordinate(0, 2);
      const result = PathValidator.validatePuzzleSolvability(testGrid, entryPoint, difficulty);

      expect(result.isValid).toBe(true);
      expect(result.exitPoint).toBeDefined();
      expect(result.reason).toBe('Puzzle is solvable');
      expect(result.laserPath).toBeDefined();
    });

    it('should invalidate puzzle with no exit (all absorbers)', () => {
      // Fill grid with absorbers to block all paths
      for (let row = 1; row < 6; row++) {
        for (let col = 0; col < 6; col++) {
          testGrid[row][col] = {
            material: 'absorber',
            coordinate: createCoordinate(row, col),
            color: MATERIAL_COLORS.absorber,
            reflectionBehavior: REFLECTION_BEHAVIORS.absorber,
          };
        }
      }

      const entryPoint = createCoordinate(0, 2);
      const result = PathValidator.validatePuzzleSolvability(testGrid, entryPoint, difficulty);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('does not reach a valid exit point');
    });

    it('should validate puzzle with mirror reflections', () => {
      // Place a mirror to create a reflection path
      testGrid[2][2] = {
        material: 'mirror',
        coordinate: createCoordinate(2, 2),
        color: MATERIAL_COLORS.mirror,
        reflectionBehavior: REFLECTION_BEHAVIORS.mirror,
      };

      const entryPoint = createCoordinate(0, 2);
      const result = PathValidator.validatePuzzleSolvability(testGrid, entryPoint, difficulty);

      expect(result.isValid).toBe(true);
      expect(result.exitPoint).toBeDefined();
      expect(result.laserPath).toBeDefined();
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity for simple straight path', () => {
      const mockPath: LaserPath = {
        segments: [
          {
            start: createCoordinate(0, 0),
            end: createCoordinate(1, 0),
            direction: 'south',
            material: 'empty',
          },
          {
            start: createCoordinate(1, 0),
            end: createCoordinate(2, 0),
            direction: 'south',
            material: 'empty',
          },
        ],
        exitPoint: createCoordinate(6, 0),
        isComplete: true,
      };

      const complexity = PathValidator.calculateComplexity(mockPath, testGrid);

      expect(complexity.reflectionCount).toBe(0); // No direction changes
      expect(complexity.pathLength).toBe(2);
      expect(complexity.materialVariety).toBe(0); // Only empty cells
      expect(complexity.totalScore).toBeGreaterThan(0);
    });

    it('should calculate higher complexity for path with reflections', () => {
      // Add a mirror to the grid
      testGrid[1][1] = {
        material: 'mirror',
        coordinate: createCoordinate(1, 1),
        color: MATERIAL_COLORS.mirror,
        reflectionBehavior: REFLECTION_BEHAVIORS.mirror,
      };

      const mockPath: LaserPath = {
        segments: [
          {
            start: createCoordinate(0, 0),
            end: createCoordinate(1, 1),
            direction: 'south',
            material: 'empty',
          },
          {
            start: createCoordinate(1, 1),
            end: createCoordinate(1, 2),
            direction: 'east', // Direction change = reflection
            material: 'mirror',
          },
        ],
        exitPoint: createCoordinate(1, 6),
        isComplete: true,
      };

      const complexity = PathValidator.calculateComplexity(mockPath, testGrid);

      expect(complexity.reflectionCount).toBe(1); // One direction change
      expect(complexity.materialVariety).toBe(1); // One mirror
      expect(complexity.totalScore).toBeGreaterThan(5); // Higher due to reflection and material
    });

    it('should count material variety correctly', () => {
      // Add multiple material types
      testGrid[1][1] = {
        material: 'mirror',
        coordinate: createCoordinate(1, 1),
        color: MATERIAL_COLORS.mirror,
        reflectionBehavior: REFLECTION_BEHAVIORS.mirror,
      };

      testGrid[2][2] = {
        material: 'water',
        coordinate: createCoordinate(2, 2),
        color: MATERIAL_COLORS.water,
        reflectionBehavior: REFLECTION_BEHAVIORS.water,
      };

      testGrid[3][3] = {
        material: 'glass',
        coordinate: createCoordinate(3, 3),
        color: MATERIAL_COLORS.glass,
        reflectionBehavior: REFLECTION_BEHAVIORS.glass,
      };

      const mockPath: LaserPath = {
        segments: [
          {
            start: createCoordinate(0, 0),
            end: createCoordinate(1, 0),
            direction: 'south',
            material: 'empty',
          },
        ],
        exitPoint: createCoordinate(6, 0),
        isComplete: true,
      };

      const complexity = PathValidator.calculateComplexity(mockPath, testGrid);

      expect(complexity.materialVariety).toBe(3); // mirror, water, glass
    });
  });

  describe('validateDifficultyLevel', () => {
    it('should validate easy difficulty complexity', () => {
      const easyComplexity = {
        reflectionCount: 1,
        pathLength: 3,
        materialVariety: 1,
        quadrantsCovered: 2,
        totalScore: 10, // Within easy range (0-15)
      };

      const isValid = PathValidator.validateDifficultyLevel(easyComplexity, 'easy');
      expect(isValid).toBe(true);
    });

    it('should invalidate complexity too high for easy', () => {
      const hardComplexity = {
        reflectionCount: 10,
        pathLength: 15,
        materialVariety: 4,
        quadrantsCovered: 4,
        totalScore: 50, // Too high for easy (0-15)
      };

      const isValid = PathValidator.validateDifficultyLevel(hardComplexity, 'easy');
      expect(isValid).toBe(false);
    });

    it('should validate medium difficulty complexity', () => {
      const mediumComplexity = {
        reflectionCount: 3,
        pathLength: 8,
        materialVariety: 2,
        quadrantsCovered: 3,
        totalScore: 20, // Within medium range (10-30)
      };

      const isValid = PathValidator.validateDifficultyLevel(mediumComplexity, 'medium');
      expect(isValid).toBe(true);
    });

    it('should validate hard difficulty complexity', () => {
      const hardComplexity = {
        reflectionCount: 8,
        pathLength: 12,
        materialVariety: 4,
        quadrantsCovered: 4,
        totalScore: 40, // Within hard range (25-50)
      };

      const isValid = PathValidator.validateDifficultyLevel(hardComplexity, 'hard');
      expect(isValid).toBe(true);
    });
  });

  describe('generateTestEntryPoints', () => {
    it('should generate correct number of entry points for easy difficulty', () => {
      const entryPoints = PathValidator.generateTestEntryPoints('easy');

      // 6x6 grid: 6 top + 6 bottom + 4 left + 4 right = 20 points
      expect(entryPoints.length).toBe(20);
    });

    it('should generate entry points on grid boundaries', () => {
      const entryPoints = PathValidator.generateTestEntryPoints('easy');

      for (const point of entryPoints) {
        const isOnBoundary =
          point.row === 0 ||
          point.row === 5 || // Top or bottom edge
          point.col === 0 ||
          point.col === 5; // Left or right edge

        expect(isOnBoundary).toBe(true);
      }
    });

    it('should generate different counts for different difficulties', () => {
      const easyPoints = PathValidator.generateTestEntryPoints('easy');
      const mediumPoints = PathValidator.generateTestEntryPoints('medium');
      const hardPoints = PathValidator.generateTestEntryPoints('hard');

      expect(easyPoints.length).toBeLessThan(mediumPoints.length);
      expect(mediumPoints.length).toBeLessThan(hardPoints.length);
    });
  });

  describe('validateUniqueSolution', () => {
    it('should validate unique solution for solvable puzzle', () => {
      const entryPoint = createCoordinate(0, 2);
      const isUnique = PathValidator.validateUniqueSolution(testGrid, entryPoint, difficulty);

      expect(isUnique).toBe(true);
    });

    it('should invalidate unsolvable puzzle', () => {
      // Block the path with absorber
      testGrid[1][2] = {
        material: 'absorber',
        coordinate: createCoordinate(1, 2),
        color: MATERIAL_COLORS.absorber,
        reflectionBehavior: REFLECTION_BEHAVIORS.absorber,
      };

      const entryPoint = createCoordinate(0, 2);
      const isUnique = PathValidator.validateUniqueSolution(testGrid, entryPoint, difficulty);

      expect(isUnique).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty grid correctly', () => {
      const entryPoint = createCoordinate(0, 0);
      const result = PathValidator.validatePuzzleSolvability(testGrid, entryPoint, difficulty);

      expect(result.isValid).toBe(true);
      expect(result.exitPoint).toBeDefined();
    });

    it('should handle single cell grid', () => {
      const singleCellGrid: GridCell[][] = [
        [
          {
            material: 'empty',
            coordinate: createCoordinate(0, 0),
            color: MATERIAL_COLORS.empty,
            reflectionBehavior: REFLECTION_BEHAVIORS.empty,
          },
        ],
      ];

      // This would be an invalid scenario, but test robustness
      const entryPoint = createCoordinate(0, 0);

      // Should handle gracefully without crashing
      expect(() => {
        PathValidator.validatePuzzleSolvability(singleCellGrid, entryPoint, 'easy');
      }).not.toThrow();
    });

    it('should handle grid with all materials', () => {
      // Place one of each material type
      const materials: Array<'mirror' | 'water' | 'glass' | 'metal' | 'absorber'> = [
        'mirror',
        'water',
        'glass',
        'metal',
        'absorber',
      ];

      materials.forEach((material, index) => {
        testGrid[1][index] = {
          material,
          coordinate: createCoordinate(1, index),
          color: MATERIAL_COLORS[material],
          reflectionBehavior: REFLECTION_BEHAVIORS[material],
        };
      });

      const entryPoint = createCoordinate(0, 0);
      const result = PathValidator.validatePuzzleSolvability(testGrid, entryPoint, difficulty);

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });
  });
});
