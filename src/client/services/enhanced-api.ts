/**
 * Enhanced API Service for ReflectIQ Client
 * Provides robust error handling, retry logic, and offline support
 * Following Devvit Web best practices
 */

import { toast } from 'sonner';
import {
  GetPuzzleResponse,
  StartPuzzleResponse,
  RequestHintResponse,
  SubmitAnswerResponse,
  Difficulty,
  GridPosition,
} from '../types/api';

export interface ApiError {
  type: 'NETWORK_ERROR' | 'SERVER_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT_ERROR' | 'OFFLINE_ERROR';
  message: string;
  status?: number;
  details?: any;
  retryable: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface ApiServiceConfig {
  baseUrl?: string;
  timeout: number;
  retryConfig: RetryConfig;
  enableOfflineDetection: boolean;
}

class EnhancedApiService {
  private static instance: EnhancedApiService;
  private config: ApiServiceConfig;
  private isOnline: boolean = navigator.onLine;
  private offlineQueue: Array<() => Promise<any>> = [];
  private abortController: AbortController | null = null;

  private constructor(config?: Partial<ApiServiceConfig>) {
    this.config = {
      baseUrl: '',
      timeout: 30000, // 30 seconds
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000, // 1 second
        maxDelay: 10000, // 10 seconds
        backoffMultiplier: 2,
      },
      enableOfflineDetection: true,
      ...config,
    };

    this.setupOfflineDetection();
  }

  public static getInstance(config?: Partial<ApiServiceConfig>): EnhancedApiService {
    if (!EnhancedApiService.instance) {
      EnhancedApiService.instance = new EnhancedApiService(config);
    }
    return EnhancedApiService.instance;
  }

  private setupOfflineDetection() {
    if (!this.config.enableOfflineDetection) return;

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.isOnline = true;
    toast.success('Connection restored', {
      description: 'Processing queued requests...',
      duration: 3000,
    });
    this.processOfflineQueue();
  };

  private handleOffline = () => {
    this.isOnline = false;
    toast.error('Connection lost', {
      description: 'Requests will be queued until connection is restored.',
      duration: 5000,
    });
  };

