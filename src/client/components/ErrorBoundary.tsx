/**
 * React Error Boundary for ReflectIQ
 * Catches JavaScript errors anywhere in the component tree and displays fallback UI
 * Following Devvit Web best practices for error handling
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production (if available)
    this.logErrorToService(error, errorInfo);

    // Show toast notification
    toast.error('Something went wrong', {
      description: 'The application encountered an unexpected error.',
      duration: 5000,
    });
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to an error tracking service
    // For Devvit Web, we'll log to console with structured data
    const errorReport = {
      timestamp: new Date().toISOString(),
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.retryCount,
    };

    console.error('Error Report:', JSON.stringify(errorReport, null, 2));

    // In production, you might send this to a logging service:
    // fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorReport) });
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;

      // Reset error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });

      toast.info(`Retrying... (${this.retryCount}/${this.maxRetries})`, {
        duration: 2000,
      });
    } else {
      toast.error('Maximum retry attempts reached', {
        description: 'Please refresh the page to continue.',
        duration: 5000,
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleReportError = () => {
    const { error, errorInfo, errorId } = this.state;

    if (!error || !errorInfo) return;

    // Create error report for user to copy
    const errorReport = {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack?.split('\\n').slice(0, 5).join('\\n'), // First 5 lines only
      component: errorInfo.componentStack?.split('\\n')[1]?.trim(), // First component in stack
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Copy to clipboard
    navigator.clipboard
      .writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        toast.success('Error report copied to clipboard', {
          description: 'You can share this with the developers.',
          duration: 3000,
        });
      })
      .catch(() => {
        toast.error('Failed to copy error report', {
          description: 'Please manually copy the error details from the console.',
          duration: 3000,
        });
      });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-bg p-4">
          <div className="text-center space-y-6 max-w-lg mx-auto">
            {/* Error icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
            </div>

            {/* Error title */}
            <h1 className="font-montserrat font-bold text-2xl md:text-3xl text-foreground">
              Application Error
            </h1>

            {/* Error message */}
            <div className="space-y-2">
              <p className="font-poppins text-foreground/70 text-sm md:text-base leading-relaxed">
                The application encountered an unexpected error and needs to recover.
              </p>

              {this.state.error && (
                <details className="text-left bg-muted/50 rounded-lg p-3 text-xs">
                  <summary className="cursor-pointer font-medium text-foreground/80 hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 space-y-1 text-foreground/60">
                    <p>
                      <strong>Error:</strong> {this.state.error.message}
                    </p>
                    {this.state.errorId && (
                      <p>
                        <strong>Error ID:</strong> {this.state.errorId}
                      </p>
                    )}
                    <p>
                      <strong>Time:</strong> {new Date().toLocaleString()}
                    </p>
                  </div>
                </details>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {this.retryCount < this.maxRetries && (
                <Button
                  onClick={this.handleRetry}
                  className="bg-gradient-primary text-primary-foreground font-poppins font-semibold px-6 py-3 rounded-xl shadow-glow-primary hover:scale-105 transition-all duration-300"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again ({this.maxRetries - this.retryCount} left)
                </Button>
              )}

              <Button
                onClick={this.handleReload}
                variant="outline"
                className="border-border/50 hover:border-primary/50 font-poppins font-semibold px-6 py-3 rounded-xl"
              >
                <Home className="mr-2 h-4 w-4" />
                Reload Page
              </Button>

              <Button
                onClick={this.handleReportError}
                variant="ghost"
                size="sm"
                className="text-foreground/60 hover:text-foreground"
              >
                <Bug className="mr-2 h-3 w-3" />
                Copy Error Report
              </Button>
            </div>

            {/* Retry count indicator */}
            {this.retryCount > 0 && (
              <p className="text-xs text-foreground/50">
                Retry attempts: {this.retryCount}/{this.maxRetries}
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
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

/**
 * Hook for handling errors in functional components
 */
export const useErrorHandler = () => {
  const handleError = (error: Error, context?: string) => {
    console.error(`Error in ${context || 'component'}:`, error);

    // Log structured error
    const errorReport = {
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('Error Report:', JSON.stringify(errorReport, null, 2));

    // Show user-friendly toast
    toast.error('Something went wrong', {
      description: context ? `Error in ${context}` : 'Please try again or refresh the page.',
      duration: 4000,
    });
  };

  return { handleError };
};
