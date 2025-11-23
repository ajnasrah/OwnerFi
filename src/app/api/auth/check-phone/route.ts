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

    // Normalize phone number - strip all non-digits
    const cleaned = phone.replace(/\D/g, '');
    const last10Digits = cleaned.slice(-10); // Get last 10 digits (removes country code if present)

    // Generate multiple possible formats that might be stored in DB
    const phoneFormats = [
      phone,                                                           // Original format (e.g., +19018319661)
      last10Digits,                                                    // Just digits (e.g., 9018319661)
      `+1${last10Digits}`,                                            // E.164 format (e.g., +19018319661)
      `(${last10Digits.slice(0,3)}) ${last10Digits.slice(3,6)}-${last10Digits.slice(6)}`, // Formatted (e.g., (901) 831-9661)
    ];

    console.log('🔍 [CHECK-PHONE] Searching for formats:', phoneFormats);

    // Try each format
    let userDocs: any = null;
    let foundFormat = '';

    for (const format of phoneFormats) {
      const usersQuery = query(
        collection(db, 'users'),
        where('phone', '==', format)
      );
      const docs = await getDocs(usersQuery);

      if (!docs.empty) {
        userDocs = docs;
        foundFormat = format;
        console.log('✅ [CHECK-PHONE] Found match with format:', format);
        break;
      }
    }

    if (!userDocs || userDocs.empty) {
      console.log('❌ [CHECK-PHONE] No user found with any phone format');
      return NextResponse.json({
        exists: false
      });
    }

    const userData = userDocs.docs[0].data();
    console.log('✅ [CHECK-PHONE] User exists:', {
      userId: userDocs.docs[0].id,
      role: userData.role,
      foundFormat: foundFormat,
      totalMatches: userDocs.size,
      hasPassword: !!userData.password
    });

    // ✅ USER EXISTS: Return true regardless of whether they have password or not
    // The auth flow will handle signing them in
    console.log('✅ [CHECK-PHONE] User found, allowing sign in');
    return NextResponse.json({
      exists: true,
      role: userData.role || 'buyer',
      userId: userDocs.docs[0].id,
      hasPassword: !!userData.password // Let client know if this is an old account
    });

  } catch (error) {
    console.error('❌ [CHECK-PHONE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check phone number' },
      { status: 500 }
    );
  }
}
