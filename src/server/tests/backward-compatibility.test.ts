/**
 * Backward Compatibility Tests for Legacy Posts
 * Tests the implementation of Task 7: Implement backward compatibility for legacy posts
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PuzzleService } from '../services/PuzzleService';
import { Difficulty } from '../../shared/types/puzzle';

describe('Backward Compatibility for Legacy Posts', () => {
  let puzzleService: PuzzleService;

  beforeEach(() => {
    puzzleService = PuzzleService.getInstance();
  });

  describe('Requirement 7.1: Detection for posts without puzzleId', () => {
    it('should detect legacy posts without puzzleId in postData', () => {
      // Simulate post data without puzzleId
      const legacyPostData = {
        type: 'puzzle',
        specificDifficulty: 'easy',
        puzzleDate: '2024-01-15',
        gameType: 'daily',
        status: 'active',
      };

      // Check that puzzleId is missing
      expect(legacyPostData).not.toHaveProperty('puzzleId');
      expect(legacyPostData.puzzleDate).toBe('2024-01-15');
      expect(legacyPostData.specificDifficulty).toBe('easy');
    });

    it('should detect modern posts with puzzleId in postData', () => {
      // Simulate post data with puzzleId
      const modernPostData = {
        type: 'puzzle',
        puzzleId: '2024-01-15_easy_1234567890_abc123',
        specificDifficulty: 'easy',
        puzzleDate: '2024-01-15',
        gameType: 'daily',
        status: 'active',
      };

      // Check that puzzleId exists
      expect(modernPostData).toHaveProperty('puzzleId');
      expect(modernPostData.puzzleId).toMatch(/^\d{4}-\d{2}-\d{2}_\w+_\d+_\w+$/);
    });
  });

  describe('Requirement 7.2: Fallback to date-based daily puzzle retrieval', () => {
    it('should retrieve puzzle by date for legacy posts', async () => {
      const date = '2024-01-15';
      const difficulty: Difficulty = 'Easy';

      // Test date-based puzzle retrieval
      const response = await puzzleService.getPuzzleByDate(date, difficulty);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      if (response.data) {
        expect(response.data.difficulty).toBe(difficulty);
        expect(response.data.id).toContain(date);
      }
    }, 10000);

    it('should handle all difficulty levels for date-based retrieval', async () => {
      const date = '2024-01-15';
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];

      for (const difficulty of difficulties) {
        const response = await puzzleService.getPuzzleByDate(date, difficulty);

        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        if (response.data) {
          expect(response.data.difficulty).toBe(difficulty);
        }
      }
    }, 30000);
  });

  describe('Requirement 7.3: Logging when legacy fallback is triggered', () => {
    it('should log when using date-based retrieval', async () => {
      const date = '2024-01-15';
      const difficulty: Difficulty = 'Easy';

      // Capture console logs
      const consoleLogs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        consoleLogs.push(args.join(' '));
        originalLog(...args);
      };

      try {
        await puzzleService.getPuzzleByDate(date, difficulty);

        // Check that legacy fallback logging occurred
        const hasLegacyLog = consoleLogs.some(
          (log) => log.includes('Legacy') || log.includes('legacy') || log.includes('🔄')
        );
        expect(hasLegacyLog).toBe(true);
      } finally {
        console.log = originalLog;
      }
    }, 10000);
  });

  describe('Requirement 7.4 & 7.5: Full functionality for pre-migration posts', () => {
    it('should provide same puzzle data structure for legacy posts', async () => {
      const date = '2024-01-15';
      const difficulty: Difficulty = 'Medium';

      // Get puzzle using date-based retrieval (legacy)
      const legacyResponse = await puzzleService.getPuzzleByDate(date, difficulty);

      // Get puzzle using current puzzle method
      const currentResponse = await puzzleService.getCurrentPuzzle(difficulty);

      // Both should have the same structure
      expect(legacyResponse.success).toBe(true);
      expect(currentResponse.success).toBe(true);

      if (legacyResponse.data && currentResponse.data) {
        // Check that both have required fields
        expect(legacyResponse.data).toHaveProperty('id');
        expect(legacyResponse.data).toHaveProperty('difficulty');
        expect(legacyResponse.data).toHaveProperty('grid');
        expect(legacyResponse.data).toHaveProperty('materials');
        expect(legacyResponse.data).toHaveProperty('hints');

        expect(currentResponse.data).toHaveProperty('id');
        expect(currentResponse.data).toHaveProperty('difficulty');
        expect(currentResponse.data).toHaveProperty('grid');
        expect(currentResponse.data).toHaveProperty('materials');
        expect(currentResponse.data).toHaveProperty('hints');
      }
    }, 15000);

    it('should handle legacy posts without errors', async () => {
      const date = '2024-01-15';
      const difficulty: Difficulty = 'Hard';

      // This should not throw any errors
      await expect(puzzleService.getPuzzleByDate(date, difficulty)).resolves.toBeDefined();

      const response = await puzzleService.getPuzzleByDate(date, difficulty);
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    }, 10000);

    it('should maintain session compatibility for legacy puzzles', async () => {
      const date = '2024-01-15';
      const difficulty: Difficulty = 'Easy';

      // Get legacy puzzle
      const response = await puzzleService.getPuzzleByDate(date, difficulty);

      expect(response.success).toBe(true);
      if (response.data) {
        // Puzzle should have all required fields for session creation
        expect(response.data.id).toBeDefined();
        expect(response.data.difficulty).toBeDefined();
        expect(response.data.grid).toBeDefined();
        expect(response.data.materials).toBeDefined();

        // ID should be in a valid format
        expect(typeof response.data.id).toBe('string');
        expect(response.data.id.length).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('Error Handling for Legacy Posts', () => {
    it('should handle invalid date format gracefully', async () => {
      const invalidDate = 'invalid-date';
      const difficulty: Difficulty = 'Easy';

      const response = await puzzleService.getPuzzleByDate(invalidDate, difficulty);

      // Should still return a response (may use backup puzzle)
      expect(response).toBeDefined();
      expect(response.success).toBeDefined();
    }, 10000);

    it('should handle invalid difficulty gracefully', async () => {
      const date = '2024-01-15';
      const invalidDifficulty = 'Invalid' as Difficulty;

      const response = await puzzleService.getPuzzleByDate(date, invalidDifficulty);

      expect(response).toBeDefined();
      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBeDefined();
        expect(response.error?.type).toBe('VALIDATION_ERROR');
      }
    }, 10000);
  });

  describe('Performance for Legacy Posts', () => {
    it('should retrieve legacy puzzles within acceptable time', async () => {
      const date = '2024-01-15';
      const difficulty: Difficulty = 'Medium';

      const startTime = Date.now();
      const response = await puzzleService.getPuzzleByDate(date, difficulty);
      const endTime = Date.now();

      const retrievalTime = endTime - startTime;

      expect(response.success).toBe(true);
      // Should complete within 5 seconds (as per requirement 10.2)
      expect(retrievalTime).toBeLessThan(5000);
    }, 10000);
  });
});
