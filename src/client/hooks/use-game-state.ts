/**
 * Game State Management Hook for ReflectIQ
 * Manages puzzle data, session state, and API interactions
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import ApiService from '../services/api';
import {
  Puzzle,
  SessionData,
  Difficulty,
  HintPath,
  ScoreResult,
  InitResponse,
  GridPosition,
} from '../types/api';

export type GameState = 'loading' | 'menu' | 'playing' | 'completed' | 'error';

interface GameStateData {
  // App initialization
  appData: InitResponse | null;

  // Game state
  gameState: GameState;
  selectedDifficulty: Difficulty | null;

  // Puzzle data
  currentPuzzle: Puzzle | null;
  session: SessionData | null;

  // Game progress
  hintsUsed: number;
  revealedQuadrants: number[];
  hintPaths: HintPath[];
  isTimerRunning: boolean;
  finalTime: number | null;
  selectedAnswer: GridPosition | null;

  // Results
  scoreResult: ScoreResult | null;
  leaderboardPosition: number | null;

  // Error handling
  error: string | null;
}

export const useGameState = () => {
  const [state, setState] = useState<GameStateData>({
    appData: null,
    gameState: 'loading',
    selectedDifficulty: null,
    currentPuzzle: null,
    session: null,
    hintsUsed: 0,
    revealedQuadrants: [],
    hintPaths: [],
    isTimerRunning: false,
    finalTime: null,
    selectedAnswer: null,
    scoreResult: null,
    leaderboardPosition: null,
    error: null,
  });

  const apiService = ApiService.getInstance();

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setState((prev) => ({ ...prev, gameState: 'loading' }));

      const appData = await apiService.initializeApp();

      setState((prev) => ({
        ...prev,
        appData,
        gameState: 'menu',
        error: null,
      }));
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setState((prev) => ({
        ...prev,
        gameState: 'error',
        error: 'Failed to initialize app. Please refresh and try again.',
      }));
    }
  };

  const startGame = async () => {
    try {
      setState((prev) => ({ ...prev, gameState: 'loading' }));

      // Get current puzzle (difficulty will be determined by the post context)
      // For now, we'll default to Easy, but this should come from the post metadata
      const difficulty: Difficulty = 'Easy'; // TODO: Get from post context
      const puzzleResponse = await apiService.getCurrentPuzzle(difficulty);

      if (!puzzleResponse.success || !puzzleResponse.data) {
        throw new Error(puzzleResponse.error?.message || 'Failed to load puzzle');
      }

      const puzzle = puzzleResponse.data;

      // Start session
      const sessionResponse = await apiService.startPuzzleSession(
        puzzle.id,
        state.appData?.username || 'anonymous'
      );

      if (!sessionResponse.success || !sessionResponse.data) {
        throw new Error(sessionResponse.error?.message || 'Failed to start session');
      }

      const session = sessionResponse.data;

      setState((prev) => ({
        ...prev,
        gameState: 'playing',
        currentPuzzle: puzzle,
        session,
        hintsUsed: 0,
        revealedQuadrants: [],
        hintPaths: [],
        isTimerRunning: true,
        finalTime: null,
        scoreResult: null,
        leaderboardPosition: null,
        error: null,
      }));

      toast.success(`${puzzle.difficulty} puzzle loaded! Timer started.`);
    } catch (error) {
      console.error('Failed to start game:', error);
      setState((prev) => ({
        ...prev,
        gameState: 'error',
        error: error instanceof Error ? error.message : 'Failed to start game',
      }));
      toast.error('Failed to start game. Please try again.');
    }
  };

  const requestHint = async () => {
    if (!state.session || state.hintsUsed >= 4) {
      toast.error('No more hints available');
      return;
    }

    try {
      const hintNumber = state.hintsUsed + 1;
      const hintResponse = await apiService.requestHint(state.session.sessionId, hintNumber);

      if (!hintResponse.success || !hintResponse.data) {
        throw new Error(hintResponse.error?.message || 'Failed to get hint');
      }

      const { hintData, hintsUsed, scoreMultiplier } = hintResponse.data;

      setState((prev) => ({
        ...prev,
        hintsUsed,
        revealedQuadrants: [...prev.revealedQuadrants, hintData.hintLevel],
        hintPaths: [...prev.hintPaths, hintData],
      }));

      const percentage = hintData.percentage.toFixed(0);
      toast.success(`Hint ${hintNumber}: ${percentage}% of laser path revealed!`, {
        duration: 4000,
        description: `Score multiplier now: ${scoreMultiplier.toFixed(1)}x`,
      });
    } catch (error) {
      console.error('Failed to get hint:', error);
      toast.error('Failed to get hint. Please try again.');
    }
  };

  const submitAnswer = async (answer: GridPosition, timeTaken: number) => {
    if (!state.session) {
      toast.error('No active session');
      return;
    }

    try {
      // Stop the timer and store the submission locally
      setState((prev) => ({
        ...prev,
        isTimerRunning: false,
        finalTime: timeTaken,
        selectedAnswer: answer,
        gameState: 'completed', // Move to completed state to show submission instructions
      }));

      // Store the session data for when the Reddit comment is processed
      // The actual submission will be handled by the comment trigger on the server
      console.log('Answer submitted locally, waiting for Reddit comment processing');
    } catch (error) {
      console.error('Failed to prepare answer submission:', error);
      toast.error('Failed to prepare submission. Please try again.');
      setState((prev) => ({ ...prev, isTimerRunning: true, gameState: 'playing' }));
    }
  };

  const resetGame = () => {
    setState((prev) => ({
      ...prev,
      gameState: 'menu',
      selectedDifficulty: null,
      currentPuzzle: null,
      session: null,
      hintsUsed: 0,
      revealedQuadrants: [],
      hintPaths: [],
      isTimerRunning: false,
      finalTime: null,
      selectedAnswer: null,
      scoreResult: null,
      leaderboardPosition: null,
      error: null,
    }));
  };

  const retryGame = () => {
    startGame();
  };

  return {
    // State
    ...state,

    // Actions
    startGame,
    requestHint,
    submitAnswer,
    resetGame,
    retryGame,
    initializeApp,
  };
};
