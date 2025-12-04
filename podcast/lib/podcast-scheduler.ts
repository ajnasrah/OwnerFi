// Daily Podcast Scheduler - 3 Episodes Per Day
// Refactored for serverless environments - uses static config and Firestore for state

interface ScheduleConfig {
  frequency: string;
  episodes_per_day: number;
  timezone: string;
  enabled: boolean;
}

interface EpisodeRecord {
  episode_number: number;
  guest_id: string;
  generated_at: string;
  video_id: string;
  published: boolean;
  youtube_url?: string;
}

interface SchedulerState {
  last_episode_number: number;
  recent_guests: string[];
  episodes: EpisodeRecord[];
}

// Static configuration (moved from podcast-config.json for serverless compatibility)
const DEFAULT_SCHEDULE: ScheduleConfig = {
  frequency: 'daily',
  episodes_per_day: 3,
  timezone: 'America/Chicago',
  enabled: true
};

export class PodcastScheduler {
  private schedule: ScheduleConfig;
  private state: SchedulerState;

  constructor() {
    // Use static configuration instead of file reads
    this.schedule = DEFAULT_SCHEDULE;

    // State is loaded from Firestore, not local files
    // Initialize empty state here, will be loaded async
    this.state = {
      last_episode_number: 0,
      recent_guests: [],
      episodes: []
    };
  }

  /**
   * Load scheduler state from Firestore (async)
   * This should be called after construction
   */
  async loadStateFromFirestore(): Promise<void> {
    try {
      const { db } = await import('@/lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');

      if (!db) {
        console.warn('Firebase not initialized, using default state');
        return;
      }

      const stateDoc = await getDoc(doc(db, 'podcast_scheduler', 'state'));

      if (stateDoc.exists()) {
        this.state = stateDoc.data() as SchedulerState;
      }
    } catch (error) {
      console.error('Error loading scheduler state from Firestore:', error);
      // Continue with default state
    }
  }

  /**
   * Save scheduler state to Firestore (async)
   */
  private async saveStateToFirestore(): Promise<void> {
    try {
      const { db } = await import('@/lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');

      if (!db) {
        console.warn('Firebase not initialized, cannot save state');
        return;
      }

      await setDoc(doc(db, 'podcast_scheduler', 'state'), this.state);
    } catch (error) {
      console.error('Error saving scheduler state to Firestore:', error);
    }
  }

  /**
   * Check if it's time to generate a new episode
   * Returns true if we haven't reached the daily limit (3 episodes per day)
   */
  shouldGenerateEpisode(): boolean {
    if (!this.schedule.enabled) {
      return false;
    }

    // Allow generation if no episodes exist yet
    if (this.state.episodes.length === 0) {
      return true;
    }

    // Get current date in Central Time
    const now = new Date();
    const todayInCentral = now.toLocaleString('en-US', {
      timeZone: this.schedule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // Count episodes generated today
    const episodesToday = this.state.episodes.filter(episode => {
      const episodeDate = new Date(episode.generated_at);
      const episodeDateInCentral = episodeDate.toLocaleString('en-US', {
        timeZone: this.schedule.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return episodeDateInCentral === todayInCentral;
    });

    const count = episodesToday.length;
    const limit = this.schedule.episodes_per_day;

    console.log(`📊 Podcast scheduler check: ${count}/${limit} episodes generated today (${todayInCentral} ${this.schedule.timezone})`);

    // Generate if we haven't hit the daily limit
    return count < limit;
  }

  /**
   * Get recently used guest IDs (to avoid repetition)
   */
  getRecentGuestIds(count: number = 4): string[] {
    return this.state.recent_guests.slice(-count);
  }

  /**
   * Record a new episode
   */
  async recordEpisode(guestId: string, videoId: string): Promise<number> {
    const episodeNumber = this.state.last_episode_number + 1;

    const episode: EpisodeRecord = {
      episode_number: episodeNumber,
      guest_id: guestId,
      generated_at: new Date().toISOString(),
      video_id: videoId,
      published: false
    };

    this.state.episodes.push(episode);
    this.state.last_episode_number = episodeNumber;

    // Update recent guests (keep last 4)
    this.state.recent_guests.push(guestId);
    if (this.state.recent_guests.length > 4) {
      this.state.recent_guests.shift();
    }

    await this.saveStateToFirestore();

    return episodeNumber;
  }

  /**
   * Mark episode as published
   */
  async markPublished(episodeNumber: number, youtubeUrl: string): Promise<void> {
    const episode = this.state.episodes.find(e => e.episode_number === episodeNumber);

    if (episode) {
      episode.published = true;
      episode.youtube_url = youtubeUrl;
      await this.saveStateToFirestore();
    }
  }

  /**
   * Get all episodes
   */
  getAllEpisodes(): EpisodeRecord[] {
    return this.state.episodes;
  }

  /**
   * Get episode by number
   */
  getEpisode(episodeNumber: number): EpisodeRecord | undefined {
    return this.state.episodes.find(e => e.episode_number === episodeNumber);
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      total_episodes: this.state.episodes.length,
      published_episodes: this.state.episodes.filter(e => e.published).length,
      last_episode_number: this.state.last_episode_number,
      recent_guests: this.state.recent_guests,
      schedule_enabled: this.schedule.enabled,
      next_scheduled: this.getNextScheduledDate()
    };
  }

  /**
   * Calculate next scheduled episode date
   */
  private getNextScheduledDate(): string {
    if (!this.schedule.enabled) {
      return 'Disabled';
    }

    if (this.state.episodes.length === 0) {
      return 'Immediately';
    }

    // Get current date in Central Time
    const now = new Date();
    const todayInCentral = now.toLocaleString('en-US', {
      timeZone: this.schedule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    // Count episodes generated today
    const episodesToday = this.state.episodes.filter(episode => {
      const episodeDate = new Date(episode.generated_at);
      const episodeDateInCentral = episodeDate.toLocaleString('en-US', {
        timeZone: this.schedule.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return episodeDateInCentral === todayInCentral;
    });

    const remaining = this.schedule.episodes_per_day - episodesToday.length;

    if (remaining > 0) {
      return `Immediately (${remaining} left today)`;
    }

    // All episodes for today generated, next one is tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
    return tomorrow.toISOString();
  }
}

export default PodcastScheduler;
