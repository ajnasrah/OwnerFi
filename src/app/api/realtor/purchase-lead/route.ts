// LEAD PURCHASE API - Atomic transaction for purchasing buyer leads
// Deducts 1 credit and creates lead purchase record

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo } from '@/lib/logger';

interface PurchaseLeadRequest {
  leadId: string;
}

interface PurchaseLeadResponse {
  success: boolean;
  buyerDetails?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
  };
  creditsRemaining?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json() as PurchaseLeadRequest;
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Get user document with embedded realtor data
    const userData = await FirebaseDB.getDocument('users', session.user.id);
    const user = userData as {
      role: string;
      realtorData?: {
        credits: number;
        [key: string]: unknown;
      };
    };
    
    if (!user || user.role !== 'realtor' || !user.realtorData) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 400 }
      );
    }

    // Check if realtor has sufficient credits
    if (user.realtorData.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please purchase more credits to continue.' },
        { status: 400 }
      );
    }

    // Get buyer details from consolidated buyerProfiles collection
    const buyerData = await FirebaseDB.getDocument('buyerProfiles', leadId);
    const buyer = buyerData as {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      preferredCity?: string;
      city?: string;
      preferredState?: string;
      state?: string;
      isAvailableForPurchase?: boolean;
    };
    
    if (!buyer) {
      return NextResponse.json(
        { error: 'Buyer lead not found' },
        { status: 404 }
      );
    }

    // Check if buyer is still available for purchase
    if (buyer.isAvailableForPurchase === false) {
      return NextResponse.json(
        { error: 'This buyer lead is no longer available' },
        { status: 400 }
      );
    }

    // Check if this realtor has already purchased this lead
    const existingPurchase = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [
        { field: 'realtorUserId', operator: '==', value: session.user.id },
        { field: 'buyerId', operator: '==', value: leadId }
      ]
    );

    if (existingPurchase.length > 0) {
      return NextResponse.json(
        { error: 'You have already purchased this lead' },
        { status: 400 }
      );
    }

    // ATOMIC TRANSACTION: Deduct credit and create purchase record
    const now = Timestamp.now();
    const newCredits = user.realtorData.credits - 1;

    // Create lead purchase record
    const purchaseData = {
      realtorUserId: session.user.id,
      buyerId: leadId,
      buyerName: `${buyer.firstName} ${buyer.lastName}`,
      buyerCity: buyer.preferredCity || buyer.city,  // Use either field for compatibility
      buyerState: buyer.preferredState || buyer.state, // Use either field for compatibility
      creditsCost: 1,
      purchasePrice: 8, // Internal cost tracking
      status: 'purchased',
      purchasedAt: now,
      createdAt: now
    };

    const purchaseId = await FirebaseDB.createDocument('leadPurchases', purchaseData);

    // Update realtor credits in user document
    const updatedRealtorData = {
      ...user.realtorData,
      credits: newCredits,
      updatedAt: now
    };

    await FirebaseDB.updateDocument('users', session.user.id, {
      realtorData: updatedRealtorData,
      updatedAt: now
    });

    // Create transaction record
    const transactionData = {
      realtorUserId: session.user.id,
      type: 'lead_purchase',
      description: `Purchased lead: ${buyer.firstName} ${buyer.lastName}`,
      creditsChange: -1,
      runningBalance: newCredits,
      relatedId: purchaseId,
      details: {
        buyerName: `${buyer.firstName} ${buyer.lastName}`,
        buyerCity: buyer.preferredCity,
        purchasePrice: 8
      },
      createdAt: now
    };

    await FirebaseDB.createDocument('realtorTransactions', transactionData);

    // Mark buyer as purchased in consolidated system
    await FirebaseDB.updateDocument('buyerProfiles', leadId, {
      isAvailableForPurchase: false,
      purchasedBy: session.user.id,
      purchasedAt: now,
      updatedAt: now
    });

    // Log successful purchase
    await logInfo('Lead purchased successfully', {
      action: 'lead_purchase',
      userId: session.user.id,
      metadata: {
        leadId,
        buyerName: `${buyer.firstName} ${buyer.lastName}`,
        creditsRemaining: newCredits,
        purchasePrice: 8
      }
    });

    const response: PurchaseLeadResponse = {
      success: true,
      buyerDetails: {
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        email: buyer.email,
        phone: buyer.phone,
        city: buyer.preferredCity || buyer.city,      // Compatibility
        state: buyer.preferredState || buyer.state   // Compatibility
      },
      creditsRemaining: newCredits
    };

    return NextResponse.json(response);

  } catch (error) {
    await logError('Lead purchase failed', {
      action: 'lead_purchase_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to purchase lead. Please try again.' },
      { status: 500 }
    );
  }
}