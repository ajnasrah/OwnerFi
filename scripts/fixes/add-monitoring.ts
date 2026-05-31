// Monitoring and alerting for pipeline

interface PipelineMetrics {
  startTime: number;
  endTime?: number;
  steps: {
    [key: string]: {
      status: 'pending' | 'running' | 'success' | 'failed';
      startTime: number;
      endTime?: number;
      error?: string;
      metadata?: any;
    };
  };
}

export class PipelineMonitor {
  private metrics: PipelineMetrics;
  private webhookUrl?: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl;
    this.metrics = {
      startTime: Date.now(),
      steps: {}
    };
  }

  startStep(name: string, metadata?: any) {
    console.log(`⏳ Starting: ${name}`);
    this.metrics.steps[name] = {
      status: 'running',
      startTime: Date.now(),
      metadata
    };
  }

  completeStep(name: string, metadata?: any) {
    const step = this.metrics.steps[name];
    if (!step) return;

    step.status = 'success';
    step.endTime = Date.now();
    step.metadata = { ...step.metadata, ...metadata };
    
    const duration = ((step.endTime - step.startTime) / 1000).toFixed(2);
    console.log(`✅ Completed: ${name} (${duration}s)`);
  }

  failStep(name: string, error: any) {
    const step = this.metrics.steps[name];
    if (!step) return;

    step.status = 'failed';
    step.endTime = Date.now();
    step.error = error.message || String(error);
    
    console.error(`❌ Failed: ${name} - ${step.error}`);
  }

  async finish(success: boolean) {
    this.metrics.endTime = Date.now();
    const duration = ((this.metrics.endTime - this.metrics.startTime) / 1000).toFixed(2);
    
    const summary = this.generateSummary();
    
    if (success) {
      console.log(`\n✅ Pipeline completed successfully in ${duration}s`);
    } else {
      console.error(`\n❌ Pipeline failed after ${duration}s`);
    }
    
    console.log(summary);
    
    // Send to webhook if configured
    if (this.webhookUrl) {
      await this.sendAlert(success, summary);
    }
    
    // Save to Firebase for historical tracking
    await this.saveMetrics();
  }

  private generateSummary(): string {
    const steps = Object.entries(this.metrics.steps);
    const successful = steps.filter(([_, s]) => s.status === 'success').length;
    const failed = steps.filter(([_, s]) => s.status === 'failed').length;
    
    let summary = `\nPipeline Summary:\n`;
    summary += `================\n`;
    summary += `Total Steps: ${steps.length}\n`;
    summary += `Successful: ${successful}\n`;
    summary += `Failed: ${failed}\n\n`;
    
    summary += `Step Details:\n`;
    for (const [name, step] of steps) {
      const duration = step.endTime 
        ? ((step.endTime - step.startTime) / 1000).toFixed(2) 
        : 'N/A';
      const status = step.status === 'success' ? '✅' : '❌';
      summary += `${status} ${name}: ${duration}s`;
      if (step.error) {
        summary += ` (Error: ${step.error})`;
      }
      summary += '\n';
    }
    
    return summary;
  }

  private async sendAlert(success: boolean, summary: string) {
    if (!this.webhookUrl) return;
    
    try {
      const color = success ? '#00FF00' : '#FF0000';
      const title = success 
        ? '✅ Video Pipeline Success' 
        : '❌ Video Pipeline Failed';
      
      // Slack webhook format
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Pipeline Monitor',
          icon_emoji: success ? ':white_check_mark:' : ':x:',
          attachments: [{
            color,
            title,
            text: summary,
            footer: 'Ownerfi Video Pipeline',
            ts: Math.floor(Date.now() / 1000)
          }]
        })
      });
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  private async saveMetrics() {
    try {
      // Save to Firebase for historical tracking
      const { getFirebaseAdmin } = await import('../../src/lib/scraper-v2/firebase-admin');
      const { db } = getFirebaseAdmin();
      
      await db.collection('pipeline_metrics').add({
        ...this.metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }
}

// Usage example:
export async function runPipelineWithMonitoring() {
  const monitor = new PipelineMonitor(process.env.SLACK_WEBHOOK_URL);
  
  try {
    // Step 1: Generate cards
    monitor.startStep('generate_cards');
    const cards = await generateCards();
    monitor.completeStep('generate_cards', { count: cards.length });
    
    // Step 2: Generate script
    monitor.startStep('generate_script');
    const script = await generateScript(cards);
    monitor.completeStep('generate_script', { theme: script.theme });
    
    // Step 3: Create video
    monitor.startStep('create_video');
    const video = await createVideo(script, cards);
    monitor.completeStep('create_video', { videoId: video.id });
    
    // Step 4: Post to social
    monitor.startStep('post_social');
    await postToSocial(video);
    monitor.completeStep('post_social');
    
    await monitor.finish(true);
  } catch (error) {
    monitor.failStep(monitor.metrics.steps[Object.keys(monitor.metrics.steps).pop()!].name, error);
    await monitor.finish(false);
    throw error;
  }
}