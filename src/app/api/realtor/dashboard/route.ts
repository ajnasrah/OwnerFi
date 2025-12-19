// REALTOR DASHBOARD API - Single endpoint for all dashboard data
// Returns available leads, owned buyers, and transaction history

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { RealtorDataHelper, ValidatedCity } from '@/lib/realtor-models';
import { logError, logInfo } from '@/lib/logger';

// Constants
const FREE_PENDING_LIMIT = 3;

interface LeadData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  languages: string[];
  matchScore: number;
  matchReasons: string[];
  likedPropertiesCount: number;
  leadPrice: number;
  createdAt: Date | string;
}

interface OwnedBuyer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  purchasedAt: string;
  status: string;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  creditsChange: number;
  runningBalance: number;
  createdAt: string;
  details: Record<string, unknown>;
}

interface DashboardData {
  availableLeads: LeadData[];
  ownedBuyers: OwnedBuyer[];
  transactions: Transaction[];
  realtorData: {
    firstName: string;
    lastName: string;
    credits: number;
    serviceArea: {
      primaryCity: string;
      totalCitiesServed: number;
    };
  };
}

export async function GET() {
  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');

    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user document with embedded realtor data
    const userData = await FirebaseDB.getDocument('users', session.user.id);
    const user = userData as {
      role: string;
      realtorData?: {
        firstName: string;
        lastName: string;
        credits: number;
        isOnTrial: boolean;
        serviceArea?: {
          primaryCity: { name: string; state: string };
          totalCitiesServed: number;
        };
      };
    };

    if (!user || user.role !== 'realtor') {
      return NextResponse.json(
        { error: 'Realtor profile not found. Please complete your registration.' },
        { status: 400 }
      );
    }

    // Get buyer profile to determine service area (realtors fill this out in settings)
    // Query by userId since buyer profiles have their own IDs (buyer_timestamp_...)
    const buyerProfiles = await FirebaseDB.queryDocuments('buyerProfiles', [
      { field: 'userId', operator: '==', value: session.user.id }
    ]);

    const profile = buyerProfiles.length > 0 ? buyerProfiles[0] as {
      preferredCity?: string;
      preferredState?: string;
      firstName?: string;
      lastName?: string;
    } : null;

    // Use buyer profile city as service area
    const serviceCity = profile?.preferredCity || 'Not set';
    const serviceState = profile?.preferredState || 'Not set';

    // Create simplified realtor data structure
    const realtorData = {
      firstName: user.realtorData?.firstName || profile?.firstName || 'Realtor',
      lastName: user.realtorData?.lastName || profile?.lastName || '',
      credits: user.realtorData?.credits || 0,
      serviceArea: {
        primaryCity: { name: serviceCity, state: serviceState },
        nearbyCities: [] // Can be extended later
      }
    };

    // Get available buyer leads using buyer profile city
    const availableLeads = await getMatchedBuyerLeads(realtorData);

    // Get owned buyers (purchased by this realtor)
    const ownedBuyers = await getOwnedBuyers(session.user.id);

    // Get transaction history
    const transactions = await getTransactionHistory(session.user.id);

    const dashboardData: DashboardData = {
      availableLeads,
      ownedBuyers,
      transactions,
      realtorData: {
        firstName: realtorData.firstName,
        lastName: realtorData.lastName,
        credits: realtorData.credits,
        serviceArea: {
          primaryCity: serviceCity,
          totalCitiesServed: 1 // Just using buyer profile city for now
        }
      }
    };

    await logInfo('Realtor dashboard loaded', {
      action: 'realtor_dashboard_load',
      userId: session.user.id,
      metadata: {
        availableLeadsCount: availableLeads.length,
        ownedBuyersCount: ownedBuyers.length,
        transactionCount: transactions.length,
        credits: realtorData.credits,
        serviceCity,
        serviceState
      }
    });

    return NextResponse.json(dashboardData);

  } catch (error) {
    await logError('Failed to load realtor dashboard', {
      action: 'realtor_dashboard_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

// Get available buyer leads for this realtor
async function getAvailableLeads(userId: string, realtorData: Record<string, unknown>): Promise<LeadData[]> {
  try {
    // PERFORMANCE FIX: Added limit to prevent unbounded query
    const allBuyers = await FirebaseDB.getCompleteBuyers(100);

    // Get already purchased leads to filter them out
    const purchasedLeads = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [{ field: 'realtorUserId', operator: '==', value: userId }]
    );
    // PERFORMANCE FIX: Use Set for O(1) lookups instead of O(n) array.includes()
    const purchasedBuyerIds = new Set(
      (purchasedLeads as Array<{ buyerId: string; [key: string]: unknown }>)
        .map((p: { buyerId: string; [key: string]: unknown }) => p.buyerId)
    );

    // Get realtor's service cities
    const serviceCities = RealtorDataHelper.getAllCitiesServed(realtorData as { serviceArea: { primaryCity: ValidatedCity; nearbyCities: ValidatedCity[] } });
    const serviceCityNames = serviceCities.map(city => city.name.toLowerCase());
    const realtorState = (realtorData as { serviceArea: { primaryCity: { stateCode: string } } }).serviceArea.primaryCity.stateCode;

    const availableLeads = [];

    for (const buyer of allBuyers) {
      // Skip if already purchased by this realtor (O(1) lookup with Set)
      if (purchasedBuyerIds.has(buyer.id)) {
        continue;
      }

      // Skip if buyer is inactive
      if (buyer.isActive === false) {
        continue;
      }

      // Match by location (buyer's preferred city must be in realtor's service area)
      const buyerCity = buyer.preferredCity?.toLowerCase();
      const buyerState = buyer.preferredState;

      // Check if buyer is in realtor's service area
      const isInServiceArea = 
        buyerState === realtorState && // Same state
        serviceCityNames.includes(buyerCity); // City is served

      if (!isInServiceArea) {
        continue;
      }

      // Calculate basic match percentage (for now, simple 85% for in-area matches)
      const matchPercentage = 85;

      // Format the lead data
      const leadData = {
        id: buyer.id,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
        phone: buyer.phone,
        city: buyer.preferredCity,
        state: buyer.preferredState,
        minBedrooms: buyer.minBedrooms,
        minBathrooms: buyer.minBathrooms,
        languages: buyer.languages || ['English'],
        createdAt: buyer.createdAt?.toDate ? buyer.createdAt.toDate().toISOString() : new Date().toISOString(),
        matchPercentage,
        propertyMatches: 5 // Placeholder - would need to calculate real property matches
      };

      availableLeads.push(leadData);
    }

    // Sort by creation date (newest first)
    availableLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return availableLeads.slice(0, 20); // Limit to 20 most recent

  } catch (error) {
    return [];
  }
}

// Get buyers owned by this realtor
async function getOwnedBuyers(userId: string): Promise<OwnedBuyer[]> {
  try {
    // Get all lead purchases by this realtor
    const purchases = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [{ field: 'realtorUserId', operator: '==', value: userId }]
    );

    const ownedBuyers = [];

    for (const purchase of purchases) {
      // Get buyer details
      const buyerData = await FirebaseDB.getDocument('buyerProfiles', (purchase as { buyerId: string; [key: string]: unknown }).buyerId);
      const buyer = buyerData as {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        preferredCity: string;
        preferredState: string;
        [key: string]: unknown;
      };

      if (buyer) {
        const ownedBuyer = {
          id: buyer.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email,
          phone: buyer.phone,
          city: buyer.preferredCity,
          state: buyer.preferredState,
          purchasedAt: (purchase as { purchasedAt?: { toDate: () => Date }; [key: string]: unknown }).purchasedAt?.toDate ? (purchase as { purchasedAt: { toDate: () => Date }; [key: string]: unknown }).purchasedAt.toDate().toISOString() : new Date().toISOString(),
          status: (purchase as { status?: string; [key: string]: unknown }).status || 'purchased'
        };

        ownedBuyers.push(ownedBuyer);
      }
    }

    // Sort by purchase date (most recent first)
    ownedBuyers.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());

    return ownedBuyers;

  } catch (error) {
    return [];
  }
}

