import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  serverTimestamp,
  GeoPoint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface AgentProfile {
  // Identity
  id: string;
  userId?: string; // Link to existing user if they claim profile
  
  // Basic Info
  name: string;
  photo?: string;
  licenseNumber?: string;
  licenseState: string;
  brokerageName?: string;
  
  // Contact
  phone?: string;
  email?: string;
  website?: string;
  
  // Location
  location?: GeoPoint;
  city?: string;
  state: string;
  zipCode?: string;
  serviceAreas: string[]; // ZIP codes or cities
  
  // Specializations
  specializations: string[]; // ['first-time-buyers', 'luxury', 'owner-finance', 'distressed']
  languages: string[]; // ['English', 'Spanish']
  
  // Ratings & Performance
  averageRating: number;
  totalReviews: number;
  ratingsBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  
  // Metrics
  recentSales: number;
  yearsExperience: number;
  responseTimeHours: number; // Average response time
  successRate: number; // % of deals closed
  
  // External Data
  zillowRating?: number;
  zillowReviews?: number;
  realtorRating?: number;
  realtorReviews?: number;
  
  // Platform Data
  leadsReceived: number;
  dealsCompleted: number;
  totalEarnings: number;
  joinedPlatform?: Date;
  
  // Status
  isActive: boolean;
  isVerified: boolean; // License verified
  isPremium: boolean; // Paying for premium features
  isFeatured: boolean; // Admin featured
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  lastScrapedAt?: Date;
}

export interface AgentReview {
  id: string;
  agentId: string;
  buyerId: string;
  buyerName: string;
  
  rating: number; // 1-5
  title?: string;
  comment: string;
  
  // Transaction Details
  propertyId?: string;
  propertyAddress?: string;
  transactionType: 'bought' | 'sold' | 'rented' | 'consultation';
  dealValue?: number;
  
  // Review Metadata
  isVerified: boolean; // Verified transaction
  helpfulVotes: number;
  reportCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export class AgentFirestoreService {
  private readonly AGENTS_COLLECTION = 'agentProfiles';
  private readonly REVIEWS_COLLECTION = 'agentReviews';
  
  /**
   * Create or update agent profile
   */
  async upsertAgentProfile(agent: Partial<AgentProfile>): Promise<void> {
    const docRef = doc(db, this.AGENTS_COLLECTION, agent.id!);
    
    await setDoc(docRef, {
      ...agent,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  
  /**
   * Get agent by ID
   */
  async getAgentById(agentId: string): Promise<AgentProfile | null> {
    const docRef = doc(db, this.AGENTS_COLLECTION, agentId);
    const snapshot = await getDoc(docRef);
    
    if (!snapshot.exists()) return null;
    
    return snapshot.data() as AgentProfile;
  }
  
  /**
   * Search agents by location with filters
   */
  async searchAgents(params: {
    city?: string;
    state?: string;
    zipCode?: string;
    specializations?: string[];
    minRating?: number;
    maxResults?: number;
    sortBy?: 'rating' | 'reviews' | 'experience';
  }): Promise<AgentProfile[]> {
    let q = query(collection(db, this.AGENTS_COLLECTION));
    
    // Add filters
    if (params.state) {
      q = query(q, where('state', '==', params.state));
    }
    
    if (params.city) {
      q = query(q, where('city', '==', params.city));
    }
    
    if (params.zipCode) {
      q = query(q, where('serviceAreas', 'array-contains', params.zipCode));
    }
    
    if (params.specializations && params.specializations.length > 0) {
      q = query(q, where('specializations', 'array-contains-any', params.specializations));
    }
    
    if (params.minRating) {
      q = query(q, where('averageRating', '>=', params.minRating));
    }
    
    // Only show active agents
    q = query(q, where('isActive', '==', true));
    
    // Sort
    switch (params.sortBy) {
      case 'rating':
        q = query(q, orderBy('averageRating', 'desc'));
        break;
      case 'reviews':
        q = query(q, orderBy('totalReviews', 'desc'));
        break;
      case 'experience':
        q = query(q, orderBy('yearsExperience', 'desc'));
        break;
      default:
        q = query(q, orderBy('averageRating', 'desc'));
    }
    
    // Limit results
    if (params.maxResults) {
      q = query(q, limit(params.maxResults));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as AgentProfile));
  }
  
  /**
   * Get featured agents for homepage
   */
  async getFeaturedAgents(limit: number = 6): Promise<AgentProfile[]> {
    const q = query(
      collection(db, this.AGENTS_COLLECTION),
      where('isFeatured', '==', true),
      where('isActive', '==', true),
      orderBy('averageRating', 'desc'),
      limit
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as AgentProfile));
  }
  
  /**
   * Add review for agent
   */
  async addAgentReview(review: Omit<AgentReview, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = doc(collection(db, this.REVIEWS_COLLECTION));
    
    await setDoc(docRef, {
      ...review,
      id: docRef.id,
      helpfulVotes: 0,
      reportCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Update agent's rating
    await this.updateAgentRating(review.agentId);
    
    return docRef.id;
  }
  
  /**
   * Get reviews for agent
   */
  async getAgentReviews(
    agentId: string, 
    limit: number = 10
  ): Promise<AgentReview[]> {
    const q = query(
      collection(db, this.REVIEWS_COLLECTION),
      where('agentId', '==', agentId),
      orderBy('createdAt', 'desc'),
      limit
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as AgentReview);
  }
  
  /**
   * Update agent rating based on reviews
   */
  private async updateAgentRating(agentId: string): Promise<void> {
    // Get all reviews for agent
    const q = query(
      collection(db, this.REVIEWS_COLLECTION),
      where('agentId', '==', agentId)
    );
    
    const snapshot = await getDocs(q);
    const reviews = snapshot.docs.map(doc => doc.data() as AgentReview);
    
    if (reviews.length === 0) return;
    
    // Calculate rating breakdown
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;
    
    reviews.forEach(review => {
      breakdown[review.rating as keyof typeof breakdown]++;
      totalRating += review.rating;
    });
    
    const averageRating = totalRating / reviews.length;
    
    // Update agent profile
    const agentRef = doc(db, this.AGENTS_COLLECTION, agentId);
    await updateDoc(agentRef, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalReviews: reviews.length,
      ratingsBreakdown: breakdown,
      updatedAt: serverTimestamp(),
    });
  }
  
  /**
   * Track agent performance metrics
   */
  async updateAgentMetrics(agentId: string, metrics: {
    responseTime?: number;
    dealCompleted?: boolean;
    leadReceived?: boolean;
  }): Promise<void> {
    const agentRef = doc(db, this.AGENTS_COLLECTION, agentId);
    const agent = await this.getAgentById(agentId);
    
    if (!agent) return;
    
    const updates: any = {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    if (metrics.responseTime !== undefined) {
      // Calculate new average response time
      const totalResponses = agent.leadsReceived || 1;
      const currentAvg = agent.responseTimeHours || 24;
      updates.responseTimeHours = 
        (currentAvg * totalResponses + metrics.responseTime) / (totalResponses + 1);
    }
    
    if (metrics.dealCompleted) {
      updates.dealsCompleted = (agent.dealsCompleted || 0) + 1;
      updates.successRate = 
        ((agent.dealsCompleted || 0) + 1) / (agent.leadsReceived || 1) * 100;
    }
    
    if (metrics.leadReceived) {
      updates.leadsReceived = (agent.leadsReceived || 0) + 1;
    }
    
    await updateDoc(agentRef, updates);
  }
}