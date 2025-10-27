/**
 * Game State Management Hook for ReflectIQ
 * Manages puzzle data, session state, and API interactions
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import EnhancedApiService, { ApiError } from '../services/enhanced-api';
import { useErrorHandler } from '../components/ErrorBoundary';
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
  errorType: ApiError['type'] | null;
  retryCount: number;
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
    errorType: null,
    retryCount: 0,
  });

  const apiService = EnhancedApiService.getInstance();
  const { handleError } = useErrorHandler();

  // Initialize app on mount
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setState((prev) => ({
        ...prev,
        gameState: 'loading',
        error: null,
        errorType: null,
        retryCount: 0,
      }));

      const appData = await apiService.initializeApp();

      // Handle offline initialization
      if (appData.offline) {
        setState((prev) => ({
          ...prev,
          appData: { ...appData, username: 'offline_user' },
          gameState: 'menu',
          error: null,
          errorType: null,
        }));

        toast.info('Running in offline mode', {
          description: 'Some features may be limited.',
          duration: 4000,
        });
        return;
      }

      setState((prev) => ({
        ...prev,
        appData,
        gameState: 'menu',
        error: null,
        errorType: null,
        retryCount: 0,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      handleError(new Error(apiError.message), 'App Initialization');

      setState((prev) => ({
        ...prev,
        gameState: 'error',
        error: apiError.message || 'Failed to initialize app. Please refresh and try again.',
        errorType: apiError.type,
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  const startGame = async () => {
    try {
      setState((prev) => ({
        ...prev,
        gameState: 'loading',
        error: null,
        errorType: null,
      }));

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
        errorType: null,
        retryCount: 0,
      }));

      toast.success(`${puzzle.difficulty} puzzle loaded! Timer started.`);
    } catch (error) {
      const apiError = error as ApiError;
      handleError(new Error(apiError.message), 'Game Start');

      setState((prev) => ({
        ...prev,
        gameState: 'error',
        error: apiError.message || 'Failed to start game',
        errorType: apiError.type,
        retryCount: prev.retryCount + 1,
      }));
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
      const apiError = error as ApiError;
      handleError(new Error(apiError.message), 'Hint Request');

      // Don't show generic error toast if it's a validation error (already handled by API service)
      if (apiError.type !== 'VALIDATION_ERROR') {
        toast.error('Failed to get hint. Please try again.');
      }
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
      errorType: null,
      retryCount: 0,
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
