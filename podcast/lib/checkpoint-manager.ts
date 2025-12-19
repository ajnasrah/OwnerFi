// Checkpoint Manager - Save progress and enable recovery
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';

export interface CheckpointData {
  episode_number: number;
  timestamp: string;
  step: 'script' | 'video' | 'submagic' | 'publish' | 'completed';
  data: {
    script?: Record<string, unknown>;
    videoUrl?: string;
    videoId?: string;
    clips?: Record<string, unknown>[];
    publishResult?: Record<string, unknown>;
  };
  error?: string;
  retries?: number;
}

export class CheckpointManager {
  private checkpointDir: string;
  private maxRetries: number = 3;

  constructor(checkpointDir?: string) {
    this.checkpointDir = checkpointDir || join(process.cwd(), 'podcast', 'checkpoints');

    if (!existsSync(this.checkpointDir)) {
      mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  /**
   * Save checkpoint
   */
  saveCheckpoint(episodeNumber: number, step: CheckpointData['step'], data: CheckpointData['data'], error?: string): void {
    const checkpoint: CheckpointData = {
      episode_number: episodeNumber,
      timestamp: new Date().toISOString(),
      step,
      data,
      error,
      retries: 0
    };

    // If checkpoint exists, increment retries
    const existing = this.loadCheckpoint(episodeNumber);
    if (existing && existing.step === step) {
      checkpoint.retries = (existing.retries || 0) + 1;
    }

    const filePath = join(this.checkpointDir, `episode-${episodeNumber}.json`);
    writeFileSync(filePath, JSON.stringify(checkpoint, null, 2));

    console.log(`💾 Checkpoint saved: Episode ${episodeNumber} - ${step}`);
  }

  /**
   * Load checkpoint
   */
  loadCheckpoint(episodeNumber: number): CheckpointData | null {
    const filePath = join(this.checkpointDir, `episode-${episodeNumber}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Error loading checkpoint for episode ${episodeNumber}:`, error);
      return null;
    }
  }

  /**
   * Check if episode can be retried
   */
  canRetry(checkpoint: CheckpointData): boolean {
    return (checkpoint.retries || 0) < this.maxRetries;
  }

  /**
   * Mark checkpoint as completed
   */
  markCompleted(episodeNumber: number, finalData: CheckpointData['data']): void {
    this.saveCheckpoint(episodeNumber, 'completed', finalData);
  }

  /**
   * Delete checkpoint (after successful completion)
   */
  deleteCheckpoint(episodeNumber: number): void {
    const filePath = join(this.checkpointDir, `episode-${episodeNumber}.json`);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`🗑️  Checkpoint deleted: Episode ${episodeNumber}`);
    }
  }

  /**
   * Get all incomplete episodes
   */
  getIncompleteEpisodes(): CheckpointData[] {
    const files = readdirSync(this.checkpointDir).filter((f: string) => f.endsWith('.json'));

    const incomplete: CheckpointData[] = [];

    for (const file of files) {
      const filePath = join(this.checkpointDir, file);
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf-8'));
        if (data.step !== 'completed') {
          incomplete.push(data);
        }
      } catch (error) {
        console.error(`Error reading checkpoint ${file}:`, error);
      }
    }

    return incomplete;
  }

  /**
   * Resume episode from checkpoint
   */
  async resumeEpisode(
    checkpoint: CheckpointData,
    handlers: {
      onScript?: (checkpoint: CheckpointData) => Promise<void>;
      onVideo?: (checkpoint: CheckpointData) => Promise<void>;
      onSubmagic?: (checkpoint: CheckpointData) => Promise<void>;
      onPublish?: (checkpoint: CheckpointData) => Promise<void>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.canRetry(checkpoint)) {
      console.error(`❌ Max retries exceeded for episode ${checkpoint.episode_number}`);
      return {
        success: false,
        error: `Max retries (${this.maxRetries}) exceeded`
      };
    }

    console.log(`\n🔄 Resuming Episode ${checkpoint.episode_number} from step: ${checkpoint.step}`);
    console.log(`   Attempt ${(checkpoint.retries || 0) + 1}/${this.maxRetries}\n`);

    try {
      switch (checkpoint.step) {
        case 'script':
          if (handlers.onScript) {
            await handlers.onScript(checkpoint);
          }
          break;

        case 'video':
          if (handlers.onVideo) {
            await handlers.onVideo(checkpoint);
          }
          break;

        case 'submagic':
          if (handlers.onSubmagic) {
            await handlers.onSubmagic(checkpoint);
          }
          break;

        case 'publish':
          if (handlers.onPublish) {
            await handlers.onPublish(checkpoint);
          }
          break;

        default:
          console.log(`Unknown step: ${checkpoint.step}`);
      }

      return { success: true };

    } catch (error) {
      console.error(`❌ Resume failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get recovery stats
   */
  getStats(): {
    incomplete: number;
    needsRetry: number;
    failedPermanently: number;
  } {
    const incomplete = this.getIncompleteEpisodes();

    return {
      incomplete: incomplete.length,
      needsRetry: incomplete.filter(c => this.canRetry(c)).length,
      failedPermanently: incomplete.filter(c => !this.canRetry(c)).length
    };
  }
}

export default CheckpointManager;
