// Tests for PuzzleFilterService

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PuzzleFilterService } from '../PuzzleFilterService.js';
import { RedisManager } from '../RedisManager.js';
import type { FilterQuery, DifficultyLevel } from '../../../shared/types/index.js';

// Mock RedisManager
vi.mock('../RedisManager.js');

describe('PuzzleFilterService', () => {
  let puzzleFilterService: PuzzleFilterService;
  let mockRedis: vi.Mocked<RedisManager>;

  beforeEach(() => {
    mockRedis = {
      getSetMembers: vi.fn(),
      getHash: vi.fn(),
      getZRangeWithScores: vi.fn(),
      setHashFields: vi.fn(),
    } as any;

    puzzleFilterService = new PuzzleFilterService(mockRedis);
  });

  describe('getFilteredPuzzles', () => {
    it('should return paginated puzzle results', async () => {
      // Mock data
      const mockPuzzleIds = ['puzzle1', 'puzzle2', 'puzzle3'];
      const mockPuzzleData = {
        title: 'Test Puzzle',
        difficulty: 'easy',
        puzzleData: JSON.stringify({ grid: [[]] }),
        createdDate: new Date().toISOString(),
        isActive: 'true',
        participantCount: '5',
        averageScore: '100',
      };

      mockRedis.getSetMembers.mockResolvedValue(mockPuzzleIds);
      mockRedis.getHash.mockResolvedValue(mockPuzzleData);

      const query: FilterQuery = {
        difficulty: 'easy',
        sortBy: 'date',
        sortOrder: 'desc',
        page: 1,
        limit: 2,
      };

      const result = await puzzleFilterService.getFilteredPuzzles(query);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });

    it('should filter by difficulty', async () => {
      const mockPuzzleIds = ['puzzle1', 'puzzle2'];
      const easyPuzzle = {
        title: 'Easy Puzzle',
        difficulty: 'easy',
        puzzleData: JSON.stringify({ grid: [[]] }),
        createdDate: new Date().toISOString(),
        isActive: 'true',
        participantCount: '3',
        averageScore: '80',
      };
      const hardPuzzle = {
        title: 'Hard Puzzle',
        difficulty: 'hard',
        puzzleData: JSON.stringify({ grid: [[]] }),
        createdDate: new Date().toISOString(),
        isActive: 'true',
        participantCount: '2',
        averageScore: '120',
      };

      mockRedis.getSetMembers.mockResolvedValue(mockPuzzleIds);
      mockRedis.getHash
        .mockResolvedValueOnce(easyPuzzle)
        .mockResolvedValueOnce(hardPuzzle)
        .mockResolvedValueOnce(easyPuzzle); // For the filtered result

      const query: FilterQuery = {
        difficulty: 'easy',
        limit: 10,
      };

      const result = await puzzleFilterService.getFilteredPuzzles(query);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].difficulty).toBe('easy');
    });
  });

  describe('searchPuzzles', () => {
    it('should search puzzles by title', async () => {
      const mockPuzzleIds = ['puzzle1', 'puzzle2'];
      const matchingPuzzle = {
        title: 'Laser Reflection Challenge',
        difficulty: 'medium',
        puzzleData: JSON.stringify({ grid: [[]] }),
        createdDate: new Date().toISOString(),
        isActive: 'true',
        participantCount: '4',
        averageScore: '95',
      };
      const nonMatchingPuzzle = {
        title: 'Mirror Maze',
        difficulty: 'hard',
        puzzleData: JSON.stringify({ grid: [[]] }),
        createdDate: new Date().toISOString(),
        isActive: 'true',
        participantCount: '2',
        averageScore: '110',
      };

      mockRedis.getSetMembers.mockResolvedValue(mockPuzzleIds);
      mockRedis.getHash
        .mockResolvedValueOnce(matchingPuzzle)
        .mockResolvedValueOnce(nonMatchingPuzzle)
        .mockResolvedValueOnce(matchingPuzzle); // For the filtered result

      const result = await puzzleFilterService.searchPuzzles('laser', { limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Laser Reflection Challenge');
    });
  });

  describe('getPuzzlesByDifficulty', () => {
    it('should return puzzles for specific difficulty', async () => {
      const mockPuzzleIds = ['easy1', 'easy2'];
      const mockPuzzleData = {
        title: 'Easy Puzzle',
        difficulty: 'easy',
        puzzleData: JSON.stringify({ grid: [[]] }),
        createdDate: new Date().toISOString(),
        isActive: 'true',
        participantCount: '5',
        averageScore: '75',
      };

      mockRedis.getSetMembers.mockResolvedValue(mockPuzzleIds);
      mockRedis.getHash.mockResolvedValue(mockPuzzleData);

      const result = await puzzleFilterService.getPuzzlesByDifficulty('easy', 10);

      expect(result).toHaveLength(2);
      expect(result[0].difficulty).toBe('easy');
      expect(mockRedis.getSetMembers).toHaveBeenCalledWith('puzzle:difficulty:easy');
    });
  });

  describe('getPuzzleStats', () => {
    it('should return puzzle statistics', async () => {
      const mockPuzzleIds = ['puzzle1', 'puzzle2'];
      const easyPuzzle = {
        difficulty: 'easy',
        participantCount: '3',
      };
      const hardPuzzle = {
        difficulty: 'hard',
        participantCount: '2',
      };
      const mockScores = [
        { member: 'user1', score: 100 },
        { member: 'user2', score: 80 },
      ];

      mockRedis.getSetMembers.mockResolvedValue(mockPuzzleIds);
      mockRedis.getHash.mockResolvedValueOnce(easyPuzzle).mockResolvedValueOnce(hardPuzzle);
      mockRedis.getZRangeWithScores.mockResolvedValue(mockScores);

      const result = await puzzleFilterService.getPuzzleStats();

      expect(result.total).toBe(2);
      expect(result.byDifficulty.easy).toBe(1);
      expect(result.byDifficulty.hard).toBe(1);
      expect(result.totalParticipants).toBe(5);
      expect(result.averageScore).toBe(90); // (100 + 80) / 2
    });
  });

  describe('updatePuzzleMetadata', () => {
    it('should update puzzle metadata fields', async () => {
      const puzzleId = 'puzzle123';
      const updates = {
        participantCount: 10,
        averageScore: 95.5,
        isActive: false,
      };

      await puzzleFilterService.updatePuzzleMetadata(puzzleId, updates);

      expect(mockRedis.setHashFields).toHaveBeenCalledWith('puzzle:puzzle123', {
        participantCount: '10',
        averageScore: '95.5',
        isActive: 'false',
      });
    });
  });
});
