import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';
import { logError, logInfo } from '@/lib/logger';
import { firestoreHelpers } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      transactionId, 
      reason, 
      explanation, 
      contactAttempts, 
      evidence,
      buyerName,
      purchaseDate 
    } = body;

    // Validation
    if (!transactionId || !reason || !explanation) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get realtor profile
    const realtorsQuery = query(
      collection(db, 'realtors'),
      where('userId', '==', session.user.id!)
    );
    const realtorDocs = await getDocs(realtorsQuery);

    if (realtorDocs.empty) {
      return NextResponse.json(
        { error: 'Realtor profile not found' },
        { status: 400 }
      );
    }

    const realtorDoc = realtorDocs.docs[0];
    const realtorProfile = { id: realtorDoc.id, ...realtorDoc.data() };

    // Verify the transaction belongs to this realtor
    const purchaseDoc = await getDoc(doc(db, 'buyerLeadPurchases', transactionId));
    
    if (!purchaseDoc.exists() || purchaseDoc.data()?.realtorId !== realtorDoc.id) {
      return NextResponse.json(
        { error: 'Transaction not found or access denied' },
        { status: 403 }
      );
    }

    // Check if dispute already exists
    const existingDisputeQuery = query(
      collection(db, 'leadDisputes'),
      where('transactionId', '==', transactionId)
    );
    const existingDisputes = await getDocs(existingDisputeQuery);

    if (!existingDisputes.empty) {
      return NextResponse.json(
        { error: 'Dispute already submitted for this transaction' },
        { status: 400 }
      );
    }

    // Create dispute record
    const disputeId = firestoreHelpers.generateId();
    
    await setDoc(doc(db, 'leadDisputes', disputeId), {
      id: disputeId,
      transactionId: transactionId,
      realtorId: realtorDoc.id,
      realtorName: `${realtorProfile.firstName} ${realtorProfile.lastName}`,
      realtorEmail: realtorProfile.email,
      buyerName: buyerName || 'Unknown',
      purchaseDate: purchaseDate,
      reason: reason,
      explanation: explanation,
      contactAttempts: contactAttempts || '',
      evidence: evidence || '',
      status: 'pending',
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await logInfo('Lead dispute submitted', {
      action: 'lead_dispute_submitted',
      disputeId: disputeId,
      realtorId: realtorDoc.id,
      transactionId: transactionId,
      reason: reason,
      metadata: {
        buyerName,
        realtorEmail: realtorProfile.email
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Dispute submitted successfully. We will review and respond within 24 hours.',
      disputeId: disputeId
    });

  } catch (error) {
    await logError('Failed to submit dispute', error, {
      action: 'dispute_submission_error'
    });

    return NextResponse.json(
      { error: 'Failed to submit dispute. Please try again.' },
      { status: 500 }
    );
  }
}