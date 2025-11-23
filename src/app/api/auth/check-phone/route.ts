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

    // Check if user exists with this phone number
    const usersQuery = query(
      collection(db, 'users'),
      where('phone', '==', phone)
    );
    const userDocs = await getDocs(usersQuery);

    if (userDocs.empty) {
      return NextResponse.json({
        exists: false
      });
    }

    const userData = userDocs.docs[0].data();

    return NextResponse.json({
      exists: true,
      role: userData.role || 'buyer',
      userId: userDocs.docs[0].id
    });

  } catch (error) {
    console.error('Error checking phone:', error);
    return NextResponse.json(
      { error: 'Failed to check phone number' },
      { status: 500 }
    );
  }
}
