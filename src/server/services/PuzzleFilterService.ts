// PuzzleFilterService - API endpoints for puzzle retrieval and filtering

import type {
  DifficultyLevel,
  PuzzlePost,
  FilterQuery,
  PaginatedResponse,
} from '../../shared/types/index.js';
import { RedisManager } from './RedisManager.js';

export class PuzzleFilterService {
  private redis: RedisManager;

  constructor(redis: RedisManager) {
    this.redis = redis;
  }

  /**
   * Get filtered puzzles with pagination
   */
  async getFilteredPuzzles(query: FilterQuery): Promise<PaginatedResponse<PuzzlePost>> {
    try {
      // Get all puzzle IDs that match the filter criteria
      const matchingIds = await this.getMatchingPuzzleIds(query);

      // Apply sorting
      const sortedIds = await this.sortPuzzleIds(matchingIds, query.sortBy, query.sortOrder);

      // Apply pagination
      const offset = ((query.page || 1) - 1) * (query.limit || 20);
      const paginatedIds = sortedIds.slice(offset, offset + (query.limit || 20));

      // Fetch full puzzle data
      const puzzles = await this.getPuzzlesByIds(paginatedIds);

      return {
        items: puzzles,
        total: sortedIds.length,
        page: query.page || 1,
        limit: query.limit || 20,
        hasNext: offset + (query.limit || 20) < sortedIds.length,
        hasPrev: (query.page || 1) > 1,
      };
    } catch (error) {
      console.error('Error filtering puzzles:', error);
      throw new Error('Failed to filter puzzles');
    }
  }

  /**
   * Search puzzles by text content
   */
  async searchPuzzles(
    searchTerm: string,
    query: FilterQuery
  ): Promise<PaginatedResponse<PuzzlePost>> {
    try {
      // Get all puzzles first
      const allPuzzleIds = await this.redis.getSetMembers('puzzle:all_ids');

      // Filter by search term
      const matchingIds: string[] = [];

      for (const puzzleId of allPuzzleIds) {
        const puzzle = await this.redis.getHash(`puzzle:${puzzleId}`);
        if (puzzle) {
          const title = puzzle.title?.toLowerCase() || '';
          const description = puzzle.description?.toLowerCase() || '';
          const searchLower = searchTerm.toLowerCase();

          if (title.includes(searchLower) || description.includes(searchLower)) {
            matchingIds.push(puzzleId);
          }
        }
      }

      // Apply additional filters
      const filteredIds = await this.applyFiltersToIds(matchingIds, query);

      // Apply sorting and pagination
      const sortedIds = await this.sortPuzzleIds(filteredIds, query.sortBy, query.sortOrder);
      const offset = ((query.page || 1) - 1) * (query.limit || 20);
      const paginatedIds = sortedIds.slice(offset, offset + (query.limit || 20));

      // Fetch full puzzle data
      const puzzles = await this.getPuzzlesByIds(paginatedIds);

      return {
        items: puzzles,
        total: sortedIds.length,
        page: query.page || 1,
        limit: query.limit || 20,
        hasNext: offset + (query.limit || 20) < sortedIds.length,
        hasPrev: (query.page || 1) > 1,
      };
    } catch (error) {
      console.error('Error searching puzzles:', error);
      throw new Error('Failed to search puzzles');
    }
  }

  /**
   * Get puzzles by difficulty level
   */
  async getPuzzlesByDifficulty(difficulty: DifficultyLevel, limit = 20): Promise<PuzzlePost[]> {
    try {
      const puzzleIds = await this.redis.getSetMembers(`puzzle:difficulty:${difficulty}`);

      // Sort by creation date (newest first)
      const sortedIds = await this.sortPuzzleIds(puzzleIds, 'date', 'desc');
      const limitedIds = sortedIds.slice(0, limit);

      return await this.getPuzzlesByIds(limitedIds);
    } catch (error) {
      console.error('Error getting puzzles by difficulty:', error);
      throw new Error('Failed to get puzzles by difficulty');
    }
  }

