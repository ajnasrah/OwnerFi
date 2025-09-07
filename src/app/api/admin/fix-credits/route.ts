import { NextRequest, NextResponse } from 'next/server';
import { 
  doc,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { firestoreHelpers } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    // Add back 10 credits to your account
    const realtorId = 'idjfqlXrzobyRoFVRTUO';
    
    await updateDoc(doc(db, 'realtors', realtorId), {
      credits: 758, // 748 + 10 Professional credits
      updatedAt: serverTimestamp()
    });
    
    // Add transaction record
    await setDoc(doc(db, 'transactions', firestoreHelpers.generateId()), {
      realtorId: realtorId,
      type: 'credit_adjustment',
      description: 'Added Professional Package credits (10 credits)',
      amount: 0,
      credits: 10,
      createdAt: serverTimestamp()
    });
    
    return NextResponse.json({
      success: true,
      message: 'Added 10 Professional credits',
      newBalance: 758
    });
    
  } catch (error) {
    console.error('Failed to fix credits:', error);
    return NextResponse.json(
      { error: 'Failed to fix credits' },
      { status: 500 }
    );
  }
}