// REALTOR DASHBOARD API - Single endpoint for all dashboard data
// Returns available leads, owned buyers, and transaction history

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { logError, logInfo } from '@/lib/logger';

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

export async function GET(request: NextRequest) {
  try {
    // Parse search params
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search')?.toLowerCase() || '';
    const cityFilter = searchParams.get('city')?.toLowerCase() || '';

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
          nearbyCities?: Array<{ name: string; state: string }>;
          totalCitiesServed: number;
        };
        serviceCities?: string[];
      };
    };

    if (!user || (user.role !== 'realtor' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Realtor profile not found. Please complete your registration.' },
        { status: 400 }
      );
    }

    // Get service area — only the state matters for lead matching
    const realtorServiceArea = user.realtorData?.serviceArea as {
      primaryCity?: { name: string; state: string };
    } | undefined;

    const serviceCity = realtorServiceArea?.primaryCity?.name || 'Not set';
    const serviceState = realtorServiceArea?.primaryCity?.state || 'Not set';

    console.log(`[REALTOR DASHBOARD] User=${session.user.id} City=${serviceCity} State=${serviceState}`);

    // Create simplified realtor data structure
    // Lead matching is STATE-LEVEL — realtors see all buyers in their state
    const realtorData = {
      firstName: user.realtorData?.firstName || 'Realtor',
      lastName: user.realtorData?.lastName || '',
      credits: user.realtorData?.credits || 0,
      serviceArea: {
        primaryCity: { name: serviceCity, state: serviceState },
      }
    };

    // Get available buyer leads using buyer profile city
    const availableLeads = await getMatchedBuyerLeads(realtorData, { searchQuery, cityFilter }, session.user.id);

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
          totalCitiesServed: 1
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
        serviceState,
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

// Get buyers owned by this realtor
async function getOwnedBuyers(userId: string): Promise<OwnedBuyer[]> {
  try {
    // Get all lead purchases by this realtor
    const purchases = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [{ field: 'realtorUserId', operator: '==', value: userId }]
    );

    // Fetch all buyer details in parallel instead of sequentially
    const buyerResults = await Promise.all(
      purchases.map(async (purchase) => {
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
        } | null;

        if (!buyer) return null;

        return {
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
      })
    );

    const ownedBuyers = buyerResults.filter((b): b is NonNullable<typeof b> => b !== null);

    // Sort by purchase date (most recent first)
    ownedBuyers.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime());

    return ownedBuyers;

  } catch (error) {
    console.error('[realtor-dashboard] Failed to load owned buyers:', error);
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
    console.error('[realtor-dashboard] Failed to load transaction history:', error);
    return [];
  }
}

// Get matched buyer leads — all available buyers in the realtor's state
async function getMatchedBuyerLeads(realtorData: {
  serviceArea?: {
    primaryCity?: { name: string; state: string };
  };
}, filters?: { searchQuery?: string; cityFilter?: string }, realtorUserId?: string): Promise<Array<{
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

    const state = realtorData.serviceArea?.primaryCity?.state || 'Unknown';
    const primaryCity = realtorData.serviceArea?.primaryCity?.name || '';

    const realtorProfile = {
      cities: primaryCity ? [primaryCity] : [],
      languages: ['English'],
      state,
    };

    const leads = await ConsolidatedLeadSystem.findAvailableLeads(realtorProfile, 200, realtorUserId);

    // Convert Timestamp to Date for compatibility
    // SECURITY: Redact email/phone — these are only revealed after agreement signing
    let convertedLeads = leads.map((lead: {
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
      email: '',
      phone: '',
      createdAt: lead.createdAt?.toDate ? lead.createdAt.toDate() : new Date()
    }));

    // Apply search filter (name)
    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      convertedLeads = convertedLeads.filter(lead =>
        lead.firstName.toLowerCase().includes(query) ||
        lead.lastName.toLowerCase().includes(query) ||
        `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(query)
      );
    }

    // Apply city filter
    if (filters?.cityFilter) {
      const cityQuery = filters.cityFilter.toLowerCase();
      convertedLeads = convertedLeads.filter(lead =>
        lead.city.toLowerCase().includes(cityQuery)
      );
    }

    return convertedLeads;
    
  } catch (error) {
    // Fallback to empty array if matching fails
    return [];
  }
}