// Get transaction history for this realtor
async function getTransactionHistory(userId: string): Promise<Transaction[]> {
  try {
    // Get all transactions for this realtor
    const transactions = await FirebaseDB.queryDocuments(
      'realtorTransactions',
      [{ field: 'realtorUserId', operator: '==', value: userId }],
      50 // Limit to last 50 transactions
    );

    return (transactions as Array<{
      id: string;
      type: string;
      description: string;
      creditsChange: number;
      runningBalance: number;
      createdAt?: { toDate: () => Date };
      details?: Record<string, unknown>;
      [key: string]: unknown;
    }>).map((transaction: {
      id: string;
      type: string;
      description: string;
      creditsChange: number;
      runningBalance: number;
      createdAt?: { toDate: () => Date };
      details?: Record<string, unknown>;
      [key: string]: unknown;
    }) => ({
      id: transaction.id,
      type: transaction.type,
      description: transaction.description,
      creditsChange: transaction.creditsChange,
      runningBalance: transaction.runningBalance,
      createdAt: transaction.createdAt?.toDate ? transaction.createdAt.toDate().toISOString() : new Date().toISOString(),
      details: transaction.details || {}
    }));

  } catch (error) {
    return [];
  }
}

// UPDATED: Get matched buyer leads using consolidated system
async function getMatchedBuyerLeads(realtorData: {
  serviceArea?: {
    primaryCity?: { name: string; state: string };
    nearbyCities?: Array<{ name?: string } | string>;
  };
  serviceCities?: string[];
}): Promise<Array<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  languages: string[];
  matchScore: number;
  matchReasons: string[];
  likedPropertiesCount: number;
  leadPrice: number;
  createdAt: Date | string;
}>> {
  try {
    const { ConsolidatedLeadSystem } = await import('@/lib/consolidated-lead-system');
    
    // Extract service cities from realtor data
    const serviceArea = realtorData.serviceArea || {};
    let cities: string[] = [];
    
    // Get primary city and nearby cities from serviceArea
    if (serviceArea.primaryCity?.name) {
      cities = [serviceArea.primaryCity.name];
      
      // Add all nearby cities from service area
      if (serviceArea.nearbyCities && serviceArea.nearbyCities.length > 0) {
        const nearbyCities = (serviceArea.nearbyCities as Array<{ name?: string } | string>).map((c: { name?: string } | string) => 
          typeof c === 'string' ? c : ((c as { name?: string }).name || 'Unknown')
        );
        cities.push(...nearbyCities);
      }
    }
    
    // Also check if cities are saved directly in serviceCities field
    if (realtorData.serviceCities && realtorData.serviceCities.length > 0) {
      cities = (realtorData.serviceCities as string[]).map((city: string) => city.split(',')[0]?.trim());
    }
    
    const realtorProfile = {
      cities: cities,
      languages: ['English'], // Default - can be extended later  
      state: serviceArea.primaryCity?.state || 'Unknown'
    };
    
    
    // Get matches from consolidated system
    const leads = await ConsolidatedLeadSystem.findAvailableLeads(realtorProfile);
    
    // Convert Timestamp to Date for compatibility
    const convertedLeads = leads.map((lead: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      city: string;
      state: string;
      languages: string[];
      matchScore: number;
      matchReasons: string[];
      likedPropertiesCount: number;
      leadPrice: number;
      createdAt?: { toDate?: () => Date };
    }) => ({
      ...lead,
      createdAt: lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date()
    }));
    
    return convertedLeads;
    
  } catch (error) {
    // Fallback to empty array if matching fails
    return [];
  }
}