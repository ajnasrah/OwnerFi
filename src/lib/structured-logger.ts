/**
 * Structured Logging System
 * 
 * Replaces scattered console.log statements with structured, filterable logging
 * Reduces performance overhead and improves debuggability
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1, 
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogContext {
  component?: string;
  function?: string;
  userId?: string;
  requestId?: string;
  cost?: number;
  duration?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class StructuredLogger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.level = process.env.LOG_LEVEL 
      ? parseInt(process.env.LOG_LEVEL) 
      : (process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO);
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as any : undefined
    };
  }

  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Development: Pretty format for console
      const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
      const levelName = levelNames[entry.level];
      const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      const errorStr = entry.error ? `\n${entry.error.stack}` : '';
      
      console[entry.level <= LogLevel.ERROR ? 'error' : entry.level === LogLevel.WARN ? 'warn' : 'log'](
        `[${entry.timestamp}] ${levelName}: ${entry.message}${contextStr}${errorStr}`
      );
    } else {
      // Production: JSON structured logs for log aggregation
      console[entry.level <= LogLevel.ERROR ? 'error' : entry.level === LogLevel.WARN ? 'warn' : 'log'](
        JSON.stringify(entry)
      );
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatEntry(LogLevel.ERROR, message, context, error));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatEntry(LogLevel.WARN, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatEntry(LogLevel.INFO, message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatEntry(LogLevel.DEBUG, message, context));
    }
  }

  trace(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      this.output(this.formatEntry(LogLevel.TRACE, message, context));
    }
  }

  // High-level semantic logging methods
  cost(message: string, amount: number, context?: LogContext): void {
    this.info(message, { ...context, cost: amount, component: context?.component || 'cost-tracker' });
  }

  performance(message: string, duration: number, context?: LogContext): void {
    this.debug(message, { ...context, duration, component: context?.component || 'performance' });
  }

  api(message: string, context?: LogContext): void {
    this.info(message, { ...context, component: context?.component || 'api' });
  }

  database(message: string, context?: LogContext): void {
    this.debug(message, { ...context, component: context?.component || 'database' });
  }

  auth(message: string, context?: LogContext): void {
    this.info(message, { ...context, component: context?.component || 'auth' });
  }

  cron(message: string, context?: LogContext): void {
    this.info(message, { ...context, component: context?.component || 'cron' });
  }
}

// Export singleton instance
export const logger = new StructuredLogger();

// Compatibility helpers for existing code migration
export const logInfo = (message: string, context?: Record<string, any>) => logger.info(message, context);
export const logError = (message: string, error?: Error, context?: Record<string, any>) => logger.error(message, context, error);
export const logDebug = (message: string, context?: Record<string, any>) => logger.debug(message, context);
export const logWarn = (message: string, context?: Record<string, any>) => logger.warn(message, context);