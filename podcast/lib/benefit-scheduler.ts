// Daily Benefit Video Scheduler - 2 Videos Per Day (1 Seller, 1 Buyer)
// Alternates with podcast content for mixed social media feed

interface ScheduleConfig {
  frequency: string;
  videos_per_day: number;
  timezone: string;
  enabled: boolean;
}

interface BenefitVideoRecord {
  benefit_id: string;
  audience: 'seller' | 'buyer';
  generated_at: string;
  video_id: string;
  published: boolean;
  workflow_id?: string;
}

interface BenefitSchedulerState {
  recent_seller_benefits: string[]; // Last 5 seller benefit IDs used
  recent_buyer_benefits: string[];  // Last 5 buyer benefit IDs used
  videos: BenefitVideoRecord[];
}

// Static configuration
const DEFAULT_SCHEDULE: ScheduleConfig = {
  frequency: 'daily',
  videos_per_day: 2, // 1 seller + 1 buyer
  timezone: 'America/Chicago',
  enabled: true
};

export class BenefitScheduler {
  private schedule: ScheduleConfig;
  private state: BenefitSchedulerState;

  constructor() {
    this.schedule = DEFAULT_SCHEDULE;
    this.state = {
      recent_seller_benefits: [],
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
   * Check if we should generate benefit videos today
   * Returns true if we haven't reached the daily limit (2 videos: 1 seller, 1 buyer)
   */
  shouldGenerateVideos(): { shouldGenerate: boolean; needSeller: boolean; needBuyer: boolean } {
    if (!this.schedule.enabled) {
      return { shouldGenerate: false, needSeller: false, needBuyer: false };
    }

    // Get current date in Central Time
    const now = new Date();
    const todayInCentral = now.toLocaleString('en-US', {
      timeZone: this.schedule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // Count videos generated today
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

    const sellerToday = videosToday.filter(v => v.audience === 'seller').length;
    const buyerToday = videosToday.filter(v => v.audience === 'buyer').length;

    const needSeller = sellerToday === 0;
    const needBuyer = buyerToday === 0;
    const shouldGenerate = needSeller || needBuyer;

    console.log(`📊 Benefit scheduler check: ${sellerToday} seller + ${buyerToday} buyer videos today (${todayInCentral} ${this.schedule.timezone})`);
    console.log(`   Need: ${needSeller ? 'seller' : ''}${needSeller && needBuyer ? ' + ' : ''}${needBuyer ? 'buyer' : ''}`);

    return { shouldGenerate, needSeller, needBuyer };
  }

  /**
   * Get recently used benefit IDs for an audience (to avoid repetition)
   */
  getRecentBenefitIds(audience: 'seller' | 'buyer', count: number = 5): string[] {
    const recentIds = audience === 'seller'
      ? this.state.recent_seller_benefits
      : this.state.recent_buyer_benefits;
    return recentIds.slice(-count);
  }

  /**
   * Record a new benefit video
   */
  async recordBenefitVideo(
    benefitId: string,
    audience: 'seller' | 'buyer',
    workflowId: string
  ): Promise<void> {
    const video: BenefitVideoRecord = {
      benefit_id: benefitId,
      audience,
      generated_at: new Date().toISOString(),
      video_id: workflowId,
      workflow_id: workflowId,
      published: false
    };

    this.state.videos.push(video);

    // Update recent benefits (keep last 5)
    if (audience === 'seller') {
      this.state.recent_seller_benefits.push(benefitId);
      if (this.state.recent_seller_benefits.length > 5) {
        this.state.recent_seller_benefits.shift();
      }
    } else {
      this.state.recent_buyer_benefits.push(benefitId);
      if (this.state.recent_buyer_benefits.length > 5) {
        this.state.recent_buyer_benefits.shift();
      }
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
   * Get statistics
   */
  getStats() {
    const sellerVideos = this.state.videos.filter(v => v.audience === 'seller').length;
    const buyerVideos = this.state.videos.filter(v => v.audience === 'buyer').length;
    const publishedVideos = this.state.videos.filter(v => v.published).length;

    return {
      total_videos: this.state.videos.length,
      seller_videos: sellerVideos,
      buyer_videos: buyerVideos,
      published_videos: publishedVideos,
      recent_seller_benefits: this.state.recent_seller_benefits,
      recent_buyer_benefits: this.state.recent_buyer_benefits,
      schedule_enabled: this.schedule.enabled,
      next_scheduled: this.getNextScheduledDate()
    };
  }

  /**
   * Calculate next scheduled video date
   */
  private getNextScheduledDate(): string {
    if (!this.schedule.enabled) {
      return 'Disabled';
    }

    const { shouldGenerate, needSeller, needBuyer } = this.shouldGenerateVideos();

    if (shouldGenerate) {
      if (needSeller && needBuyer) {
        return 'Immediately (need both seller and buyer)';
      } else if (needSeller) {
        return 'Immediately (need seller)';
      } else if (needBuyer) {
        return 'Immediately (need buyer)';
      }
    }

    // All videos for today generated, next one is tomorrow
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    return tomorrow.toISOString();
  }
}

export default BenefitScheduler;
