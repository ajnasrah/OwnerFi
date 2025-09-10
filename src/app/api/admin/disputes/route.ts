import { NextRequest, NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { adminDb } from '@/lib/firebase-admin';

// GET - Fetch all disputes for admin review
export async function GET(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // TODO: Add admin role check when admin auth is implemented
    // For now, this is open for development
    
    const disputesQuery = query(
      adminDb.collection('leadDisputes'),
      orderBy('submittedAt', 'desc')
    );
    const disputeDocs = await disputesQuery.get();

    // Fetch disputes and enhance with buyer details
    const disputes = await Promise.all(disputeDocs.docs.map(async (docSnapshot) => {
      const disputeData = docSnapshot.data();
      let buyerDetails = null;
      
      // Try to fetch the related purchase to get buyer ID
      if (disputeData.transactionId) {
        try {
          const purchaseDoc = await adminDb.collection('buyerLeadPurchases').doc(disputeData.transactionId).get();
          if (purchaseDoc.exists()) {
            const purchaseData = purchaseDoc.data();
            
            // Fetch buyer profile
            if (purchaseData.buyerId) {
              const buyerDoc = await adminDb.collection('buyerProfiles').doc(purchaseData.buyerId).get();
              if (buyerDoc.exists()) {
                const buyer = buyerDoc.data();
                const criteria = buyer.searchCriteria || {};
                buyerDetails = {
                  buyerPhone: buyer.phone || 'No phone',
                  buyerEmail: buyer.email || 'No email',
                  buyerCity: criteria.cities?.[0] || buyer.preferredCity || 'Unknown',
                  buyerState: criteria.state || buyer.preferredState || '',
                  maxMonthlyPayment: criteria.maxMonthlyPayment || buyer.maxMonthlyPayment || 0,
                  maxDownPayment: criteria.maxDownPayment || buyer.maxDownPayment || 0
                };
              }
            }
          }
        } catch (error) {
          console.error('Error fetching buyer details for dispute:', error);
        }
      }
      
      return {
        id: docSnapshot.id,
        ...disputeData,
        ...buyerDetails,
        submittedAt: disputeData.submittedAt?.toDate?.()?.toISOString() || disputeData.submittedAt,
        createdAt: disputeData.createdAt?.toDate?.()?.toISOString() || disputeData.createdAt,
        updatedAt: disputeData.updatedAt?.toDate?.()?.toISOString() || disputeData.updatedAt,
        resolvedAt: disputeData.resolvedAt?.toDate?.()?.toISOString() || disputeData.resolvedAt
      };
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
    await logError('Failed to fetch disputes', {
      action: 'admin_disputes_fetch_error'
    }, error as Error);

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
    const disputeDoc = await adminDb.collection('leadDisputes').doc(disputeId).get();
    
    if (!disputeDoc.exists()) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    const dispute = disputeDoc.data();
    
    // Allow re-processing approved disputes if they don't have refund amounts
    if (dispute.status === 'approved' && !dispute.refundAmount && refundCredits > 0) {
      console.log('Re-processing approved dispute to add missing refund');
    }

    // Update dispute status
    const updateData: Record<string, unknown> = {
      status: action === 'refund' ? 'refunded' : action === 'approve' ? 'approved' : 'denied',
      adminNotes: adminNotes || '',
      resolvedAt: new Date(),
      updatedAt: new Date()
    };

    // Refund credits when approving or explicitly refunding
    if ((action === 'approve' || action === 'refund') && refundCredits > 0) {
      updateData.refundAmount = refundCredits;
      
      // Add credits back to realtor account
      const realtorDoc = await adminDb.collection('realtors').doc(dispute.realtorId).get();
      if (realtorDoc.exists()) {
        const currentCredits = realtorDoc.data()?.credits || 0;
        await adminDb.collection('realtors').doc(dispute.realtorId).update({
          credits: currentCredits + refundCredits,
          updatedAt: new Date()
        });
        
        // Create a transaction record for the refund
        await setDoc(doc(adminDb.collection('transactions')), {
          realtorId: dispute.realtorId,
          type: 'dispute_refund',
          description: `Refund for dispute #${disputeId.substring(0, 8)}`,
          credits: refundCredits,
          amount: 0, // No money transaction, just credits
          status: 'completed',
          createdAt: new Date()
        });
      }
    }

    await adminDb.collection('leadDisputes').doc(disputeId).update(updateData);

    await logInfo('Dispute resolved by admin', {
      action: 'dispute_resolved',
      metadata: {
        resolution: action,
        refundCredits: refundCredits || 0,
        disputeId: disputeId
      }
    });

    return NextResponse.json({
      success: true,
      message: `Dispute ${action}ed successfully`,
      refundAmount: action === 'refund' ? refundCredits : 0
    });

  } catch (error) {
    await logError('Failed to resolve dispute', {
      action: 'admin_dispute_resolve_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to resolve dispute' },
      { status: 500 }
    );
  }
}