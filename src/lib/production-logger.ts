/**
 * Production Logging System
 * Replaces console.log with proper structured logging
 */

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  userId?: string;
  action?: string;
}

class ProductionLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatLog(entry: LogEntry): void {
    const logString = `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
    
    if (this.isDevelopment) {
      // Development: still use console for debugging
      switch (entry.level) {
        case 'error':
          console.error(logString, entry.context);
          break;
        case 'warn':
          console.warn(logString, entry.context);
          break;
        case 'info':
          console.info(logString, entry.context);
          break;
        case 'debug':
          console.log(logString, entry.context);
          break;
      }
    } else {
      // Production: send to external logging service (e.g., LogRocket, DataDog)
      // For now, suppress debug logs and only log important events
      if (entry.level !== 'debug') {
        console.log(JSON.stringify(entry));
      }
    }
  }

  info(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.formatLog({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      context,
      userId
    });
  }

  warn(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.formatLog({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      context,
      userId
    });
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>, userId?: string): void {
    this.formatLog({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      context: { ...context, error: (error as Error)?.message || error },
      userId
    });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    // Only log debug in development
    if (this.isDevelopment) {
      this.formatLog({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        context
      });
    }
  }

  // Business action logging
  userAction(action: string, userId: string, context?: Record<string, unknown>): void {
    this.info(`User action: ${action}`, context, userId);
  }

  apiCall(endpoint: string, method: string, responseTime: number, userId?: string): void {
    this.info(`API ${method} ${endpoint}`, { responseTime: `${responseTime}ms` }, userId);
  }

  securityEvent(event: string, context?: Record<string, unknown>, userId?: string): void {
    this.warn(`Security event: ${event}`, context, userId);
  }
}

// Export singleton instance
export const logger = new ProductionLogger();

// Convenience exports for common patterns
export const logInfo = logger.info.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logError = logger.error.bind(logger);
export const logDebug = logger.debug.bind(logger);
export const logUserAction = logger.userAction.bind(logger);
export const logApiCall = logger.apiCall.bind(logger);
export const logSecurityEvent = logger.securityEvent.bind(logger);