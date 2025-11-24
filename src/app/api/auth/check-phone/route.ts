import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/unified-db';
import { normalizePhone, isValidPhone } from '@/lib/phone-utils';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!isValidPhone(phone)) {
      console.log('❌ [CHECK-PHONE] Invalid phone format:', phone);
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Normalize phone to E.164 format
    const normalizedPhone = normalizePhone(phone);
    console.log('🔍 [CHECK-PHONE] Searching for phone:', phone, '→', normalizedPhone);

    // Use unified DB method - it tries all formats automatically
    const user = await unifiedDb.users.findByPhone(normalizedPhone);

    if (!user) {
      console.log('❌ [CHECK-PHONE] No user found');
      return NextResponse.json({
        exists: false
      });
    }

    console.log('✅ [CHECK-PHONE] User exists:', {
      userId: user.id,
      role: user.role,
      phone: user.phone,
      hasPassword: !!user.password
    });

    // ✅ USER EXISTS: Return true regardless of whether they have password or not
    // The auth flow will handle signing them in
    return NextResponse.json({
      exists: true,
      role: user.role || 'buyer',
      userId: user.id,
      hasPassword: !!user.password // Let client know if this is an old account
    });

  } catch (error) {
    console.error('❌ [CHECK-PHONE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check phone number' },
      { status: 500 }
    );
  }
}
