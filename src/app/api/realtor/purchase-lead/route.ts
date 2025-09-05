import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { getSessionWithRole } from '@/lib/auth-utils';
import { firestoreHelpers } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    // Enforce realtor role only
    const session = await getSessionWithRole('realtor');
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'Lead ID is required' },
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

    if (!realtorProfile.profileComplete) {
      return NextResponse.json(
        { error: 'Realtor profile not complete' },
        { status: 400 }
      );
    }

    // Check if realtor has enough credits
    if (realtorProfile.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits. Please purchase more credits to continue.' },
        { status: 400 }
      );
    }

    // Check if buyer profile exists
    const buyerDoc = await getDoc(doc(db, 'buyerProfiles', leadId));
    
    if (!buyerDoc.exists()) {
      return NextResponse.json(
        { error: 'Buyer lead not found' },
        { status: 404 }
      );
    }

    const buyerProfile = { id: buyerDoc.id, ...buyerDoc.data() };

    // Check if realtor has already purchased this lead
    const existingPurchaseQuery = query(
      collection(db, 'buyerLeadPurchases'),
      where('realtorId', '==', realtorDoc.id),
      where('buyerId', '==', leadId)
    );
    const existingPurchaseDocs = await getDocs(existingPurchaseQuery);

    if (!existingPurchaseDocs.empty) {
      return NextResponse.json(
        { error: 'You have already purchased this lead' },
        { status: 400 }
      );
    }

    // Process the purchase
    const purchaseId = firestoreHelpers.generateId();
    const creditCost = 1; // 1 credit per lead
    const dollarCost = 8.00; // $8 per lead (for tracking)

    // Create the purchase record
    await setDoc(doc(db, 'buyerLeadPurchases', purchaseId), {
      id: purchaseId,
      realtorId: realtorDoc.id,
      buyerId: leadId,
      creditsCost: creditCost,
      purchasePrice: dollarCost,
      status: 'purchased',
      purchasedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    // Deduct credits from realtor
    await updateDoc(doc(db, 'realtors', realtorDoc.id), {
      credits: realtorProfile.credits - creditCost,
      updatedAt: serverTimestamp()
    });

    await logInfo('Realtor purchased buyer lead', {
      action: 'lead_purchase',
      realtorId: realtorProfile.id,
      buyerId: leadId,
      creditsCost: creditCost,
      purchasePrice: dollarCost,
      remainingCredits: realtorProfile.credits - creditCost,
      metadata: {
        buyerCity: buyerProfile.preferredCity,
        buyerState: buyerProfile.preferredState,
        buyerBudget: buyerProfile.maxMonthlyPayment
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Lead purchased successfully',
      purchaseId,
      remainingCredits: realtorProfile.credits - creditCost,
      buyerInfo: {
        name: `${buyerProfile.firstName} ${buyerProfile.lastName}`,
        phone: buyerProfile.phone,
        city: `${buyerProfile.preferredCity}, ${buyerProfile.preferredState}`,
        budget: `$${buyerProfile.maxMonthlyPayment}/month, $${buyerProfile.maxDownPayment} down`
      }
    });

  } catch (error) {
    // Handle role validation errors
    if ((error as Error).message.includes('Access denied') || (error as Error).message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Access denied. Realtor access required.' },
        { status: 403 }
      );
    }

    await logError('Failed to purchase lead', {
      action: 'lead_purchase_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to purchase lead', details: (error as Error).message },
      { status: 500 }
    );
  }
}