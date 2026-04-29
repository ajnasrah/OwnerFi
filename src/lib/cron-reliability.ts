/**
 * Cron Job Reliability Enhancement System
 * 
 * Adds proper error handling, retries, and monitoring to cron jobs
 * Prevents silent failures and provides visibility into cron health
 */

import { logger } from './structured-logger';
import { NextResponse } from 'next/server';

export interface CronJobConfig {
  name: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  alertOnFailure?: boolean;
}

export interface CronJobResult {
  success: boolean;
  duration: number;
  attempts: number;
  error?: Error;
  data?: any;
}

export class CronJobRunner {
  private config: Required<CronJobConfig>;

  constructor(config: CronJobConfig) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 5000, // 5 seconds
      timeoutMs: 300000, // 5 minutes
      alertOnFailure: true,
      ...config
    };
  }

  /**
   * Execute a cron job with reliability features
   */
  async execute<T>(jobFunction: () => Promise<T>): Promise<CronJobResult> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    
    logger.cron(`Starting cron job: ${this.config.name}`, {
      maxRetries: this.config.maxRetries,
      timeoutMs: this.config.timeoutMs
    });

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        // Add timeout wrapper
        const result = await Promise.race([
          jobFunction(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Cron job timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs)
          )
        ]);

        const duration = Date.now() - startTime;
        logger.cron(`Cron job completed successfully: ${this.config.name}`, {
          duration,
          attempts: attempt
        });

        return {
          success: true,
          duration,
          attempts: attempt,
          data: result
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt <= this.config.maxRetries) {
          logger.warn(`Cron job attempt ${attempt} failed, retrying: ${this.config.name}`, {
            error: lastError.message,
            nextAttemptIn: this.config.retryDelayMs,
            attemptsRemaining: this.config.maxRetries - attempt + 1
          });
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
        }
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    logger.error(`Cron job failed after all attempts: ${this.config.name}`, {
      duration,
      attempts: this.config.maxRetries + 1,
      finalError: lastError?.message
    }, lastError);

    // Send alert if configured
    if (this.config.alertOnFailure && lastError) {
      await this.sendFailureAlert(lastError);
    }

    return {
      success: false,
      duration,
      attempts: this.config.maxRetries + 1,
      error: lastError
    };
  }

  /**
   * Create a standardized cron response
   */
  createResponse(result: CronJobResult): NextResponse {
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Cron job ${this.config.name} completed successfully`,
        duration: result.duration,
        attempts: result.attempts,
        data: result.data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: `Cron job ${this.config.name} failed after ${result.attempts} attempts`,
        duration: result.duration,
        attempts: result.attempts,
        details: result.error?.message
      }, { status: 500 });
    }
  }

  /**
   * Send failure alert (can be extended for Slack, email, etc.)
   */
  private async sendFailureAlert(error: Error): Promise<void> {
    try {
      // TODO: Integrate with alerting system (Slack, email, etc.)
      logger.error(`CRON ALERT: ${this.config.name} failed`, {
        component: 'cron-alert',
        cronJob: this.config.name,
        error: error.message,
        stack: error.stack
      });
      
      // Could send to external monitoring service here
      // await sendSlackAlert(this.config.name, error);
      // await sendEmailAlert(this.config.name, error);
    } catch (alertError) {
      logger.error('Failed to send cron failure alert', {
        component: 'cron-alert',
        originalError: error.message,
        alertError: alertError instanceof Error ? alertError.message : String(alertError)
      });
    }
  }
}

/**
 * Utility for creating batch operations with progress tracking
 */
export class CronBatchProcessor<T, R> {
  private config: {
    name: string;
    batchSize: number;
    delayBetweenBatches: number;
  };

  constructor(config: { name: string; batchSize?: number; delayBetweenBatches?: number }) {
    this.config = {
      batchSize: 10,
      delayBetweenBatches: 1000, // 1 second
      ...config
    };
  }

  async process(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>
  ): Promise<{ results: R[]; errors: Error[] }> {
    const results: R[] = [];
    const errors: Error[] = [];
    const totalBatches = Math.ceil(items.length / this.config.batchSize);

    logger.cron(`Starting batch processing: ${this.config.name}`, {
      totalItems: items.length,
      batchSize: this.config.batchSize,
      totalBatches
    });

    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batch = items.slice(i, i + this.config.batchSize);
      const batchNumber = Math.floor(i / this.config.batchSize) + 1;

      try {
        logger.debug(`Processing batch ${batchNumber}/${totalBatches}: ${this.config.name}`, {
          batchSize: batch.length,
          progress: Math.round((batchNumber / totalBatches) * 100)
        });

        const batchResults = await processor(batch);
        results.push(...batchResults);

        // Delay between batches to avoid overwhelming external services
        if (batchNumber < totalBatches && this.config.delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenBatches));
        }

      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Batch ${batchNumber} failed: ${this.config.name}`, {
          error: err.message,
          batchSize: batch.length
        });
        errors.push(err);
      }
    }

    logger.cron(`Batch processing completed: ${this.config.name}`, {
      totalItems: items.length,
      successfulResults: results.length,
      errors: errors.length,
      successRate: Math.round((results.length / items.length) * 100)
    });

    return { results, errors };
  }
}

/**
 * Pre-configured cron runners for common jobs
 */
export const createAgentRefreshRunner = () => 
  new CronJobRunner({
    name: 'agent-refresh',
    maxRetries: 2,
    retryDelayMs: 10000, // 10 seconds
    timeoutMs: 240000, // 4 minutes (under the 240s Vercel limit)
    alertOnFailure: true
  });

export const createPropertyScraperRunner = () =>
  new CronJobRunner({
    name: 'property-scraper',
    maxRetries: 3,
    retryDelayMs: 30000, // 30 seconds
    timeoutMs: 580000, // 9.5 minutes (under the 600s Vercel limit)
    alertOnFailure: true
  });

export const createZillowRefreshRunner = () =>
  new CronJobRunner({
    name: 'zillow-refresh',
    maxRetries: 2,
    retryDelayMs: 15000, // 15 seconds
    timeoutMs: 280000, // 4.5 minutes (under the 300s Vercel limit)
    alertOnFailure: true
  });