// Unit tests for BeamHandler

import { describe, it, expect } from 'vitest';
import { BeamHandler } from '../beam-handler.js';
import type { Coordinate, PathSegment, DifficultyLevel } from '../../types/game.js';
import { createCoordinate } from '../../utils.js';

describe('BeamHandler', () => {
  const difficulty: DifficultyLevel = 'easy';

  describe('handleGridExit', () => {
    it('should detect exit from top edge', () => {
      const position = createCoordinate(0, 2);
      const result = BeamHandler.handleGridExit(position, 'north', difficulty);

      expect(result.hasExited).toBe(true);
      expect(result.exitPoint?.row).toBe(-1);
      expect(result.exitPoint?.col).toBe(2);
      expect(result.exitEdge).toBe('top');
    });

    it('should detect exit from bottom edge', () => {
      const position = createCoordinate(5, 2);
      const result = BeamHandler.handleGridExit(position, 'south', difficulty);

      expect(result.hasExited).toBe(true);
      expect(result.exitPoint?.row).toBe(6);
      expect(result.exitPoint?.col).toBe(2);
      expect(result.exitEdge).toBe('bottom');
    });

    it('should detect exit from left edge', () => {
      const position = createCoordinate(2, 0);
      const result = BeamHandler.handleGridExit(position, 'west', difficulty);

      expect(result.hasExited).toBe(true);
      expect(result.exitPoint?.row).toBe(2);
      expect(result.exitPoint?.col).toBe(-1);
      expect(result.exitEdge).toBe('left');
    });

    it('should detect exit from right edge', () => {
      const position = createCoordinate(2, 5);
      const result = BeamHandler.handleGridExit(position, 'east', difficulty);

      expect(result.hasExited).toBe(true);
      expect(result.exitPoint?.row).toBe(2);
      expect(result.exitPoint?.col).toBe(6);
      expect(result.exitEdge).toBe('right');
    });

    it('should not detect exit for internal movement', () => {
      const position = createCoordinate(2, 2);
      const result = BeamHandler.handleGridExit(position, 'south', difficulty);

      expect(result.hasExited).toBe(false);
      expect(result.exitPoint).toBeNull();
      expect(result.exitEdge).toBeNull();
    });

    it('should handle diagonal directions correctly', () => {
      const position = createCoordinate(0, 0);
      const result = BeamHandler.handleGridExit(position, 'northwest', difficulty);

      expect(result.hasExited).toBe(true);
      expect(result.exitEdge).toBe('top');
    });
  });

  describe('detectInfiniteLoop', () => {
    it('should not detect loop in short segment list', () => {
      const segments: PathSegment[] = [
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
      ];

      const hasLoop = BeamHandler.detectInfiniteLoop(segments, 1000);
      expect(hasLoop).toBe(false);
    });

    it('should detect loop in repeating pattern', () => {
      const segments: PathSegment[] = [];

      // Create a repeating pattern
      for (let i = 0; i < 25; i++) {
        segments.push({
          start: createCoordinate(1, 1),
          end: createCoordinate(1, 2),
          direction: 'east',
          material: 'mirror',
        });
        segments.push({
          start: createCoordinate(1, 2),
          end: createCoordinate(1, 1),
          direction: 'west',
          material: 'mirror',
        });
      }

      const hasLoop = BeamHandler.detectInfiniteLoop(segments, 20); // Lower threshold
      expect(hasLoop).toBe(true);
    });

    it('should handle empty segment list', () => {
      const segments: PathSegment[] = [];
      const hasLoop = BeamHandler.detectInfiniteLoop(segments, 1000);
      expect(hasLoop).toBe(false);
    });
  });

  describe('handleAbsorption', () => {
    it('should detect absorption by absorber material', () => {
      const position = createCoordinate(2, 2);
      const segments: PathSegment[] = [];

      const result = BeamHandler.handleAbsorption(position, 'absorber', segments);

      expect(result.isAbsorbed).toBe(true);
      expect(result.absorptionPoint).toEqual(position);
    });

    it('should not detect absorption by non-absorber material', () => {
      const position = createCoordinate(2, 2);
      const segments: PathSegment[] = [];

      const result = BeamHandler.handleAbsorption(position, 'mirror', segments);

      expect(result.isAbsorbed).toBe(false);
      expect(result.absorptionPoint).toBeNull();
    });

    it('should handle empty material', () => {
      const position = createCoordinate(2, 2);
      const segments: PathSegment[] = [];

      const result = BeamHandler.handleAbsorption(position, 'empty', segments);

      expect(result.isAbsorbed).toBe(false);
      expect(result.absorptionPoint).toBeNull();
    });
  });

  describe('handleGlassSplit', () => {
    it('should return either reflect or pass-through behavior', () => {
      const position = createCoordinate(2, 2);

      // Test multiple times due to randomness
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = BeamHandler.handleGlassSplit(position, 'south', 0.5);
        results.push(result.behavior);
      }

      // Should have both behaviors in multiple runs
      const behaviors = new Set(results);
      expect(behaviors.size).toBeGreaterThan(0);
      expect(['reflect', 'pass-through']).toContain(results[0]);
    });

    it('should always reflect with 100% probability', () => {
      const position = createCoordinate(2, 2);
      const result = BeamHandler.handleGlassSplit(position, 'south', 1.0);

      expect(result.behavior).toBe('reflect');
      expect(result.passThrough).toBe(false);
    });

    it('should always pass-through with 0% probability', () => {
      const position = createCoordinate(2, 2);
      const result = BeamHandler.handleGlassSplit(position, 'south', 0.0);

      expect(result.behavior).toBe('pass-through');
      expect(result.passThrough).toBe(true);
      expect(result.newDirection).toBe('south');
    });

    it('should calculate correct reflection direction', () => {
      const position = createCoordinate(2, 2);

      // Force reflection
      const result = BeamHandler.handleGlassSplit(position, 'south', 1.0);

      expect(result.behavior).toBe('reflect');
      expect(['north', 'east', 'west']).toContain(result.newDirection);
    });
  });

  describe('validatePathIntegrity', () => {
    it('should validate connected path segments', () => {
      const mockPath = {
        segments: [
          {
            start: createCoordinate(0, 0),
            end: createCoordinate(1, 0),
            direction: 'south' as const,
            material: 'empty' as const,
          },
          {
            start: createCoordinate(1, 0),
            end: createCoordinate(2, 0),
            direction: 'south' as const,
            material: 'empty' as const,
          },
        ],
        exitPoint: createCoordinate(6, 0),
        isComplete: true,
      };

      const result = BeamHandler.validatePathIntegrity(mockPath);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect disconnected segments', () => {
      const mockPath = {
        segments: [
          {
            start: createCoordinate(0, 0),
            end: createCoordinate(1, 0),
            direction: 'south' as const,
            material: 'empty' as const,
          },
          {
            start: createCoordinate(2, 0), // Disconnected from previous end
            end: createCoordinate(3, 0),
            direction: 'south' as const,
            material: 'empty' as const,
          },
        ],
        exitPoint: createCoordinate(6, 0),
        isComplete: true,
      };

      const result = BeamHandler.validatePathIntegrity(mockPath);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('Disconnected segments');
    });

    it('should detect invalid coordinates', () => {
      const mockPath = {
        segments: [
          {
            start: createCoordinate(-5, -5), // Invalid coordinates
            end: createCoordinate(1, 0),
            direction: 'south' as const,
            material: 'empty' as const,
          },
        ],
        exitPoint: createCoordinate(6, 0),
        isComplete: true,
      };

      const result = BeamHandler.validatePathIntegrity(mockPath);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('Invalid start coordinate');
    });

    it('should handle empty path', () => {
      const mockPath = {
        segments: [],
        exitPoint: null,
        isComplete: false,
      };

      const result = BeamHandler.validatePathIntegrity(mockPath);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('calculateEnergyLoss', () => {
    it('should calculate no loss for empty materials', () => {
      const segments: PathSegment[] = [
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
      ];

      const energyLoss = BeamHandler.calculateEnergyLoss(segments);
      expect(energyLoss).toBe(0.02); // 0.01 per segment
    });

    it('should calculate higher loss for water', () => {
      const segments: PathSegment[] = [
        {
          start: createCoordinate(0, 0),
          end: createCoordinate(1, 0),
          direction: 'south',
          material: 'water',
        },
      ];

      const energyLoss = BeamHandler.calculateEnergyLoss(segments);
      expect(energyLoss).toBe(0.1);
    });

    it('should calculate complete loss for absorber', () => {
      const segments: PathSegment[] = [
        {
          start: createCoordinate(0, 0),
          end: createCoordinate(1, 0),
          direction: 'south',
          material: 'absorber',
        },
      ];

      const energyLoss = BeamHandler.calculateEnergyLoss(segments);
      expect(energyLoss).toBe(1.0);
    });

    it('should cap energy loss at 100%', () => {
      const segments: PathSegment[] = [];

      // Add many high-loss segments
      for (let i = 0; i < 20; i++) {
        segments.push({
          start: createCoordinate(i, 0),
          end: createCoordinate(i + 1, 0),
          direction: 'south',
          material: 'water',
        });
      }

      const energyLoss = BeamHandler.calculateEnergyLoss(segments);
      expect(energyLoss).toBe(1.0); // Capped at 100%
    });

    it('should handle mixed materials correctly', () => {
      const segments: PathSegment[] = [
        {
          start: createCoordinate(0, 0),
          end: createCoordinate(1, 0),
          direction: 'south',
          material: 'water', // 0.1 loss
        },
        {
          start: createCoordinate(1, 0),
          end: createCoordinate(2, 0),
          direction: 'south',
          material: 'glass', // 0.05 loss
        },
        {
          start: createCoordinate(2, 0),
          end: createCoordinate(3, 0),
          direction: 'south',
          material: 'empty', // 0.01 loss
        },
      ];

      const energyLoss = BeamHandler.calculateEnergyLoss(segments);
      expect(energyLoss).toBeCloseTo(0.16); // 0.1 + 0.05 + 0.01
    });
  });
});
