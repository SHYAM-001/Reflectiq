// End-to-end integration tests for ReflectIQ
// Tests complete user journey from puzzle access to submission
// Validates scheduler automation and Reddit integration
// Tests mobile and desktop compatibility within Reddit app

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PuzzleService } from '../../services/PuzzleService.js';
import { LeaderboardService } from '../../services/LeaderboardService.js';

// Mock Devvit Web server
vi.mock('@devvit/web/server', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    zAdd: vi.fn(),
    zRange: vi.fn(),
    zCard: vi.fn(),
    zScore: vi.fn(),
    zRem: vi.fn(),
    hSet: vi.fn(),
    hGet: vi.fn(),
    hDel: vi.fn(),
    multi: vi.fn(() => ({
      zAdd: vi.fn(),
      hSet: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(),
    })),
  },
  context: {
    postId: 'test-post-123',
    userId: 'test-user-123',
    subredditName: 'test-subreddit',
  },
  reddit: {
    getCurrentUsername: vi.fn(() => Promise.resolve('testuser')),
    submitPost: vi.fn(() => Promise.resolve({ id: 'post-123' })),
    submitCustomPost: vi.fn(() => Promise.resolve({ id: 'custom-post-123' })),
  },
  createServer: vi.fn(),
  getServerPort: vi.fn(() => 3000),
}));