  /**
   * Get recent puzzles
   */
  async getRecentPuzzles(limit = 10): Promise<PuzzlePost[]> {
    try {
      const allPuzzleIds = await this.redis.getSetMembers('puzzle:all_ids');
      const sortedIds = await this.sortPuzzleIds(allPuzzleIds, 'date', 'desc');
      const recentIds = sortedIds.slice(0, limit);

      return await this.getPuzzlesByIds(recentIds);
    } catch (error) {
      console.error('Error getting recent puzzles:', error);
      throw new Error('Failed to get recent puzzles');
    }
  }

  /**
   * Get popular puzzles (by participant count)
   */
  async getPopularPuzzles(limit = 10): Promise<PuzzlePost[]> {
    try {
      const allPuzzleIds = await this.redis.getSetMembers('puzzle:all_ids');
      const sortedIds = await this.sortPuzzleIds(allPuzzleIds, 'participants', 'desc');
      const popularIds = sortedIds.slice(0, limit);

      return await this.getPuzzlesByIds(popularIds);
    } catch (error) {
      console.error('Error getting popular puzzles:', error);
      throw new Error('Failed to get popular puzzles');
    }
  }

  /**
   * Get puzzle statistics
   */
  async getPuzzleStats(): Promise<{
    total: number;
    byDifficulty: Record<DifficultyLevel, number>;
    totalParticipants: number;
    averageScore: number;
  }> {
    try {
      const allPuzzleIds = await this.redis.getSetMembers('puzzle:all_ids');

      const stats = {
        total: allPuzzleIds.length,
        byDifficulty: {
          easy: 0,
          medium: 0,
          hard: 0,
        } as Record<DifficultyLevel, number>,
        totalParticipants: 0,
        averageScore: 0,
      };

      let totalScore = 0;
      let scoreCount = 0;

      for (const puzzleId of allPuzzleIds) {
        const puzzle = await this.redis.getHash(`puzzle:${puzzleId}`);
        if (puzzle) {
          const difficulty = puzzle.difficulty as DifficultyLevel;
          if (difficulty && stats.byDifficulty[difficulty] !== undefined) {
            stats.byDifficulty[difficulty]++;
          }

          const participantCount = parseInt(puzzle.participantCount || '0');
          stats.totalParticipants += participantCount;

          // Get average score for this puzzle
          const scores = await this.redis.getZRangeWithScores(`leaderboard:${puzzleId}`, 0, -1);
          if (scores.length > 0) {
            const puzzleTotal = scores.reduce((sum, score) => sum + score.score, 0);
            totalScore += puzzleTotal;
            scoreCount += scores.length;
          }
        }
      }

      stats.averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

      return stats;
    } catch (error) {
      console.error('Error getting puzzle stats:', error);
      throw new Error('Failed to get puzzle statistics');
    }
  }

  /**
   * Get matching puzzle IDs based on filter criteria
   */
  private async getMatchingPuzzleIds(query: FilterQuery): Promise<string[]> {
    let puzzleIds = await this.redis.getSetMembers('puzzle:all_ids');

    return await this.applyFiltersToIds(puzzleIds, query);
  }

  /**
   * Apply filters to a list of puzzle IDs
   */
  private async applyFiltersToIds(puzzleIds: string[], query: FilterQuery): Promise<string[]> {
    const filteredIds: string[] = [];

    for (const puzzleId of puzzleIds) {
      const puzzle = await this.redis.getHash(`puzzle:${puzzleId}`);
      if (!puzzle) continue;

      // Filter by difficulty
      if (query.difficulty && puzzle.difficulty !== query.difficulty) {
        continue;
      }

      // Filter by date range
      if (query.dateFrom || query.dateTo) {
        const puzzleDate = new Date(puzzle.createdDate);

        if (query.dateFrom && puzzleDate < query.dateFrom) {
          continue;
        }

        if (query.dateTo && puzzleDate > query.dateTo) {
          continue;
        }
      }

      // Filter by active status
      if (query.isActive !== undefined && puzzle.isActive !== query.isActive.toString()) {
        continue;
      }

      // Filter by minimum participants
      if (query.minParticipants) {
        const participantCount = parseInt(puzzle.participantCount || '0');
        if (participantCount < query.minParticipants) {
          continue;
        }
      }

      filteredIds.push(puzzleId);
    }

    return filteredIds;
  }

