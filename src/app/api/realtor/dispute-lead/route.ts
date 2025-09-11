import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo } from '@/lib/logger';
import { BuyerProfile, RealtorProfile, LeadPurchase, LeadDispute } from '@/lib/firebase-models';

interface DisputeLeadRequest {
  buyerId: string;
  reason: string;
  description: string;
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

    const body = await request.json() as DisputeLeadRequest;
    const { buyerId, reason, description } = body;

    if (!buyerId || !reason || !description) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Verify the realtor purchased this lead
    const purchases = await FirebaseDB.queryDocuments(
      'leadPurchases',
      [
        { field: 'realtorUserId', operator: '==', value: session.user.id },
        { field: 'buyerId', operator: '==', value: buyerId }
      ]
    );

    if (purchases.length === 0) {
      return NextResponse.json(
        { error: 'You can only dispute leads you have purchased' },
        { status: 403 }
      );
    }

    const purchase = purchases[0] as LeadPurchase;

    // Get full buyer details from buyerProfiles
    const buyerProfile = await FirebaseDB.getDocument('buyerProfiles', buyerId);
    
    if (!buyerProfile) {
      return NextResponse.json(
        { error: 'Buyer profile not found' },
        { status: 404 }
      );
    }

    // Get realtor details from realtor profile
    const realtorProfile = await FirebaseDB.queryDocuments(
      'realtors',
      [{ field: 'userId', operator: '==', value: session.user.id }]
    );
    
    const realtor = realtorProfile.length > 0 ? realtorProfile[0] : null;

    // Check if already disputed
    const existingDisputes = await FirebaseDB.queryDocuments(
      'leadDisputes',
      [
        { field: 'realtorUserId', operator: '==', value: session.user.id },
        { field: 'buyerId', operator: '==', value: buyerId }
      ]
    );

    if (existingDisputes.some((d: LeadDispute) => d.status === 'pending')) {
      return NextResponse.json(
        { error: 'You already have a pending dispute for this lead' },
        { status: 400 }
      );
    }

    // Create comprehensive dispute record with all required fields
    const disputeData = {
      realtorUserId: session.user.id,
      buyerId: buyerId,
      transactionId: purchase.id,
      reason: reason,
      description: description,
      status: 'pending',
      
      // Complete buyer information
      buyerName: `${(buyerProfile as BuyerProfile).firstName} ${(buyerProfile as BuyerProfile).lastName}`,
      buyerPhone: (buyerProfile as BuyerProfile).phone,
      buyerEmail: (buyerProfile as BuyerProfile).email,
      buyerCity: (buyerProfile as BuyerProfile).city,
      buyerState: (buyerProfile as BuyerProfile).state,
      maxMonthlyPayment: (buyerProfile as BuyerProfile).maxMonthlyPayment,
      maxDownPayment: (buyerProfile as BuyerProfile).maxDownPayment,
      
      // Realtor information
      realtorName: realtor ? `${(realtor as RealtorProfile).firstName} ${(realtor as RealtorProfile).lastName}` : session.user.email || 'Unknown Realtor',
      realtorEmail: session.user.email,
      
      // Purchase information
      purchaseDate: purchase.createdAt ? purchase.createdAt.toDate().toISOString() : new Date().toISOString(),
      creditsCost: purchase.creditsCost,
      
      // Timestamps
      submittedAt: Timestamp.now(),
      createdAt: Timestamp.now()
    };

    const disputeId = await FirebaseDB.createDocument('leadDisputes', disputeData);

    // Log dispute submission
    await logInfo('Lead dispute submitted', {
      action: 'dispute_submitted',
      userId: session.user.id,
      metadata: {
        disputeId,
        buyerId,
        reason
      }
    });

    return NextResponse.json({
      success: true,
      disputeId,
      message: 'Dispute submitted successfully. Our team will review it within 24-48 hours.'
    });

  } catch (error) {
    await logError('Lead dispute submission failed', {
      action: 'dispute_submission_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to submit dispute. Please try again.' },
      { status: 500 }
    );
  }
}