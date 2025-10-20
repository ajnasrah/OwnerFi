// HeyGen V2 API Multi-Scene Video Generator for Podcasts
import { readFileSync } from 'fs';
import { join } from 'path';

interface QAPair {
  question: string;
  answer: string;
}

interface PodcastScript {
  episode_title: string;
  guest_id: string;
  guest_name: string;
  topic: string;
  qa_pairs: QAPair[];
}

interface VideoScene {
  character: {
    type: string;
    avatar_id?: string;
    talking_photo_id?: string;
    scale?: number;
    talking_photo_style?: string;
    talking_style?: string;
    avatar_style?: string;
  };
  voice: {
    type: string;
    voice_id?: string;
    input_text: string;
    speed?: number;
  };
  background?: {
    type: string;
    value: string;
  };
}

interface HeyGenVideoRequest {
  video_inputs: VideoScene[];
  dimension?: {
    width: number;
    height: number;
  };
  title?: string;
  caption?: boolean;
  callback_id?: string;
}

interface HeyGenVideoResponse {
  error: any;
  data: {
    video_id: string;
  };
}

export class HeyGenPodcastGenerator {
  private apiKey: string;
  private apiUrl: string = 'https://api.heygen.com/v2/video/generate';
  private statusUrl: string = 'https://api.heygen.com/v1/video_status.get';
  private guestProfiles: any;
  private hostProfile: any;
  private videoSettings: any;

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    // Load profiles configuration
    const configPath = join(process.cwd(), 'podcast', 'config', 'guest-profiles.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    this.guestProfiles = config.profiles;
    this.hostProfile = config.host;
    this.videoSettings = config.video_settings;
  }

  /**
   * Generate a multi-scene podcast video from a script
   */
  async generatePodcastVideo(script: PodcastScript): Promise<string> {
    console.log(`\nGenerating podcast video: ${script.episode_title}`);

    const guest = this.guestProfiles[script.guest_id];
    if (!guest) {
      throw new Error(`Guest profile not found: ${script.guest_id}`);
    }

    // Validate guest configuration
    if (!guest.avatar_id) {
      throw new Error(`Guest ${script.guest_id} is missing avatar_id`);
    }

    if (!guest.voice_id) {
      console.warn(`⚠️  Guest ${script.guest_id} has no voice_id - using avatar's default voice`);
    }

    // Validate host configuration
    if (!this.hostProfile.avatar_id) {
      throw new Error('Host is missing avatar_id');
    }

    if (!this.hostProfile.voice_id) {
      throw new Error('Host is missing voice_id');
    }

    // Build video scenes (alternating Q&A)
    const videoScenes = this.buildVideoScenes(script, guest);

    console.log(`Created ${videoScenes.length} scenes`);

    // Prepare HeyGen API request
    const request: HeyGenVideoRequest = {
      video_inputs: videoScenes,
      dimension: this.videoSettings.dimension,
      title: script.episode_title,
      caption: false // We'll add captions via Submagic
    };

    // Call HeyGen API
    const response = await this.callHeyGenAPI(request);

    if (response.error) {
      const errorMessage = typeof response.error === 'string'
        ? response.error
        : JSON.stringify(response.error);
      throw new Error(`HeyGen API error: ${errorMessage}`);
    }

    if (!response.data || !response.data.video_id) {
      throw new Error('HeyGen API did not return a video ID');
    }

    const videoId = response.data.video_id;
    console.log(`Video generation started. Video ID: ${videoId}`);

    return videoId;
  }

  /**
   * Build video scenes array for HeyGen API
   */
  private buildVideoScenes(script: PodcastScript, guest: any): VideoScene[] {
    const scenes: VideoScene[] = [];

    for (const qa of script.qa_pairs) {
      // Host asks question
      scenes.push({
        character: {
          type: this.hostProfile.avatar_type,
          talking_photo_id: this.hostProfile.avatar_id,
          scale: this.hostProfile.scale || 1.4,
          talking_photo_style: 'square',
          talking_style: 'expressive'
        },
        voice: {
          type: 'text',
          voice_id: this.hostProfile.voice_id,
          input_text: qa.question,
          speed: 1.0
        },
        background: {
          type: 'color',
          value: this.hostProfile.background_color || '#ffffff'
        }
      });

      // Guest answers (speed up guest since they talk slow)
      const guestVoice: any = {
        type: 'text',
        input_text: qa.answer,
        speed: 1.44  // Speed up guest avatar by 20% more (1.2 * 1.2 = 1.44x)
      };

      // Only add voice_id if it's provided, otherwise use avatar's default voice
      if (guest.voice_id) {
        guestVoice.voice_id = guest.voice_id;
      }

      const guestCharacter: any = {
        type: guest.avatar_type,
        scale: guest.scale || 1.68  // Zoom in 20% more on guest (1.4 * 1.2 = 1.68)
      };

      // Add avatar_id or talking_photo_id based on type
      if (guest.avatar_type === 'avatar') {
        guestCharacter.avatar_id = guest.avatar_id;
        guestCharacter.avatar_style = 'normal';  // Options: normal, closeUp, circle
      } else {
        guestCharacter.talking_photo_id = guest.avatar_id;
        guestCharacter.talking_photo_style = 'square';
        guestCharacter.talking_style = 'expressive';
      }

      scenes.push({
        character: guestCharacter,
        voice: guestVoice,
        background: {
          type: 'color',
          value: guest.background_color || '#f5f5f5'
        }
      });
    }

    return scenes;
  }

  /**
   * Call HeyGen V2 API to generate video
   */
  private async callHeyGenAPI(request: HeyGenVideoRequest): Promise<HeyGenVideoResponse> {
    // Log the request for debugging
    console.log('\nAPI Request:', JSON.stringify(request, null, 2));

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('\nAPI Error Response:', error);
      throw new Error(`HeyGen API request failed: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log('\nAPI Response:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Check video generation status
   */
  async checkVideoStatus(videoId: string): Promise<{
    status: string;
    video_url?: string;
    duration?: number;
    error?: string;
  }> {
    const response = await fetch(`${this.statusUrl}?video_id=${videoId}`, {
      headers: {
        'accept': 'application/json',
        'x-api-key': this.apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check video status: ${response.status}`);
    }

    const data = await response.json();

    // Handle both old and new API response formats
    const videoData = data.data || data;

    return {
      status: videoData.status,
      video_url: videoData.video_url,
      duration: videoData.duration,
      error: videoData.error || data.error?.message
    };
  }

  /**
   * Poll video status until complete or failed
   */
  async waitForVideoCompletion(
    videoId: string,
    maxWaitMinutes: number = 10
  ): Promise<string> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const pollIntervalMs = 10000; // Check every 10 seconds

    console.log(`Waiting for video to complete (max ${maxWaitMinutes} minutes)...`);

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.checkVideoStatus(videoId);

      console.log(`Status: ${status.status}`);

      if (status.status === 'completed' && status.video_url) {
        console.log(`Video completed! Duration: ${status.duration}s`);
        return status.video_url;
      }

      if (status.status === 'failed') {
        throw new Error(`Video generation failed: ${status.error || 'Unknown error'}`);
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Video generation timeout after ${maxWaitMinutes} minutes`);
  }

  /**
   * Get estimated video duration from script
   */
  estimateVideoDuration(script: PodcastScript): number {
    // Average speaking rate: 150 words per minute
    const totalWords = script.qa_pairs.reduce((sum, pair) => {
      return sum + pair.question.split(' ').length + pair.answer.split(' ').length;
    }, 0);

    return Math.ceil((totalWords / 150) * 60);
  }
}

export default HeyGenPodcastGenerator;
