import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

// GET - Fetch all disputes for admin review
export async function GET() {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Admin access control
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }
    
    const disputesQuery = query(
      collection(db!, 'leadDisputes'),
      orderBy('submittedAt', 'desc')
    );
    const disputeDocs = await getDocs(disputesQuery);

    // Fetch disputes and enhance with buyer details
    const disputes = await Promise.all(disputeDocs.docs.map(async (docSnapshot) => {
      const disputeData = docSnapshot.data();
      let buyerDetails = null;
      
      // Try to fetch the related purchase to get buyer ID
      if (disputeData.transactionId) {
        try {
          const purchaseDoc = await getDoc(doc(db!, 'leadPurchases', disputeData.transactionId));
          if (purchaseDoc.exists()) {
            const purchaseData = purchaseDoc.data();
            
            // Fetch buyer profile
            if (purchaseData.buyerId) {
              const buyerDoc = await getDoc(doc(db!, 'buyerProfiles', purchaseData.buyerId));
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
        } catch {
        }
      }
      
      return {
        id: docSnapshot.id,
        ...disputeData,
        ...buyerDetails,
        status: disputeData.status || 'pending',
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
  let disputeId: string | undefined;
  let action: string | undefined;
  let adminNotes: string | undefined;
  let refundCredits: number | undefined;
  let dispute: Record<string, unknown> | null = null;

  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Admin access control
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    ({ disputeId, action, adminNotes, refundCredits } = body);

    if (!disputeId || !action || !['approve', 'deny', 'refund'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid dispute resolution action' },
        { status: 400 }
      );
    }

    // Get dispute details
    const disputeDoc = await getDoc(doc(db!, 'leadDisputes', disputeId));

    if (!disputeDoc.exists()) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }

    dispute = disputeDoc.data();

    // Debug: Log dispute structure for troubleshooting
    console.log('Dispute resolution debug:', {
      disputeId,
      action,
      refundCredits,
      disputeStatus: dispute.status,
      hasRealtorUserId: !!dispute.realtorUserId,
      hasRealtorId: !!dispute.realtorId,
      realtorUserIdValue: dispute.realtorUserId,
      realtorIdValue: dispute.realtorId,
      allDisputeFields: Object.keys(dispute || {})
    });

    // Allow re-processing approved disputes if they don't have refund amounts
    if (dispute.status === 'approved' && !dispute.refundAmount && refundCredits > 0) {
    }

    // Update dispute status
    const updateData: Record<string, unknown> = {
      status: action === 'refund' ? 'refunded' : action === 'approve' ? 'approved' : 'denied',
      adminNotes: adminNotes || '',
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Refund credits when approving or explicitly refunding
    if ((action === 'approve' || action === 'refund') && refundCredits > 0) {
      updateData.refundAmount = refundCredits;

      // Get realtor ID - check the actual field name used in dispute creation
      const realtorUserId = (dispute.realtorUserId as string) || (dispute.realtorId as string);

      if (!realtorUserId) {
        await logError('Cannot refund credits - no realtor ID in dispute', {
          action: 'admin_dispute_resolve_error',
          metadata: {
            disputeId,
            action,
            refundCredits,
            disputeFields: Object.keys(dispute),
            hasRealtorId: !!dispute?.realtorId,
            hasRealtorUserId: !!dispute?.realtorUserId
          }
        });

        return NextResponse.json({
          error: 'Cannot refund credits - realtor ID missing from dispute'
        }, { status: 400 });
      }

      // Find realtor user document and update credits
      try {
        // Get the user document directly
        const userDoc = await getDoc(doc(db!, 'users', realtorUserId));

        if (!userDoc.exists()) {
          await logError('Realtor user not found for credit refund', {
            action: 'admin_dispute_resolve_error',
            metadata: { disputeId, realtorUserId, refundCredits }
          });

          return NextResponse.json({
            error: `Realtor account not found for user ID: ${realtorUserId}`
          }, { status: 404 });
        }

        const userData = userDoc.data();

        // Check if user has realtorData
        if (!userData.realtorData) {
          await logError('User is not a realtor or missing realtorData', {
            action: 'admin_dispute_resolve_error',
            metadata: { disputeId, realtorUserId, refundCredits }
          });

          return NextResponse.json({
            error: `User ${realtorUserId} is not a realtor or has incomplete profile`
          }, { status: 400 });
        }

        const currentCredits = userData.realtorData.credits || 0;

        // Update credits in the user's realtorData field
        await updateDoc(doc(db!, 'users', realtorUserId), {
          'realtorData.credits': currentCredits + refundCredits,
          updatedAt: serverTimestamp()
        });

        // Create a transaction record for the refund
        await setDoc(doc(collection(db!, 'transactions')), {
          realtorId: realtorUserId,
          realtorUserId: realtorUserId,
            type: 'dispute_refund',
            description: `Refund for dispute #${disputeId.substring(0, 8)}`,
            credits: refundCredits,
            amount: 0, // No money transaction, just credits
            status: 'completed',
            createdAt: serverTimestamp()
          });

      } catch (error) {
        await logError('Failed to update realtor credits', {
          action: 'admin_dispute_resolve_error',
          metadata: { disputeId, realtorUserId, refundCredits }
        }, error as Error);

        return NextResponse.json({
          error: 'Failed to update realtor credits'
        }, { status: 500 });
      }
    }

    await updateDoc(doc(db!, 'leadDisputes', disputeId), updateData);

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
    console.error('DISPUTE RESOLUTION ERROR:', error);
    console.error('REQUEST BODY:', { disputeId, action, adminNotes, refundCredits });
    console.error('DISPUTE DATA:', dispute);

    await logError('Failed to resolve dispute', {
      action: 'admin_dispute_resolve_error',
      metadata: {
        disputeId,
        action,
        refundCredits,
        hasRealtorId: !!dispute?.realtorId,
        disputeData: dispute
      }
    }, error as Error);

    return NextResponse.json(
      { error: `Failed to resolve dispute: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}