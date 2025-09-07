/**
 * OwnerFi Property System - Clean Architecture
 * 
 * PRINCIPLES:
 * 1. Buyer profiles store only preferences (cities, budget, requirements)
 * 2. Property matches are calculated and stored separately 
 * 3. Property actions (like/pass) are stored as immutable events
 * 4. Both buyers and realtors read from the same data sources
 */

export interface BuyerProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Search Preferences (Step 1)
  searchCriteria: {
    cities: string[];           // ["Jacksonville", "Orange Park", "Fleming Island"]
    state: string;              // "FL" 
    maxMonthlyPayment: number;  // 5500
    maxDownPayment: number;     // 300000
    minBedrooms?: number;       // 3
    minBathrooms?: number;      // 2
    searchRadius: number;       // 25
  };
  
  // Metadata
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyMatch {
  id: string;
  buyerId: string;
  propertyId: string;
  
  // Matching Info
  matchScore: number;         // 0-100 based on how well it matches criteria
  matchReasons: string[];     // ["budget_match", "location_match", "size_match"]
  
  // Status Tracking (Step 2)
  status: 'pending' | 'liked' | 'disliked' | 'archived';
  
  // Timestamps
  matchedAt: string;          // When property was first matched to buyer
  lastActionAt?: string;      // When buyer last interacted with property
  createdAt: string;
  updatedAt: string;
}

export interface PropertyAction {
  id: string;
  buyerId: string;
  propertyId: string;
  
  // Action Details
  action: 'like' | 'pass' | 'undo_like' | 'undo_pass';
  timestamp: string;
  
  // Context
  source: 'dashboard' | 'realtor_shared' | 'email_link';
  
  // Metadata
  createdAt: string;
}

/**
 * Property System Service
 */
export class PropertySystemService {
  
  /**
   * Step 1: Save buyer search preferences (simple, fast)
   */
  static async saveBuyerProfile(buyerId: string, profileData: Partial<BuyerProfile>): Promise<void> {
    // ONLY save profile data - no complex calculations
    // Trigger background matching job separately
  }
  
  /**
   * Step 2: Background job to calculate property matches
   */
  static async calculatePropertyMatches(buyerId: string): Promise<PropertyMatch[]> {
    // Run in background, not blocking user interactions
    // Calculate match scores and reasons
    // Store in separate 'propertyMatches' collection
  }
  
  /**
   * Step 3: Record property actions (immutable events)
   */
  static async recordPropertyAction(buyerId: string, propertyId: string, action: string): Promise<void> {
    // Store as immutable event in 'propertyActions' collection
    // Update current status in 'propertyMatches' collection
  }
  
  /**
   * Display: Get properties for buyer (dashboard view)
   */
  static async getBuyerProperties(buyerId: string, status?: string): Promise<Property[]> {
    // Read from propertyMatches collection with status filter
    // Fetch property details for matched IDs
    // Return full property objects
  }
  
  /**
   * Display: Get buyer's properties for realtor (realtor view) 
   */
  static async getBuyerPropertiesForRealtor(buyerId: string): Promise<Property[]> {
    // Identical logic to getBuyerProperties - same data source
    // Include buyer action status for each property
  }
  
  /**
   * Maintenance: Sync property matches when properties change
   */
  static async syncPropertyMatches(propertyId: string, action: 'add' | 'update' | 'delete'): Promise<void> {
    // Update all buyer matches when property database changes
  }
}