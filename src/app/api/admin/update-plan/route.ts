import { NextRequest, NextResponse } from 'next/server';
import { 
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { realtorId, plan } = await request.json();
    
    // Update realtor document
    await updateDoc(doc(db, 'realtors', realtorId), {
      currentPlan: plan,
      updatedAt: serverTimestamp()
    });
    
    // Update all subscription records for this realtor
    const subscriptionsQuery = query(
      collection(db, 'realtorSubscriptions'),
      where('realtorId', '==', realtorId)
    );
    const subscriptionDocs = await getDocs(subscriptionsQuery);
    
    for (const subscriptionDoc of subscriptionDocs.docs) {
      await updateDoc(doc(db, 'realtorSubscriptions', subscriptionDoc.id), {
        plan: plan,
        updatedAt: serverTimestamp()
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated plan to ${plan}`,
      updatedSubscriptions: subscriptionDocs.docs.length
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}