// Error Monitoring and Alerting
// Send alerts when critical workflows fail

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export interface ErrorAlert {
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  context?: {
    brand?: 'carz' | 'ownerfi' | 'podcast';
    workflowId?: string;
    articleTitle?: string;
    error?: string;
    stack?: string;
  };
}

/**
 * Send error alert to monitoring channels
 */
export async function sendErrorAlert(alert: ErrorAlert): Promise<void> {
  const alerts: Promise<void>[] = [];

  if (SLACK_WEBHOOK_URL) {
    alerts.push(sendSlackAlert(alert));
  }

  if (DISCORD_WEBHOOK_URL) {
    alerts.push(sendDiscordAlert(alert));
  }

  if (alerts.length === 0) {
    console.warn('⚠️  No monitoring webhooks configured - alert not sent');
    return;
  }

  try {
    await Promise.all(alerts);
    console.log(`✅ Alert sent: ${alert.title}`);
  } catch (error) {
    console.error('❌ Failed to send alert:', error);
  }
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(alert: ErrorAlert): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  const color = alert.severity === 'critical' ? '#FF0000'
               : alert.severity === 'warning' ? '#FFA500'
               : '#0099FF';

  const emoji = alert.severity === 'critical' ? '🚨'
                : alert.severity === 'warning' ? '⚠️'
                : 'ℹ️';

  const fields = [];
  if (alert.context?.brand) {
    fields.push({
      title: 'Brand',
      value: alert.context.brand.toUpperCase(),
      short: true
    });
  }
  if (alert.context?.workflowId) {
    fields.push({
      title: 'Workflow ID',
      value: alert.context.workflowId,
      short: true
    });
  }
  if (alert.context?.articleTitle) {
    fields.push({
      title: 'Article',
      value: alert.context.articleTitle.substring(0, 100),
      short: false
    });
  }
  if (alert.context?.error) {
    fields.push({
      title: 'Error',
      value: `\`\`\`${alert.context.error.substring(0, 500)}\`\`\``,
      short: false
    });
  }

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'OwnerFi Bot',
      icon_emoji: emoji,
      attachments: [{
        color,
        title: `${emoji} ${alert.title}`,
        text: alert.message,
        fields,
        footer: 'OwnerFi Social Media Automation',
        ts: Math.floor(Date.now() / 1000)
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status}`);
  }
}

/**
 * Send alert to Discord
 */
async function sendDiscordAlert(alert: ErrorAlert): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return;

  const color = alert.severity === 'critical' ? 0xFF0000
                : alert.severity === 'warning' ? 0xFFA500
                : 0x0099FF;

  const fields = [];
  if (alert.context?.brand) {
    fields.push({
      name: 'Brand',
      value: alert.context.brand.toUpperCase(),
      inline: true
    });
  }
  if (alert.context?.workflowId) {
    fields.push({
      name: 'Workflow ID',
      value: alert.context.workflowId,
      inline: true
    });
  }
  if (alert.context?.articleTitle) {
    fields.push({
      name: 'Article',
      value: alert.context.articleTitle.substring(0, 100),
      inline: false
    });
  }
  if (alert.context?.error) {
    fields.push({
      name: 'Error',
      value: `\`\`\`${alert.context.error.substring(0, 500)}\`\`\``,
      inline: false
    });
  }

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'OwnerFi Bot',
      embeds: [{
        title: alert.title,
        description: alert.message,
        color,
        fields,
        footer: { text: 'OwnerFi Social Media Automation' },
        timestamp: new Date().toISOString()
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status}`);
  }
}

/**
 * Alert on workflow failure
 */
export async function alertWorkflowFailure(
  brand: 'carz' | 'ownerfi' | 'podcast',
  workflowId: string,
  articleTitle: string,
  error: string
): Promise<void> {
  await sendErrorAlert({
    title: `Workflow Failed: ${brand.toUpperCase()}`,
    message: `Video generation workflow failed after multiple attempts`,
    severity: 'critical',
    context: {
      brand,
      workflowId,
      articleTitle,
      error
    }
  });
}

/**
 * Alert on cron failure
 */
export async function alertCronFailure(error: string, stack?: string): Promise<void> {
  await sendErrorAlert({
    title: 'Cron Job Failed',
    message: 'Scheduled video generation cron job encountered an error',
    severity: 'critical',
    context: {
      error,
      stack
    }
  });
}

/**
 * Alert on API rate limit
 */
export async function alertRateLimitHit(service: string): Promise<void> {
  await sendErrorAlert({
    title: `Rate Limit Hit: ${service}`,
    message: `${service} API rate limit reached - some operations may be delayed`,
    severity: 'warning',
    context: {
      error: `${service} rate limit exceeded`
    }
  });
}

/**
 * Alert on low article quality
 */
export async function alertLowArticleQuality(brand: 'carz' | 'ownerfi'): Promise<void> {
  await sendErrorAlert({
    title: `Low Article Quality: ${brand.toUpperCase()}`,
    message: `No high-quality articles found - all articles scored below threshold`,
    severity: 'warning',
    context: {
      brand,
      error: 'All available articles failed quality check'
    }
  });
}
