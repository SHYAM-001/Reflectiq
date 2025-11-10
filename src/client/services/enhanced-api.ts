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
   * Get current puzzle by difficulty using enhanced generation
   */
  async getCurrentPuzzle(difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      // First try to get existing puzzle for today
      const existingPuzzleResponse = await this.makeRequest<GetPuzzleResponse>(
        `/api/puzzle/current?difficulty=${difficulty}`,
        { method: 'GET' },
        'getCurrentPuzzle'
      );

      // If puzzle exists and is valid, return it
      if (existingPuzzleResponse.success && existingPuzzleResponse.data) {
        return existingPuzzleResponse;
      }

      // If no puzzle exists or failed, generate using enhanced system
      console.log(`No existing puzzle found for ${difficulty}, generating with enhanced system...`);

      const enhancedPuzzle = await this.generateEnhancedPuzzle(difficulty);

      return {
        success: true,
        data: enhancedPuzzle,
        timestamp: new Date(),
      };
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
   * Get puzzle by date (for legacy posts)
   * Requirement 7.2: Implement fallback to date-based daily puzzle retrieval
   * Requirement 7.4: Ensure full functionality for pre-migration posts
   */
  async getPuzzleByDate(date: string, difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      // Format request parameters
      const params = new URLSearchParams({
        date,
        difficulty,
      });

      console.log(`🔄 Requesting legacy puzzle by date: ${date}, difficulty: ${difficulty}`);

      // Use standard timeout for legacy puzzle retrieval
      const LEGACY_PUZZLE_TIMEOUT = 5000; // 5 seconds
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, LEGACY_PUZZLE_TIMEOUT);

      try {
        const response = await fetch(
          `${this.config.baseUrl}/api/puzzle/by-date?${params.toString()}`,
          {
            method: 'GET',
            signal: abortController.signal,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${response.status}`);
          (error as any).status = response.status;
          throw error;
        }

        const data = await response.json();

        // Check if response is successful
        if (!data.success || !data.data) {
          throw new Error('Failed to retrieve legacy puzzle by date');
        }

        // Log metadata about puzzle source
        if (data.metadata) {
          console.log(
            `✓ Legacy puzzle retrieved: ${date} (source: ${data.metadata.source}, time: ${data.metadata.retrievalTime}ms)`
          );
        }

        return {
          success: true,
          data: data.data,
          timestamp: new Date(),
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error(`Error fetching legacy puzzle by date (${date}):`, error);

      // Create appropriate error type
      const apiError = this.createApiError(error, 'getPuzzleByDate');

      // Show user-friendly error messages
      if (apiError.type === 'TIMEOUT_ERROR') {
        toast.error('Legacy puzzle loading timed out', {
          description: 'Please try again.',
          duration: 4000,
        });
      } else {
        toast.error('Failed to load legacy puzzle', {
          description: 'Please try again or contact support.',
          duration: 4000,
        });
      }

      throw apiError;
    }
  }

  /**
   * Get puzzle by unique ID (for post-specific puzzles)
   * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
   */
  async getPuzzleById(puzzleId: string, difficulty: Difficulty): Promise<GetPuzzleResponse> {
    try {
      // Requirement 4.1: Implement proper request formatting
      const params = new URLSearchParams({
        puzzleId,
        difficulty,
      });

      console.log(`Requesting puzzle by ID: ${puzzleId}, difficulty: ${difficulty}`);

      // Requirement 4.3: Add timeout protection (5 seconds)
      const PUZZLE_BY_ID_TIMEOUT = 5000; // 5 seconds as per requirement
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, PUZZLE_BY_ID_TIMEOUT);

      try {
        // Requirement 4.2: Implement error handling
        // Requirement 4.4: Include retry logic for transient failures
        const response = await fetch(
          `${this.config.baseUrl}/api/puzzle/by-id?${params.toString()}`,
          {
            method: 'GET',
            signal: abortController.signal,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${response.status}`);
          (error as any).status = response.status;
          throw error;
        }

        const data = await response.json();

        // Check if response is successful
        if (!data.success || !data.data) {
          throw new Error('Failed to retrieve puzzle by ID');
        }

        // Log metadata about puzzle source
        if (data.metadata) {
          console.log(
            `✓ Puzzle retrieved: ${puzzleId} (source: ${data.metadata.source}, time: ${data.metadata.retrievalTime}ms)`
          );
        }

        return {
          success: true,
          data: data.data,
          timestamp: new Date(),
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error(`Error fetching puzzle by ID (${puzzleId}):`, error);

      // Create appropriate error type
      const apiError = this.createApiError(error, 'getPuzzleById');

      // Requirement 4.4: Include retry logic for transient failures
      if (apiError.retryable && apiError.type !== 'TIMEOUT_ERROR') {
        // Retry once for transient failures (except timeouts)
        try {
          console.log(`Retrying puzzle fetch for ${puzzleId}...`);
          await this.delay(1000); // 1 second delay before retry

          const params = new URLSearchParams({
            puzzleId,
            difficulty,
          });

          const retryResponse = await fetch(
            `${this.config.baseUrl}/api/puzzle/by-id?${params.toString()}`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          );

          if (retryResponse.ok) {
            const data = await retryResponse.json();
            if (data.success && data.data) {
              console.log(`✓ Puzzle retrieved on retry: ${puzzleId}`);
              return {
                success: true,
                data: data.data,
                timestamp: new Date(),
              };
            }
          }
        } catch (retryError) {
          console.error(`Retry failed for puzzle ${puzzleId}:`, retryError);
        }
      }

      // Show user-friendly error messages
      if (apiError.type === 'OFFLINE_ERROR') {
        toast.error('Cannot load puzzle while offline', {
          description: 'Please check your internet connection.',
          duration: 5000,
        });
      } else if (apiError.type === 'TIMEOUT_ERROR') {
        toast.error('Puzzle loading timed out', {
          description: 'Please try again.',
          duration: 4000,
        });
      } else if (apiError.type === 'VALIDATION_ERROR') {
        toast.error('Invalid puzzle request', {
          description: 'The puzzle ID or difficulty may be incorrect.',
          duration: 4000,
        });
      } else {
        toast.error('Failed to load puzzle', {
          description: 'Please try again or contact support.',
          duration: 4000,
        });
      }

      throw apiError;
    }
  }

  /**
   * Generate a new puzzle using enhanced guaranteed generation
   */
  async generateEnhancedPuzzle(
    difficulty: Difficulty,
    options?: {
      forceRegeneration?: boolean;
      maxAttempts?: number;
      targetComplexity?: number;
    }
  ): Promise<any> {
    try {
      const requestBody = {
        difficulty,
        forceRegeneration: options?.forceRegeneration || false,
        maxAttempts: options?.maxAttempts || 10,
        targetComplexity: options?.targetComplexity,
      };

      return await this.makeRequest(
        '/api/puzzle/generate',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        },
        'generateEnhancedPuzzle'
      );
    } catch (error) {
      console.error('Enhanced puzzle generation failed:', error);

      // Fallback to legacy endpoint if enhanced generation fails
      console.log('Falling back to legacy puzzle generation...');

      try {
        return await this.makeRequest(
          `/api/puzzle/current?difficulty=${difficulty}`,
          { method: 'GET' },
          'fallbackGetCurrentPuzzle'
        );
      } catch (fallbackError) {
        console.error('Fallback puzzle generation also failed:', fallbackError);
        throw error; // Throw original error
      }
    }
  }

  /**
   * Validate an existing puzzle
   */
  async validatePuzzle(puzzleId: string): Promise<any> {
    try {
      return await this.makeRequest(
        `/api/puzzle/validate?puzzleId=${encodeURIComponent(puzzleId)}`,
        { method: 'GET' },
        'validatePuzzle'
      );
    } catch (error) {
      console.error('Error validating puzzle:', error);
      throw error;
    }
  }

  /**
   * Regenerate a puzzle with new parameters
   */
  async regeneratePuzzle(
    puzzleId: string,
    reason: string,
    options?: {
      difficulty?: Difficulty;
      preserveSettings?: boolean;
    }
  ): Promise<any> {
    try {
      const requestBody = {
        puzzleId,
        reason,
        difficulty: options?.difficulty,
        preserveSettings: options?.preserveSettings || false,
      };

      return await this.makeRequest(
        '/api/puzzle/regenerate',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        },
        'regeneratePuzzle'
      );
    } catch (error) {
      console.error('Error regenerating puzzle:', error);
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
   * Submit puzzle answer with enhanced error handling for comment posting failures
   * Requirements: 8.3, 10.3, 11.4
   */
  async submitAnswer(
    sessionId: string,
    answer: GridPosition,
    timeTaken: number
  ): Promise<SubmitAnswerResponse> {
    try {
      const response = await this.makeRequest<SubmitAnswerResponse>(
        '/api/puzzle/submit',
        {
          method: 'POST',
          body: JSON.stringify({ sessionId, answer, timeTaken }),
        },
        'submitAnswer'
      );

      // Log comment posting status for monitoring
      if (response.success && response.data?.commentPosting) {
        const { commentPosting } = response.data;
        if (!commentPosting.success) {
          console.warn(`Comment posting failed for ${commentPosting.type}:`, commentPosting.error);
        } else {
          console.log(`Comment posting succeeded for ${commentPosting.type}`);
        }
      }

      return response;
    } catch (error) {
      console.error('Error submitting answer:', error);

      if (error.type === 'OFFLINE_ERROR') {
        // Enhanced offline handling with comment posting awareness
        toast.info('Answer queued for submission', {
          description:
            'Will be submitted when connection is restored. Community sharing may be delayed.',
          duration: 5000,
        });
      } else if (error.type === 'NETWORK_ERROR') {
        // Network issues might affect comment posting even if submission succeeds
        toast.warning('Network issues detected', {
          description: 'Your answer was processed, but community features may be limited.',
          duration: 4000,
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
