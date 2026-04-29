/**
 * Agent Tracking System - Database Integration
 * 
 * Persistent storage for agent data to track rating/review changes over time
 * and maintain fresh data across server restarts
 */

import { db as firebaseDb } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  serverTimestamp 
} from 'firebase/firestore';

export interface AgentRecord {
  id: string; // google_${place_id}
  placeId: string;
  name: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Current metrics (updated on each refresh)
  rating: number;
  reviewCount: number;
  isActive: boolean;
  isFeatured: boolean;
  specializations: string[];
  
  // Tracking data
  firstSeen: any; // Timestamp
  lastUpdated: any; // Timestamp
  totalUpdates: number;
  
  // Historical tracking for change detection
  ratingHistory?: Array<{
    rating: number;
    reviewCount: number;
    timestamp: any;
  }>;
  
  // Google API data
  googleMapsUrl: string;
  photo?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface CityAgentCache {
  id: string; // ${city}-${state}
  city: string;
  state: string;
  agentIds: string[]; // Array of agent IDs for this city
  lastRefreshed: any; // Timestamp
  version: number;
  totalAgents: number;
}

/**
 * Save or update agent in database
 */
export async function saveAgent(agentData: Omit<AgentRecord, 'firstSeen' | 'lastUpdated' | 'totalUpdates'>): Promise<void> {
  if (!firebaseDb) {
    throw new Error('Firebase not initialized');
  }

  try {
    const agentRef = doc(firebaseDb, 'agents', agentData.id);
    const existingAgent = await getDoc(agentRef);
    
    if (existingAgent.exists()) {
      // UPDATE existing agent
      const existing = existingAgent.data() as AgentRecord;
      
      // Detect rating changes for historical tracking
      const ratingChanged = existing.rating !== agentData.rating || 
                           existing.reviewCount !== agentData.reviewCount;
      
      let updatedHistory = existing.ratingHistory || [];
      
      if (ratingChanged) {
        // Keep last 10 rating changes
        updatedHistory = [
          ...updatedHistory.slice(-9),
          {
            rating: agentData.rating,
            reviewCount: agentData.reviewCount,
            timestamp: serverTimestamp()
          }
        ];
        
        console.log(`[Agent Tracking] Rating change detected for ${agentData.name}: ${existing.rating}→${agentData.rating} (${existing.reviewCount}→${agentData.reviewCount} reviews)`);
      }
      
      await updateDoc(agentRef, {
        ...agentData,
        lastUpdated: serverTimestamp(),
        totalUpdates: (existing.totalUpdates || 0) + 1,
        ratingHistory: updatedHistory
      });
    } else {
      // CREATE new agent
      await setDoc(agentRef, {
        ...agentData,
        firstSeen: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        totalUpdates: 1,
        ratingHistory: [{
          rating: agentData.rating,
          reviewCount: agentData.reviewCount,
          timestamp: serverTimestamp()
        }]
      });
      
      console.log(`[Agent Tracking] New agent tracked: ${agentData.name} (${agentData.rating}★, ${agentData.reviewCount} reviews)`);
    }
  } catch (error) {
    console.error('Error saving agent:', error);
    throw error;
  }
}

/**
 * Get agents for a city from database (for comparison with fresh data)
 */
export async function getCityAgents(city: string, state: string): Promise<AgentRecord[]> {
  if (!firebaseDb) {
    console.warn('Firebase not initialized - returning empty agents array');
    return [];
  }

  try {
    const agentsQuery = query(
      collection(firebaseDb, 'agents'),
      where('city', '==', city.toLowerCase()),
      where('state', '==', state.toUpperCase()),
      where('isActive', '==', true),
      orderBy('rating', 'desc'),
      orderBy('reviewCount', 'desc'),
      firestoreLimit(20)
    );
    
    const agentDocs = await getDocs(agentsQuery);
    return agentDocs.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as AgentRecord));
  } catch (error) {
    console.error('Error fetching city agents:', error);
    return [];
  }
}

/**
 * Update city cache metadata
 */
export async function updateCityCache(city: string, state: string, agentIds: string[]): Promise<void> {
  if (!firebaseDb) {
    console.warn('Firebase not initialized - skipping city cache update');
    return;
  }

  try {
    const cacheKey = `${city.toLowerCase()}-${state.toLowerCase()}`;
    const cacheRef = doc(firebaseDb, 'agent_cache', cacheKey);
    const existingCache = await getDoc(cacheRef);
    
    const previousVersion = existingCache.exists() ? 
      (existingCache.data() as CityAgentCache).version || 0 : 0;
    
    await setDoc(cacheRef, {
      id: cacheKey,
      city: city.toLowerCase(),
      state: state.toUpperCase(),
      agentIds: agentIds,
      lastRefreshed: serverTimestamp(),
      version: previousVersion + 1,
      totalAgents: agentIds.length
    });
    
    console.log(`[Agent Tracking] Updated city cache for ${cacheKey}: ${agentIds.length} agents (v${previousVersion + 1})`);
  } catch (error) {
    console.error('Error updating city cache:', error);
  }
}

/**
 * Get agents that have improved ratings since last check
 */
export async function getImprovedAgents(city: string, state: string, sinceDays: number = 7): Promise<AgentRecord[]> {
  if (!firebaseDb) {
    return [];
  }

  try {
    const agentsQuery = query(
      collection(firebaseDb, 'agents'),
      where('city', '==', city.toLowerCase()),
      where('state', '==', state.toUpperCase()),
      where('isActive', '==', true)
    );
    
    const agentDocs = await getDocs(agentsQuery);
    const improvedAgents: AgentRecord[] = [];
    
    const cutoffTime = Date.now() - (sinceDays * 24 * 60 * 60 * 1000);
    
    agentDocs.docs.forEach(doc => {
      const agent = doc.data() as AgentRecord;
      const history = agent.ratingHistory || [];
      
      if (history.length >= 2) {
        const recentChanges = history.filter(h => 
          h.timestamp?.toMillis && h.timestamp.toMillis() > cutoffTime
        );
        
        if (recentChanges.length > 0) {
          const oldRating = history[history.length - 2].rating;
          const newRating = agent.rating;
          
          if (newRating > oldRating || 
              (newRating === oldRating && agent.reviewCount > history[history.length - 2].reviewCount)) {
            improvedAgents.push(agent);
          }
        }
      }
    });
    
    return improvedAgents.sort((a, b) => b.rating - a.rating);
  } catch (error) {
    console.error('Error finding improved agents:', error);
    return [];
  }
}

/**
 * Check if city data needs refresh based on database staleness
 */
export async function needsRefresh(city: string, state: string, maxAgeMinutes: number = 15): Promise<boolean> {
  if (!firebaseDb) {
    return true; // Refresh if no database
  }

  try {
    const cacheKey = `${city.toLowerCase()}-${state.toLowerCase()}`;
    const cacheRef = doc(firebaseDb, 'agent_cache', cacheKey);
    const cacheDoc = await getDoc(cacheRef);
    
    if (!cacheDoc.exists()) {
      return true; // No cache, needs refresh
    }
    
    const cache = cacheDoc.data() as CityAgentCache;
    const ageMs = Date.now() - cache.lastRefreshed?.toMillis();
    const maxAgeMs = maxAgeMinutes * 60 * 1000;
    
    return ageMs > maxAgeMs;
  } catch (error) {
    console.error('Error checking refresh needs:', error);
    return true; // Refresh on error
  }
}