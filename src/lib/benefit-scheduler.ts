/**
 * Benefit Video Scheduler - BUYER-ONLY
 *
 * Simple, reliable daily video scheduler:
 * - 5 buyer videos per day
 * - Atomic Firestore operations (no race conditions)
 * - Tracks videos by UTC date (no timezone bugs)
 */

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

const VIDEOS_PER_DAY = 5;
const SCHEDULER_DOC = 'benefit_scheduler/state';

export interface DailyState {
  date: string; // YYYY-MM-DD in UTC
  videosGenerated: number;
  recentBenefitIds: string[]; // Last 5 used
  lastUpdated: any; // Firestore timestamp
}

export class BenefitScheduler {
  /**
   * Get today's date in UTC (YYYY-MM-DD format)
   */
  private static getTodayUTC(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Load current state from Firestore
   */
  static async loadState(): Promise<DailyState> {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const docRef = doc(db, SCHEDULER_DOC);
    const docSnap = await getDoc(docRef);

    const today = this.getTodayUTC();

    if (!docSnap.exists()) {
      // First run - create initial state
      const initialState: DailyState = {
        date: today,
        videosGenerated: 0,
        recentBenefitIds: [],
        lastUpdated: serverTimestamp()
      };
      await setDoc(docRef, initialState);
      return initialState;
    }

    const state = docSnap.data() as DailyState;

    // If it's a new day, reset counter
    if (state.date !== today) {
      const resetState: DailyState = {
        date: today,
        videosGenerated: 0,
        recentBenefitIds: state.recentBenefitIds || [], // Keep recent IDs across days (or empty array if undefined)
        lastUpdated: serverTimestamp()
      };
      await setDoc(docRef, resetState);
      return resetState;
    }

    return state;
  }

  /**
   * Check how many videos we still need today
   */
  static async getVideosNeeded(): Promise<number> {
    const state = await this.loadState();
    return Math.max(0, VIDEOS_PER_DAY - state.videosGenerated);
  }

  /**
   * Atomically claim a video slot (prevents race conditions)
   * Returns true if successful, false if daily limit reached
   */
  static async claimVideoSlot(benefitId: string): Promise<boolean> {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const state = await this.loadState();

    // Check if we've hit the daily limit
    if (state.videosGenerated >= VIDEOS_PER_DAY) {
      return false;
    }

    // Atomically increment counter and update recent IDs
    const docRef = doc(db, SCHEDULER_DOC);

    // Add to recent IDs (keep last 5)
    const updatedRecent = [...state.recentBenefitIds, benefitId].slice(-5);

    await updateDoc(docRef, {
      videosGenerated: increment(1),
      recentBenefitIds: updatedRecent,
      lastUpdated: serverTimestamp()
    });

    console.log(`✅ Claimed video slot ${state.videosGenerated + 1}/${VIDEOS_PER_DAY} for benefit ${benefitId}`);
    return true;
  }

  /**
   * Get recently used benefit IDs (to avoid repetition)
   */
  static async getRecentBenefitIds(): Promise<string[]> {
    const state = await this.loadState();
    return state.recentBenefitIds || [];
  }

  /**
   * Get current stats (for dashboard/monitoring)
   */
  static async getStats() {
    const state = await this.loadState();
    const needed = await this.getVideosNeeded();

    return {
      date: state.date,
      videosGenerated: state.videosGenerated,
      videosNeeded: needed,
      dailyLimit: VIDEOS_PER_DAY,
      recentBenefitIds: state.recentBenefitIds,
      lastUpdated: state.lastUpdated
    };
  }

  /**
   * Force reset (for testing/debugging only)
   */
  static async forceReset(): Promise<void> {
    if (!db) {
      throw new Error('Firebase not initialized');
    }

    const docRef = doc(db, SCHEDULER_DOC);
    await setDoc(docRef, {
      date: this.getTodayUTC(),
      videosGenerated: 0,
      recentBenefitIds: [],
      lastUpdated: serverTimestamp()
    });

    console.log('⚠️  Scheduler state force reset');
  }
}
