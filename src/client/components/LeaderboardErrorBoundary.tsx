import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class LeaderboardErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Leaderboard error boundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-bg flex flex-col items-center justify-center p-4">
          <Card className="p-8 bg-card/50 backdrop-blur-sm border-border shadow-elevated max-w-md w-full text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Leaderboard Error</h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Something went wrong while loading the leaderboard. This might be a temporary
                  issue.
                </p>
                {this.state.error && (
                  <details className="text-xs text-muted-foreground mb-4">
                    <summary className="cursor-pointer hover:text-foreground">
                      Error Details
                    </summary>
                    <pre className="mt-2 p-2 bg-muted/20 rounded text-left overflow-auto">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={this.handleRetry} className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default LeaderboardErrorBoundary;
