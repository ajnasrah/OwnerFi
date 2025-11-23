import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    console.log('🔍 [CHECK-PHONE] Searching for phone:', phone);

    // Check if user exists with this phone number
    const usersQuery = query(
      collection(db, 'users'),
      where('phone', '==', phone)
    );
    const userDocs = await getDocs(usersQuery);

    console.log('🔍 [CHECK-PHONE] Found', userDocs.size, 'users with phone:', phone);

    if (userDocs.empty) {
      console.log('❌ [CHECK-PHONE] No user found with phone:', phone);
      return NextResponse.json({
        exists: false
      });
    }

    const userData = userDocs.docs[0].data();
    console.log('✅ [CHECK-PHONE] User exists:', { userId: userDocs.docs[0].id, role: userData.role });

    return NextResponse.json({
      exists: true,
      role: userData.role || 'buyer',
      userId: userDocs.docs[0].id
    });

  } catch (error) {
    console.error('❌ [CHECK-PHONE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check phone number' },
      { status: 500 }
    );
  }
}
