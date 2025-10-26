// Daily Benefit Video Scheduler - BUYER-ONLY (5 Videos Per Day)
// Helps renters become homeowners through owner financing education

interface ScheduleConfig {
  frequency: string;
  videos_per_day: number;
  timezone: string;
  enabled: boolean;
}

interface BenefitVideoRecord {
  benefit_id: string;
  audience: 'buyer'; // BUYER-ONLY
  generated_at: string;
  video_id: string;
  published: boolean;
  workflow_id?: string;
}

interface BenefitSchedulerState {
  recent_buyer_benefits: string[];  // Last 5 buyer benefit IDs used (avoid repetition)
  videos: BenefitVideoRecord[];
}

// Static configuration - BUYER-ONLY
const DEFAULT_SCHEDULE: ScheduleConfig = {
  frequency: 'daily',
  videos_per_day: 5, // 5 buyer videos per day
  timezone: 'America/Chicago',
  enabled: true
};

export class BenefitScheduler {
  private schedule: ScheduleConfig;
  private state: BenefitSchedulerState;

  constructor() {
    this.schedule = DEFAULT_SCHEDULE;
    this.state = {
      recent_buyer_benefits: [],
      videos: []
    };
  }

  /**
   * Load scheduler state from Firestore
   */
  async loadStateFromFirestore(): Promise<void> {
    try {
      const { db } = await import('@/lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');

      if (!db) {
        console.warn('Firebase not initialized, using default state');
        return;
      }

      const stateDoc = await getDoc(doc(db, 'benefit_scheduler', 'state'));

      if (stateDoc.exists()) {
        this.state = stateDoc.data() as BenefitSchedulerState;
      }
    } catch (error) {
      console.error('Error loading benefit scheduler state from Firestore:', error);
    }
  }

  /**
   * Save scheduler state to Firestore
   */
  private async saveStateToFirestore(): Promise<void> {
    try {
      const { db } = await import('@/lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');

      if (!db) {
        console.warn('Firebase not initialized, cannot save state');
        return;
      }

      await setDoc(doc(db, 'benefit_scheduler', 'state'), this.state);
    } catch (error) {
      console.error('Error saving benefit scheduler state to Firestore:', error);
    }
  }

  /**
   * Check if we should generate benefit videos today (BUYER-ONLY)
   * Returns true if we haven't reached the daily limit (5 buyer videos)
   */
  shouldGenerateVideos(): { shouldGenerate: boolean; videosNeeded: number } {
    if (!this.schedule.enabled) {
      return { shouldGenerate: false, videosNeeded: 0 };
    }

    // Get current date in Central Time
    const now = new Date();
    const todayInCentral = now.toLocaleString('en-US', {
      timeZone: this.schedule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // Count BUYER videos generated today
    const videosToday = this.state.videos.filter(video => {
      const videoDate = new Date(video.generated_at);
      const videoDateInCentral = videoDate.toLocaleString('en-US', {
        timeZone: this.schedule.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return videoDateInCentral === todayInCentral;
    });

    const buyerVideosToday = videosToday.length; // All videos are buyer videos
    const videosNeeded = Math.max(0, this.schedule.videos_per_day - buyerVideosToday);
    const shouldGenerate = videosNeeded > 0;

    console.log(`📊 BUYER-ONLY scheduler check: ${buyerVideosToday}/${this.schedule.videos_per_day} buyer videos today (${todayInCentral} ${this.schedule.timezone})`);
    console.log(`   Videos needed: ${videosNeeded}`);

    return { shouldGenerate, videosNeeded };
  }

  /**
   * Get recently used BUYER benefit IDs (to avoid repetition)
   * BUYER-ONLY: Only tracks buyer benefits
   */
  getRecentBenefitIds(count: number = 5): string[] {
    return this.state.recent_buyer_benefits.slice(-count);
  }

  /**
   * Record a new BUYER benefit video
   * BUYER-ONLY: Only accepts buyer audience
   */
  async recordBenefitVideo(
    benefitId: string,
    workflowId: string
  ): Promise<void> {
    const video: BenefitVideoRecord = {
      benefit_id: benefitId,
      audience: 'buyer', // BUYER-ONLY
      generated_at: new Date().toISOString(),
      video_id: workflowId,
      workflow_id: workflowId,
      published: false
    };

    this.state.videos.push(video);

    // Update recent buyer benefits (keep last 5 to avoid repetition)
    this.state.recent_buyer_benefits.push(benefitId);
    if (this.state.recent_buyer_benefits.length > 5) {
      this.state.recent_buyer_benefits.shift();
    }

    await this.saveStateToFirestore();
  }

  /**
   * Mark video as published
   */
  async markPublished(workflowId: string): Promise<void> {
    const video = this.state.videos.find(v => v.workflow_id === workflowId);

    if (video) {
      video.published = true;
      await this.saveStateToFirestore();
    }
  }

  /**
   * Get all videos
   */
  getAllVideos(): BenefitVideoRecord[] {
    return this.state.videos;
  }

  /**
   * Get statistics (BUYER-ONLY)
   */
  getStats() {
    const totalVideos = this.state.videos.length; // All are buyer videos
    const publishedVideos = this.state.videos.filter(v => v.published).length;

    return {
      total_videos: totalVideos,
      buyer_videos: totalVideos, // BUYER-ONLY system
      published_videos: publishedVideos,
      recent_buyer_benefits: this.state.recent_buyer_benefits,
      schedule_enabled: this.schedule.enabled,
      videos_per_day: this.schedule.videos_per_day,
      next_scheduled: this.getNextScheduledDate()
    };
  }

  /**
   * Calculate next scheduled video date (BUYER-ONLY)
   */
  private getNextScheduledDate(): string {
    if (!this.schedule.enabled) {
      return 'Disabled';
    }

    const { shouldGenerate, videosNeeded } = this.shouldGenerateVideos();

    if (shouldGenerate) {
      return `Immediately (need ${videosNeeded} buyer video${videosNeeded > 1 ? 's' : ''})`;
    }

    // All 5 buyer videos for today generated, next batch is tomorrow
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    return tomorrow.toISOString();
  }
}

export default BenefitScheduler;
