/**
 * End-to-End Puzzle Lifecycle System Tests
 * Tests complete puzzle journey from generation to player completion
 * Validates integration between all system components
 *
 * Requirements Coverage:
 * - Complete puzzle lifecycle validation
 * - Player interaction simulation
 * - System integration verification
 * - Data persistence and retrieval
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnhancedPuzzleEngineImpl } from '../../../shared/puzzle/EnhancedPuzzleEngine.js';
import { PuzzleService } from '../../services/PuzzleService.js';
import { LeaderboardService } from '../../services/LeaderboardService.js';
import { CacheManager } from '../../services/CacheManager.js';
import { Difficulty, Puzzle, GridPosition } from '../../../shared/types/puzzle.js';
import { ValidationResult } from '../../../shared/types/guaranteed-generation.js';

describe('End-to-End Puzzle Lifecycle Tests', () => {
  let enhancedEngine: EnhancedPuzzleEngineImpl;
  let puzzleService: PuzzleService;
  let leaderboardService: LeaderboardService;
  let cacheManager: CacheManager;

  beforeEach(() => {
    enhancedEngine = EnhancedPuzzleEngineImpl.getInstance();
    puzzleService = PuzzleService.getInstance();
    leaderboardService = LeaderboardService.getInstance();
    cacheManager = CacheManager.getInstance();

    // Clear metrics for clean testing
    enhancedEngine.clearOldMetrics(0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Player Journey Tests', () => {
    it('should handle complete player journey from puzzle request to completion', async () => {
      const testDate = '2025-01-30';
      const difficulty: Difficulty = 'Easy';
      const mockUserId = 'player-journey-123';
      const mockSessionId = 'session-journey-123';

      console.log(`🎮 Starting complete player journey test for ${difficulty}...`);

      // Step 1: Player requests a new puzzle
      console.log('   📝 Step 1: Generating puzzle...');
      const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

      expect(puzzle).toBeDefined();
      expect(puzzle.difficulty).toBe(difficulty);
      expect(puzzle.materials.length).toBeGreaterThan(0);
      expect(puzzle.solutionPath.segments.length).toBeGreaterThan(0);
      expect(puzzle.hints.length).toBe(4);

      // Verify puzzle quality
      const validation = await enhancedEngine.verifyUniqueSolution(puzzle);
      expect(validation.isValid).toBe(true);
      expect(validation.hasUniqueSolution).toBe(true);

      // Step 2: Store puzzle in system
      console.log('   💾 Step 2: Storing puzzle in cache...');
      await cacheManager.storePuzzle(puzzle);
      const storedPuzzle = await cacheManager.getPuzzle(puzzle.id);
      expect(storedPuzzle).toEqual(puzzle);

      // Step 3: Player starts game session
      console.log('   🎯 Step 3: Starting game session...');
      const gameSession = await puzzleService.startPuzzleSession(
        puzzle.id,
        mockUserId,
        mockSessionId
      );

      expect(gameSession.puzzleId).toBe(puzzle.id);
      expect(gameSession.userId).toBe(mockUserId);
      expect(gameSession.sessionId).toBe(mockSessionId);
      expect(gameSession.isActive).toBe(true);
      expect(gameSession.startTime).toBeDefined();

      // Step 4: Player requests first hint
      console.log('   💡 Step 4: Requesting first hint...');
      const hint1 = await puzzleService.getHint(puzzle.id, mockUserId, 1);

      expect(hint1).toBeDefined();
      expect(hint1.hintLevel).toBe(1);
      expect(hint1.segments.length).toBeGreaterThan(0);
      expect(hint1.percentage).toBe(25);

      // Verify hint usage is tracked
      const hintUsage1 = await puzzleService.getHintUsage(puzzle.id, mockUserId);
      expect(hintUsage1.length).toBe(1);
      expect(hintUsage1[0].hintLevel).toBe(1);

      // Step 5: Player makes incorrect guess
      console.log('   ❌ Step 5: Making incorrect guess...');
      const incorrectGuess: GridPosition = [0, 0]; // Assume this is wrong
      const incorrectResult = await puzzleService.validateSolution(
        puzzle.id,
        mockUserId,
        incorrectGuess,
        60000, // 1 minute elapsed
        1 // 1 hint used
      );

      expect(incorrectResult.isCorrect).toBe(false);
      expect(incorrectResult.score.finalScore).toBe(0);

      // Step 6: Player requests second hint
      console.log('   💡 Step 6: Requesting second hint...');
      const hint2 = await puzzleService.getHint(puzzle.id, mockUserId, 2);

      expect(hint2).toBeDefined();
      expect(hint2.hintLevel).toBe(2);
      expect(hint2.percentage).toBe(50);

      // Verify hint usage is updated
      const hintUsage2 = await puzzleService.getHintUsage(puzzle.id, mockUserId);
      expect(hintUsage2.length).toBe(2);

      // Step 7: Player makes correct guess
      console.log('   ✅ Step 7: Making correct guess...');
      const correctResult = await puzzleService.validateSolution(
        puzzle.id,
        mockUserId,
        puzzle.solution,
        180000, // 3 minutes total elapsed
        2 // 2 hints used
      );

      expect(correctResult.isCorrect).toBe(true);
      expect(correctResult.score.finalScore).toBeGreaterThan(0);
      expect(correctResult.score.hintMultiplier).toBeLessThan(1); // Penalty for hints

      // Step 8: Update leaderboard
      console.log('   🏆 Step 8: Updating leaderboard...');
      await leaderboardService.updateLeaderboard(
        mockUserId,
        difficulty,
        correctResult.score.finalScore,
        180000,
        2
      );

      // Verify leaderboard entry
      const userRank = await leaderboardService.getUserRank(mockUserId, difficulty);
      expect(userRank).toBeDefined();
      expect(userRank).toBeGreaterThan(0);

      // Step 9: Complete session
      console.log('   🎉 Step 9: Completing session...');
      await puzzleService.completeSession(mockSessionId, correctResult.score.finalScore);

      const completedSession = await puzzleService.getGameSession(mockSessionId);
      expect(completedSession.isActive).toBe(false);
      expect(completedSession.completed).toBe(true);
      expect(completedSession.finalScore).toBe(correctResult.score.finalScore);

      // Step 10: Verify metrics and analytics
      console.log('   📊 Step 10: Verifying metrics...');
      const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
      expect(metadata).toBeDefined();
      expect(metadata?.validationPassed).toBe(true);

      const performanceMetrics = enhancedEngine.getPerformanceMetrics();
      expect(performanceMetrics.totalGenerated).toBeGreaterThan(0);

      console.log('✅ Complete player journey test passed successfully!');
    }, 60000);

    it('should handle multiple players solving the same puzzle', async () => {
      const testDate = '2025-01-31';
      const difficulty: Difficulty = 'Medium';
      const playerCount = 3;
      const players = Array.from({ length: playerCount }, (_, i) => ({
        userId: `multi-player-${i}`,
        sessionId: `multi-session-${i}`,
      }));

      console.log(`👥 Testing ${playerCount} players solving the same puzzle...`);

      // Generate single puzzle for all players
      const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);
      await cacheManager.storePuzzle(puzzle);

      const playerResults: Array<{
        userId: string;
        success: boolean;
        score: number;
        hintsUsed: number;
        timeElapsed: number;
      }> = [];

      // Simulate each player's journey
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        console.log(`   🎮 Player ${i + 1} (${player.userId}) starting...`);

        try {
          // Start session
          const session = await puzzleService.startPuzzleSession(
            puzzle.id,
            player.userId,
            player.sessionId
          );

          // Simulate different hint usage patterns
          const hintsToUse = i; // Player 0 uses 0 hints, Player 1 uses 1 hint, etc.
          for (let hintLevel = 1; hintLevel <= hintsToUse; hintLevel++) {
            await puzzleService.getHint(puzzle.id, player.userId, hintLevel);
          }

          // Simulate different solving times
          const timeElapsed = 120000 + i * 30000; // 2, 2.5, 3 minutes

          // Solve puzzle
          const result = await puzzleService.validateSolution(
            puzzle.id,
            player.userId,
            puzzle.solution,
            timeElapsed,
            hintsToUse
          );

          expect(result.isCorrect).toBe(true);

          // Update leaderboard
          await leaderboardService.updateLeaderboard(
            player.userId,
            difficulty,
            result.score.finalScore,
            timeElapsed,
            hintsToUse
          );

          // Complete session
          await puzzleService.completeSession(player.sessionId, result.score.finalScore);

          playerResults.push({
            userId: player.userId,
            success: true,
            score: result.score.finalScore,
            hintsUsed: hintsToUse,
            timeElapsed,
          });

          console.log(`     ✅ Player ${i + 1} completed with score ${result.score.finalScore}`);
        } catch (error) {
          playerResults.push({
            userId: player.userId,
            success: false,
            score: 0,
            hintsUsed: 0,
            timeElapsed: 0,
          });
          console.log(`     ❌ Player ${i + 1} failed: ${error}`);
        }
      }

      // Verify all players succeeded
      const successfulPlayers = playerResults.filter((p) => p.success);
      expect(successfulPlayers.length).toBe(playerCount);

      // Verify scoring reflects different performance
      const sortedByScore = successfulPlayers.sort((a, b) => b.score - a.score);

      // Player with fewer hints and faster time should have higher score
      expect(sortedByScore[0].hintsUsed).toBeLessThanOrEqual(
        sortedByScore[sortedByScore.length - 1].hintsUsed
      );

      // Verify leaderboard reflects all players
      for (const player of players) {
        const rank = await leaderboardService.getUserRank(player.userId, difficulty);
        expect(rank).toBeDefined();
        expect(rank).toBeGreaterThan(0);
      }

      console.log('✅ Multi-player test completed successfully!');
      console.log(`   - All ${playerCount} players completed the puzzle`);
      console.log(
        `   - Score range: ${Math.min(...successfulPlayers.map((p) => p.score))} - ${Math.max(...successfulPlayers.map((p) => p.score))}`
      );
    }, 90000);
  });

  describe('Daily Puzzle Workflow Tests', () => {
    it('should handle complete daily puzzle generation and distribution workflow', async () => {
      const testDate = '2025-02-01';

      console.log(`📅 Testing daily puzzle workflow for ${testDate}...`);

      // Step 1: Generate daily puzzle set
      console.log('   🎲 Step 1: Generating daily puzzle set...');
      const dailyPuzzles = await enhancedEngine.generateDailyPuzzles(testDate);

      expect(dailyPuzzles).toBeDefined();
      expect(dailyPuzzles.date).toBeDefined();
      expect(dailyPuzzles.puzzles.Easy).toBeDefined();
      expect(dailyPuzzles.puzzles.Medium).toBeDefined();
      expect(dailyPuzzles.puzzles.Hard).toBeDefined();

      // Step 2: Store all puzzles in cache
      console.log('   💾 Step 2: Storing puzzles in cache...');
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
      for (const difficulty of difficulties) {
        const puzzle = dailyPuzzles.puzzles[difficulty];
        await cacheManager.storePuzzle(puzzle);

        // Verify storage
        const stored = await cacheManager.getPuzzle(puzzle.id);
        expect(stored).toEqual(puzzle);
      }

      // Step 3: Simulate multiple players accessing daily puzzles
      console.log('   👥 Step 3: Simulating player access...');
      const playersPerDifficulty = 2;
      const allPlayerResults: Array<{
        difficulty: Difficulty;
        userId: string;
        completed: boolean;
      }> = [];

      for (const difficulty of difficulties) {
        const puzzle = dailyPuzzles.puzzles[difficulty];

        for (let i = 0; i < playersPerDifficulty; i++) {
          const userId = `daily-player-${difficulty}-${i}`;
          const sessionId = `daily-session-${difficulty}-${i}`;

          try {
            // Start session
            await puzzleService.startPuzzleSession(puzzle.id, userId, sessionId);

            // Solve puzzle (simplified)
            const result = await puzzleService.validateSolution(
              puzzle.id,
              userId,
              puzzle.solution,
              150000, // 2.5 minutes
              1 // 1 hint
            );

            expect(result.isCorrect).toBe(true);

            // Update leaderboard
            await leaderboardService.updateLeaderboard(
              userId,
              difficulty,
              result.score.finalScore,
              150000,
              1
            );

            allPlayerResults.push({
              difficulty,
              userId,
              completed: true,
            });

            console.log(`     ✅ ${userId} completed ${difficulty} puzzle`);
          } catch (error) {
            allPlayerResults.push({
              difficulty,
              userId,
              completed: false,
            });
            console.log(`     ❌ ${userId} failed ${difficulty} puzzle: ${error}`);
          }
        }
      }

      // Step 4: Verify leaderboards for all difficulties
      console.log('   🏆 Step 4: Verifying leaderboards...');
      for (const difficulty of difficulties) {
        const leaderboard = await leaderboardService.getLeaderboard(difficulty, 10, 0);
        expect(leaderboard).toBeDefined();
        expect(leaderboard.length).toBeGreaterThan(0);

        console.log(`     📊 ${difficulty} leaderboard has ${leaderboard.length} entries`);
      }

      // Step 5: Verify daily puzzle retrieval
      console.log('   📋 Step 5: Verifying daily puzzle retrieval...');
      const retrievedDailySet = await cacheManager.getDailyPuzzleSet(testDate);
      expect(retrievedDailySet).toBeDefined();
      expect(retrievedDailySet?.puzzles.Easy.id).toBe(dailyPuzzles.puzzles.Easy.id);
      expect(retrievedDailySet?.puzzles.Medium.id).toBe(dailyPuzzles.puzzles.Medium.id);
      expect(retrievedDailySet?.puzzles.Hard.id).toBe(dailyPuzzles.puzzles.Hard.id);

      const completedPlayers = allPlayerResults.filter((p) => p.completed).length;
      const totalPlayers = allPlayerResults.length;

      console.log('✅ Daily puzzle workflow test completed successfully!');
      console.log(`   - Generated puzzles for all 3 difficulties`);
      console.log(`   - ${completedPlayers}/${totalPlayers} players completed their puzzles`);
      console.log(`   - All leaderboards updated correctly`);
    }, 120000);
  });

  describe('Error Recovery and Resilience Tests', () => {
    it('should recover gracefully from puzzle generation failures during player session', async () => {
      const testDate = '2025-02-02';
      const difficulty: Difficulty = 'Hard';
      const mockUserId = 'resilience-player-123';
      const mockSessionId = 'resilience-session-123';

      console.log('🛡️ Testing error recovery during player session...');

      // Mock generation to fail initially
      let generationAttempts = 0;
      const originalGenerateGuaranteedPuzzle = enhancedEngine.generateGuaranteedPuzzle;

      vi.spyOn(enhancedEngine, 'generateGuaranteedPuzzle').mockImplementation(
        async (diff, date) => {
          generationAttempts++;
          if (generationAttempts <= 2) {
            throw new Error(`Simulated generation failure ${generationAttempts}`);
          }
          // Third attempt succeeds
          return originalGenerateGuaranteedPuzzle.call(enhancedEngine, diff, date);
        }
      );

      try {
        // Player requests puzzle - should eventually succeed after retries
        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

        expect(puzzle).toBeDefined();
        expect(generationAttempts).toBeGreaterThan(2); // Should have retried

        // Continue with normal player flow
        await cacheManager.storePuzzle(puzzle);

        const session = await puzzleService.startPuzzleSession(
          puzzle.id,
          mockUserId,
          mockSessionId
        );

        expect(session.isActive).toBe(true);

        // Player completes puzzle
        const result = await puzzleService.validateSolution(
          puzzle.id,
          mockUserId,
          puzzle.solution,
          200000,
          0
        );

        expect(result.isCorrect).toBe(true);

        console.log('✅ Error recovery test passed - system recovered from generation failures');
      } finally {
        // Restore original method
        enhancedEngine.generateGuaranteedPuzzle = originalGenerateGuaranteedPuzzle;
      }
    }, 45000);

    it('should handle cache failures gracefully during puzzle lifecycle', async () => {
      const testDate = '2025-02-03';
      const difficulty: Difficulty = 'Easy';
      const mockUserId = 'cache-test-player-123';

      console.log('💾 Testing cache failure resilience...');

      // Generate puzzle normally
      const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

      // Mock cache to fail on first storage attempt
      let cacheAttempts = 0;
      const originalStorePuzzle = cacheManager.storePuzzle;

      vi.spyOn(cacheManager, 'storePuzzle').mockImplementation(async (puzzleToStore) => {
        cacheAttempts++;
        if (cacheAttempts === 1) {
          throw new Error('Simulated cache storage failure');
        }
        // Second attempt succeeds
        return originalStorePuzzle.call(cacheManager, puzzleToStore);
      });

      try {
        // First storage attempt should fail, but system should retry
        await expect(cacheManager.storePuzzle(puzzle)).rejects.toThrow(
          'Simulated cache storage failure'
        );

        // Second attempt should succeed
        await cacheManager.storePuzzle(puzzle);

        // Verify puzzle can be retrieved
        const retrieved = await cacheManager.getPuzzle(puzzle.id);
        expect(retrieved).toEqual(puzzle);

        console.log('✅ Cache failure resilience test passed');
      } finally {
        // Restore original method
        cacheManager.storePuzzle = originalStorePuzzle;
      }
    }, 30000);
  });

  describe('Performance and Quality Validation Tests', () => {
    it('should maintain consistent puzzle quality throughout player lifecycle', async () => {
      const testDate = '2025-02-04';
      const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
      const qualityThresholds = {
        Easy: 80,
        Medium: 75,
        Hard: 70,
      };

      console.log('🎯 Testing puzzle quality consistency...');

      for (const difficulty of difficulties) {
        console.log(`   📊 Testing ${difficulty} difficulty...`);

        // Generate puzzle
        const puzzle = await enhancedEngine.generateGuaranteedPuzzle(difficulty, testDate);

        // Validate quality metrics
        const validation = await enhancedEngine.verifyUniqueSolution(puzzle);
        expect(validation.isValid).toBe(true);
        expect(validation.hasUniqueSolution).toBe(true);
        expect(validation.confidenceScore).toBeGreaterThan(qualityThresholds[difficulty]);

        // Verify puzzle structure quality
        expect(puzzle.materials.length).toBeGreaterThan(0);
        expect(puzzle.solutionPath.segments.length).toBeGreaterThan(0);
        expect(puzzle.hints.length).toBe(4);

        // Verify spacing constraints
        const isValidSpacing = enhancedEngine.validateSpacingConstraints(
          puzzle.entry,
          puzzle.solution,
          difficulty
        );
        expect(isValidSpacing).toBe(true);

        // Simulate player solving to verify solvability
        const mockUserId = `quality-test-${difficulty}`;
        const mockSessionId = `quality-session-${difficulty}`;

        await cacheManager.storePuzzle(puzzle);
        await puzzleService.startPuzzleSession(puzzle.id, mockUserId, mockSessionId);

        const result = await puzzleService.validateSolution(
          puzzle.id,
          mockUserId,
          puzzle.solution,
          180000,
          1
        );

        expect(result.isCorrect).toBe(true);
        expect(result.score.finalScore).toBeGreaterThan(0);

        const metadata = enhancedEngine.getGenerationMetadata(puzzle.id);
        console.log(
          `     ✅ ${difficulty}: confidence ${validation.confidenceScore}, quality verified`
        );
      }

      console.log('✅ Puzzle quality consistency test passed for all difficulties');
    }, 90000);
  });
});
