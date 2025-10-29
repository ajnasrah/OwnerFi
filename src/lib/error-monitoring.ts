/**
 * Error Monitoring & Alerting
 * Centralized error tracking and notifications
 */

import { monitoring } from './env-config';

/**
 * Alert workflow failure via Slack
 */
export async function alertWorkflowFailure(
  brand: string,
  workflowId: string,
  title: string,
  reason: string
): Promise<void> {
  if (!monitoring.slackWebhook) {
    console.warn('⚠️  Slack webhook not configured, skipping alert');
    return;
  }

  try {
    const message = {
      text: `🚨 Workflow Failed: ${brand}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 Workflow Failed: ${brand.toUpperCase()}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Workflow ID:*\n${workflowId}`,
            },
            {
              type: 'mrkdwn',
              text: `*Title:*\n${title}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Reason:*\n${reason}`,
          },
        },
      ],
    };

    const response = await fetch(monitoring.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error('Failed to send Slack alert:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error sending workflow failure alert:', error);
  }
}

/**
 * Log error to monitoring service (Sentry, etc.)
 */
export function logError(
  context: string,
  error: Error | unknown,
  metadata?: Record<string, any>
): void {
  console.error(`❌ [${context}]`, error, metadata);

  // TODO: Send to Sentry if configured
  if (monitoring.sentryDsn) {
    // Sentry.captureException(error, { extra: metadata });
  }
}

/**
 * Log info message
 */
export function logInfo(
  context: string,
  message: string,
  metadata?: Record<string, any>
): void {
  console.log(`ℹ️  [${context}] ${message}`, metadata || '');
}

export default {
  alertWorkflowFailure,
  logError,
  logInfo,
};