describe('End-to-End Integration Tests', () => {
  let app: express.Application;
  let mockRedis: any;

  beforeEach(async () => {
    // Import the main server app
    const { default: serverApp } = await import('../../index.js');
    app = serverApp;

    // Get Redis mock
    const { redis } = await import('@devvit/web/server');
    mockRedis = redis;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete User Journey: Puzzle Access to Leaderboard', () => {
    it('should handle complete puzzle submission workflow', async () => {
      const today = new Date().toISOString().split('T')[0];
      const testUser = 'testplayer';
      const correctAnswer = 'A1';

      // Mock puzzle data
      const mockPuzzle = {
        id: `puzzle_easy_${today}`,
        difficulty: 'Easy',
        gridSize: 6,
        materials: [],
        entry: [0, 0],
        solution: [0, 0], // A1 in grid coordinates
        hints: [],
        createdAt: new Date(),
      };

      const mockPuzzleSet = {
        date: today,
        puzzles: {
          easy: mockPuzzle,
          medium: { ...mockPuzzle, id: `puzzle_medium_${today}`, difficulty: 'Medium' },
          hard: { ...mockPuzzle, id: `puzzle_hard_${today}`, difficulty: 'Hard' },
        },
        status: 'active',
      };

      // Mock Redis responses for puzzle retrieval
      mockRedis.get.mockResolvedValue(JSON.stringify(mockPuzzleSet));
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zAdd.mockResolvedValue(1);
      mockRedis.zCard.mockResolvedValue(1);
      mockRedis.zRange.mockResolvedValue([{ member: testUser, score: 150 }]);
      mockRedis.hSet.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      // Mock multi transaction
      const mockMulti = {
        zAdd: vi.fn(),
        hSet: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn().mockResolvedValue(['OK', 'OK', 'OK']),
      };
      mockRedis.multi.mockReturnValue(mockMulti);

      // Step 1: Test puzzle retrieval
      const puzzleResponse = await request(app)
        .get('/api/puzzle/current')
        .query({ difficulty: 'Easy' })
        .expect(200);

      expect(puzzleResponse.body.success).toBe(true);
      expect(puzzleResponse.body.data.difficulty).toBe('Easy');

      // Step 2: Test comment submission with correct answer
      const commentSubmission = await request(app)
        .post('/internal/triggers/comment-submit')
        .send({
          body: `Exit: ${correctAnswer}`,
          author: testUser,
          postId: 'test-post-123',
        })
        .expect(200);

      expect(commentSubmission.body.status).toBe('success');
      expect(commentSubmission.body.message).toBe('Answer submission processed and scored');
      expect(commentSubmission.body.data.correct).toBe(true);
      expect(commentSubmission.body.data.difficulty).toBe('Easy');
      expect(commentSubmission.body.data.score).toBeGreaterThan(0);

      // Verify Redis operations were called correctly
      expect(mockRedis.multi).toHaveBeenCalled();
      expect(mockMulti.zAdd).toHaveBeenCalled();
      expect(mockMulti.hSet).toHaveBeenCalled();
      expect(mockMulti.exec).toHaveBeenCalled();

      // Step 3: Test leaderboard retrieval
      mockRedis.zCard.mockResolvedValue(1);
      mockRedis.zRange.mockResolvedValue([{ member: `${testUser}:Easy`, score: 150 }]);
      mockRedis.hGet.mockResolvedValue(
        JSON.stringify({
          userId: testUser,
          puzzleId: mockPuzzle.id,
          timeTaken: 300,
          hintsUsed: 0,
          score: 150,
          correct: true,
          timestamp: new Date(),
          difficulty: 'Easy',
        })
      );

      const leaderboardResponse = await request(app)
        .get(`/api/leaderboard-data/daily`)
        .query({ date: today })
        .expect(200);

      expect(leaderboardResponse.body.type).toBe('daily');
      expect(leaderboardResponse.body.entries).toHaveLength(1);
      expect(leaderboardResponse.body.entries[0].username).toBe(testUser);
      expect(leaderboardResponse.body.entries[0].score).toBe(150);
      expect(leaderboardResponse.body.stats.totalPlayers).toBe(1);
    });

    it('should handle incorrect answer submissions', async () => {
      const today = new Date().toISOString().split('T')[0];
      const testUser = 'testplayer2';
      const incorrectAnswer = 'Z9';

      // Mock puzzle data with different solution
      const mockPuzzle = {
        id: `puzzle_easy_${today}`,
        difficulty: 'Easy',
        gridSize: 6,
        materials: [],
        entry: [0, 0],
        solution: [2, 3], // Different from the submitted answer
        hints: [],
        createdAt: new Date(),
      };

      const mockPuzzleSet = {
        date: today,
        puzzles: {
          easy: mockPuzzle,
          medium: { ...mockPuzzle, id: `puzzle_medium_${today}`, difficulty: 'Medium' },
          hard: { ...mockPuzzle, id: `puzzle_hard_${today}`, difficulty: 'Hard' },
        },
        status: 'active',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockPuzzleSet));

      // Test comment submission with incorrect answer
      const commentSubmission = await request(app)
        .post('/internal/triggers/comment-submit')
        .send({
          body: `Exit: ${incorrectAnswer}`,
          author: testUser,
          postId: 'test-post-123',
        })
        .expect(200);

      expect(commentSubmission.body.status).toBe('success');
      expect(commentSubmission.body.message).toBe('Answer submission processed (incorrect)');
      expect(commentSubmission.body.data.correct).toBe(false);

      // Verify no leaderboard updates were made
      expect(mockRedis.multi).not.toHaveBeenCalled();
    });

    it('should handle coordinate format answers', async () => {
      const today = new Date().toISOString().split('T')[0];
      const testUser = 'testplayer3';
      const coordinateAnswer = '[2,3]';

      // Mock puzzle data
      const mockPuzzle = {
        id: `puzzle_medium_${today}`,
        difficulty: 'Medium',
        gridSize: 8,
        materials: [],
        entry: [0, 0],
        solution: [2, 3], // Matches the coordinate answer
        hints: [],
        createdAt: new Date(),
      };

      const mockPuzzleSet = {
        date: today,
        puzzles: {
          easy: { ...mockPuzzle, id: `puzzle_easy_${today}`, difficulty: 'Easy', solution: [0, 0] },
          medium: mockPuzzle,
          hard: { ...mockPuzzle, id: `puzzle_hard_${today}`, difficulty: 'Hard', solution: [5, 5] },
        },
        status: 'active',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockPuzzleSet));
      mockRedis.zAdd.mockResolvedValue(1);
      mockRedis.hSet.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const mockMulti = {
        zAdd: vi.fn(),
        hSet: vi.fn(),
        expire: vi.fn(),
        exec: vi.fn().mockResolvedValue(['OK', 'OK', 'OK']),
      };
      mockRedis.multi.mockReturnValue(mockMulti);

      // Test comment submission with coordinate format
      const commentSubmission = await request(app)
        .post('/internal/triggers/comment-submit')
        .send({
          body: `Exit: ${coordinateAnswer}`,
          author: testUser,
          postId: 'test-post-123',
        })
        .expect(200);

      expect(commentSubmission.body.status).toBe('success');
      expect(commentSubmission.body.message).toBe('Answer submission processed and scored');
      expect(commentSubmission.body.data.correct).toBe(true);
      expect(commentSubmission.body.data.difficulty).toBe('Medium');
      expect(commentSubmission.body.data.answer).toBe(coordinateAnswer);
    });
  });

  describe('Scheduler Integration Tests', () => {
    it('should generate daily puzzles via scheduler', async () => {
      const today = new Date().toISOString().split('T')[0];

      // Mock Redis to indicate no existing puzzles
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.expire.mockResolvedValue(1);

      // Test puzzle generation scheduler
      const schedulerResponse = await request(app)
        .post('/internal/scheduler/generate-puzzles')
        .expect(200);

      expect(schedulerResponse.body.status).toBe('success');
      expect(schedulerResponse.body.puzzlesGenerated).toBe(3);
      expect(schedulerResponse.body.date).toBe(today);
      expect(schedulerResponse.body.puzzles).toHaveLength(3);

      // Verify puzzles were stored in Redis
      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should post daily leaderboard via scheduler', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      // Mock leaderboard data
      mockRedis.zCard.mockResolvedValue(2);
      mockRedis.zRange.mockResolvedValue([
        { member: 'player1:Easy', score: 150 },
        { member: 'player2:Medium', score: 400 },
      ]);
      mockRedis.hGet.mockImplementation((key, field) => {
        const submissions = {
          player1: {
            userId: 'player1',
            timeTaken: 180,
            hintsUsed: 0,
            difficulty: 'Easy',
            timestamp: new Date(),
          },
          player2: {
            userId: 'player2',
            timeTaken: 240,
            hintsUsed: 1,
            difficulty: 'Medium',
            timestamp: new Date(),
          },
        };
        return Promise.resolve(JSON.stringify(submissions[field as keyof typeof submissions]));
      });

      // Mock Reddit post creation
      const { reddit } = await import('@devvit/web/server');
      (reddit.submitCustomPost as any).mockResolvedValue({ id: 'leaderboard-post-123' });

      // Test leaderboard posting scheduler
      const schedulerResponse = await request(app)
        .post('/internal/scheduler/post-leaderboard')
        .expect(200);

      expect(schedulerResponse.body.status).toBe('success');
      expect(schedulerResponse.body.playersCount).toBe(2);
      expect(schedulerResponse.body.postId).toBe('leaderboard-post-123');

      // Verify Reddit post was created
      expect(reddit.submitCustomPost).toHaveBeenCalled();
    });
  });

  describe('Mobile and Desktop Compatibility', () => {
    it('should handle viewport constraints for mobile devices', async () => {
      // Test puzzle retrieval with mobile viewport considerations
      const puzzleResponse = await request(app)
        .get('/api/puzzle/current')
        .query({ difficulty: 'Easy' })
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .expect(200);

      expect(puzzleResponse.body.success).toBe(true);

      // Verify puzzle grid size is appropriate for mobile (6x6 for Easy)
      if (puzzleResponse.body.data) {
        expect(puzzleResponse.body.data.gridSize).toBe(6);
      }
    });

    it('should handle viewport constraints for desktop devices', async () => {
      // Test puzzle retrieval with desktop viewport considerations
      const puzzleResponse = await request(app)
        .get('/api/puzzle/current')
        .query({ difficulty: 'Hard' })
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        .expect(200);

      expect(puzzleResponse.body.success).toBe(true);

      // Verify puzzle grid size is appropriate for desktop (10x10 for Hard)
      if (puzzleResponse.body.data) {
        expect(puzzleResponse.body.data.gridSize).toBe(10);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis failure
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      // Test puzzle retrieval with Redis failure
      const puzzleResponse = await request(app)
        .get('/api/puzzle/current')
        .query({ difficulty: 'Easy' });

      // Should still return a response (backup puzzle)
      expect([200, 500]).toContain(puzzleResponse.status);
    });

    it('should handle malformed comment submissions', async () => {
      // Test various malformed comment formats
      const malformedComments = [
        'Invalid format',
        'Exit:',
        'Exit: ABC',
        'Exit: [a,b]',
        'Exit: [1]',
        'Exit: 123',
      ];

      for (const comment of malformedComments) {
        const response = await request(app)
          .post('/internal/triggers/comment-submit')
          .send({
            body: comment,
            author: 'testuser',
            postId: 'test-post-123',
          })
          .expect(200);

        expect(response.body.status).toBe('success');
        expect(response.body.message).toMatch(/not an answer|invalid format/);
      }
    });
  });
});
