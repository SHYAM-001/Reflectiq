/**
 * Centralized Error Handling Utilities for ReflectIQ
 * Provides consistent error responses and recovery mechanisms following Devvit patterns
 */

import { Response } from 'express';

// Error types specific to ReflectIQ
export type ReflectIQErrorType =
  | 'PUZZLE_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'INVALID_ANSWER'
  | 'REDIS_ERROR'
  | 'GENERATION_FAILED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ErrorResponse {
  success: false;
  error: {
    type: ReflectIQErrorType;
    message: string;
    details?: string;
    code?: string;
  };
  timestamp: Date;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: Date;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * HTTP Status Code mapping for different error types
 */
const ERROR_STATUS_CODES: Record<ReflectIQErrorType, number> = {
  PUZZLE_NOT_FOUND: 404,
  SESSION_EXPIRED: 401,
  INVALID_ANSWER: 400,
  REDIS_ERROR: 503,
  GENERATION_FAILED: 500,
  UNAUTHORIZED: 403,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
};

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<ReflectIQErrorType, string> = {
  PUZZLE_NOT_FOUND: 'Puzzle not found or not available',
  SESSION_EXPIRED: 'Your game session has expired. Please start a new game',
  INVALID_ANSWER: 'Invalid answer format or data provided',
  REDIS_ERROR: 'Database temporarily unavailable. Please try again',
  GENERATION_FAILED: 'Failed to generate puzzle. Please try again later',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  RATE_LIMITED: 'Too many requests. Please wait before trying again',
  VALIDATION_ERROR: 'Invalid data provided',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again',
};

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  type: ReflectIQErrorType,
  details?: string,
  customMessage?: string
): ErrorResponse {
  return {
    success: false,
    error: {
      type,
      message: customMessage || ERROR_MESSAGES[type],
      details,
      code: type,
    },
    timestamp: new Date(),
  };
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
  };
}

/**
 * Send error response with appropriate HTTP status code
 */
export function sendErrorResponse(
  res: Response,
  type: ReflectIQErrorType,
  details?: string,
  customMessage?: string
): void {
  const statusCode = ERROR_STATUS_CODES[type];
  const errorResponse = createErrorResponse(type, details, customMessage);

  console.error(`API Error [${statusCode}]:`, errorResponse.error);
  res.status(statusCode).json(errorResponse);
}

/**
 * Send success response
 */
export function sendSuccessResponse<T>(res: Response, data: T): void {
  const successResponse = createSuccessResponse(data);
  res.status(200).json(successResponse);
}

/**
 * Wrap async route handlers with error handling
 */
export function asyncHandler(fn: (req: any, res: Response, next?: any) => Promise<void>) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      console.error('Unhandled route error:', error);

      // Determine error type based on error characteristics
      let errorType: ReflectIQErrorType = 'INTERNAL_ERROR';
      let details = error.message;

      if (error.message?.includes('Redis') || error.message?.includes('redis')) {
        errorType = 'REDIS_ERROR';
      } else if (error.message?.includes('validation') || error.message?.includes('invalid')) {
        errorType = 'VALIDATION_ERROR';
      } else if (error.message?.includes('not found')) {
        errorType = 'PUZZLE_NOT_FOUND';
      } else if (error.message?.includes('expired')) {
        errorType = 'SESSION_EXPIRED';
      }

      sendErrorResponse(res, errorType, details);
    });
  };
}

/**
 * Enhanced Redis operation wrapper with retry logic, circuit breaker, and fallback
 */
export async function withRedisRetry<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'Redis operation'
): Promise<T> {
  let lastError: Error;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      // Log successful recovery if this wasn't the first attempt
      if (attempt > 1) {
        console.log(
          `${operationName} succeeded on attempt ${attempt} after ${Date.now() - startTime}ms`
        );
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      const isRedisError =
        error.message?.includes('Redis') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('Connection');

      console.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}):`, {
        error: error.message,
        isRedisError,
        duration: Date.now() - startTime,
      });

      // For Redis connection errors, wait longer between retries
      if (attempt < maxRetries) {
        const baseDelay = isRedisError ? 500 : 100;
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If all retries failed, try fallback
  if (fallback) {
    try {
      console.log(`Attempting fallback for ${operationName} after ${maxRetries} failed attempts`);
      const fallbackResult = await fallback();
      console.log(`Fallback succeeded for ${operationName}`);
      return fallbackResult;
    } catch (fallbackError) {
      console.error(`Fallback also failed for ${operationName}:`, fallbackError);
    }
  }

  // If everything failed, throw a descriptive error
  const totalDuration = Date.now() - startTime;
  throw new Error(
    `${operationName} failed after ${maxRetries} attempts over ${totalDuration}ms. Last error: ${lastError.message}`
  );
}

/**
 * Circuit breaker for Redis operations to prevent cascading failures
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 30000 // 30 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`Circuit breaker for ${operationName} moving to HALF_OPEN state`);
      } else {
        throw new Error(
          `Circuit breaker is OPEN for ${operationName}. Service temporarily unavailable.`
        );
      }
    }

    try {
      const result = await operation();

      // Reset on success
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        console.log(`Circuit breaker for ${operationName} reset to CLOSED state`);
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'OPEN';
        console.error(
          `Circuit breaker for ${operationName} opened after ${this.failures} failures`
        );
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Global circuit breaker instances
const redisCircuitBreaker = new CircuitBreaker(5, 30000);
const puzzleGenerationCircuitBreaker = new CircuitBreaker(3, 60000);

/**
 * Enhanced Redis operation with circuit breaker protection
 */
export async function withRedisCircuitBreaker<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>,
  operationName: string = 'Redis operation'
): Promise<T> {
  return redisCircuitBreaker.execute(async () => {
    return withRedisRetry(operation, fallback, 3, operationName);
  }, operationName);
}

/**
 * Puzzle generation with circuit breaker and backup templates
 */
export async function withPuzzleGenerationFallback<T>(
  operation: () => Promise<T>,
  backupOperation: () => Promise<T>,
  operationName: string = 'Puzzle generation'
): Promise<T> {
  return puzzleGenerationCircuitBreaker.execute(async () => {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Primary ${operationName} failed, attempting backup:`, error.message);
      return await backupOperation();
    }
  }, operationName);
}

