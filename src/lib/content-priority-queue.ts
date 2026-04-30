/**
 * Unified Content Priority Queue
 * 
 * Intelligently prioritizes content across all brands and sources
 * Ensures optimal content selection for video generation
 */

import { db } from './firebase-admin';
import { Brand } from '@/config/constants';

export interface ContentItem {
  id: string;
  type: 'rss_article' | 'social_trend' | 'property_batch' | 'manual_content';
  brand: Brand;
  title: string;
  content?: string;
  source: string;
  priority: number; // 1-100, higher = more priority
  qualityScore?: number;
  engagementScore?: number;
  timeDecay: number; // 0-1, how much priority decreases over time
  createdAt: number;
  expiresAt?: number;
  metadata: Record<string, any>;
  processed: boolean;
  locked?: {
    by: string;
    at: number;
    expiresAt: number;
  };
}

interface QueueFilters {
  brands?: Brand[];
  types?: ContentItem['type'][];
  minQuality?: number;
  maxAge?: number; // hours
  excludeProcessed?: boolean;
}

export class ContentPriorityQueue {
  private static readonly QUEUE_COLLECTION = 'content_priority_queue';
  private static readonly LOCK_TIMEOUT_MINUTES = 30;

  /**
   * Add content to the priority queue
   */
  static async addContent(content: Omit<ContentItem, 'id' | 'priority' | 'timeDecay' | 'processed'>): Promise<string> {
    const id = `${content.brand}_${content.type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const priority = this.calculatePriority(content);
    const timeDecay = this.calculateTimeDecay(content);
    
    const contentItem: ContentItem = {
      ...content,
      id,
      priority,
      timeDecay,
      processed: false
    };

    await db.collection(this.QUEUE_COLLECTION).doc(id).set(contentItem);
    
    console.log(`[Priority Queue] Added content: ${content.title} (priority: ${priority})`);
    return id;
  }

  /**
   * Get next highest priority content
   */
  static async getNextContent(
    filters?: QueueFilters,
    lockKey?: string
  ): Promise<ContentItem | null> {
    try {
      let query = db.collection(this.QUEUE_COLLECTION)
        .where('processed', '==', false);

      // Apply filters
      if (filters?.brands) {
        query = query.where('brand', 'in', filters.brands);
      }
      
      if (filters?.types) {
        query = query.where('type', 'in', filters.types);
      }

      if (filters?.minQuality) {
        query = query.where('qualityScore', '>=', filters.minQuality);
      }

      // Get candidates
      const snapshot = await query.limit(50).get();
      
      if (snapshot.empty) return null;

      let candidates = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as ContentItem[];

      // Filter by age if specified
      if (filters?.maxAge) {
        const maxAgeMs = filters.maxAge * 60 * 60 * 1000;
        const cutoff = Date.now() - maxAgeMs;
        candidates = candidates.filter(item => item.createdAt > cutoff);
      }

      // Filter out locked content
      candidates = candidates.filter(item => !this.isLocked(item));

      // Filter out expired content
      candidates = candidates.filter(item => !item.expiresAt || item.expiresAt > Date.now());

      if (candidates.length === 0) return null;

      // Calculate current priority (with time decay)
      candidates.forEach(item => {
        item.priority = this.getCurrentPriority(item);
      });

      // Sort by priority (highest first)
      candidates.sort((a, b) => b.priority - a.priority);

      const selected = candidates[0];

      // Lock the content if lockKey provided
      if (lockKey) {
        await this.lockContent(selected.id, lockKey);
        selected.locked = {
          by: lockKey,
          at: Date.now(),
          expiresAt: Date.now() + (this.LOCK_TIMEOUT_MINUTES * 60 * 1000)
        };
      }

      console.log(`[Priority Queue] Selected content: ${selected.title} (priority: ${selected.priority})`);
      return selected;

    } catch (error) {
      console.error('[Priority Queue] Failed to get next content:', error);
      return null;
    }
  }

  /**
   * Mark content as processed
   */
  static async markProcessed(
    contentId: string, 
    workflowId?: string, 
    result?: 'success' | 'failed'
  ): Promise<void> {
    try {
      const updates: any = {
        processed: true,
        processedAt: Date.now(),
        locked: null // Release lock
      };

      if (workflowId) updates.workflowId = workflowId;
      if (result) updates.result = result;

      await db.collection(this.QUEUE_COLLECTION).doc(contentId).update(updates);
      
      console.log(`[Priority Queue] Marked processed: ${contentId} (${result})`);
    } catch (error) {
      console.error('[Priority Queue] Failed to mark processed:', error);
    }
  }

  /**
   * Release lock on content
   */
  static async releaseLock(contentId: string): Promise<void> {
    try {
      await db.collection(this.QUEUE_COLLECTION).doc(contentId).update({
        locked: null
      });
    } catch (error) {
      console.error('[Priority Queue] Failed to release lock:', error);
    }
  }

  /**
   * Get queue stats
   */
  static async getQueueStats(brand?: Brand): Promise<{
    total: number;
    pending: number;
    processed: number;
    locked: number;
    expired: number;
    byType: Record<string, number>;
    byBrand: Record<string, number>;
  }> {
    let query: any = db.collection(this.QUEUE_COLLECTION);
    
    if (brand) {
      query = query.where('brand', '==', brand);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ContentItem[];

    const stats = {
      total: items.length,
      pending: items.filter(item => !item.processed && !this.isLocked(item)).length,
      processed: items.filter(item => item.processed).length,
      locked: items.filter(item => this.isLocked(item)).length,
      expired: items.filter(item => item.expiresAt && item.expiresAt < Date.now()).length,
      byType: {} as Record<string, number>,
      byBrand: {} as Record<string, number>
    };

    // Count by type
    items.forEach(item => {
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
      stats.byBrand[item.brand] = (stats.byBrand[item.brand] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clean up old/expired content
   */
  static async cleanup(olderThanDays: number = 30): Promise<number> {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const query = db.collection(this.QUEUE_COLLECTION)
      .where('processed', '==', true)
      .where('processedAt', '<', cutoff);

    const snapshot = await query.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    console.log(`[Priority Queue] Cleaned up ${snapshot.size} old items`);
    return snapshot.size;
  }

  /**
   * Calculate initial priority for content
   */
  private static calculatePriority(content: Partial<ContentItem>): number {
    let priority = 50; // Base priority

    // Quality score bonus (0-40 points)
    if (content.qualityScore) {
      priority += (content.qualityScore / 100) * 40;
    }

    // Engagement score bonus (0-30 points)
    if (content.engagementScore) {
      priority += (content.engagementScore / 100) * 30;
    }

    // Type-based priority
    switch (content.type) {
      case 'social_trend':
        priority += 20; // Trending content is high priority
        break;
      case 'rss_article':
        priority += 10; // Standard articles
        break;
      case 'property_batch':
        priority += 15; // Property content
        break;
      case 'manual_content':
        priority += 25; // Manual content is highest
        break;
    }

    // Brand-based priority (if needed)
    if (content.brand === 'ownerfi') {
      priority += 5; // Slight boost for main brand
    }

    return Math.min(Math.max(priority, 1), 100); // Clamp to 1-100
  }

  /**
   * Calculate time decay factor
   */
  private static calculateTimeDecay(content: Partial<ContentItem>): number {
    switch (content.type) {
      case 'social_trend':
        return 0.8; // High decay - trending content expires fast
      case 'rss_article':
        return 0.3; // Medium decay
      case 'property_batch':
        return 0.1; // Low decay - evergreen content
      case 'manual_content':
        return 0.2; // Low-medium decay
      default:
        return 0.5;
    }
  }

  /**
   * Calculate current priority with time decay
   */
  private static getCurrentPriority(item: ContentItem): number {
    const ageHours = (Date.now() - item.createdAt) / (1000 * 60 * 60);
    const decay = Math.pow(0.95, ageHours * item.timeDecay);
    return item.priority * decay;
  }

  /**
   * Check if content is locked
   */
  private static isLocked(item: ContentItem): boolean {
    if (!item.locked) return false;
    return item.locked.expiresAt > Date.now();
  }

  /**
   * Lock content
   */
  private static async lockContent(contentId: string, lockKey: string): Promise<void> {
    await db.collection(this.QUEUE_COLLECTION).doc(contentId).update({
      locked: {
        by: lockKey,
        at: Date.now(),
        expiresAt: Date.now() + (this.LOCK_TIMEOUT_MINUTES * 60 * 1000)
      }
    });
  }
}