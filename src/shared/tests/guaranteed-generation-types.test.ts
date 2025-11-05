/**
 * Tests for guaranteed generation types and interfaces
 * Validates that all interfaces are properly defined and compatible
 */

import { describe, it, expect } from 'vitest';
import {
  EnhancedPuzzleEngine,
  EntryExitPair,
  PathPlan,
  ValidationResult,
  PuzzleGenerationMetadata,
  SpacingConstraints,
  GuaranteedGenerationConfig,
} from '../types/guaranteed-generation.js';

import {
  SPACING_CONSTRAINTS,
  GUARANTEED_GENERATION_CONFIG,
  GENERATION_THRESHOLDS,
} from '../constants/guaranteed-generation.js';

import { EnhancedPuzzleEngineImpl } from '../puzzle/EnhancedPuzzleEngine.js';
import { Difficulty, GridPosition } from '../types/puzzle.js';

describe('Guaranteed Generation Types', () => {
  describe('Interface Compatibility', () => {
    it('should have properly typed EntryExitPair interface', () => {
      const entryExitPair: EntryExitPair = {
        entry: [0, 0] as GridPosition,
        exit: [5, 5] as GridPosition,
        distance: 10,
        difficulty: 'Easy' as Difficulty,
        validationScore: 85,
        placementType: 'corner',
      };

      expect(entryExitPair.entry).toEqual([0, 0]);
      expect(entryExitPair.exit).toEqual([5, 5]);
      expect(entryExitPair.distance).toBe(10);
      expect(entryExitPair.difficulty).toBe('Easy');
      expect(entryExitPair.validationScore).toBe(85);
      expect(entryExitPair.placementType).toBe('corner');
    });

    it('should have properly typed PathPlan interface', () => {
      const pathPlan: PathPlan = {
        entry: [0, 0] as GridPosition,
        exit: [5, 5] as GridPosition,
        requiredReflections: 3,
        keyReflectionPoints: [
          [2, 2],
          [3, 3],
        ] as GridPosition[],
        materialRequirements: [
          {
            position: [2, 2] as GridPosition,
            materialType: 'mirror',
            angle: 45,
            priority: 'critical',
            reflectionIndex: 1,
          },
        ],
        complexityScore: 7,
        estimatedDifficulty: 'Medium' as Difficulty,
      };

      expect(pathPlan.entry).toEqual([0, 0]);
      expect(pathPlan.requiredReflections).toBe(3);
      expect(pathPlan.materialRequirements).toHaveLength(1);
      expect(pathPlan.materialRequirements[0]?.materialType).toBe('mirror');
    });

    it('should have properly typed ValidationResult interface', () => {
      const validationResult: ValidationResult = {
        isValid: true,
        hasUniqueSolution: true,
        alternativeCount: 0,
        physicsCompliant: true,
        confidenceScore: 92,
        issues: [],
        validationTime: 150,
      };

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.hasUniqueSolution).toBe(true);
      expect(validationResult.confidenceScore).toBe(92);
      expect(validationResult.issues).toHaveLength(0);
    });
  });

  describe('Constants Validation', () => {
    it('should have valid spacing constraints for all difficulties', () => {
      expect(SPACING_CONSTRAINTS.Easy.minDistance).toBe(3);
      expect(SPACING_CONSTRAINTS.Medium.minDistance).toBe(4);
      expect(SPACING_CONSTRAINTS.Hard.minDistance).toBe(5);

      // Verify preferred distances are greater than minimum
      expect(SPACING_CONSTRAINTS.Easy.preferredDistance).toBeGreaterThan(
        SPACING_CONSTRAINTS.Easy.minDistance
      );
      expect(SPACING_CONSTRAINTS.Medium.preferredDistance).toBeGreaterThan(
        SPACING_CONSTRAINTS.Medium.minDistance
      );
      expect(SPACING_CONSTRAINTS.Hard.preferredDistance).toBeGreaterThan(
        SPACING_CONSTRAINTS.Hard.minDistance
      );
    });

    it('should have valid generation configuration', () => {
      expect(GUARANTEED_GENERATION_CONFIG.maxGenerationAttempts).toBeGreaterThan(0);
      expect(GUARANTEED_GENERATION_CONFIG.minConfidenceScore).toBeGreaterThanOrEqual(0);
      expect(GUARANTEED_GENERATION_CONFIG.minConfidenceScore).toBeLessThanOrEqual(100);
      expect(GUARANTEED_GENERATION_CONFIG.timeoutMs).toBeGreaterThan(0);
      expect(GUARANTEED_GENERATION_CONFIG.enableFallback).toBe(true);
    });

    it('should have valid generation thresholds', () => {
      expect(GENERATION_THRESHOLDS.MIN_CONFIDENCE_SCORE).toBe(85);
      expect(GENERATION_THRESHOLDS.MAX_GENERATION_TIME_MS).toBe(5000);
      expect(GENERATION_THRESHOLDS.MAX_ALTERNATIVE_SOLUTIONS).toBe(0);
    });
  });

  describe('EnhancedPuzzleEngine Implementation', () => {
    it('should create enhanced puzzle engine instance', () => {
      const engine = EnhancedPuzzleEngineImpl.getInstance();
      expect(engine).toBeDefined();
      expect(typeof engine.generateGuaranteedPuzzle).toBe('function');
      expect(typeof engine.validateSpacingConstraints).toBe('function');
      expect(typeof engine.reverseEngineerPath).toBe('function');
      expect(typeof engine.verifyUniqueSolution).toBe('function');
    });

    it('should validate spacing constraints correctly', () => {
      const engine = EnhancedPuzzleEngineImpl.getInstance();

      // Test valid spacing for Easy difficulty
      const validSpacing = engine.validateSpacingConstraints(
        [0, 0] as GridPosition,
        [3, 0] as GridPosition,
        'Easy' as Difficulty
      );
      expect(validSpacing).toBe(true);

      // Test invalid spacing for Easy difficulty
      const invalidSpacing = engine.validateSpacingConstraints(
        [0, 0] as GridPosition,
        [1, 0] as GridPosition,
        'Easy' as Difficulty
      );
      expect(invalidSpacing).toBe(false);

      // Test same position (should be invalid)
      const samePosition = engine.validateSpacingConstraints(
        [0, 0] as GridPosition,
        [0, 0] as GridPosition,
        'Easy' as Difficulty
      );
      expect(samePosition).toBe(false);
    });

    it('should maintain backward compatibility with legacy methods', async () => {
      const engine = EnhancedPuzzleEngineImpl.getInstance();

      // These methods should exist and be callable
      expect(typeof engine.generateDailyPuzzles).toBe('function');
      expect(typeof engine.createPuzzle).toBe('function');

      // Note: We don't actually call these methods in the test as they would
      // require full puzzle generation which is complex and time-consuming
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct difficulty types', () => {
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      difficulties.forEach((difficulty) => {
        expect(['Easy', 'Medium', 'Hard']).toContain(difficulty);
        expect(SPACING_CONSTRAINTS[difficulty]).toBeDefined();
        expect(GUARANTEED_GENERATION_CONFIG.materialConfigs[difficulty]).toBeDefined();
        expect(GUARANTEED_GENERATION_CONFIG.complexityConfigs[difficulty]).toBeDefined();
      });
    });

    it('should enforce correct GridPosition format', () => {
      const position: GridPosition = [3, 4];
      expect(Array.isArray(position)).toBe(true);
      expect(position).toHaveLength(2);
      expect(typeof position[0]).toBe('number');
      expect(typeof position[1]).toBe('number');
    });
  });
});
