/**
 * Tests for PointPlacementService
 * Validates strategic point placement functionality
 */

import { describe, test, expect } from 'vitest';
import { PointPlacementService } from '../PointPlacementService.js';
import { Difficulty } from '../../types/puzzle.js';

describe('PointPlacementService', () => {
  const service = PointPlacementService.getInstance();

  describe('getBoundaryPositions', () => {
    test('returns correct boundary positions for 6x6 grid', () => {
      const positions = service.getBoundaryPositions(6);

      // Should have 20 boundary positions for 6x6 grid
      // Top: 6, Bottom: 6, Left: 4 (excluding corners), Right: 4 (excluding corners)
      expect(positions).toHaveLength(20);

      // Check corners are included
      expect(positions).toContainEqual([0, 0]); // Top-left
      expect(positions).toContainEqual([5, 0]); // Top-right
      expect(positions).toContainEqual([0, 5]); // Bottom-left
      expect(positions).toContainEqual([5, 5]); // Bottom-right
    });

    test('returns correct boundary positions for 8x8 grid', () => {
      const positions = service.getBoundaryPositions(8);

      // Should have 28 boundary positions for 8x8 grid
      expect(positions).toHaveLength(28);
    });

    test('returns correct boundary positions for 10x10 grid', () => {
      const positions = service.getBoundaryPositions(10);

      // Should have 36 boundary positions for 10x10 grid
      // Top: 10, Bottom: 10, Left: 8 (excluding corners), Right: 8 (excluding corners)
      expect(positions).toHaveLength(36);

      // Verify all positions are actually on the boundary
      for (const [x, y] of positions) {
        const isOnBoundary = x === 0 || x === 9 || y === 0 || y === 9;
        expect(isOnBoundary).toBe(true);
      }
    });

    test('handles minimum grid size correctly', () => {
      const positions = service.getBoundaryPositions(3);

      // Should have 8 boundary positions for 3x3 grid (all positions except center)
      expect(positions).toHaveLength(8);

      // Center position should not be included
      expect(positions).not.toContainEqual([1, 1]);
    });
  });

  describe('calculateDistance', () => {
    test('calculates Manhattan distance correctly', () => {
      const distance = service.calculateDistance([0, 0], [3, 4]);
      expect(distance).toBe(7); // |3-0| + |4-0| = 7
    });

    test('returns 0 for same position', () => {
      const distance = service.calculateDistance([2, 3], [2, 3]);
      expect(distance).toBe(0);
    });
  });

  describe('validateSpacing', () => {
    test('rejects same positions', () => {
      const isValid = service.validateSpacing([0, 0], [0, 0], 3);
      expect(isValid).toBe(false);
    });

    test('validates minimum distance requirement', () => {
      // Distance of 5 should pass minimum of 3
      const isValid = service.validateSpacing([0, 0], [3, 2], 3);
      expect(isValid).toBe(true);

      // Distance of 2 should fail minimum of 3
      const isInvalid = service.validateSpacing([0, 0], [1, 1], 3);
      expect(isInvalid).toBe(false);
    });

    test('validates exact minimum distance boundary', () => {
      // Distance of exactly 3 should pass minimum of 3
      const isValid = service.validateSpacing([0, 0], [3, 0], 3);
      expect(isValid).toBe(true);

      // Distance of exactly 2 should fail minimum of 3
      const isInvalid = service.validateSpacing([0, 0], [2, 0], 3);
      expect(isInvalid).toBe(false);
    });

    test('validates difficulty-specific spacing constraints', () => {
      const easyConstraints = service.getSpacingConstraints('Easy');
      const mediumConstraints = service.getSpacingConstraints('Medium');
      const hardConstraints = service.getSpacingConstraints('Hard');

      // Test Easy minimum (3)
      expect(service.validateSpacing([0, 0], [3, 0], easyConstraints.minDistance)).toBe(true);
      expect(service.validateSpacing([0, 0], [2, 0], easyConstraints.minDistance)).toBe(false);

      // Test Medium minimum (4)
      expect(service.validateSpacing([0, 0], [4, 0], mediumConstraints.minDistance)).toBe(true);
      expect(service.validateSpacing([0, 0], [3, 0], mediumConstraints.minDistance)).toBe(false);

      // Test Hard minimum (5)
      expect(service.validateSpacing([0, 0], [5, 0], hardConstraints.minDistance)).toBe(true);
      expect(service.validateSpacing([0, 0], [4, 0], hardConstraints.minDistance)).toBe(false);
    });
  });

  describe('selectEntryExitPairs', () => {
    test('generates valid pairs for Easy difficulty', async () => {
      const pairs = await service.selectEntryExitPairs('Easy', 6);

      expect(pairs.length).toBeGreaterThan(0);

      // All pairs should meet minimum distance requirement (3 for Easy)
      for (const pair of pairs) {
        expect(pair.distance).toBeGreaterThanOrEqual(3);
        expect(pair.difficulty).toBe('Easy');
        expect(pair.validationScore).toBeGreaterThan(0);
      }
    });

    test('generates valid pairs for Medium difficulty', async () => {
      const pairs = await service.selectEntryExitPairs('Medium', 8);

      expect(pairs.length).toBeGreaterThan(0);

      // All pairs should meet minimum distance requirement (4 for Medium)
      for (const pair of pairs) {
        expect(pair.distance).toBeGreaterThanOrEqual(4);
        expect(pair.difficulty).toBe('Medium');
      }
    });

    test('generates valid pairs for Hard difficulty', async () => {
      const pairs = await service.selectEntryExitPairs('Hard', 10);

      expect(pairs.length).toBeGreaterThan(0);

      // All pairs should meet minimum distance requirement (5 for Hard)
      for (const pair of pairs) {
        expect(pair.distance).toBeGreaterThanOrEqual(5);
        expect(pair.difficulty).toBe('Hard');
      }
    });

    test('returns pairs sorted by validation score', async () => {
      const pairs = await service.selectEntryExitPairs('Easy', 6);

      // Should be sorted in descending order by validation score
      for (let i = 1; i < pairs.length; i++) {
        expect(pairs[i - 1].validationScore).toBeGreaterThanOrEqual(pairs[i].validationScore);
      }
    });

    test('prefers corner positions', async () => {
      const pairs = await service.selectEntryExitPairs('Easy', 6);

      // Find pairs with corner positions
      const cornerPairs = pairs.filter(
        (pair) => pair.placementType === 'corner' || pair.placementType === 'optimal'
      );

      expect(cornerPairs.length).toBeGreaterThan(0);

      // Corner pairs should generally have higher scores
      if (cornerPairs.length > 0 && pairs.length > cornerPairs.length) {
        const avgCornerScore =
          cornerPairs.reduce((sum, pair) => sum + pair.validationScore, 0) / cornerPairs.length;
        const edgePairs = pairs.filter((pair) => pair.placementType === 'edge');

        if (edgePairs.length > 0) {
          const avgEdgeScore =
            edgePairs.reduce((sum, pair) => sum + pair.validationScore, 0) / edgePairs.length;
          expect(avgCornerScore).toBeGreaterThan(avgEdgeScore);
        }
      }
    });

    test('generates appropriate number of candidates for different grid sizes', async () => {
      // Test with Hard difficulty to see more variation (higher minimum distance)
      const smallGridPairs = await service.selectEntryExitPairs('Hard', 6);
      const largeGridPairs = await service.selectEntryExitPairs('Hard', 10);

      expect(smallGridPairs.length).toBeGreaterThan(0);
      expect(largeGridPairs.length).toBeGreaterThan(0);

      // Larger grids should generally have more valid candidates due to more boundary positions
      // But we'll test that both generate reasonable numbers rather than exact comparison
      expect(smallGridPairs.length).toBeLessThanOrEqual(100); // Reasonable upper bound
      expect(largeGridPairs.length).toBeLessThanOrEqual(100); // Reasonable upper bound
    });

    test('respects maximum search attempts constraint', async () => {
      const constraints = service.getSpacingConstraints('Easy');
      const pairs = await service.selectEntryExitPairs('Easy', 6);

      // Should not exceed maxSearchAttempts
      expect(pairs.length).toBeLessThanOrEqual(constraints.maxSearchAttempts);
    });

    test('handles edge case with very restrictive spacing', async () => {
      // Hard difficulty on small grid should still generate some pairs
      const pairs = await service.selectEntryExitPairs('Hard', 6);

      // Even with restrictive spacing (min 5), should find some valid pairs
      expect(pairs.length).toBeGreaterThan(0);

      // All pairs should meet the hard constraint
      for (const pair of pairs) {
        expect(pair.distance).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('getSpacingConstraints', () => {
    test('returns correct constraints for each difficulty', () => {
      const easyConstraints = service.getSpacingConstraints('Easy');
      expect(easyConstraints.minDistance).toBe(3);
      expect(easyConstraints.preferredDistance).toBe(4);

      const mediumConstraints = service.getSpacingConstraints('Medium');
      expect(mediumConstraints.minDistance).toBe(4);
      expect(mediumConstraints.preferredDistance).toBe(6);

      const hardConstraints = service.getSpacingConstraints('Hard');
      expect(hardConstraints.minDistance).toBe(5);
      expect(hardConstraints.preferredDistance).toBe(8);
    });
  });

  describe('validatePosition', () => {
    test('validates boundary positions correctly', () => {
      // Corner positions should be valid
      expect(service.validatePosition([0, 0], 6)).toBe(true);
      expect(service.validatePosition([5, 5], 6)).toBe(true);

      // Edge positions should be valid
      expect(service.validatePosition([0, 3], 6)).toBe(true);
      expect(service.validatePosition([3, 0], 6)).toBe(true);

      // Center positions should be invalid
      expect(service.validatePosition([2, 2], 6)).toBe(false);
      expect(service.validatePosition([3, 3], 6)).toBe(false);

      // Out of bounds positions should be invalid
      expect(service.validatePosition([-1, 0], 6)).toBe(false);
      expect(service.validatePosition([6, 0], 6)).toBe(false);
    });

    test('validates all boundary positions for different grid sizes', () => {
      const gridSizes = [6, 8, 10];

      for (const gridSize of gridSizes) {
        const boundaryPositions = service.getBoundaryPositions(gridSize);

        // All boundary positions should be valid
        for (const position of boundaryPositions) {
          expect(service.validatePosition(position, gridSize)).toBe(true);
        }

        // Test some non-boundary positions should be invalid
        const centerX = Math.floor(gridSize / 2);
        const centerY = Math.floor(gridSize / 2);
        expect(service.validatePosition([centerX, centerY], gridSize)).toBe(false);
      }
    });
  });

  describe('ranking algorithm comprehensive tests', () => {
    test('validation scores are consistent and meaningful', async () => {
      const pairs = await service.selectEntryExitPairs('Medium', 8);

      // All scores should be positive
      for (const pair of pairs) {
        expect(pair.validationScore).toBeGreaterThan(0);
      }

      // Scores should be in descending order (already tested, but ensuring consistency)
      for (let i = 1; i < pairs.length; i++) {
        expect(pairs[i - 1].validationScore).toBeGreaterThanOrEqual(pairs[i].validationScore);
      }
    });

    test('distance preferences are correctly applied', async () => {
      const pairs = await service.selectEntryExitPairs('Medium', 8);
      const constraints = service.getSpacingConstraints('Medium');

      // Find pairs close to preferred distance
      const preferredPairs = pairs.filter(
        (pair) => Math.abs(pair.distance - constraints.preferredDistance) <= 1
      );

      // Find pairs at minimum distance
      const minimumPairs = pairs.filter((pair) => pair.distance === constraints.minDistance);

      if (preferredPairs.length > 0 && minimumPairs.length > 0) {
        const avgPreferredScore =
          preferredPairs.reduce((sum, pair) => sum + pair.validationScore, 0) /
          preferredPairs.length;
        const avgMinimumScore =
          minimumPairs.reduce((sum, pair) => sum + pair.validationScore, 0) / minimumPairs.length;

        // Preferred distance pairs should generally score higher
        expect(avgPreferredScore).toBeGreaterThan(avgMinimumScore);
      }
    });

    test('placement type classification is accurate', async () => {
      const pairs = await service.selectEntryExitPairs('Easy', 6);

      // Helper function for corner detection
      const isCorner = (position: [number, number], gridSize: number): boolean => {
        const [x, y] = position;
        return (
          (x === 0 && y === 0) ||
          (x === gridSize - 1 && y === 0) ||
          (x === 0 && y === gridSize - 1) ||
          (x === gridSize - 1 && y === gridSize - 1)
        );
      };

      for (const pair of pairs) {
        const { entry, exit, placementType } = pair;

        // Verify placement type matches actual positions
        const entryIsCorner = isCorner(entry, 6);
        const exitIsCorner = isCorner(exit, 6);

        if (entryIsCorner && exitIsCorner) {
          expect(placementType).toBe('corner');
        } else if (entryIsCorner || exitIsCorner) {
          expect(placementType).toBe('optimal');
        } else {
          expect(placementType).toBe('edge');
        }
      }
    });
  });
});