  /**
   * Sort puzzle IDs based on criteria
   */
  private async sortPuzzleIds(
    puzzleIds: string[],
    sortBy: 'date' | 'difficulty' | 'participants' = 'date',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<string[]> {
    const puzzlesWithSortData: Array<{ id: string; sortValue: number | string }> = [];

    for (const puzzleId of puzzleIds) {
      const puzzle = await this.redis.getHash(`puzzle:${puzzleId}`);
      if (!puzzle) continue;

      let sortValue: number | string;

      switch (sortBy) {
        case 'date':
          sortValue = new Date(puzzle.createdDate).getTime();
          break;
        case 'difficulty':
          const difficultyOrder = { easy: 1, medium: 2, hard: 3 };
          sortValue = difficultyOrder[puzzle.difficulty as DifficultyLevel] || 0;
          break;
        case 'participants':
          sortValue = parseInt(puzzle.participantCount || '0');
          break;
        default:
          sortValue = new Date(puzzle.createdDate).getTime();
      }

      puzzlesWithSortData.push({ id: puzzleId, sortValue });
    }

    // Sort the array
    puzzlesWithSortData.sort((a, b) => {
      if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') {
        return sortOrder === 'asc' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue;
      } else {
        const aStr = String(a.sortValue);
        const bStr = String(b.sortValue);
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }
    });

    return puzzlesWithSortData.map((item) => item.id);
  }

  /**
   * Get full puzzle data by IDs
   */
  private async getPuzzlesByIds(puzzleIds: string[]): Promise<PuzzlePost[]> {
    const puzzles: PuzzlePost[] = [];

    for (const puzzleId of puzzleIds) {
      const puzzleData = await this.redis.getHash(`puzzle:${puzzleId}`);
      if (puzzleData) {
        try {
          const puzzle: PuzzlePost = {
            postId: puzzleId,
            title: puzzleData.title,
            difficulty: puzzleData.difficulty as DifficultyLevel,
            puzzle: JSON.parse(puzzleData.puzzleData),
            createdDate: new Date(puzzleData.createdDate),
            isActive: puzzleData.isActive === 'true',
            participantCount: parseInt(puzzleData.participantCount || '0'),
            averageScore: parseFloat(puzzleData.averageScore || '0'),
          };
          puzzles.push(puzzle);
        } catch (error) {
          console.error(`Error parsing puzzle data for ${puzzleId}:`, error);
        }
      }
    }

    return puzzles;
  }

  /**
   * Get puzzle by ID
   */
  async getPuzzleById(puzzleId: string): Promise<PuzzlePost | null> {
    try {
      const puzzleData = await this.redis.getHash(`puzzle:${puzzleId}`);
      if (!puzzleData) return null;

      return {
        postId: puzzleId,
        title: puzzleData.title,
        difficulty: puzzleData.difficulty as DifficultyLevel,
        puzzle: JSON.parse(puzzleData.puzzleData),
        createdDate: new Date(puzzleData.createdDate),
        isActive: puzzleData.isActive === 'true',
        participantCount: parseInt(puzzleData.participantCount || '0'),
        averageScore: parseFloat(puzzleData.averageScore || '0'),
      };
    } catch (error) {
      console.error('Error getting puzzle by ID:', error);
      return null;
    }
  }

  /**
   * Update puzzle metadata (participant count, average score, etc.)
   */
  async updatePuzzleMetadata(
    puzzleId: string,
    updates: Partial<{
      participantCount: number;
      averageScore: number;
      isActive: boolean;
    }>
  ): Promise<void> {
    try {
      const updateData: Record<string, string> = {};

      if (updates.participantCount !== undefined) {
        updateData.participantCount = updates.participantCount.toString();
      }

      if (updates.averageScore !== undefined) {
        updateData.averageScore = updates.averageScore.toString();
      }

      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive.toString();
      }

      if (Object.keys(updateData).length > 0) {
        await this.redis.setHashFields(`puzzle:${puzzleId}`, updateData);
      }
    } catch (error) {
      console.error('Error updating puzzle metadata:', error);
      throw new Error('Failed to update puzzle metadata');
    }
  }
}
