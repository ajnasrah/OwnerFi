// Submagic API Integration for Podcast Captions
import { readFileSync } from 'fs';
import { join } from 'path';

interface SubmagicRequest {
  video_url: string;
  template?: string;
  language?: string;
}

interface SubmagicResponse {
  success: boolean;
  job_id: string;
  status: string;
  video_url?: string;
  error?: string;
}

export class SubmagicIntegration {
  private apiKey: string;
  private apiUrl: string = 'https://api.submagic.co/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Add captions to video using Submagic
   */
  async addCaptions(
    videoUrl: string,
    template: string = 'Hormozi 2',
    language: string = 'en'
  ): Promise<string> {
    console.log(`\nAdding captions to video with Submagic...`);
    console.log(`Template: ${template}`);

    const response = await this.createSubmagicJob(videoUrl, template, language);

    if (!response.success) {
      throw new Error(`Submagic job creation failed: ${response.error}`);
    }

    console.log(`Submagic job created: ${response.job_id}`);

    // Wait for completion
    const finalVideoUrl = await this.waitForCompletion(response.job_id);

    console.log(`Captions added successfully!`);
    return finalVideoUrl;
  }

  /**
   * Create Submagic caption job
   */
  private async createSubmagicJob(
    videoUrl: string,
    template: string,
    language: string
  ): Promise<SubmagicResponse> {
    const response = await fetch(`${this.apiUrl}/captions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_url: videoUrl,
        template,
        language
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Submagic API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Check Submagic job status
   */
  async checkStatus(jobId: string): Promise<SubmagicResponse> {
    const response = await fetch(`${this.apiUrl}/captions/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check Submagic status: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Wait for Submagic job completion
   */
  async waitForCompletion(
    jobId: string,
    maxWaitMinutes: number = 15
  ): Promise<string> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const pollIntervalMs = 15000; // Check every 15 seconds

    console.log(`Waiting for Submagic to complete (max ${maxWaitMinutes} minutes)...`);

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkStatus(jobId);

      console.log(`Status: ${status.status}`);

      if (status.status === 'completed' && status.video_url) {
        return status.video_url;
      }

      if (status.status === 'failed') {
        throw new Error(`Submagic job failed: ${status.error || 'Unknown error'}`);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Submagic timeout after ${maxWaitMinutes} minutes`);
  }
}

export default SubmagicIntegration;
