/**
 * Game State Management Hook for ReflectIQ
 * Manages puzzle data, session state, and API interactions
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import EnhancedApiService, { ApiError } from '../services/enhanced-api';
import { useErrorHandler } from '../components/ErrorBoundary';
import { setAppContext } from '../utils/navigation';
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

type AppInitData =
  | InitResponse
  | { offline: true; username: string; success: false; message: string };

interface GameStateData {
  // App initialization
  appData: AppInitData | null;

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
  isRequestingHint: boolean;
  isSubmittingAnswer: boolean;

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
    isRequestingHint: false,
    isSubmittingAnswer: false,
    scoreResult: null,
    leaderboardPosition: null,
    error: null,
    errorType: null,
    retryCount: 0,
  });

  const apiService = EnhancedApiService.getInstance();
  const { handleError } = useErrorHandler();

  const initializeApp = useCallback(async () => {
    try {
      setState((prev) => ({
        ...prev,
        gameState: 'loading',
        error: null,
        errorType: null,
        retryCount: 0,
      }));

      const appData = (await apiService.initializeApp()) as AppInitData;

      // Handle offline initialization
      if ('offline' in appData && appData.offline) {
        setState((prev) => ({
          ...prev,
          appData: {
            offline: true,
            username: 'offline_user',
            success: false,
            message: 'Offline mode',
          },
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

      // Set the app context for navigation
      if ('postId' in appData && typeof appData.postId === 'string') {
        const subreddit =
          'subreddit' in appData && typeof appData.subreddit === 'string'
            ? appData.subreddit
            : undefined;
        setAppContext({
          postId: appData.postId,
          ...(subreddit && { subreddit }),
        });
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
  }, [apiService, handleError]);

  // Initialize app on mount
  useEffect(() => {
    void initializeApp();
  }, []);

  const startGame = async () => {
    try {
      setState((prev) => ({
        ...prev,
        gameState: 'loading',
        error: null,
        errorType: null,
      }));

      // Get difficulty from post context or default to Easy
      let difficulty: Difficulty = 'Easy';

      try {
        const postContextResponse = await fetch('/api/post-context');
        if (postContextResponse.ok) {
          const postContext = await postContextResponse.json();
          const postData = postContext.postData;

          if (postData?.specificDifficulty) {
            // Convert to proper case (easy -> Easy, medium -> Medium, hard -> Hard)
            difficulty = (postData.specificDifficulty.charAt(0).toUpperCase() +
              postData.specificDifficulty.slice(1)) as Difficulty;
            console.log(`Loading puzzle with difficulty from post context: ${difficulty}`);
          }
        }
      } catch (error) {
        console.log('Could not get post context, using default difficulty:', error);
      }

      // Show loading message for enhanced generation
      toast.info('Loading puzzle...', {
        description: 'puzzle generation has been started........',
        duration: 3000,
      });

      const puzzleResponse = await apiService.getCurrentPuzzle(difficulty);

      if (!puzzleResponse.success || !puzzleResponse.data) {
        throw new Error(puzzleResponse.error?.message || 'Failed to load puzzle');
      }

      // Show success message if enhanced generation was used
      if (puzzleResponse.data.id?.includes('enhanced_')) {
        toast.success('Loading puzzle...', {
          description: 'puzzle generation has been started.......',
          duration: 2000,
        });
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
        selectedDifficulty: difficulty,
        currentPuzzle: puzzle,
        session,
        hintsUsed: 0,
        revealedQuadrants: [],
        hintPaths: [],
        isTimerRunning: true,
        finalTime: null,
        isRequestingHint: false,
        isSubmittingAnswer: false,
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
    if (!state.session || state.hintsUsed >= 4 || state.isRequestingHint) {
      if (state.hintsUsed >= 4) {
        toast.error('No more hints available');
      }
      return;
    }

    try {
      setState((prev) => ({ ...prev, isRequestingHint: true }));

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
        isRequestingHint: false,
      }));

      const percentage = hintData.percentage.toFixed(0);
      // toast.success(`Hint ${hintNumber}: ${percentage}% of laser path revealed!`, {
      //   duration: 4000,
      //   description: `Score multiplier now: ${scoreMultiplier.toFixed(1)}x`,
      // });
    } catch (error) {
      setState((prev) => ({ ...prev, isRequestingHint: false }));

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
      toast.error('No active session', {
        description: 'Please start a new game to submit an answer',
        duration: 3000,
      });
      return;
    }

    try {
      // Set loading state and stop the timer immediately
      setState((prev) => ({
        ...prev,
        isTimerRunning: false,
        finalTime: timeTaken,
        selectedAnswer: answer,
        isSubmittingAnswer: true,
      }));

      // Show processing feedback
      toast.info('Processing your answer...', {
        description: 'Validating solution and updating leaderboard',
        duration: 2000,
      });

      // Submit the answer to the server
      console.log('Submitting answer to server:', {
        sessionId: state.session.sessionId,
        answer,
        timeTaken,
      });

      const response = await apiService.submitAnswer(state.session.sessionId, answer, timeTaken);

      if (response.success && response.data) {
        const {
          scoreResult,
          leaderboardPosition,
          commentPosting,
          message,
          isRepeatAttempt,
          originalCompletion,
        } = response.data;

        // Update state with results
        setState((prev) => ({
          ...prev,
          scoreResult,
          leaderboardPosition: leaderboardPosition ?? null,
          gameState: 'completed',
          isSubmittingAnswer: false,
        }));

        // Handle repeat attempts differently
        if (isRepeatAttempt && originalCompletion) {
          // Show repeat attempt message with original completion stats
          const originalTimeFormatted = `${Math.floor(originalCompletion.timeTaken / 60)}:${(originalCompletion.timeTaken % 60).toString().padStart(2, '0')}`;
          const originalDate = new Date(originalCompletion.completedAt).toLocaleDateString();

          toast.info('🔄 Puzzle Already Completed', {
            description: `Original completion: ${originalTimeFormatted} • ${originalCompletion.hintsUsed} hints • ${originalCompletion.score} points on ${originalDate}`,
            duration: 8000,
          });

          // Show the first-attempt-only policy message
          setTimeout(() => {
            toast.info('📊 Leaderboard Policy', {
              description:
                'Only your first correct attempt counts for leaderboard rankings to ensure fair competition',
              duration: 6000,
            });
          }, 2000);

          return; // Exit early for repeat attempts
        }

        // Show success message with enhanced feedback for first attempts
        if (scoreResult.correct) {
          const timeFormatted = `${Math.floor(timeTaken / 60)}:${(timeTaken % 60).toString().padStart(2, '0')}`;

          // Enhanced success message with score breakdown
          const scoreBreakdown = [
            `Base: ${scoreResult.baseScore}`,
            `Time multiplier: ${scoreResult.timeMultiplier}x`,
            `Hint multiplier: ${scoreResult.hintMultiplier}x`,
          ].join(' • ');

          const rankingText = leaderboardPosition
            ? `Ranked #${leaderboardPosition} in ${state.selectedDifficulty}`
            : 'Leaderboard updated';

          toast.success(`🎉 Correct! Final Score: ${scoreResult.finalScore} points`, {
            description: `${timeFormatted} • ${scoreResult.hintsUsed} hints • ${rankingText}`,
            duration: 6000,
          });

          // Show detailed score breakdown in a separate toast
          // setTimeout(() => {
          //   toast.info('Score Breakdown', {
          //     description: scoreBreakdown,
          //     duration: 4000,
          //   });
          // }, 1000);

          // Handle comment posting feedback for successful submissions
          if (commentPosting) {
            if (commentPosting.success) {
              toast.success('🎉 Completion shared with the community!', {
                description: 'Your achievement has been posted to celebrate your success',
                duration: 3000,
              });
            } else {
              // Provide specific feedback based on error type
              const errorType = commentPosting.error?.split(':')[0] || 'unknown';
              const feedbackMessage =
                "Your score was saved, but we couldn't share your achievement";
              let feedbackDescription = "Don't worry - your completion is still recorded!";

              switch (errorType) {
                case 'timeout':
                  feedbackDescription = 'Reddit is responding slowly. Your completion is saved!';
                  break;
                case 'rate_limit':
                  feedbackDescription = 'Too many celebrations happening! Your score is recorded.';
                  break;
                case 'api_unavailable':
                  feedbackDescription =
                    'Reddit is temporarily unavailable. Your progress is saved!';
                  break;
                case 'permission':
                  feedbackDescription = 'Unable to post comments right now. Your score counts!';
                  break;
                case 'post_not_found':
                  feedbackDescription = 'Post context changed. Your completion is still valid!';
                  break;
                default:
                  feedbackDescription =
                    'Technical issue with sharing. Your achievement is recorded!';
              }

              toast.info(feedbackMessage, {
                description: feedbackDescription,
                duration: 4000,
              });
            }
          }
        } else {
          // Enhanced error feedback with specific guidance
          const letter = String.fromCharCode(65 + answer[0]);
          const number = answer[1] + 1;
          const attemptedAnswer = `${letter}${number}`;

          // Check if this is a message about first-attempt-only policy
          if (message && message.includes('first correct attempt')) {
            toast.info('🔄 First Attempt Policy', {
              description: message,
              duration: 6000,
            });
          } else {
            toast.error(`❌ Incorrect answer: ${attemptedAnswer}`, {
              description:
                'Trace the laser path carefully - check mirror reflections and material interactions',
              duration: 5000,
            });

            // Provide helpful tips based on hints used
            setTimeout(() => {
              if (scoreResult.hintsUsed === 0) {
                toast.info('💡 Tip: Use hints to reveal parts of the laser path', {
                  description: 'Hints show you exactly where the laser travels',
                  duration: 4000,
                });
              } else if (scoreResult.hintsUsed < 3) {
                toast.info('🔍 Need more guidance?', {
                  description: 'Use additional hints to see more of the laser path',
                  duration: 4000,
                });
              } else {
                toast.info('🎯 Almost there!', {
                  description: 'The laser path is mostly revealed - check the final exit carefully',
                  duration: 4000,
                });
              }
            }, 1500);
          }

          // Handle comment posting feedback for incorrect answers
          if (commentPosting && !commentPosting.success) {
            // Only show feedback if there was an unexpected error (not just API unavailable)
            const errorType = commentPosting.error?.split(':')[0] || 'unknown';
            if (errorType !== 'api_unavailable' && errorType !== 'timeout') {
              console.warn('Encouragement comment failed:', commentPosting.error);
            }
          }

          // Show submission screen for incorrect answers with retry option
          setState((prev) => ({
            ...prev,
            isTimerRunning: false,
            gameState: 'completed',
            isSubmittingAnswer: false,
            scoreResult: scoreResult,
            finalTime: scoreResult.timeTaken,
          }));
        }
      } else {
        throw new Error(response.error?.message || 'Submission failed');
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);

      const apiError = error as ApiError;
      let errorMessage = 'Failed to submit answer';
      let errorDescription = 'Please check your connection and try again';

      // Provide specific error guidance based on error type
      switch (apiError.type) {
        case 'NETWORK_ERROR':
          errorMessage = 'Connection problem';
          errorDescription = 'Check your internet connection and try again';
          break;
        case 'TIMEOUT_ERROR':
          errorMessage = 'Request timed out';
          errorDescription = 'The server is responding slowly. Please try again';
          break;
        case 'VALIDATION_ERROR':
          errorMessage = 'Invalid submission';
          errorDescription = 'Please select a valid exit cell and try again';
          break;
        case 'SERVER_ERROR':
          errorMessage = 'Server error';
          errorDescription = 'Our servers are having issues. Please try again in a moment';
          break;
        default:
          errorMessage = 'Submission failed';
          errorDescription = 'Something went wrong. Please try submitting again';
      }

      toast.error(errorMessage, {
        description: errorDescription,
        duration: 5000,
      });

      setState((prev) => ({
        ...prev,
        isTimerRunning: true,
        gameState: 'playing',
        isSubmittingAnswer: false,
      }));
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
      isRequestingHint: false,
      isSubmittingAnswer: false,
      scoreResult: null,
      leaderboardPosition: null,
      error: null,
      errorType: null,
      retryCount: 0,
    }));
  };

  const retryGame = () => {
    void startGame();
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
