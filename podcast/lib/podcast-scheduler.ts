// Weekly Podcast Scheduler
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ScheduleConfig {
  frequency: string;
  day_of_week: string;
  time: string;
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

export class PodcastScheduler {
  private configPath: string;
  private statePath: string;
  private schedule: ScheduleConfig;
  private state: SchedulerState;

  constructor() {
    this.configPath = join(process.cwd(), 'podcast', 'config', 'podcast-config.json');
    this.statePath = join(process.cwd(), 'podcast', 'config', 'scheduler-state.json');

    // Load configuration
    const config = JSON.parse(readFileSync(this.configPath, 'utf-8'));
    this.schedule = config.schedule;

    // Load or initialize state
    this.state = this.loadState();
  }

  /**
   * Load scheduler state from file
   */
  private loadState(): SchedulerState {
    if (existsSync(this.statePath)) {
      return JSON.parse(readFileSync(this.statePath, 'utf-8'));
    }

    // Initialize new state
    return {
      last_episode_number: 0,
      recent_guests: [],
      episodes: []
    };
  }

  /**
   * Save scheduler state to file
   */
  private saveState(): void {
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
  }

  /**
   * Check if it's time to generate a new episode
   */
  shouldGenerateEpisode(): boolean {
    if (!this.schedule.enabled) {
      return false;
    }

    const now = new Date();
    const lastEpisode = this.state.episodes[this.state.episodes.length - 1];

    if (!lastEpisode) {
      return true; // No episodes yet
    }

    const lastEpisodeDate = new Date(lastEpisode.generated_at);
    const daysSinceLastEpisode = (now.getTime() - lastEpisodeDate.getTime()) / (1000 * 60 * 60 * 24);

    if (this.schedule.frequency === 'weekly' && daysSinceLastEpisode >= 7) {
      return true;
    }

    return false;
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
  recordEpisode(guestId: string, videoId: string): number {
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

    this.saveState();

    return episodeNumber;
  }

  /**
   * Mark episode as published
   */
  markPublished(episodeNumber: number, youtubeUrl: string): void {
    const episode = this.state.episodes.find(e => e.episode_number === episodeNumber);

    if (episode) {
      episode.published = true;
      episode.youtube_url = youtubeUrl;
      this.saveState();
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

    const lastEpisode = this.state.episodes[this.state.episodes.length - 1];
    if (!lastEpisode) {
      return 'Immediately';
    }

    const lastDate = new Date(lastEpisode.generated_at);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + 7); // Add 1 week

    return nextDate.toISOString();
  }
}

export default PodcastScheduler;
