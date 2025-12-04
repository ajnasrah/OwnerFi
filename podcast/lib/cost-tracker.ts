// Cost Tracker - Monitor API usage and spending
import { writeFileSync, readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

interface CostEntry {
  timestamp: string;
  episode_number: number;
  service: 'openai' | 'heygen' | 'submagic' | 'metricool';
  operation: string;
  cost_usd?: number;
  tokens_used?: number;
  duration_seconds?: number;
  success: boolean;
  error?: string;
}

interface CostSummary {
  total_cost_usd: number;
  episodes_generated: number;
  average_cost_per_episode: number;
  costs_by_service: {
    [service: string]: number;
  };
  last_30_days_cost: number;
}

export class CostTracker {
  private logFile: string;
  private summaryFile: string;

  // Estimated costs (update based on actual pricing)
  private costs = {
    openai: {
      gpt4o_per_1k_tokens: 0.0025, // $2.50 per 1M tokens input
      gpt4o_output_per_1k_tokens: 0.01 // $10 per 1M tokens output
    },
    heygen: {
      per_second: 0.003, // ~$0.18 per minute
      multi_scene_batch_discount: 0.9 // 10% discount for batched requests (estimated)
    },
    submagic: {
      per_video: 0.50, // ~$0.50 per video processed
      per_clip: 0.10 // ~$0.10 per clip exported
    },
    metricool: {
      per_post: 0 // Included in subscription
    }
  };

  constructor(logDir?: string) {
    const dir = logDir || join(process.cwd(), 'podcast', 'logs');

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.logFile = join(dir, 'cost-log.jsonl');
    this.summaryFile = join(dir, 'cost-summary.json');
  }

  /**
   * Log a cost entry
   */
  logCost(entry: Omit<CostEntry, 'timestamp'>): void {
    const fullEntry: CostEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    // Append to log file (JSONL format)
    appendFileSync(this.logFile, JSON.stringify(fullEntry) + '\n');

    // Update summary
    this.updateSummary(fullEntry);

    if (fullEntry.cost_usd) {
      console.log(`💰 Cost logged: ${fullEntry.service} - $${fullEntry.cost_usd.toFixed(4)}`);
    }
  }

  /**
   * Track OpenAI usage
   */
  logOpenAI(episodeNumber: number, tokensUsed: number, success: boolean, error?: string): void {
    const cost = (tokensUsed / 1000) * (this.costs.openai.gpt4o_per_1k_tokens + this.costs.openai.gpt4o_output_per_1k_tokens);

    this.logCost({
      episode_number: episodeNumber,
      service: 'openai',
      operation: 'generate_script',
      cost_usd: cost,
      tokens_used: tokensUsed,
      success,
      error
    });
  }

  /**
   * Track HeyGen usage (optimized single API call)
   */
  logHeyGen(episodeNumber: number, durationSeconds: number, sceneCount: number, success: boolean, error?: string): void {
    const baseCost = durationSeconds * this.costs.heygen.per_second;
    const optimizedCost = baseCost * this.costs.heygen.multi_scene_batch_discount;

    this.logCost({
      episode_number: episodeNumber,
      service: 'heygen',
      operation: `generate_video_${sceneCount}_scenes`,
      cost_usd: optimizedCost,
      duration_seconds: durationSeconds,
      success,
      error
    });

    const savings = baseCost - optimizedCost;
    console.log(`💡 Saved $${savings.toFixed(2)} by using single API call (10 scenes batched)`);
  }

  /**
   * Track Submagic usage
   */
  logSubmagic(episodeNumber: number, clipsGenerated: number, success: boolean, error?: string): void {
    const cost = this.costs.submagic.per_video + (clipsGenerated * this.costs.submagic.per_clip);

    this.logCost({
      episode_number: episodeNumber,
      service: 'submagic',
      operation: `process_and_split_${clipsGenerated}_clips`,
      cost_usd: cost,
      success,
      error
    });
  }

  /**
   * Track Metricool posting
   */
  logMetricool(episodeNumber: number, platformCount: number, success: boolean, error?: string): void {
    this.logCost({
      episode_number: episodeNumber,
      service: 'metricool',
      operation: `publish_${platformCount}_platforms`,
      cost_usd: 0, // Included in subscription
      success,
      error
    });
  }

  /**
   * Update cost summary
   */
  private updateSummary(entry: CostEntry): void {
    let summary: CostSummary;

    if (existsSync(this.summaryFile)) {
      summary = JSON.parse(readFileSync(this.summaryFile, 'utf-8'));
    } else {
      summary = {
        total_cost_usd: 0,
        episodes_generated: 0,
        average_cost_per_episode: 0,
        costs_by_service: {},
        last_30_days_cost: 0
      };
    }

    // Update totals
    if (entry.cost_usd) {
      summary.total_cost_usd += entry.cost_usd;

      if (!summary.costs_by_service[entry.service]) {
        summary.costs_by_service[entry.service] = 0;
      }
      summary.costs_by_service[entry.service] += entry.cost_usd;
    }

    // Track episode count
    const episodeSet = new Set(this.getAllEpisodeNumbers());
    summary.episodes_generated = episodeSet.size;

    // Calculate average
    if (summary.episodes_generated > 0) {
      summary.average_cost_per_episode = summary.total_cost_usd / summary.episodes_generated;
    }

    // Calculate last 30 days cost
    summary.last_30_days_cost = this.getLast30DaysCost();

    writeFileSync(this.summaryFile, JSON.stringify(summary, null, 2));
  }

  /**
   * Get all episode numbers from log
   */
  private getAllEpisodeNumbers(): number[] {
    if (!existsSync(this.logFile)) {
      return [];
    }

    const lines = readFileSync(this.logFile, 'utf-8').split('\n').filter(l => l.trim());
    const episodes = lines.map(line => {
      try {
        return JSON.parse(line).episode_number;
      } catch {
        return null;
      }
    }).filter(n => n !== null);

    return episodes;
  }

  /**
   * Calculate cost for last 30 days
   */
  private getLast30DaysCost(): number {
    if (!existsSync(this.logFile)) {
      return 0;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const lines = readFileSync(this.logFile, 'utf-8').split('\n').filter(l => l.trim());
    let total = 0;

    for (const line of lines) {
      try {
        const entry: CostEntry = JSON.parse(line);
        const entryDate = new Date(entry.timestamp);

        if (entryDate >= thirtyDaysAgo && entry.cost_usd) {
          total += entry.cost_usd;
        }
      } catch {
        // Skip invalid lines
      }
    }

    return total;
  }

  /**
   * Get cost summary
   */
  getSummary(): CostSummary {
    if (!existsSync(this.summaryFile)) {
      return {
        total_cost_usd: 0,
        episodes_generated: 0,
        average_cost_per_episode: 0,
        costs_by_service: {},
        last_30_days_cost: 0
      };
    }

    return JSON.parse(readFileSync(this.summaryFile, 'utf-8'));
  }

  /**
   * Get cost report for episode
   */
  getEpisodeCost(episodeNumber: number): { total: number; breakdown: any } {
    if (!existsSync(this.logFile)) {
      return { total: 0, breakdown: {} };
    }

    const lines = readFileSync(this.logFile, 'utf-8').split('\n').filter(l => l.trim());
    let total = 0;
    const breakdown: any = {};

    for (const line of lines) {
      try {
        const entry: CostEntry = JSON.parse(line);

        if (entry.episode_number === episodeNumber && entry.cost_usd) {
          total += entry.cost_usd;

          if (!breakdown[entry.service]) {
            breakdown[entry.service] = 0;
          }
          breakdown[entry.service] += entry.cost_usd;
        }
      } catch {
        // Skip invalid lines
      }
    }

    return { total, breakdown };
  }

  /**
   * Print cost report
   */
  printReport(): void {
    const summary = this.getSummary();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              PODCAST COST REPORT                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log(`📊 Total Episodes Generated: ${summary.episodes_generated}`);
    console.log(`💰 Total Cost: $${summary.total_cost_usd.toFixed(2)}`);
    console.log(`📈 Average per Episode: $${summary.average_cost_per_episode.toFixed(2)}`);
    console.log(`📅 Last 30 Days: $${summary.last_30_days_cost.toFixed(2)}\n`);

    console.log('💵 Cost Breakdown by Service:\n');
    for (const [service, cost] of Object.entries(summary.costs_by_service)) {
      console.log(`   ${service.padEnd(12)}: $${(cost as number).toFixed(2)}`);
    }
    console.log();
  }
}

export default CostTracker;
