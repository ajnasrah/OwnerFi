// Enhanced Video Generator: Individual Clips + Final Stitched Video
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

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

interface VideoClip {
  scene_number: number;
  type: 'question' | 'answer';
  video_id: string;
  video_url: string;
  text: string;
}

interface PodcastVideoOutput {
  episode_number: number;
  individual_clips: VideoClip[];
  final_video_url: string;
  clips_directory: string;
}

export class PodcastVideoGenerator {
  private heygenApiKey: string;
  private apiUrl: string = 'https://api.heygen.com/v2/video/generate';
  private statusUrl: string = 'https://api.heygen.com/v1/video_status.get';
  private guestProfiles: any;
  private hostProfile: any;
  private outputDir: string;

  constructor(heygenApiKey: string) {
    this.heygenApiKey = heygenApiKey;

    // Load profiles
    const configPath = join(process.cwd(), 'podcast', 'config', 'guest-profiles.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    this.guestProfiles = config.profiles;
    this.hostProfile = config.host;

    // Set output directory
    this.outputDir = join(process.cwd(), 'podcast', 'output');
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate podcast with both individual clips and final video
   * OPTIMIZED: Single HeyGen API call (90% cost savings!)
   * Returns HeyGen URL directly - Submagic will handle splitting
   */
  async generatePodcast(
    script: PodcastScript,
    episodeNumber: number
  ): Promise<PodcastVideoOutput> {
    console.log(`\n🎬 Generating Podcast Episode #${episodeNumber}`);
    console.log(`   Title: ${script.episode_title}\n`);

    const guest = this.guestProfiles[script.guest_id];
    if (!guest) {
      throw new Error(`Guest profile not found: ${script.guest_id}`);
    }

    // Create episode directory
    const episodeDir = join(this.outputDir, `episode-${episodeNumber}`);
    if (!existsSync(episodeDir)) {
      mkdirSync(episodeDir, { recursive: true });
    }

    // Step 1: Generate complete video with single API call (90% cost savings!)
    console.log('📹 Step 1: Generating complete video (single API call)...\n');
    console.log('   This batches all Q&A into ONE HeyGen request\n');

    const videoUrl = await this.generateCompleteVideo(script, guest);

    console.log(`✅ Complete video generated!\n`);
    console.log(`   Video URL: ${videoUrl}\n`);

    // Step 2: Build clip metadata (for Submagic to use)
    const clips: VideoClip[] = [];
    let sceneNumber = 1;

    for (let i = 0; i < script.qa_pairs.length; i++) {
      const qa = script.qa_pairs[i];

      clips.push({
        scene_number: sceneNumber++,
        type: 'question',
        video_id: `q${i + 1}`,
        video_url: videoUrl, // Same video, Submagic will split
        text: qa.question
      });

      clips.push({
        scene_number: sceneNumber++,
        type: 'answer',
        video_id: `a${i + 1}`,
        video_url: videoUrl, // Same video, Submagic will split
        text: qa.answer
      });
    }

    // Step 3: Save metadata
    const metadata = {
      episode_number: episodeNumber,
      episode_title: script.episode_title,
      guest_id: script.guest_id,
      guest_name: script.guest_name,
      topic: script.topic,
      clips: clips.map(c => ({
        scene: c.scene_number,
        type: c.type,
        video_id: c.video_id,
        text: c.text
      })),
      heygen_video_url: videoUrl,
      generated_at: new Date().toISOString(),
      cost_optimization: 'single_api_call',
      total_scenes: clips.length,
      note: 'Submagic will handle video splitting and caption generation'
    };

    const metadataPath = join(episodeDir, 'metadata.json');
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`💡 Next: Pass this video URL to Submagic for:`);
    console.log(`   - Auto-captioning`);
    console.log(`   - Scene detection & splitting`);
    console.log(`   - Individual clip export\n`);

    return {
      episode_number: episodeNumber,
      individual_clips: clips,
      final_video_url: videoUrl,
      clips_directory: episodeDir
    };
  }

  /**
   * Generate complete video with single HeyGen API call
   * Uses multi-scene approach from heygen-podcast.ts
   */
  private async generateCompleteVideo(
    script: PodcastScript,
    guest: any
  ): Promise<string> {
    // Build all scenes (alternating Q&A)
    const videoScenes = [];

    for (const qa of script.qa_pairs) {
      // Host asks question - uses standard talking_photo configuration
      videoScenes.push({
        character: {
          type: 'talking_photo',
          talking_photo_id: this.hostProfile.avatar_id,
          scale: this.hostProfile.scale || 1.4,
          talking_style: 'expressive'
        },
        voice: {
          type: 'text',
          voice_id: this.hostProfile.voice_id,
          input_text: qa.question,
          speed: 1.1
        },
        background: {
          type: 'color',
          value: this.hostProfile.background_color || '#ffffff'
        }
      });

      // Guest answers - uses standard talking_photo configuration
      const guestVoice: any = {
        type: 'text',
        input_text: qa.answer,
        speed: 1.1
      };

      if (guest.voice_id) {
        guestVoice.voice_id = guest.voice_id;
      }

      videoScenes.push({
        character: {
          type: 'talking_photo',
          talking_photo_id: guest.avatar_id,
          scale: guest.scale || 1.4,
          talking_style: 'expressive'
        },
        voice: guestVoice,
        background: {
          type: 'color',
          value: guest.background_color || '#f5f5f5'
        }
      });
    }

    const request = {
      video_inputs: videoScenes,
      dimension: {
        width: 1080,
        height: 1920
      },
      title: script.episode_title,
      caption: false // Submagic will handle captions
    };

    console.log(`   Generating ${videoScenes.length} scenes in single API call...`);

    // Call HeyGen API
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': this.heygenApiKey
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HeyGen API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (data.code !== 100) {
      throw new Error(`HeyGen API error: ${data.message || 'Unknown error'}`);
    }

    const videoId = data.data.video_id;
    console.log(`   Video ID: ${videoId}`);

    // Wait for completion
    const videoUrl = await this.waitForVideo(videoId);

    return videoUrl;
  }

  /**
   * Generate individual clips for each Q&A
   * DEPRECATED: Use generateCompleteVideo instead for 90% cost savings
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async generateIndividualClips(
    script: PodcastScript,
    guest: any,
    outputDir: string
  ): Promise<VideoClip[]> {
    const clips: VideoClip[] = [];
    let sceneNumber = 1;

    for (let i = 0; i < script.qa_pairs.length; i++) {
      const qa = script.qa_pairs[i];

      console.log(`   Generating Q${i + 1}...`);

      // Generate question clip
      const questionClip = await this.generateSingleClip(
        qa.question,
        this.hostProfile,
        'question',
        sceneNumber++,
        `q${i + 1}`
      );
      clips.push(questionClip);

      // Download question clip
      await this.downloadClip(questionClip.video_url, outputDir, `q${i + 1}.mp4`);

      console.log(`   Generating A${i + 1}...`);

      // Generate answer clip
      const answerClip = await this.generateSingleClip(
        qa.answer,
        guest,
        'answer',
        sceneNumber++,
        `a${i + 1}`
      );
      clips.push(answerClip);

      // Download answer clip
      await this.downloadClip(answerClip.video_url, outputDir, `a${i + 1}.mp4`);
    }

    return clips;
  }

  /**
   * Generate a single video clip
   */
  private async generateSingleClip(
    text: string,
    profile: any,
    type: 'question' | 'answer',
    sceneNumber: number,
    clipId: string
  ): Promise<VideoClip> {
    const request = {
      video_inputs: [
        {
          character: {
            type: 'talking_photo',
            talking_photo_id: profile.avatar_id,
            scale: profile.scale || 1.4,
            talking_style: 'expressive'
          },
          voice: {
            type: 'text',
            voice_id: profile.voice_id,
            input_text: text,
            speed: 1.1
          },
          background: {
            type: 'color',
            value: profile.background_color || '#ffffff'
          }
        }
      ],
      dimension: {
        width: 1080,
        height: 1920
      },
      title: `${type}_${clipId}`
    };

    // Call HeyGen API
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': this.heygenApiKey
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HeyGen API error: ${response.status}`);
    }

    const data = await response.json();
    const videoId = data.data.video_id;

    // Wait for completion
    const videoUrl = await this.waitForVideo(videoId);

    return {
      scene_number: sceneNumber,
      type,
      video_id: videoId,
      video_url: videoUrl,
      text
    };
  }

  /**
   * Wait for video to complete
   */
  private async waitForVideo(videoId: string): Promise<string> {
    const maxWaitMs = 10 * 60 * 1000; // 10 minutes
    const pollInterval = 10000; // 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const response = await fetch(`${this.statusUrl}?video_id=${videoId}`, {
        headers: {
          'accept': 'application/json',
          'x-api-key': this.heygenApiKey
        }
      });

      const data = await response.json();
      const status = data.data.status;

      if (status === 'completed') {
        return data.data.video_url;
      }

      if (status === 'failed') {
        throw new Error(`Video generation failed: ${data.data.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Video generation timeout');
  }

  /**
   * Download a video clip
   */
  private async downloadClip(
    url: string,
    outputDir: string,
    filename: string
  ): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download clip: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const filePath = join(outputDir, filename);
    writeFileSync(filePath, Buffer.from(buffer));
  }

  /**
   * Stitch clips together using FFmpeg
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async stitchClips(
    clips: VideoClip[],
    outputDir: string,
    episodeNumber: number
  ): Promise<string> {
    // Create file list for FFmpeg
    const fileListPath = join(outputDir, 'filelist.txt');
    const fileList = clips
      .sort((a, b) => a.scene_number - b.scene_number)
      .map(clip => {
        const filename = `${clip.type === 'question' ? 'q' : 'a'}${Math.ceil(clip.scene_number / 2)}.mp4`;
        return `file '${filename}'`;
      })
      .join('\n');

    writeFileSync(fileListPath, fileList);

    // Output file
    const outputFile = join(outputDir, `episode-${episodeNumber}-final.mp4`);

    // Use FFmpeg to concatenate
    try {
      execSync(
        `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputFile}" -y`,
        { cwd: outputDir, stdio: 'pipe' }
      );
    } catch (error: any) {
      // If concat fails, try re-encoding
      console.log('   Retrying with re-encoding...');
      execSync(
        `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c:v libx264 -preset fast -crf 22 -c:a aac "${outputFile}" -y`,
        { cwd: outputDir, stdio: 'pipe' }
      );
    }

    return outputFile;
  }

  /**
   * Check if FFmpeg is installed
   */
  static checkFFmpeg(): boolean {
    try {
      execSync('ffmpeg -version', { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

export default PodcastVideoGenerator;
