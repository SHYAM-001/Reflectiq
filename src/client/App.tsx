import { Toaster } from './components/ui/toaster';
import { Toaster as Sonner } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConnectionStatus } from './components/ConnectionStatus';
import EnhancedGenerationStatus from './components/EnhancedGenerationStatus';
import Index from './pages/Index';
import InteractiveLeaderboard from './components/InteractiveLeaderboard';
import { useEffect, useState } from 'react';
import { runComprehensiveTest, logTestResults } from './utils/enhanced-generation-test';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry validation errors
        if (error?.type === 'VALIDATION_ERROR') return false;
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: (failureCount, error: any) => {
        // Don't retry validation errors or successful submissions
        if (error?.type === 'VALIDATION_ERROR') return false;
        // Retry network errors up to 2 times
        return failureCount < 2 && error?.type === 'NETWORK_ERROR';
      },
    },
  },
});

const App = () => {
  const [postData, setPostData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    // Check if we have post data (for custom posts)
    const checkPostData = async () => {
      try {
        // In Devvit Web, post data should be available through the context
        // We'll try to fetch it from the server
        const response = await fetch('/api/post-context');
        if (response.ok) {
          const data = await response.json();
          setPostData(data.postData);
        }
      } catch (error) {
        console.log('No post data available, showing default game');
      } finally {
        setLoading(false);
      }
    };

    checkPostData();

    // Add keyboard shortcut for debug panel (Ctrl+Shift+D)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setShowDebugPanel(!showDebugPanel);
      }

      // Add keyboard shortcut for running tests (Ctrl+Shift+T)
      if (event.ctrlKey && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        console.log('🧪 Running enhanced generation tests...');
        runComprehensiveTest().then(logTestResults);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDebugPanel]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If this is a leaderboard post, show the leaderboard component
  if (postData?.type === 'leaderboard') {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <div className="relative">
              {/* Connection status indicator */}
              <div className="fixed top-4 right-4 z-50">
                <ConnectionStatus />
              </div>

              {/* Debug panel */}
              {showDebugPanel && (
                <div className="fixed top-4 left-4 z-50 max-w-md">
                  <EnhancedGenerationStatus />
                </div>
              )}

              {/* Toast notifications */}
              <Toaster />
              <Sonner />

              {/* Leaderboard content */}
              <InteractiveLeaderboard postData={postData} />
            </div>
          </TooltipProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  // Default game content
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="relative">
            {/* Connection status indicator */}
            <div className="fixed top-4 right-4 z-50">
              <ConnectionStatus />
            </div>

            {/* Debug panel */}
            {showDebugPanel && (
              <div className="fixed top-4 left-4 z-50 max-w-md">
                <EnhancedGenerationStatus />
              </div>
            )}

            {/* Toast notifications */}
            <Toaster />
            <Sonner />

            {/* Main app content */}
            <Index />
          </div>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
