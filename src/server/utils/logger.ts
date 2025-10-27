/**
 * Logging Utility for ReflectIQ
 * Provides structured logging following Devvit best practices
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;

  private constructor() {
    // Set log level based on environment
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLogLevel) {
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'INFO':
        this.logLevel = LogLevel.INFO;
        break;
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
      default:
        this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private formatLogEntry(entry: LogEntry): string {
    const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const levelName = levelNames[entry.level];

    let logMessage = `[${entry.timestamp}] ${levelName}: ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      logMessage += ` | Context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      logMessage += ` | Error: ${entry.error.message}`;
      if (entry.error.stack) {
        logMessage += ` | Stack: ${entry.error.stack}`;
      }
    }

    return logMessage;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      error,
    };

    const formattedMessage = this.formatLogEntry(entry);

    // Use appropriate console method based on log level
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
    }
  }

  public error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Convenience methods for common logging scenarios
  public apiRequest(method: string, path: string, userId?: string, duration?: number): void {
    this.info(`API Request: ${method} ${path}`, {
      method,
      path,
      userId,
      duration,
    });
  }

  public apiError(method: string, path: string, error: Error, userId?: string): void {
    this.error(
      `API Error: ${method} ${path}`,
      {
        method,
        path,
        userId,
      },
      error
    );
  }

  public redisOperation(operation: string, key: string, success: boolean, duration?: number): void {
    const level = success ? LogLevel.DEBUG : LogLevel.WARN;
    const message = `Redis ${operation}: ${key} - ${success ? 'SUCCESS' : 'FAILED'}`;

    this.log(level, message, {
      operation,
      key,
      success,
      duration,
    });
  }

  public puzzleGeneration(
    difficulty: string,
    success: boolean,
    duration?: number,
    error?: Error
  ): void {
    if (success) {
      this.info(`Puzzle generated: ${difficulty}`, {
        difficulty,
        duration,
      });
    } else {
      this.error(
        `Puzzle generation failed: ${difficulty}`,
        {
          difficulty,
          duration,
        },
        error
      );
    }
  }

  public userAction(action: string, userId: string, context?: Record<string, any>): void {
    this.info(`User action: ${action}`, {
      action,
      userId,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logError = (message: string, context?: Record<string, any>, error?: Error) =>
  logger.error(message, context, error);

export const logWarn = (message: string, context?: Record<string, any>) =>
  logger.warn(message, context);

export const logInfo = (message: string, context?: Record<string, any>) =>
  logger.info(message, context);

export const logDebug = (message: string, context?: Record<string, any>) =>
  logger.debug(message, context);
