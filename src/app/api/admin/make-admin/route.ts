/**
 * Make a user admin by phone number
 *
 * Protected by CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { FirebaseDB } from '@/lib/firebase-db';

export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number required' },
        { status: 400 }
      );
    }

    console.log(`\n🔍 Searching for user with phone: ${phone}\n`);

    // Normalize phone - try multiple formats
    const cleaned = phone.replace(/\D/g, '');
    const last10Digits = cleaned.slice(-10);

    const phoneFormats = [
      phone,
      last10Digits,
      `+1${last10Digits}`,
      `(${last10Digits.slice(0,3)}) ${last10Digits.slice(3,6)}-${last10Digits.slice(6)}`,
    ];

    console.log('Trying phone formats:', phoneFormats);

    let userDoc: any = null;
    let foundFormat = '';

    for (const format of phoneFormats) {
      const users = await FirebaseDB.queryDocuments('users', [
        { field: 'phone', operator: '==', value: format }
      ], 1);

      if (users && users.length > 0) {
        userDoc = users[0];
        foundFormat = format;
        console.log(`✅ Found user with format: ${format}`);
        break;
      }
    }

    if (!userDoc) {
      return NextResponse.json({
        success: false,
        error: 'User not found with any phone format',
        tried: phoneFormats
      }, { status: 404 });
    }

    const userId = userDoc.id;

    console.log('\n📋 Current user data:', {
      id: userId,
      name: userDoc.name,
      email: userDoc.email,
      phone: userDoc.phone,
      role: userDoc.role
    });

    if (userDoc.role === 'admin') {
      return NextResponse.json({
        success: true,
        message: 'User is already admin',
        user: {
          id: userId,
          name: userDoc.name,
          email: userDoc.email,
          phone: userDoc.phone,
          role: 'admin'
        }
      });
    }

    // Update to admin (with automatic buyer profile cleanup)
    console.log('\n🔧 Updating user to admin...');
    await FirebaseDB.changeUserRole(userId, 'admin', userDoc.role);

    console.log('✅ Successfully updated user to admin!');

    return NextResponse.json({
      success: true,
      message: 'User updated to admin successfully',
      user: {
        id: userId,
        name: userDoc.name,
        email: userDoc.email,
        phone: userDoc.phone,
        role: 'admin',
        previousRole: userDoc.role
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// SECURITY: GET handler removed
// Passing secrets via query params is insecure because:
// 1. Query params are logged in server access logs
// 2. Query params can leak via Referer headers
// 3. Query params appear in browser history
// Use POST with Authorization header instead