  private async processOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    const queuedRequests = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const request of queuedRequests) {
      try {
        await request();
      } catch (error) {
        console.error('Failed to process queued request:', error);
      }
    }
  }

  private createApiError(error: any, context: string): ApiError {
    if (!navigator.onLine) {
      return {
        type: 'OFFLINE_ERROR',
        message: 'No internet connection available',
        retryable: true,
      };
    }

    if (error.name === 'AbortError') {
      return {
        type: 'TIMEOUT_ERROR',
        message: 'Request timed out',
        retryable: true,
      };
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: 'NETWORK_ERROR',
        message: 'Network connection failed',
        retryable: true,
      };
    }

    if (error.status) {
      const status = error.status;

      if (status >= 400 && status < 500) {
        return {
          type: 'VALIDATION_ERROR',
          message: error.message || 'Invalid request',
          status,
          retryable: status === 429, // Only retry rate limits
        };
      }

      if (status >= 500) {
        return {
          type: 'SERVER_ERROR',
          message: 'Server error occurred',
          status,
          retryable: true,
        };
      }
    }

    return {
      type: 'SERVER_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error,
      retryable: true,
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateRetryDelay(attempt: number): number {
    const { baseDelay, maxDelay, backoffMultiplier } = this.config.retryConfig;
    const delay = baseDelay * Math.pow(backoffMultiplier, attempt);
    return Math.min(delay, maxDelay);
  }

  private async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    context: string
  ): Promise<T> {
    // Check if offline and queue request
    if (!this.isOnline) {
      return new Promise((resolve, reject) => {
        this.offlineQueue.push(async () => {
          try {
            const result = await this.makeRequest<T>(url, options, context);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });

        throw this.createApiError(new Error('Offline'), context);
      });
    }

    const { maxRetries } = this.config.retryConfig;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create abort controller for timeout
        this.abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          this.abortController?.abort();
        }, this.config.timeout);

        const response = await fetch(`${this.config.baseUrl}${url}`, {
          ...options,
          signal: this.abortController.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${response.status}`);
          (error as any).status = response.status;
          throw error;
        }

        const data = await response.json();

        // Reset retry count on success
        if (attempt > 0) {
          toast.success('Request succeeded after retry', {
            duration: 2000,
          });
        }

        return data;
      } catch (error) {
        lastError = error;
        const apiError = this.createApiError(error, context);

        // Don't retry if not retryable or max retries reached
        if (!apiError.retryable || attempt === maxRetries) {
          throw apiError;
        }

        // Calculate delay and show retry notification
        const delay = this.calculateRetryDelay(attempt);

        if (attempt < maxRetries) {
          toast.error(`Request failed, retrying in ${delay / 1000}s...`, {
            description: `Attempt ${attempt + 1}/${maxRetries + 1}`,
            duration: delay,
          });

          await this.delay(delay);
        }
      }
    }

    throw this.createApiError(lastError, context);
  }

  /**
   * Get current puzzle by difficulty
   */
  async getCurrentPuzzle(difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      return await this.makeRequest<GetPuzzleResponse>(
        `/api/puzzle/current?difficulty=${difficulty}`,
        { method: 'GET' },
        'getCurrentPuzzle'
      );
    } catch (error) {
      console.error('Error fetching puzzle:', error);

      if (error.type === 'OFFLINE_ERROR') {
        toast.error('Cannot load puzzle while offline', {
          description: 'Please check your internet connection.',
          duration: 5000,
        });
      }

      throw error;
    }
  }

  /**
   * Start a new puzzle session
   */
  async startPuzzleSession(puzzleId: string, userId: string): Promise<StartPuzzleResponse> {
    try {
      return await this.makeRequest<StartPuzzleResponse>(
        '/api/puzzle/start',
        {
          method: 'POST',
          body: JSON.stringify({ puzzleId, userId }),
        },
        'startPuzzleSession'
      );
    } catch (error) {
      console.error('Error starting puzzle session:', error);

      if (error.type === 'VALIDATION_ERROR') {
        toast.error('Invalid session data', {
          description: 'Please try starting a new game.',
          duration: 4000,
        });
      }

      throw error;
    }
  }

  /**
   * Request a hint for the current session
   */
  async requestHint(sessionId: string, hintNumber: number): Promise<RequestHintResponse> {
    try {
      return await this.makeRequest<RequestHintResponse>(
        '/api/puzzle/hint',
        {
          method: 'POST',
          body: JSON.stringify({ sessionId, hintNumber }),
        },
        'requestHint'
      );
    } catch (error) {
      console.error('Error requesting hint:', error);

      if (error.type === 'VALIDATION_ERROR') {
        toast.error('Cannot get hint', {
          description: 'You may have reached the maximum number of hints.',
          duration: 4000,
        });
      }

      throw error;
    }
  }

  /**
   * Submit puzzle answer
   */
  async submitAnswer(
    sessionId: string,
    answer: GridPosition,
    timeTaken: number
  ): Promise<SubmitAnswerResponse> {
    try {
      return await this.makeRequest<SubmitAnswerResponse>(
        '/api/puzzle/submit',
        {
          method: 'POST',
          body: JSON.stringify({ sessionId, answer, timeTaken }),
        },
        'submitAnswer'
      );
    } catch (error) {
      console.error('Error submitting answer:', error);

      if (error.type === 'OFFLINE_ERROR') {
        // Queue submission for when online
        toast.info('Answer queued for submission', {
          description: 'Will be submitted when connection is restored.',
          duration: 5000,
        });
      }

      throw error;
    }
  }

  /**
   * Get daily leaderboard
   */
  async getDailyLeaderboard(date?: string, limit: number = 10) {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (limit) params.append('limit', limit.toString());

      return await this.makeRequest(
        `/api/leaderboard/daily?${params.toString()}`,
        { method: 'GET' },
        'getDailyLeaderboard'
      );
    } catch (error) {
      console.error('Error fetching leaderboard:', error);

      if (error.type === 'OFFLINE_ERROR') {
        toast.info('Leaderboard unavailable offline', {
          description: 'Will load when connection is restored.',
          duration: 3000,
        });
      }

      throw error;
    }
  }

  /**
   * Initialize app and get user context
   */
  async initializeApp() {
    try {
      return await this.makeRequest('/api/init', { method: 'GET' }, 'initializeApp');
    } catch (error) {
      console.error('Error initializing app:', error);

      if (error.type === 'OFFLINE_ERROR') {
        // Return minimal offline state
        return {
          success: false,
          offline: true,
          message: 'App initialized in offline mode',
        };
      }

      throw error;
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck() {
    try {
      return await this.makeRequest('/api/health', { method: 'GET' }, 'healthCheck');
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelRequests() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isOnline: this.isOnline,
      queuedRequests: this.offlineQueue.length,
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.cancelRequests();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

export default EnhancedApiService;
