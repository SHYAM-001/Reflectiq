/**
 * Enhanced Generation Status Component
 * Shows the current status of the enhanced puzzle generation system
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Sparkles, TrendingUp, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface FeatureFlagStatus {
  flags: {
    enableGuaranteedGeneration: boolean;
    fallbackToLegacy: boolean;
    enhancedGenerationRollout: number;
    confidenceThreshold: number;
    maxGenerationAttempts: number;
    timeoutMs: number;
  };
  status: {
    enhancedGenerationEnabled: boolean;
    rolloutPercentage: number;
    fallbackEnabled: boolean;
  };
  metrics: {
    enhancedGenerationUsage: number;
    fallbackUsage: number;
    averageGenerationTime: number;
    successRate: number;
  };
  timestamp: string;
}

export const EnhancedGenerationStatus = () => {
  const [status, setStatus] = useState<FeatureFlagStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/feature-flags');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch status');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching feature flag status:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateRollout = async (percentage: number) => {
    try {
      const response = await fetch('/api/feature-flags/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enhancedGenerationRollout: percentage,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        toast.success(`Rollout updated to ${percentage}%`);
        await fetchStatus(); // Refresh status
      } else {
        throw new Error(data.error?.message || 'Failed to update rollout');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to update rollout: ${errorMessage}`);
      console.error('Error updating rollout:', err);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Enhanced Generation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="ml-2">Loading status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Enhanced Generation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchStatus} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const totalGenerations = status.metrics.enhancedGenerationUsage + status.metrics.fallbackUsage;
  const enhancedPercentage =
    totalGenerations > 0 ? (status.metrics.enhancedGenerationUsage / totalGenerations) * 100 : 0;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          Enhanced Generation Status
        </CardTitle>
        <CardDescription>Current status of the guaranteed puzzle generation system</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={status.status.enhancedGenerationEnabled ? 'default' : 'secondary'}>
                {status.status.enhancedGenerationEnabled ? (
                  <>
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Enabled
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Disabled
                  </>
                )}
              </Badge>
              <span className="text-sm text-muted-foreground">System Status</span>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={status.status.fallbackEnabled ? 'outline' : 'secondary'}>
                Fallback: {status.status.fallbackEnabled ? 'On' : 'Off'}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-right">
              <div className="text-2xl font-bold">{status.status.rolloutPercentage}%</div>
              <div className="text-sm text-muted-foreground">Rollout</div>
            </div>
          </div>
        </div>

        {/* Rollout Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Enhanced Generation Rollout</span>
            <span className="text-sm text-muted-foreground">
              {status.status.rolloutPercentage}%
            </span>
          </div>
          <Progress value={status.status.rolloutPercentage} className="h-2" />
        </div>

        {/* Usage Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {status.metrics.enhancedGenerationUsage}
            </div>
            <div className="text-sm text-muted-foreground">Enhanced</div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{status.metrics.fallbackUsage}</div>
            <div className="text-sm text-muted-foreground">Fallback</div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <div>
              <div className="font-medium">{(status.metrics.successRate * 100).toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <div>
              <div className="font-medium">{status.metrics.averageGenerationTime.toFixed(0)}ms</div>
              <div className="text-sm text-muted-foreground">Avg Time</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={() => updateRollout(100)}
            size="sm"
            disabled={status.status.rolloutPercentage === 100}
          >
            100% Rollout
          </Button>
          <Button
            onClick={() => updateRollout(50)}
            size="sm"
            variant="outline"
            disabled={status.status.rolloutPercentage === 50}
          >
            50% Rollout
          </Button>
          <Button
            onClick={() => updateRollout(0)}
            size="sm"
            variant="outline"
            disabled={status.status.rolloutPercentage === 0}
          >
            Disable
          </Button>
          <Button onClick={fetchStatus} size="sm" variant="ghost" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(status.timestamp).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedGenerationStatus;
