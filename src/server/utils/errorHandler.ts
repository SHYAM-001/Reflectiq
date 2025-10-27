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
 * Redis operation wrapper with retry logic and fallback
 */
export async function withRedisRetry<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Redis operation failed (attempt ${attempt}/${maxRetries}):`, error);

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  // If all retries failed, try fallback
  if (fallback) {
    try {
      console.log('Attempting fallback operation after Redis failures');
      return await fallback();
    } catch (fallbackError) {
      console.error('Fallback operation also failed:', fallbackError);
    }
  }

  // If everything failed, throw the last Redis error
  throw new Error(`Redis operation failed after ${maxRetries} attempts: ${lastError.message}`);
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
 * Clean up old rate limit entries
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute
