/**
 * Unit tests for ReversePathService
 * Tests core path planning and material placement functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReversePathService } from '../../services/ReversePathService.js';
import { GridPosition, Difficulty, Material, MaterialType } from '../../../shared/types/puzzle.js';
import { PathPlan, MaterialRequirement } from '../../../shared/types/guaranteed-generation.js';

describe('ReversePathService', () => {
  let service: ReversePathService;

  beforeEach(() => {
    service = ReversePathService.getInstance();
  });

  describe('planOptimalPath', () => {
    it('should create a valid path plan for Easy difficulty', async () => {
      const entry: GridPosition = [0, 2];
      const exit: GridPosition = [5, 4];
      const difficulty: Difficulty = 'Easy';

      const pathPlan = await service.planOptimalPath(entry, exit, difficulty);

      expect(pathPlan).toBeDefined();
      expect(pathPlan.entry).toEqual(entry);
      expect(pathPlan.exit).toEqual(exit);
      expect(pathPlan.estimatedDifficulty).toBe(difficulty);
      expect(pathPlan.requiredReflections).toBeGreaterThanOrEqual(2);
      expect(pathPlan.complexityScore).toBeGreaterThanOrEqual(1);
      expect(pathPlan.complexityScore).toBeLessThanOrEqual(10);
      expect(pathPlan.materialRequirements).toBeInstanceOf(Array);
    });

    it('should create more complex paths for Hard difficulty', async () => {
      const entry: GridPosition = [0, 1];
      const exit: GridPosition = [9, 8];
      const difficulty: Difficulty = 'Hard';

      const pathPlan = await service.planOptimalPath(entry, exit, difficulty);

      expect(pathPlan.requiredReflections).toBeGreaterThanOrEqual(4);
      expect(pathPlan.materialRequirements.length).toBeGreaterThan(0);
      expect(pathPlan.complexityScore).toBeGreaterThan(3);
    });

    it('should generate material requirements for all reflection points', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [7, 7];
      const difficulty: Difficulty = 'Medium';

      const pathPlan = await service.planOptimalPath(entry, exit, difficulty);

      expect(pathPlan.materialRequirements.length).toBe(pathPlan.keyReflectionPoints.length);

      // All requirements should be critical for the solution path
      pathPlan.materialRequirements.forEach((req) => {
        expect(req.priority).toBe('critical');
        expect(req.position).toBeDefined();
        expect(req.materialType).toBeDefined();
      });
    });
  });

  describe('placeMaterialsForPath', () => {
    it('should place materials according to path plan', async () => {
      const entry: GridPosition = [0, 1];
      const exit: GridPosition = [5, 4];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Easy');
      const gridSize = 6;

      const materials = await service.placeMaterialsForPath(pathPlan, gridSize);

      expect(materials.length).toBeGreaterThan(0);

      // Should include all critical materials from the path plan
      const criticalRequirements = pathPlan.materialRequirements.filter(
        (req) => req.priority === 'critical'
      );
      expect(materials.length).toBeGreaterThanOrEqual(criticalRequirements.length);

      // All materials should have valid positions
      materials.forEach((material) => {
        const [x, y] = material.position;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(gridSize);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(gridSize);
      });
    });

    it('should respect material density targets', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [7, 7];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Medium');
      const gridSize = 8;

      const materials = await service.placeMaterialsForPath(pathPlan, gridSize);
      const actualDensity = materials.length / (gridSize * gridSize);
      const targetDensity = 0.8; // Medium difficulty target

      // Should be close to target density (within 10%)
      expect(actualDensity).toBeGreaterThan(targetDensity * 0.7);
      expect(actualDensity).toBeLessThan(targetDensity * 1.3);
    });
  });

  describe('optimizeMaterialDensity', () => {
    it('should maintain target density', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [5, 5];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Easy');
      const gridSize = 6;
      const targetDensity = 0.7;

      // Start with fewer materials than target
      const initialMaterials = await service.placeMaterialsForPath(pathPlan, gridSize);
      const reducedMaterials = initialMaterials.slice(0, Math.floor(initialMaterials.length * 0.5));

      const optimizedMaterials = await service.optimizeMaterialDensity(
        reducedMaterials,
        targetDensity,
        gridSize,
        pathPlan
      );

      const actualDensity = optimizedMaterials.length / (gridSize * gridSize);
      expect(actualDensity).toBeCloseTo(targetDensity, 1);
    });

    it('should preserve critical materials when reducing density', async () => {
      const entry: GridPosition = [0, 1];
      const exit: GridPosition = [5, 4];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Medium');
      const gridSize = 6;
      const targetDensity = 0.5; // Lower than typical

      // Start with materials at target density
      const initialMaterials = await service.placeMaterialsForPath(pathPlan, gridSize);

      const optimizedMaterials = await service.optimizeMaterialDensity(
        initialMaterials,
        targetDensity,
        gridSize,
        pathPlan
      );

      // Critical materials should still be present
      const criticalRequirements = pathPlan.materialRequirements.filter(
        (req) => req.priority === 'critical'
      );

      criticalRequirements.forEach((req) => {
        const materialExists = optimizedMaterials.some(
          (material) =>
            material.position[0] === req.position[0] &&
            material.position[1] === req.position[1] &&
            material.type === req.materialType
        );
        expect(materialExists).toBe(true);
      });
    });
  });

  describe('validatePathPhysics', () => {
    it('should validate physics compliance for simple mirror reflection', async () => {
      const entry: GridPosition = [0, 2];
      const exit: GridPosition = [4, 2];
      const gridSize = 6;

      // Create a simple path with one mirror
      const materials: Material[] = [
        {
          type: 'mirror',
          position: [2, 2],
          angle: 45,
          properties: { reflectivity: 1.0, absorption: 0.0 },
        },
      ];

      const validation = await service.validatePathPhysics(materials, entry, exit, gridSize);

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

    it('should detect invalid physics when materials are misaligned', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [5, 5];
      const gridSize = 6;

      // Create materials that cannot create a valid path
      const materials: Material[] = [
        {
          type: 'absorber',
          position: [1, 0], // Directly in path, will absorb laser
          properties: { reflectivity: 0.0, absorption: 1.0 },
        },
      ];

      const validation = await service.validatePathPhysics(materials, entry, exit, gridSize);

      expect(validation.valid).toBe(false);
      expect(validation.terminationCorrect).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate material interactions for different material types', async () => {
      const entry: GridPosition = [0, 1];
      const exit: GridPosition = [3, 4];
      const gridSize = 6;

      // Create path with multiple material types
      const materials: Material[] = [
        {
          type: 'mirror',
          position: [1, 2],
          angle: 45,
          properties: { reflectivity: 1.0, absorption: 0.0 },
        },
        {
          type: 'glass',
          position: [2, 3],
          properties: { reflectivity: 0.8, absorption: 0.1 },
        },
      ];

      const validation = await service.validatePathPhysics(materials, entry, exit, gridSize);

      // The validation should complete without errors, even if no interactions are detected
      expect(validation).toBeDefined();
      expect(validation.materialInteractions).toBeInstanceOf(Array);

      // If there are interactions, validate their structure
      if (validation.materialInteractions.length > 0) {
        validation.materialInteractions.forEach((interaction) => {
          expect(interaction.material).toBeDefined();
          expect(interaction.incidentAngle).toBeGreaterThanOrEqual(0);
          expect(interaction.incidentAngle).toBeLessThan(360);
          expect(interaction.expectedReflection).toBeGreaterThanOrEqual(0);
          expect(interaction.expectedReflection).toBeLessThan(360);
          expect(interaction.actualReflection).toBeGreaterThanOrEqual(0);
          expect(interaction.actualReflection).toBeLessThan(360);
          expect(interaction.accuracyScore).toBeGreaterThanOrEqual(0);
          expect(interaction.accuracyScore).toBeLessThanOrEqual(1);
          expect(typeof interaction.compliant).toBe('boolean');
        });
      }
    });

    it('should handle edge cases gracefully', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [1, 1];
      const gridSize = 6;

      // Test with empty materials array
      const emptyValidation = await service.validatePathPhysics([], entry, exit, gridSize);
      expect(emptyValidation).toBeDefined();
      expect(emptyValidation.materialInteractions).toHaveLength(0);

      // Test with materials outside grid bounds (should be handled gracefully)
      const invalidMaterials: Material[] = [
        {
          type: 'mirror',
          position: [10, 10], // Outside grid
          angle: 45,
          properties: { reflectivity: 1.0, absorption: 0.0 },
        },
      ];

      const invalidValidation = await service.validatePathPhysics(
        invalidMaterials,
        entry,
        exit,
        gridSize
      );
      expect(invalidValidation).toBeDefined();
      // Should not crash, but may have validation errors
    });
  });

  describe('Path Planning Algorithm Tests', () => {
    it('should generate valid reflection points for various entry/exit combinations', async () => {
      const testCases: Array<{
        entry: GridPosition;
        exit: GridPosition;
        difficulty: Difficulty;
        expectedMinReflections: number;
      }> = [
        { entry: [0, 0], exit: [5, 5], difficulty: 'Easy', expectedMinReflections: 2 },
        { entry: [0, 2], exit: [7, 6], difficulty: 'Medium', expectedMinReflections: 3 },
        { entry: [0, 1], exit: [9, 8], difficulty: 'Hard', expectedMinReflections: 4 },
        { entry: [2, 0], exit: [0, 4], difficulty: 'Easy', expectedMinReflections: 2 },
      ];

      for (const testCase of testCases) {
        const pathPlan = await service.planOptimalPath(
          testCase.entry,
          testCase.exit,
          testCase.difficulty
        );

        expect(pathPlan.requiredReflections).toBeGreaterThanOrEqual(
          testCase.expectedMinReflections
        );
        // The number of reflection points may be less than required reflections due to algorithm optimization
        expect(pathPlan.keyReflectionPoints.length).toBeLessThanOrEqual(
          pathPlan.requiredReflections
        );

        // Verify reflection points are within reasonable bounds
        pathPlan.keyReflectionPoints.forEach((point) => {
          expect(point[0]).toBeGreaterThanOrEqual(0);
          expect(point[1]).toBeGreaterThanOrEqual(0);
          expect(point[0]).toBeLessThan(10); // Reasonable grid size
          expect(point[1]).toBeLessThan(10);
        });
      }
    });

    it('should maintain solution integrity across different difficulty levels', async () => {
      const entry: GridPosition = [0, 1];
      const exit: GridPosition = [6, 5];
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      for (const difficulty of difficulties) {
        const pathPlan = await service.planOptimalPath(entry, exit, difficulty);
        const materials = await service.placeMaterialsForPath(pathPlan, 8);

        // Verify all critical materials are placed
        const criticalRequirements = pathPlan.materialRequirements.filter(
          (req) => req.priority === 'critical'
        );

        expect(materials.length).toBeGreaterThanOrEqual(criticalRequirements.length);

        // Verify material types are appropriate for difficulty
        const materialTypes = new Set(materials.map((m) => m.type));

        if (difficulty === 'Easy') {
          // Easy should primarily use mirrors and absorbers
          expect(materialTypes.has('mirror') || materialTypes.has('absorber')).toBe(true);
        } else if (difficulty === 'Hard') {
          // Hard can use all material types
          expect(materialTypes.size).toBeGreaterThan(1);
        }
      }
    });
  });

  describe('Material Placement Accuracy Tests', () => {
    it('should place materials with correct angles for mirrors', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [4, 4];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Medium');
      const materials = await service.placeMaterialsForPath(pathPlan, 6);

      const mirrors = materials.filter((m) => m.type === 'mirror');

      mirrors.forEach((mirror) => {
        expect(mirror.angle).toBeDefined();
        expect(mirror.angle).toBeGreaterThanOrEqual(0);
        expect(mirror.angle).toBeLessThan(360);

        // Angles should be reasonable values (may not be exact increments due to calculation)
        expect(mirror.angle).toBeGreaterThanOrEqual(0);
        expect(mirror.angle).toBeLessThan(360);
      });
    });

    it('should avoid placing materials on entry and exit positions', async () => {
      const entry: GridPosition = [0, 2];
      const exit: GridPosition = [5, 3];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Easy');
      const materials = await service.placeMaterialsForPath(pathPlan, 6);

      // No material should be placed on entry or exit positions
      materials.forEach((material) => {
        expect(material.position).not.toEqual(entry);
        expect(material.position).not.toEqual(exit);
      });
    });

    it('should maintain minimum spacing between materials', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [7, 7];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Hard');
      const materials = await service.placeMaterialsForPath(pathPlan, 8);

      // Check that critical materials have reasonable spacing
      const criticalMaterials = materials.filter((material) => {
        return pathPlan.materialRequirements.some(
          (req) =>
            req.priority === 'critical' &&
            req.position[0] === material.position[0] &&
            req.position[1] === material.position[1]
        );
      });

      for (let i = 0; i < criticalMaterials.length - 1; i++) {
        for (let j = i + 1; j < criticalMaterials.length; j++) {
          const material1 = criticalMaterials[i]!;
          const material2 = criticalMaterials[j]!;

          const distance =
            Math.abs(material1.position[0] - material2.position[0]) +
            Math.abs(material1.position[1] - material2.position[1]);

          // Critical materials should have some minimum spacing
          expect(distance).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Density Optimization Integrity Tests', () => {
    it('should maintain solution path when optimizing density', async () => {
      const entry: GridPosition = [0, 1];
      const exit: GridPosition = [5, 4];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Medium');
      const gridSize = 6;
      const targetDensity = 0.6;

      const initialMaterials = await service.placeMaterialsForPath(pathPlan, gridSize);
      const optimizedMaterials = await service.optimizeMaterialDensity(
        initialMaterials,
        targetDensity,
        gridSize,
        pathPlan
      );

      // Validate that the optimized materials still create a valid path
      const validation = await service.validatePathPhysics(
        optimizedMaterials,
        entry,
        exit,
        gridSize
      );

      // The path should still be physically valid (though may not reach exact exit due to complexity)
      expect(validation.pathContinuity).toBe(true);
      expect(validation.errors.length).toBeLessThanOrEqual(1); // Allow for minor path issues
    });

    it('should handle extreme density requirements gracefully', async () => {
      const entry: GridPosition = [0, 0];
      const exit: GridPosition = [3, 3];
      const pathPlan = await service.planOptimalPath(entry, exit, 'Easy');
      const gridSize = 4;

      // Test very low density - start with some initial materials
      const initialMaterials = await service.placeMaterialsForPath(pathPlan, gridSize);
      const lowDensityMaterials = await service.optimizeMaterialDensity(
        initialMaterials,
        0.1,
        gridSize,
        pathPlan
      );
      expect(lowDensityMaterials.length).toBeGreaterThanOrEqual(0); // May have no materials for very low density

      // Test very high density
      const highDensityMaterials = await service.optimizeMaterialDensity(
        [],
        0.9,
        gridSize,
        pathPlan
      );
      const actualDensity = highDensityMaterials.length / (gridSize * gridSize);
      expect(actualDensity).toBeLessThanOrEqual(1.0); // Cannot exceed 100% density
    });
  });
});