/**
 * Validate request data with proper error responses
 */
export function validateRequired(
  data: any,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missingFields.push(field);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Rate limiting helper (simple in-memory implementation)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = identifier;

  let record = rateLimitStore.get(key);

  // Reset if window has passed
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
    rateLimitStore.set(key, record);
  }

  record.count++;

  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime,
  };
}

/**
 * Error monitoring and metrics collection
 */
interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ReflectIQErrorType, number>;
  recentErrors: Array<{
    type: ReflectIQErrorType;
    message: string;
    timestamp: Date;
    endpoint?: string;
  }>;
  redisFailures: number;
  circuitBreakerTrips: number;
}

class ErrorMonitor {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {} as Record<ReflectIQErrorType, number>,
    recentErrors: [],
    redisFailures: 0,
    circuitBreakerTrips: 0,
  };

  recordError(type: ReflectIQErrorType, message: string, endpoint?: string) {
    this.metrics.totalErrors++;
    this.metrics.errorsByType[type] = (this.metrics.errorsByType[type] || 0) + 1;

    // Keep only last 100 errors
    this.metrics.recentErrors.unshift({
      type,
      message,
      timestamp: new Date(),
      endpoint,
    });

    if (this.metrics.recentErrors.length > 100) {
      this.metrics.recentErrors = this.metrics.recentErrors.slice(0, 100);
    }

    // Special tracking for Redis failures
    if (type === 'REDIS_ERROR') {
      this.metrics.redisFailures++;
    }
  }

  recordCircuitBreakerTrip() {
    this.metrics.circuitBreakerTrips++;
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  getHealthStatus() {
    const recentErrorCount = this.metrics.recentErrors.filter(
      (error) => Date.now() - error.timestamp.getTime() < 300000 // Last 5 minutes
    ).length;

    const redisCircuitState = redisCircuitBreaker.getState();
    const puzzleCircuitState = puzzleGenerationCircuitBreaker.getState();

    return {
      status: recentErrorCount > 10 || redisCircuitState.state === 'OPEN' ? 'degraded' : 'healthy',
      recentErrorCount,
      circuitBreakers: {
        redis: redisCircuitState,
        puzzleGeneration: puzzleCircuitState,
      },
      metrics: this.getMetrics(),
    };
  }

  reset() {
    this.metrics = {
      totalErrors: 0,
      errorsByType: {} as Record<ReflectIQErrorType, number>,
      recentErrors: [],
      redisFailures: 0,
      circuitBreakerTrips: 0,
    };
  }
}

export const errorMonitor = new ErrorMonitor();

/**
 * Enhanced error response with monitoring
 */
export function sendErrorResponseWithMonitoring(
  res: Response,
  type: ReflectIQErrorType,
  details?: string,
  customMessage?: string,
  endpoint?: string
): void {
  const statusCode = ERROR_STATUS_CODES[type];
  const errorResponse = createErrorResponse(type, details, customMessage);

  // Record error for monitoring
  errorMonitor.recordError(type, errorResponse.error.message, endpoint);

  console.error(`API Error [${statusCode}] at ${endpoint || 'unknown'}:`, errorResponse.error);
  res.status(statusCode).json(errorResponse);
}

/**
 * Enhanced async handler with better error classification and monitoring
 */
export function enhancedAsyncHandler(fn: (req: any, res: Response, next?: any) => Promise<void>) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const endpoint = `${req.method} ${req.path}`;
      console.error(`Unhandled route error at ${endpoint}:`, error);

      // Enhanced error type detection
      let errorType: ReflectIQErrorType = 'INTERNAL_ERROR';
      let details = error.message;

      // Redis-related errors
      if (
        error.message?.includes('Redis') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('Connection')
      ) {
        errorType = 'REDIS_ERROR';
      }
      // Validation errors
      else if (
        error.message?.includes('validation') ||
        error.message?.includes('invalid') ||
        error.message?.includes('required')
      ) {
        errorType = 'VALIDATION_ERROR';
      }
      // Not found errors
      else if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        errorType = 'PUZZLE_NOT_FOUND';
      }
      // Session/auth errors
      else if (error.message?.includes('expired') || error.message?.includes('unauthorized')) {
        errorType = 'SESSION_EXPIRED';
      }
      // Rate limiting
      else if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        errorType = 'RATE_LIMITED';
      }
      // Generation failures
      else if (error.message?.includes('generation') || error.message?.includes('generate')) {
        errorType = 'GENERATION_FAILED';
      }

      sendErrorResponseWithMonitoring(res, errorType, details, undefined, endpoint);
    });
  };
}

/**
 * Clean up old rate limit entries and error monitoring
 */
setInterval(() => {
  const now = Date.now();

  // Clean up rate limiting
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }

  // Clean up old error records (keep only last 24 hours)
  const metrics = errorMonitor.getMetrics();
  const cutoffTime = now - 24 * 60 * 60 * 1000;
  const filteredErrors = metrics.recentErrors.filter(
    (error) => error.timestamp.getTime() > cutoffTime
  );

  if (filteredErrors.length !== metrics.recentErrors.length) {
    console.log(
      `Cleaned up ${metrics.recentErrors.length - filteredErrors.length} old error records`
    );
  }
}, 60000); // Clean up every minute
