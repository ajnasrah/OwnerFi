// Podcast Publisher - Auto-post to social media via Late
import { postToLate, scheduleVideoPost, LatePostRequest } from '../../src/lib/late-api';

interface PodcastMetadata {
  episode_number: number;
  episode_title: string;
  guest_name: string;
  topic: string;
  heygen_video_url?: string;
  clips?: Array<{
    clip_number: number;
    video_url: string;
    caption_text?: string;
  }>;
}

interface PublishingStrategy {
  longForm: {
    platforms: ('youtube' | 'facebook')[];
    videoUrl: string;
  };
  shortForm?: {
    platforms: ('instagram' | 'tiktok' | 'facebook' | 'youtube' | 'linkedin' | 'threads' | 'twitter')[];
    clips: Array<{
      videoUrl: string;
      caption: string;
    }>;
  };
}

export class PodcastPublisher {
  private brand: 'carz' | 'ownerfi' = 'ownerfi';

  constructor(brand: 'carz' | 'ownerfi' = 'ownerfi') {
    this.brand = brand;
  }

  /**
   * Publish complete podcast episode
   * Strategy: Long video to YouTube/Facebook, clips to Reels/Shorts/TikTok
   */
  async publishEpisode(
    metadata: PodcastMetadata,
    videoUrl: string,
    clipsWithCaptions?: Array<{ videoUrl: string; caption: string }>
  ): Promise<{
    success: boolean;
    longFormResult?: any;
    shortFormResults?: any[];
    error?: string;
  }> {
    console.log(`\n📢 Publishing Podcast Episode #${metadata.episode_number}`);
    console.log(`   Title: ${metadata.episode_title}`);
    console.log(`   Brand: ${this.brand === 'carz' ? 'Carz Inc' : 'OwnerFi'}\n`);

    try {
      // Step 1: Publish long-form video (full episode)
      console.log('📺 Publishing long-form video...\n');

      const caption = this.generateEpisodeCaption(metadata);
      const title = this.generateEpisodeTitle(metadata);

      const longFormResult = await scheduleVideoPost(
        videoUrl,
        caption,
        title,
        ['youtube', 'facebook'],
        'immediate',
        this.brand
      );

      if (!longFormResult.success) {
        console.error('❌ Long-form publishing failed:', longFormResult.error);
        return {
          success: false,
          error: longFormResult.error
        };
      }

      console.log('✅ Long-form video published!\n');

      // Step 2: Publish short-form clips (if available)
      let shortFormResults: any[] = [];

      if (clipsWithCaptions && clipsWithCaptions.length > 0) {
        console.log(`📱 Publishing ${clipsWithCaptions.length} short-form clips...\n`);

        shortFormResults = await this.publishClips(clipsWithCaptions, metadata);

        console.log(`✅ Published ${shortFormResults.filter(r => r.success).length}/${clipsWithCaptions.length} clips\n`);
      }

      return {
        success: true,
        longFormResult,
        shortFormResults
      };

    } catch (error) {
      console.error('❌ Publishing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Publish individual clips to all 8 platforms (Reels, Stories, Shorts, etc.)
   */
  private async publishClips(
    clips: Array<{ videoUrl: string; caption: string }>,
    metadata: PodcastMetadata
  ): Promise<any[]> {
    const results = [];

    // All platforms for maximum reach
    const allPlatforms: LatePostRequest['platforms'] = [
      'instagram',  // Reels
      'facebook',   // Reels
      'tiktok',
      'youtube',    // Shorts
      'linkedin',
      'twitter',
      'threads',
      'bluesky'
    ];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];

      console.log(`   Publishing clip ${i + 1}/${clips.length}...`);

      try {
        // Add episode context to clip caption
        const fullCaption = `${clip.caption}

From Episode #${metadata.episode_number}: ${metadata.guest_name} on ${metadata.topic}

#podcast #shorts #viral #education`;

        // Post to Reels/Shorts on all platforms
        const reelsResult = await postToLate({
          videoUrl: clip.videoUrl,
          caption: fullCaption,
          platforms: allPlatforms,
          brand: 'podcast'
        });

        results.push(reelsResult);

        if (reelsResult.success) {
          console.log(`   ✅ Clip ${i + 1} published to Reels/Shorts`);
        } else {
          console.log(`   ❌ Clip ${i + 1} Reels failed: ${reelsResult.error}`);
        }

        // Late handles all platform types (Reels/Stories/Shorts) automatically
        // No need for separate Stories posting

      } catch (error) {
        console.error(`   ❌ Error publishing clip ${i + 1}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Generate engaging caption for episode
   */
  private generateEpisodeCaption(metadata: PodcastMetadata): string {
    return `🎙️ NEW EPISODE ALERT!

${metadata.guest_name} drops INSANE knowledge about ${metadata.topic}!

You won't believe what we uncovered in this conversation. This is the type of insider info that can literally CHANGE YOUR LIFE.

Watch now and learn something MASSIVE!

#podcast #${metadata.topic.replace(/\s+/g, '')} #education #viral #mustwatch`;
  }

  /**
   * Generate SEO-friendly title
   */
  private generateEpisodeTitle(metadata: PodcastMetadata): string {
    return `${metadata.episode_title} | Episode #${metadata.episode_number}`;
  }

  /**
   * Publish just the long-form video (no clips)
   */
  async publishLongFormOnly(
    metadata: PodcastMetadata,
    videoUrl: string
  ): Promise<any> {
    console.log(`\n📺 Publishing long-form only: ${metadata.episode_title}\n`);

    const caption = this.generateEpisodeCaption(metadata);
    const title = this.generateEpisodeTitle(metadata);

    return await scheduleVideoPost(
      videoUrl,
      caption,
      title,
      ['youtube', 'facebook'],
      'immediate',
      this.brand
    );
  }

  /**
   * Schedule episode for optimal posting time
   */
  async scheduleEpisode(
    metadata: PodcastMetadata,
    videoUrl: string,
    scheduleTime: 'optimal' | '1hour' | '2hours' | '4hours' = 'optimal'
  ): Promise<any> {
    console.log(`\n⏰ Scheduling episode for ${scheduleTime} time...\n`);

    const caption = this.generateEpisodeCaption(metadata);
    const title = this.generateEpisodeTitle(metadata);

    return await scheduleVideoPost(
      videoUrl,
      caption,
      title,
      ['youtube', 'facebook'],
      scheduleTime,
      this.brand
    );
  }
}

export default PodcastPublisher;
