// LEAD PURCHASE API - Atomic transaction for purchasing buyer leads
// Deducts 1 credit and creates lead purchase record

import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp, doc, collection, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

    // Check if this realtor has already purchased this lead (pre-check before transaction)
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

    // Check for existing pending or signed agreements from ANY realtor
    const existingAgreements = await FirebaseDB.queryDocuments(
      'referralAgreements',
      [
        { field: 'buyerId', operator: '==', value: leadId },
        { field: 'status', operator: 'in', value: ['pending', 'signed'] }
      ]
    );

    if (existingAgreements.length > 0) {
      return NextResponse.json(
        { error: 'This lead has a pending or signed referral agreement and cannot be purchased with credits.' },
        { status: 409 }
      );
    }

    // ATOMIC TRANSACTION: All operations must succeed or none will
    // This prevents race conditions where:
    // - Two requests could both see sufficient credits and deduct
    // - Two requests could both purchase the same lead
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const now = Timestamp.now();
    const userId = session.user.id;

    const result = await runTransaction(db, async (transaction) => {
      // Re-read user document inside transaction for consistency
      const userRef = doc(db, 'users', userId);
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists()) {
        throw new Error('User not found');
      }

      const freshUserData = userSnap.data() as {
        role: string;
        realtorData?: { credits: number; [key: string]: unknown };
      };

      if (!freshUserData.realtorData) {
        throw new Error('Realtor profile not found');
      }

      // Re-check credits inside transaction
      if (freshUserData.realtorData.credits < 1) {
        throw new Error('Insufficient credits');
      }

      // Re-check buyer availability inside transaction
      const buyerRef = doc(db, 'buyerProfiles', leadId);
      const buyerSnap = await transaction.get(buyerRef);

      if (!buyerSnap.exists()) {
        throw new Error('Buyer not found');
      }

      const freshBuyerData = buyerSnap.data();
      if (freshBuyerData.isAvailableForPurchase === false) {
        throw new Error('Lead no longer available');
      }

      const newCredits = freshUserData.realtorData.credits - 1;

      // Generate IDs for new documents
      const purchaseRef = doc(collection(db, 'leadPurchases'));
      const transactionRef = doc(collection(db, 'realtorTransactions'));

      // Create purchase record
      const purchaseData = {
        realtorUserId: userId,
        buyerId: leadId,
        buyerName: `${buyer.firstName} ${buyer.lastName}`,
        buyerCity: buyer.preferredCity || buyer.city,
        buyerState: buyer.preferredState || buyer.state,
        creditsCost: 1,
        purchasePrice: 8,
        status: 'purchased',
        purchasedAt: now,
        createdAt: now
      };

      // Create transaction record
      const transactionData = {
        realtorUserId: userId,
        type: 'lead_purchase',
        description: `Purchased lead: ${buyer.firstName} ${buyer.lastName}`,
        creditsChange: -1,
        runningBalance: newCredits,
        relatedId: purchaseRef.id,
        details: {
          buyerName: `${buyer.firstName} ${buyer.lastName}`,
          buyerCity: buyer.preferredCity,
          purchasePrice: 8
        },
        createdAt: now
      };

      // All writes happen atomically
      transaction.set(purchaseRef, purchaseData);
      transaction.set(transactionRef, transactionData);
      transaction.update(userRef, {
        'realtorData.credits': newCredits,
        'realtorData.updatedAt': now,
        updatedAt: now
      });
      transaction.update(buyerRef, {
        isAvailableForPurchase: false,
        purchasedBy: userId,
        purchasedAt: now,
        updatedAt: now
      });

      return { purchaseId: purchaseRef.id, newCredits };
    });

    const { newCredits } = result;

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific transaction errors with user-friendly messages
    if (errorMessage === 'Insufficient credits') {
      return NextResponse.json(
        { error: 'Insufficient credits. Please purchase more credits to continue.' },
        { status: 400 }
      );
    }
    if (errorMessage === 'Lead no longer available') {
      return NextResponse.json(
        { error: 'This lead has already been purchased by another realtor.' },
        { status: 409 }
      );
    }
    if (errorMessage === 'Buyer not found' || errorMessage === 'User not found') {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      );
    }

    await logError('Lead purchase failed', {
      action: 'lead_purchase_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to purchase lead. Please try again.' },
      { status: 500 }
    );
  }
}