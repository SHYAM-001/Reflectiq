import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Home, Wifi, Bug, Clock } from 'lucide-react';
import { ConnectionStatus } from './ConnectionStatus';
import { useConnectionStatus } from './ConnectionStatus';
import { toast } from 'sonner';

interface ErrorScreenProps {
  error: string;
  onRetry: () => void;
  onReset: () => void;
  errorType?:
    | 'NETWORK_ERROR'
    | 'SERVER_ERROR'
    | 'VALIDATION_ERROR'
    | 'TIMEOUT_ERROR'
    | 'OFFLINE_ERROR';
  retryCount?: number;
  maxRetries?: number;
}

export const ErrorScreen = ({
  error,
  onRetry,
  onReset,
  errorType,
  retryCount = 0,
  maxRetries = 3,
}: ErrorScreenProps) => {
  const connectionStatus = useConnectionStatus();

  const getErrorIcon = () => {
    switch (errorType) {
      case 'OFFLINE_ERROR':
      case 'NETWORK_ERROR':
        return <Wifi className="h-8 w-8 text-destructive" />;
      case 'TIMEOUT_ERROR':
        return <Clock className="h-8 w-8 text-destructive" />;
      default:
        return <AlertTriangle className="h-8 w-8 text-destructive" />;
    }
  };

  const getErrorTitle = () => {
    switch (errorType) {
      case 'OFFLINE_ERROR':
        return 'No Internet Connection';
      case 'NETWORK_ERROR':
        return 'Connection Problem';
      case 'TIMEOUT_ERROR':
        return 'Request Timed Out';
      case 'SERVER_ERROR':
        return 'Server Error';
      case 'VALIDATION_ERROR':
        return 'Invalid Request';
      default:
        return 'Something Went Wrong';
    }
  };

  const getErrorDescription = () => {
    switch (errorType) {
      case 'OFFLINE_ERROR':
        return 'Please check your internet connection and try again.';
      case 'NETWORK_ERROR':
        return 'Unable to connect to the server. Please check your connection.';
      case 'TIMEOUT_ERROR':
        return 'The request took too long to complete. Please try again.';
      case 'SERVER_ERROR':
        return 'The server encountered an error. Please try again in a moment.';
      case 'VALIDATION_ERROR':
        return 'There was a problem with your request. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  const handleReportError = () => {
    const errorReport = {
      timestamp: new Date().toISOString(),
      error,
      errorType,
      retryCount,
      connectionStatus,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    navigator.clipboard
      .writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        toast.success('Error report copied to clipboard', {
          description: 'You can share this with support.',
          duration: 3000,
        });
      })
      .catch(() => {
        toast.error('Failed to copy error report');
      });
  };

  const canRetry = retryCount < maxRetries && errorType !== 'VALIDATION_ERROR';
  const isConnectionIssue = errorType === 'OFFLINE_ERROR' || errorType === 'NETWORK_ERROR';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg p-4">
      <div className="text-center space-y-6 max-w-lg mx-auto">
        {/* Connection status */}
        <div className="flex justify-center">
          <ConnectionStatus showDetails={isConnectionIssue} />
        </div>

        {/* Error icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            {getErrorIcon()}
          </div>
        </div>

        {/* Error title */}
        <h1 className="font-montserrat font-bold text-2xl md:text-3xl text-foreground">
          {getErrorTitle()}
        </h1>

        {/* Error description */}
        <div className="space-y-3">
          <p className="font-poppins text-foreground/70 text-sm md:text-base leading-relaxed">
            {getErrorDescription()}
          </p>

          {error && error !== getErrorDescription() && (
            <details className="text-left bg-muted/50 rounded-lg p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground">
                Technical Details
              </summary>
              <div className="mt-2 text-foreground/60">
                <p>{error}</p>
                {retryCount > 0 && (
                  <p className="mt-1">
                    Retry attempts: {retryCount}/{maxRetries}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>

        {/* Offline-specific guidance */}
        {errorType === 'OFFLINE_ERROR' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <Wifi className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-yellow-700 dark:text-yellow-300">Working Offline</p>
                <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                  Some features may be limited. Your progress will be saved when connection is
                  restored.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {canRetry && (
            <Button
              onClick={onRetry}
              disabled={!connectionStatus.isOnline && isConnectionIssue}
              className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-6 py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isConnectionIssue && !connectionStatus.isOnline
                ? 'Waiting for Connection...'
                : `Try Again (${maxRetries - retryCount} left)`}
            </Button>
          )}

          <Button
            onClick={onReset}
            variant="outline"
            className="border-border/50 hover:border-primary/50 font-poppins font-semibold px-6 py-3 rounded-xl"
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Menu
          </Button>

          <Button
            onClick={handleReportError}
            variant="ghost"
            size="sm"
            className="text-foreground/60 hover:text-foreground"
          >
            <Bug className="mr-2 h-3 w-3" />
            Copy Error Report
          </Button>
        </div>

        {/* Retry count indicator */}
        {retryCount > 0 && (
          <p className="text-xs text-foreground/50">
            Retry attempts: {retryCount}/{maxRetries}
          </p>
        )}

        {/* Auto-retry indicator for connection issues */}
        {isConnectionIssue && !connectionStatus.isOnline && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Will automatically retry when connection is restored
          </p>
        )}

        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-destructive/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
