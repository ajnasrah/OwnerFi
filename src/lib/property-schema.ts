// Comprehensive Property Database Schema for OwnerFi Platform

export interface PropertyListing {
  // Core Identification
  id: string;                          // Unique property ID
  mlsNumber?: string;                  // MLS listing number (if available)
  ghlContactId?: string;               // GoHighLevel contact ID for lead tracking
  
  // Address & Location
  address: string;                     // Street address
  city: string;                        // City name
  state: string;                       // State abbreviation (TX, FL, GA)
  zipCode: string;                     // ZIP code
  latitude?: number;                   // GPS coordinates for mapping
  longitude?: number;                  // GPS coordinates for mapping
  county?: string;                     // County name
  neighborhood?: string;               // Neighborhood/subdivision name
  nearbyCities?: string[];             // Cities within 30-mile radius for similar property searches
  
  // Property Details
  propertyType: 'single-family' | 'condo' | 'townhouse' | 'mobile-home' | 'multi-family' | 'land';
  bedrooms: number;                    // Number of bedrooms
  bathrooms: number;                   // Number of bathrooms (0.5 for half bath)
  squareFeet?: number;                 // Interior square footage
  lotSize?: number;                    // Lot size in square feet
  yearBuilt?: number;                  // Year constructed
  stories?: number;                    // Number of stories/levels
  garage?: number;                     // Number of garage spaces
  
  // Financial Information - Owner Financing
  listPrice: number;                   // Total property price
  downPaymentAmount: number;           // Required down payment ($)
  downPaymentPercent: number;          // Down payment as percentage (10%, 5%, etc.)
  monthlyPayment: number;              // Monthly payment amount
  interestRate: number;                // Owner financing interest rate
  termYears: number;                   // Financing term in years
  balloonPayment?: number;             // Balloon payment amount (if applicable)
  balloonYears?: number;               // Years until balloon payment due
  
  // Property Features
  features?: string[];                 // Array of features ['hardwood floors', 'updated kitchen', 'pool']
  appliances?: string[];               // Included appliances ['refrigerator', 'washer', 'dryer']
  heating?: string;                    // Heating type (gas, electric, etc.)
  cooling?: string;                    // AC type (central, window units, etc.)
  parking?: string;                    // Parking description
  
  // Media
  imageUrls: string[];                 // Array of property photo URLs
  virtualTourUrl?: string;             // 360° tour or video link
  floorPlanUrl?: string;              // Floor plan image URL
  
  // Description & Marketing
  title?: string;                      // Marketing title/headline
  description: string;                 // Property description
  highlights?: string[];               // Key selling points
  
  // Owner/Contact Information  
  ownerName?: string;                  // Property owner name
  ownerPhone?: string;                 // Owner contact phone
  ownerEmail?: string;                 // Owner contact email
  agentName?: string;                  // Listing agent name
  agentPhone?: string;                 // Agent phone
  agentEmail?: string;                 // Agent email
  
  // Listing Management
  status: 'active' | 'pending' | 'sold' | 'withdrawn' | 'expired';
  dateAdded: string;                   // ISO date when added to platform
  lastUpdated: string;                 // ISO date of last update
  expirationDate?: string;             // When listing expires
  priority: number;                    // Display priority (1-10, higher = more prominent)
  featured: boolean;                   // Whether to highlight in searches
  
  // Location Analytics
  distanceToCenter?: number;           // Miles from search center (calculated)
  walkScore?: number;                  // Walk score (if available)
  schoolRating?: number;               // School district rating
  
  // Market Data
  estimatedValue?: number;             // Market value estimate
  pricePerSqFt?: number;              // Price per square foot
  daysOnMarket?: number;               // Days since listed
  viewCount?: number;                  // Number of times viewed
  favoriteCount?: number;              // Number of users who favorited
  
  // Compliance & Legal
  disclosures?: string[];              // Required disclosures
  hoa?: {
    hasHOA: boolean;
    monthlyFee?: number;
    restrictions?: string[];
  };
  taxes?: {
    annualAmount: number;
    assessedValue?: number;
  };
  
  // Integration Data
  source: 'manual' | 'ghl-webhook' | 'import' | 'scraper';
  sourceId?: string;                   // Original ID from source system
  ghlData?: {                          // Raw GoHighLevel data
    contactId: string;
    opportunityId?: string;
    customFields?: Record<string, any>;
    tags?: string[];
  };
}

// Database schema for property filtering and search
export interface PropertySearchCriteria {
  // Location
  centerCity: string;
  centerState: string;
  searchRadius: number;                // Miles
  
  // Budget constraints
  maxMonthlyPayment: number;
  maxDownPayment: number;
  minPrice?: number;
  maxPrice?: number;
  
  // Property requirements
  minBedrooms?: number;
  minBathrooms?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  minLotSize?: number;
  
  // Property type preferences
  propertyTypes: string[];             // Array of acceptable types
  maxYearBuilt?: number;               // No older than this year
  minYearBuilt?: number;               // No newer than this year
  
  // Features
  requiredFeatures?: string[];         // Must-have features
  preferredFeatures?: string[];        // Nice-to-have features
  excludeFeatures?: string[];          // Deal-breakers
  
  // Special requirements
  petsAllowed?: boolean;
  noHOA?: boolean;
  maxHOAFee?: number;
}

// Property listing workflow statuses
export interface PropertyWorkflow {
  id: string;
  propertyId: string;
  status: 'intake' | 'verification' | 'photography' | 'review' | 'published' | 'archived';
  assignedTo?: string;                 // User ID of person handling
  notes: string[];                     // Workflow notes
  createdAt: string;
  updatedAt: string;
}

// Analytics and reporting
export interface PropertyAnalytics {
  propertyId: string;
  date: string;
  views: number;
  favorites: number;
  leads: number;                       // Number of buyer inquiries
  showings?: number;                   // Physical showings
  offers?: number;                     // Offers received
}