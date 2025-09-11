// REALTOR DASHBOARD API - Single endpoint for all dashboard data
// Returns available leads, owned buyers, and transaction history

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { RealtorDataHelper } from '@/lib/realtor-models';
import { logError, logInfo } from '@/lib/logger';

interface DashboardData {
  availableLeads: any[];
  ownedBuyers: any[];
  transactions: any[];
  realtorData: {
    firstName: string;
    lastName: string;
    credits: number;
    isOnTrial: boolean;
    trialDaysRemaining: number;
    serviceArea: {
      primaryCity: string;
      totalCitiesServed: number;
    };
  };
}

export async function GET(request: NextRequest) {
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
    const user = userData as any; // TODO: Add proper typing
    
    if (!user || user.role !== 'realtor' || !user.realtorData) {
      return NextResponse.json(
        { error: 'Realtor profile not found. Please complete your registration.' },
        { status: 400 }
      );
    }

    const { realtorData } = user;

    // Get available buyer leads using new matching module
    const availableLeads = await getMatchedBuyerLeads(realtorData);
    
    // Get owned buyers (purchased by this realtor)
    const ownedBuyers = await getOwnedBuyers(session.user.id);
    
    // Get transaction history
    const transactions = await getTransactionHistory(session.user.id);

    // Calculate trial days remaining
    const trialDaysRemaining = RealtorDataHelper.getTrialDaysRemaining(realtorData);

    const dashboardData: DashboardData = {
      availableLeads,
      ownedBuyers,
      transactions,
      realtorData: {
        firstName: realtorData.firstName,
        lastName: realtorData.lastName,
        credits: realtorData.credits,
        isOnTrial: realtorData.isOnTrial,
        trialDaysRemaining,
        serviceArea: {
          primaryCity: realtorData.serviceArea.primaryCity.name,
          totalCitiesServed: realtorData.serviceArea.totalCitiesServed
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
        credits: realtorData.credits
      }
    });

    return NextResponse.json(dashboardData);

  } catch {
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
async function getAvailableLeads(userId: string, realtorData: any): Promise<any[]> {
  try {
    // Get all complete buyer profiles
    const allBuyers = await FirebaseDB.getCompleteBuyers();
    
    // Get already purchased leads to filter them out
    const purchasedLeads = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [{ field: 'realtorUserId', operator: '==', value: userId }]
    );
    const purchasedBuyerIds = purchasedLeads.map((p: any) => p.buyerId);

    // Get realtor's service cities
    const serviceCities = RealtorDataHelper.getAllCitiesServed(realtorData);
    const serviceCityNames = serviceCities.map(city => city.name.toLowerCase());
    const realtorState = realtorData.serviceArea.primaryCity.stateCode;

    const availableLeads = [];

    for (const buyer of allBuyers) {
      // Skip if already purchased by this realtor
      if (purchasedBuyerIds.includes(buyer.id)) {
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
        maxMonthlyPayment: buyer.maxMonthlyPayment,
        maxDownPayment: buyer.maxDownPayment,
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

  } catch {
    return [];
  }
}

// Get buyers owned by this realtor
async function getOwnedBuyers(userId: string): Promise<any[]> {
  try {
    // Get all lead purchases by this realtor
    const purchases = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [{ field: 'realtorUserId', operator: '==', value: userId }]
    );

    const ownedBuyers = [];

    for (const purchase of purchases) {
      // Get buyer details
      const buyerData = await FirebaseDB.getDocument('buyerProfiles', (purchase as any).buyerId);
      const buyer = buyerData as any; // TODO: Add proper typing
      
      if (buyer) {
        const ownedBuyer = {
          id: buyer.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email,
          phone: buyer.phone,
          city: buyer.preferredCity,
          state: buyer.preferredState,
          maxMonthlyPayment: buyer.maxMonthlyPayment,
          maxDownPayment: buyer.maxDownPayment,
          purchasedAt: (purchase as any).purchasedAt?.toDate ? (purchase as any).purchasedAt.toDate().toISOString() : new Date().toISOString(),
          status: (purchase as any).status || 'purchased'
        };

        ownedBuyers.push(ownedBuyer);
      }
    }

    // Sort by purchase date (most recent first)
    ownedBuyers.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());

    return ownedBuyers;

  } catch {
    return [];
  }
}

// Get transaction history for this realtor
async function getTransactionHistory(userId: string): Promise<any[]> {
  try {
    // Get all transactions for this realtor
    const transactions = await FirebaseDB.queryDocuments(
      'realtorTransactions',
      [{ field: 'realtorUserId', operator: '==', value: userId }],
      50 // Limit to last 50 transactions
    );

    return transactions.map((transaction: any) => ({
      id: transaction.id,
      type: transaction.type,
      description: transaction.description,
      creditsChange: transaction.creditsChange,
      runningBalance: transaction.runningBalance,
      createdAt: transaction.createdAt?.toDate ? transaction.createdAt.toDate().toISOString() : new Date().toISOString(),
      details: transaction.details || {}
    }));

  } catch {
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
  maxMonthlyPayment: number;
  maxDownPayment: number;
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
        const nearbyCities = serviceArea.nearbyCities.map(c => 
          typeof c === 'string' ? c : (c.name || 'Unknown')
        );
        cities.push(...nearbyCities);
      }
    }
    
    // Also check if cities are saved directly in serviceCities field
    if (realtorData.serviceCities && realtorData.serviceCities.length > 0) {
      cities = realtorData.serviceCities.map((city: string) => city.split(',')[0]?.trim());
    }
    
    const realtorProfile = {
      cities: cities,
      languages: ['English'], // Default - can be extended later  
      state: serviceArea.primaryCity?.state || 'Unknown'
    };
    
    
    // Get matches from consolidated system
    const leads = await ConsolidatedLeadSystem.findAvailableLeads(realtorProfile);
    
    // Convert Timestamp to Date for compatibility
    const convertedLeads = leads.map(lead => ({
      ...lead,
      createdAt: lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date()
    }));
    
    return convertedLeads;
    
  } catch {
    // Fallback to empty array if matching fails
    return [];
  }
}