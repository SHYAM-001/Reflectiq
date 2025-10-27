/**
 * Connection Status Component for ReflectIQ
 * Shows network connectivity status and queued requests
 * Following Devvit Web best practices for user feedback
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import EnhancedApiService from '../services/enhanced-api';

interface ConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className,
  showDetails = false,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedRequests, setQueuedRequests] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const apiService = EnhancedApiService.getInstance();

    const updateStatus = () => {
      const status = apiService.getConnectionStatus();
      setIsOnline(status.isOnline);
      setQueuedRequests(status.queuedRequests);
      setLastChecked(new Date());
    };

    // Initial status
    updateStatus();

    // Listen for online/offline events
    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic status check
    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const getStatusIcon = () => {
    if (isOnline) {
      return queuedRequests > 0 ? (
        <Clock className="h-4 w-4 text-yellow-500" />
      ) : (
        <Wifi className="h-4 w-4 text-green-500" />
      );
    }
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (queuedRequests > 0) return `${queuedRequests} queued`;
    return 'Online';
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500';
    if (queuedRequests > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (!showDetails && isOnline && queuedRequests === 0) {
    // Don't show anything when everything is working normally
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg bg-background/80 backdrop-blur-sm border border-border/50',
        className
      )}
    >
      {getStatusIcon()}

      <span className={cn('text-sm font-medium', getStatusColor())}>{getStatusText()}</span>

      {showDetails && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastChecked && <span>Last: {lastChecked.toLocaleTimeString()}</span>}

          {!isOnline && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span>Check connection</span>
            </div>
          )}

          {queuedRequests > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Processing when online</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hook for connection status
 */
export const useConnectionStatus = () => {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    queuedRequests: 0,
  });

  useEffect(() => {
    const apiService = EnhancedApiService.getInstance();

    const updateStatus = () => {
      setStatus(apiService.getConnectionStatus());
    };

    updateStatus();

    const handleOnline = () => updateStatus();
    const handleOffline = () => updateStatus();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(updateStatus, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return status;
};
