import { StartScreen } from '../components/StartScreen';
import { PuzzleScreen } from '../components/puzzle/PuzzleScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen } from '../components/ErrorScreen';
import { SubmissionScreen } from '../components/SubmissionScreen';
import { useGameState } from '../hooks/use-game-state';
import { withErrorBoundary } from '../components/ErrorBoundary';

const Index = () => {
  const gameState = useGameState();

  const renderScreen = () => {
    switch (gameState.gameState) {
      case 'loading':
        return <LoadingScreen />;

      case 'error':
        return (
          <ErrorScreen
            error={gameState.error || 'An unknown error occurred'}
            errorType={gameState.errorType}
            retryCount={gameState.retryCount}
            onRetry={gameState.retryGame}
            onReset={gameState.resetGame}
          />
        );

      case 'menu':
        return <StartScreen onStart={gameState.startGame} />;

      case 'playing':
        return (
          <PuzzleScreen
            puzzle={gameState.currentPuzzle!}
            session={gameState.session!}
            hintsUsed={gameState.hintsUsed}
            hintPaths={gameState.hintPaths}
            isTimerRunning={gameState.isTimerRunning}
            onRequestHint={gameState.requestHint}
            onSubmitAnswer={gameState.submitAnswer}
            onBack={gameState.resetGame}
          />
        );

      case 'completed':
        return (
          <SubmissionScreen
            puzzle={gameState.currentPuzzle!}
            selectedAnswer={gameState.selectedAnswer!}
            finalTime={gameState.finalTime!}
            hintsUsed={gameState.hintsUsed}
            onPlayAgain={gameState.resetGame}
          />
        );

      default:
        return <LoadingScreen />;
    }
  };

  return renderScreen();
};

export default withErrorBoundary(Index);
