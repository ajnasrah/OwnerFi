// Submagic API Integration for Podcast Captions & Clip Generation
import { readFileSync } from 'fs';
import { join } from 'path';

interface SubmagicRequest {
  video_url: string;
  template?: string;
  language?: string;
  split_scenes?: boolean;
  export_individual_clips?: boolean;
}

interface SubmagicClip {
  clip_number: number;
  start_time: number;
  end_time: number;
  video_url: string;
  caption_text?: string;
}

interface SubmagicResponse {
  success: boolean;
  job_id: string;
  status: string;
  video_url?: string;
  clips?: SubmagicClip[];
  error?: string;
}

export class SubmagicIntegration {
  private apiKey: string;
  private apiUrl: string = 'https://api.submagic.co/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Process podcast video: Add captions + Split into clips
   * This is the ONE-STOP method for the complete podcast workflow
   */
  async processPodcastVideo(
    videoUrl: string,
    template: string = 'Hormozi 2',
    language: string = 'en',
    splitIntoClips: boolean = true
  ): Promise<{
    finalVideoUrl: string;
    clips?: SubmagicClip[];
  }> {
    console.log(`\n🎨 Processing video with Submagic...`);
    console.log(`   Template: ${template}`);
    console.log(`   Split into clips: ${splitIntoClips ? 'Yes' : 'No'}\n`);

    const response = await this.createSubmagicJob(
      videoUrl,
      template,
      language,
      splitIntoClips
    );

    if (!response.success) {
      throw new Error(`Submagic job creation failed: ${response.error}`);
    }

    console.log(`   Job ID: ${response.job_id}\n`);

    // Wait for completion
    const result = await this.waitForCompletion(response.job_id);

    console.log(`✅ Submagic processing complete!\n`);

    if (splitIntoClips && result.clips) {
      console.log(`   Generated ${result.clips.length} individual clips\n`);
    }

    return {
      finalVideoUrl: result.video_url || videoUrl,
      clips: result.clips
    };
  }

  /**
   * Add captions to video using Submagic (legacy method)
   */
  async addCaptions(
    videoUrl: string,
    template: string = 'Hormozi 2',
    language: string = 'en'
  ): Promise<string> {
    const result = await this.processPodcastVideo(videoUrl, template, language, false);
    return result.finalVideoUrl;
  }

  /**
   * Create Submagic caption job with optional clip splitting
   */
  private async createSubmagicJob(
    videoUrl: string,
    template: string,
    language: string,
    splitScenes: boolean = false
  ): Promise<SubmagicResponse> {
    const payload: SubmagicRequest = {
      video_url: videoUrl,
      template,
      language
    };

    if (splitScenes) {
      payload.split_scenes = true;
      payload.export_individual_clips = true;
    }

    const response = await fetch(`${this.apiUrl}/captions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
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
  ): Promise<SubmagicResponse> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const pollIntervalMs = 15000; // Check every 15 seconds

    console.log(`   Waiting for Submagic (max ${maxWaitMinutes} min)...`);

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkStatus(jobId);

      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`   [${elapsed}s] Status: ${status.status}`);

      if (status.status === 'completed' && status.video_url) {
        return status;
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
