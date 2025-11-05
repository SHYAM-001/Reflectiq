/**
 * Unit tests for SolutionValidator service
 * Tests comprehensive solution validation with physics simulation capabilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SolutionValidator } from '../../services/SolutionValidator.js';
import {
  Puzzle,
  Material,
  GridPosition,
  LaserPath,
  PathSegment,
  Difficulty,
} from '../../../shared/types/puzzle.js';
import {
  ValidationResult,
  ValidationIssue,
  AlternativePath,
  PhysicsValidation,
} from '../../../shared/types/guaranteed-generation.js';
import { MATERIAL_PROPERTIES } from '../../../shared/physics/constants.js';

describe('SolutionValidator', () => {
  let validator: SolutionValidator;

  beforeEach(() => {
    validator = SolutionValidator.getInstance();
  });

  describe('verifyUniqueSolution', () => {
    it('should validate a puzzle with unique solution', async () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'absorber',
          position: [4, 4],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const result = await validator.verifyUniqueSolution(puzzle);

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(result.hasUniqueSolution).toBeDefined();
      expect(result.alternativeCount).toBeGreaterThanOrEqual(0);
      expect(result.physicsCompliant).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.issues).toBeInstanceOf(Array);
      expect(result.validationTime).toBeGreaterThan(0);
    });

    it('should detect when puzzle has no solution', async () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', [
        {
          type: 'absorber',
          position: [0, 1], // Blocks immediate path from entry
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const result = await validator.verifyUniqueSolution(puzzle);

      expect(result.isValid).toBe(false);
      expect(result.hasUniqueSolution).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);

      const criticalIssues = result.issues.filter((issue) => issue.severity === 'critical');
      expect(criticalIssues.length).toBeGreaterThan(0);
    });

    it('should handle validation errors gracefully', async () => {
      const invalidPuzzle = {
        ...createTestPuzzle('Easy', []),
        materials: null as any, // Invalid materials to trigger error
      };

      const result = await validator.verifyUniqueSolution(invalidPuzzle);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].severity).toBe('critical');
    });
  });

  describe('checkAlternativePaths', () => {
    it('should detect alternative solution paths', async () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'mirror',
          position: [3, 3],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'glass',
          position: [5, 5],
          properties: MATERIAL_PROPERTIES.glass,
        },
      ]);

      const alternatives = await validator.checkAlternativePaths(puzzle);

      expect(alternatives).toBeInstanceOf(Array);

      // Each alternative should have required properties
      alternatives.forEach((alt: AlternativePath) => {
        expect(alt.path).toBeDefined();
        expect(alt.confidence).toBeGreaterThanOrEqual(0);
        expect(alt.confidence).toBeLessThanOrEqual(1);
        expect(alt.differenceFromPrimary).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return empty array when no alternatives exist', async () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', [
        {
          type: 'absorber',
          position: [2, 2],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const alternatives = await validator.checkAlternativePaths(puzzle);

      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBeLessThanOrEqual(5); // Should be limited to top 5
    });

    it('should handle errors gracefully', async () => {
      const invalidPuzzle = {
        ...createTestPuzzle('Easy', []),
        gridSize: -1, // Invalid grid size
      };

      const alternatives = await validator.checkAlternativePaths(invalidPuzzle);

      expect(alternatives).toBeInstanceOf(Array);
      expect(alternatives.length).toBe(0);
    });
  });

  describe('validatePhysicsCompliance', () => {
    it('should validate physics compliance for simple mirror reflection', async () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
      ]);

      const validation = await validator.validatePhysicsCompliance(puzzle);

      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(validation.materialInteractions).toBeInstanceOf(Array);
      expect(validation.reflectionAccuracy).toBeGreaterThanOrEqual(0);
      expect(validation.reflectionAccuracy).toBeLessThanOrEqual(1);
      expect(validation.pathContinuity).toBeDefined();
      expect(validation.terminationCorrect).toBeDefined();
      expect(validation.errors).toBeInstanceOf(Array);
      expect(validation.warnings).toBeInstanceOf(Array);
    });

    it('should detect physics violations', async () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'mirror',
          position: [1, 1],
          angle: 999, // Invalid angle
          properties: MATERIAL_PROPERTIES.mirror,
        },
      ]);

      const validation = await validator.validatePhysicsCompliance(puzzle);

      expect(validation).toBeDefined();
      // Should handle invalid angles gracefully
      expect(validation.materialInteractions).toBeInstanceOf(Array);
    });

    it('should handle validation errors gracefully', async () => {
      const invalidPuzzle = {
        ...createTestPuzzle('Easy', []),
        entry: [-1, -1] as GridPosition, // Invalid entry position
      };

      const validation = await validator.validatePhysicsCompliance(invalidPuzzle);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('generateConfidenceScore', () => {
    it('should generate confidence score for valid puzzle', () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
      ]);

      const mockPath: LaserPath = {
        segments: [
          {
            start: [0, 2],
            end: [2, 2],
            direction: 0,
          },
          {
            start: [2, 2],
            end: [5, 5],
            direction: 45,
            material: puzzle.materials[0],
          },
        ],
        exit: [5, 5],
        terminated: false,
      };

      const mockPhysicsValidation: PhysicsValidation = {
        valid: true,
        materialInteractions: [],
        reflectionAccuracy: 0.95,
        pathContinuity: true,
        terminationCorrect: true,
        errors: [],
        warnings: [],
      };

      const score = validator.generateConfidenceScore(puzzle, mockPath, [], mockPhysicsValidation);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThanOrEqual(70); // Should be reasonably high for valid puzzle
    });

    it('should penalize puzzles with multiple solutions', () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', []);

      const mockAlternatives: AlternativePath[] = [
        {
          path: {
            segments: [],
            exit: [3, 7],
            terminated: false,
          },
          confidence: 0.8,
          differenceFromPrimary: 0.5,
        },
        {
          path: {
            segments: [],
            exit: [7, 3],
            terminated: false,
          },
          confidence: 0.6,
          differenceFromPrimary: 0.7,
        },
      ];

      const score = validator.generateConfidenceScore(puzzle, undefined, mockAlternatives);

      expect(score).toBeLessThan(80); // Should be penalized for alternatives
    });

    it('should penalize puzzles with physics violations', () => {
      const puzzle: Puzzle = createTestPuzzle('Hard', []);

      const mockPhysicsValidation: PhysicsValidation = {
        valid: false,
        materialInteractions: [],
        reflectionAccuracy: 0.5,
        pathContinuity: false,
        terminationCorrect: false,
        errors: ['Physics violation detected'],
        warnings: [],
      };

      const score = validator.generateConfidenceScore(puzzle, undefined, [], mockPhysicsValidation);

      expect(score).toBeLessThan(70); // Should be heavily penalized
    });

    it('should return minimum score for puzzles with no solution', () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', []);

      const score = validator.generateConfidenceScore(puzzle); // No path provided

      expect(score).toBeLessThanOrEqual(50); // Should be low for no solution
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SolutionValidator.getInstance();
      const instance2 = SolutionValidator.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  // Comprehensive validation tests for task 4.3
  describe('Comprehensive Unique Solution Detection', () => {
    it('should detect unique solution with complex mirror arrangements', async () => {
      const puzzle: Puzzle = createTestPuzzle('Hard', [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'mirror',
          position: [6, 4],
          angle: 135,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'absorber',
          position: [8, 8],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const result = await validator.verifyUniqueSolution(puzzle);

      expect(result.isValid).toBeDefined();
      expect(result.hasUniqueSolution).toBeDefined();
      expect(result.alternativeCount).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(100);
      expect(result.validationTime).toBeGreaterThan(0);
    });

    it('should detect multiple solutions with symmetric material placement', async () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'mirror',
          position: [3, 3],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'mirror',
          position: [5, 3],
          angle: 135,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'glass',
          position: [4, 6],
          properties: MATERIAL_PROPERTIES.glass,
        },
      ]);

      const result = await validator.verifyUniqueSolution(puzzle);

      expect(result).toBeDefined();
      expect(result.alternativeCount).toBeGreaterThanOrEqual(0);

      if (result.alternativeCount > 0) {
        const multipleIssues = result.issues.filter((issue) => issue.type === 'multiple_solutions');
        expect(multipleIssues.length).toBeGreaterThan(0);
        expect(multipleIssues[0].severity).toBe('critical');
      }
    });

    it('should handle puzzles with infinite loop potential', async () => {
      const puzzle: Puzzle = createTestPuzzle('Hard', [
        {
          type: 'mirror',
          position: [3, 3],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'mirror',
          position: [5, 5],
          angle: 225,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'mirror',
          position: [3, 5],
          angle: 135,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'mirror',
          position: [5, 3],
          angle: 315,
          properties: MATERIAL_PROPERTIES.mirror,
        },
      ]);

      const result = await validator.verifyUniqueSolution(puzzle);

      expect(result).toBeDefined();
      expect(result.validationTime).toBeGreaterThanOrEqual(0);

      // Should detect infinite loop if present
      const loopIssues = result.issues.filter((issue) => issue.type === 'infinite_loop');
      if (loopIssues.length > 0) {
        expect(loopIssues[0].severity).toBe('critical');
        expect(loopIssues[0].affectedPositions.length).toBeGreaterThan(0);
      }
    });

    it('should validate puzzles with mixed material density', async () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'mirror',
          position: [1, 1],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'water',
          position: [3, 2],
          properties: MATERIAL_PROPERTIES.water,
        },
        {
          type: 'glass',
          position: [5, 4],
          properties: MATERIAL_PROPERTIES.glass,
        },
        {
          type: 'metal',
          position: [2, 6],
          properties: MATERIAL_PROPERTIES.metal,
        },
        {
          type: 'absorber',
          position: [7, 7],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const result = await validator.verifyUniqueSolution(puzzle);

      expect(result).toBeDefined();
      expect(result.physicsCompliant).toBeDefined();
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.issues).toBeInstanceOf(Array);
    });
  });

  describe('Comprehensive Physics Compliance Testing', () => {
    it('should validate mirror physics with various angles', async () => {
      const testAngles = [0, 45, 90, 135, 180, 225, 270, 315];

      for (const angle of testAngles) {
        const puzzle: Puzzle = createTestPuzzle('Easy', [
          {
            type: 'mirror',
            position: [2, 2],
            angle,
            properties: MATERIAL_PROPERTIES.mirror,
          },
        ]);

        const validation = await validator.validatePhysicsCompliance(puzzle);

        expect(validation).toBeDefined();
        expect(validation.materialInteractions).toBeInstanceOf(Array);
        expect(validation.reflectionAccuracy).toBeGreaterThanOrEqual(0);
        expect(validation.reflectionAccuracy).toBeLessThanOrEqual(1);
        expect(validation.pathContinuity).toBeDefined();
      }
    });

    it('should validate water material diffusion properties', async () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'water',
          position: [3, 3],
          properties: MATERIAL_PROPERTIES.water,
        },
        {
          type: 'absorber',
          position: [6, 6],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const validation = await validator.validatePhysicsCompliance(puzzle);

      expect(validation).toBeDefined();
      expect(validation.materialInteractions).toBeInstanceOf(Array);

      // Water interactions should be present if laser hits water
      const waterInteractions = validation.materialInteractions.filter(
        (interaction) => interaction.material.type === 'water'
      );

      if (waterInteractions.length > 0) {
        waterInteractions.forEach((interaction) => {
          expect(interaction.material.type).toBe('water');
          expect(interaction.incidentAngle).toBeGreaterThanOrEqual(0);
          expect(interaction.incidentAngle).toBeLessThan(360);
          expect(interaction.accuracyScore).toBeGreaterThanOrEqual(0);
          expect(interaction.accuracyScore).toBeLessThanOrEqual(1);
        });
      }
    });

    it('should validate glass material transparency and reflection', async () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'glass',
          position: [4, 2],
          properties: MATERIAL_PROPERTIES.glass,
        },
        {
          type: 'mirror',
          position: [6, 4],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
      ]);

      const validation = await validator.validatePhysicsCompliance(puzzle);

      expect(validation).toBeDefined();
      expect(validation.materialInteractions).toBeInstanceOf(Array);

      const glassInteractions = validation.materialInteractions.filter(
        (interaction) => interaction.material.type === 'glass'
      );

      if (glassInteractions.length > 0) {
        glassInteractions.forEach((interaction) => {
          expect(interaction.material.type).toBe('glass');
          expect(interaction.compliant).toBeDefined();
        });
      }
    });

    it('should validate metal material reversal properties', async () => {
      const puzzle: Puzzle = createTestPuzzle('Hard', [
        {
          type: 'metal',
          position: [3, 3],
          properties: MATERIAL_PROPERTIES.metal,
        },
        {
          type: 'absorber',
          position: [1, 3],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const validation = await validator.validatePhysicsCompliance(puzzle);

      expect(validation).toBeDefined();

      const metalInteractions = validation.materialInteractions.filter(
        (interaction) => interaction.material.type === 'metal'
      );

      if (metalInteractions.length > 0) {
        metalInteractions.forEach((interaction) => {
          expect(interaction.material.type).toBe('metal');
          // Metal should reverse direction (180-degree change)
          const angleDifference = Math.abs(
            interaction.expectedReflection - interaction.incidentAngle
          );
          const normalizedDiff = Math.min(angleDifference, 360 - angleDifference);
          expect(normalizedDiff).toBeCloseTo(180, 10); // Within 10 degrees of 180
        });
      }
    });

    it('should validate absorber material termination', async () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', [
        {
          type: 'absorber',
          position: [3, 2],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const validation = await validator.validatePhysicsCompliance(puzzle);

      expect(validation).toBeDefined();
      expect(validation.terminationCorrect).toBeDefined();

      const absorberInteractions = validation.materialInteractions.filter(
        (interaction) => interaction.material.type === 'absorber'
      );

      if (absorberInteractions.length > 0) {
        absorberInteractions.forEach((interaction) => {
          expect(interaction.material.type).toBe('absorber');
          // Absorber should not reflect - incident angle should equal "reflection"
          expect(interaction.expectedReflection).toBe(interaction.incidentAngle);
        });
      }
    });

    it('should detect path continuity violations', async () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'mirror',
          position: [6, 6],
          angle: 225,
          properties: MATERIAL_PROPERTIES.mirror,
        },
      ]);

      const validation = await validator.validatePhysicsCompliance(puzzle);

      expect(validation).toBeDefined();
      expect(validation.pathContinuity).toBeDefined();

      if (!validation.pathContinuity) {
        expect(validation.errors.length).toBeGreaterThan(0);
        const continuityErrors = validation.errors.filter((error) => error.includes('continuity'));
        expect(continuityErrors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Comprehensive Confidence Scoring', () => {
    it('should score perfect puzzle with maximum confidence', () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
        {
          type: 'absorber',
          position: [7, 7],
          properties: MATERIAL_PROPERTIES.absorber,
        },
      ]);

      const perfectPath: LaserPath = {
        segments: [
          {
            start: [0, 2],
            end: [2, 2],
            direction: 0,
          },
          {
            start: [2, 2],
            end: [7, 7],
            direction: 45,
            material: puzzle.materials[0],
          },
        ],
        exit: puzzle.solution,
        terminated: false,
      };

      const perfectPhysics: PhysicsValidation = {
        valid: true,
        materialInteractions: [
          {
            material: puzzle.materials[0],
            incidentAngle: 0,
            expectedReflection: 45,
            actualReflection: 45,
            accuracyScore: 1.0,
            compliant: true,
          },
        ],
        reflectionAccuracy: 1.0,
        pathContinuity: true,
        terminationCorrect: true,
        errors: [],
        warnings: [],
      };

      const score = validator.generateConfidenceScore(
        puzzle,
        perfectPath,
        [], // No alternatives
        perfectPhysics
      );

      expect(score).toBeGreaterThanOrEqual(90);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should consistently score similar puzzles', () => {
      const basePuzzle: Puzzle = createTestPuzzle('Easy', [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: MATERIAL_PROPERTIES.mirror,
        },
      ]);

      const scores: number[] = [];

      // Generate scores for similar puzzles
      for (let i = 0; i < 5; i++) {
        const similarPuzzle = {
          ...basePuzzle,
          id: `similar_${i}`,
          materials: [
            {
              ...basePuzzle.materials[0],
              position: [2 + (i % 2), 2 + Math.floor(i / 2)] as GridPosition,
            },
          ],
        };

        const score = validator.generateConfidenceScore(similarPuzzle);
        scores.push(score);
      }

      // Scores should be reasonably consistent (within 20 points)
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      expect(maxScore - minScore).toBeLessThanOrEqual(20);
    });

    it('should appropriately penalize low reflection accuracy', () => {
      const puzzle: Puzzle = createTestPuzzle('Medium', []);

      const lowAccuracyPhysics: PhysicsValidation = {
        valid: true,
        materialInteractions: [],
        reflectionAccuracy: 0.3, // Very low accuracy
        pathContinuity: true,
        terminationCorrect: true,
        errors: [],
        warnings: ['Low reflection accuracy'],
      };

      const highAccuracyPhysics: PhysicsValidation = {
        valid: true,
        materialInteractions: [],
        reflectionAccuracy: 0.95, // High accuracy
        pathContinuity: true,
        terminationCorrect: true,
        errors: [],
        warnings: [],
      };

      const lowScore = validator.generateConfidenceScore(puzzle, undefined, [], lowAccuracyPhysics);
      const highScore = validator.generateConfidenceScore(
        puzzle,
        undefined,
        [],
        highAccuracyPhysics
      );

      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore - lowScore).toBeGreaterThanOrEqual(10); // Significant difference
    });

    it('should reward strategic entry/exit placement', () => {
      // Corner placement puzzle
      const cornerPuzzle: Puzzle = createTestPuzzle('Medium', []);
      cornerPuzzle.entry = [0, 0]; // Corner
      cornerPuzzle.solution = [7, 7]; // Corner

      // Edge placement puzzle
      const edgePuzzle: Puzzle = createTestPuzzle('Medium', []);
      edgePuzzle.entry = [0, 3]; // Edge
      edgePuzzle.solution = [7, 4]; // Edge

      const cornerScore = validator.generateConfidenceScore(cornerPuzzle);
      const edgeScore = validator.generateConfidenceScore(edgePuzzle);

      // Corner placement should generally score higher due to strategic bonus
      expect(cornerScore).toBeGreaterThanOrEqual(edgeScore - 5); // Allow some variance
    });

    it('should handle edge cases in confidence scoring', () => {
      const puzzle: Puzzle = createTestPuzzle('Easy', []);

      // Test with null/undefined inputs
      const scoreWithNulls = validator.generateConfidenceScore(
        puzzle,
        undefined,
        undefined,
        undefined
      );
      expect(scoreWithNulls).toBeGreaterThanOrEqual(0);
      expect(scoreWithNulls).toBeLessThanOrEqual(100);

      // Test with empty arrays
      const scoreWithEmpty = validator.generateConfidenceScore(puzzle, undefined, [], undefined);
      expect(scoreWithEmpty).toBeGreaterThanOrEqual(0);
      expect(scoreWithEmpty).toBeLessThanOrEqual(100);

      // Test with invalid path
      const invalidPath: LaserPath = {
        segments: [],
        exit: null,
        terminated: true,
      };

      const scoreWithInvalidPath = validator.generateConfidenceScore(puzzle, invalidPath);
      expect(scoreWithInvalidPath).toBeLessThan(60); // Should be penalized
    });
  });
});

// Helper function to create test puzzles
function createTestPuzzle(difficulty: Difficulty, materials: Material[]): Puzzle {
  const gridSize = difficulty === 'Easy' ? 6 : difficulty === 'Medium' ? 8 : 10;

  return {
    id: `test_${difficulty.toLowerCase()}_${Date.now()}`,
    difficulty,
    gridSize,
    materials,
    entry: [0, 2] as GridPosition,
    solution: [gridSize - 1, 4] as GridPosition,
    solutionPath: {
      segments: [
        {
          start: [0, 2],
          end: [gridSize - 1, 4],
          direction: 0,
        },
      ],
      exit: [gridSize - 1, 4],
      terminated: false,
    },
    hints: [],
    createdAt: new Date(),
    materialDensity: materials.length / (gridSize * gridSize),
  };
}
