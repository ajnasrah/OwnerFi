import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  getDocs, 
  doc,
  updateDoc,
  getDoc,
  orderBy,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';
import { logError, logInfo } from '@/lib/logger';

// GET - Fetch all disputes for admin review
export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin role check when admin auth is implemented
    // For now, this is open for development
    
    const disputesQuery = query(
      collection(db, 'leadDisputes'),
      orderBy('submittedAt', 'desc')
    );
    const disputeDocs = await getDocs(disputesQuery);

    const disputes = disputeDocs.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString() || doc.data().submittedAt,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
      resolvedAt: doc.data().resolvedAt?.toDate?.()?.toISOString() || doc.data().resolvedAt
    }));

    // Group by status
    const pendingDisputes = disputes.filter(d => d.status === 'pending');
    const resolvedDisputes = disputes.filter(d => d.status !== 'pending');

    return NextResponse.json({
      pendingDisputes,
      resolvedDisputes,
      totalDisputes: disputes.length,
      stats: {
        pending: pendingDisputes.length,
        approved: disputes.filter(d => d.status === 'approved').length,
        denied: disputes.filter(d => d.status === 'denied').length,
        refunded: disputes.filter(d => d.status === 'refunded').length
      }
    });

  } catch (error) {
    await logError('Failed to fetch disputes', error, {
      action: 'admin_disputes_fetch_error'
    });

    return NextResponse.json(
      { error: 'Failed to load disputes' },
      { status: 500 }
    );
  }
}

// POST - Resolve a dispute (approve/deny)
export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin role check when admin auth is implemented
    
    const body = await request.json();
    const { disputeId, action, adminNotes, refundCredits } = body;

    if (!disputeId || !action || !['approve', 'deny', 'refund'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid dispute resolution action' },
        { status: 400 }
      );
    }

    // Get dispute details
    const disputeDoc = await getDoc(doc(db, 'leadDisputes', disputeId));
    
    if (!disputeDoc.exists()) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    const dispute = disputeDoc.data();

    // Update dispute status
    const updateData = {
      status: action === 'refund' ? 'refunded' : action === 'approve' ? 'approved' : 'denied',
      adminNotes: adminNotes || '',
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (action === 'refund' && refundCredits) {
      updateData.refundAmount = refundCredits;
      
      // Add credits back to realtor account
      const realtorDoc = await getDoc(doc(db, 'realtors', dispute.realtorId));
      if (realtorDoc.exists()) {
        const currentCredits = realtorDoc.data()?.credits || 0;
        await updateDoc(doc(db, 'realtors', dispute.realtorId), {
          credits: currentCredits + refundCredits,
          updatedAt: serverTimestamp()
        });
      }
    }

    await updateDoc(doc(db, 'leadDisputes', disputeId), updateData);

    await logInfo('Dispute resolved by admin', {
      action: 'dispute_resolved',
      disputeId: disputeId,
      resolution: action,
      refundCredits: refundCredits || 0,
      realtorId: dispute.realtorId
    });

    return NextResponse.json({
      success: true,
      message: `Dispute ${action}ed successfully`,
      refundAmount: action === 'refund' ? refundCredits : 0
    });

  } catch (error) {
    await logError('Failed to resolve dispute', error, {
      action: 'admin_dispute_resolve_error'
    });

    return NextResponse.json(
      { error: 'Failed to resolve dispute' },
      { status: 500 }
    );
  }
}