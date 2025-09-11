import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { FirebaseDB } from '@/lib/firebase-db';
import { Timestamp } from 'firebase/firestore';
import { logError, logInfo } from '@/lib/logger';

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

    const purchase = purchases[0] as any;

    // Check if already disputed
    const existingDisputes = await FirebaseDB.queryDocuments(
      'leadDisputes',
      [
        { field: 'realtorUserId', operator: '==', value: session.user.id },
        { field: 'buyerId', operator: '==', value: buyerId }
      ]
    );

    if (existingDisputes.some((d: any) => d.status === 'pending')) {
      return NextResponse.json(
        { error: 'You already have a pending dispute for this lead' },
        { status: 400 }
      );
    }

    // Create dispute record
    const disputeData = {
      realtorUserId: session.user.id,
      buyerId: buyerId,
      transactionId: purchase.id,
      reason: reason,
      description: description,
      status: 'pending',
      buyerName: purchase.buyerName,
      buyerCity: purchase.buyerCity,
      buyerState: purchase.buyerState,
      creditsCost: purchase.creditsCost || 1,
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