/**
 * Do Not Sell / CCPA Opt-Out API
 *
 * Allows users to opt out of having their personal information sold or shared.
 * Marks their buyer profile as unavailable for purchase.
 *
 * Route: POST /api/do-not-sell
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAllPhoneFormats } from '@/lib/phone-utils';

interface OptOutRequest {
  phone?: string;
  email?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: OptOutRequest = await request.json();
    const { phone, email } = body;

    // Validate at least one identifier
    if (!phone && !email) {
      return NextResponse.json(
        { success: false, error: 'Please provide a phone number or email address' },
        { status: 400 }
      );
    }

    // Initialize Firebase Admin
    const db = await getAdminDb();
    if (!db) {
      console.error('[Do Not Sell] Firebase Admin not initialized');
      return NextResponse.json(
        { success: false, error: 'Service temporarily unavailable' },
        { status: 500 }
      );
    }

    let buyerDoc = null;
    let lookupMethod = '';

    // Try phone lookup using all possible formats
    if (phone) {
      const phoneFormats = getAllPhoneFormats(phone);

      for (const phoneFormat of phoneFormats) {
        const snapshot = await db.collection('buyerProfiles')
          .where('phone', '==', phoneFormat)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          buyerDoc = snapshot.docs[0];
          lookupMethod = 'phone';
          break;
        }
      }
    }

    // Try email lookup
    if (!buyerDoc && email) {
      const normalizedEmail = email.toLowerCase().trim();
      const snapshot = await db.collection('buyerProfiles')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        buyerDoc = snapshot.docs[0];
        lookupMethod = 'email';
      }
    }

    // Handle buyer not found
    if (!buyerDoc) {
      console.log(`[Do Not Sell] No buyer found - phone: ${phone}, email: ${email}`);
      return NextResponse.json({
        success: false,
        error: 'We could not find your information in our system'
      }, { status: 404 });
    }

    const buyerData = buyerDoc.data();

    // Check if already opted out
    if (buyerData?.isAvailableForPurchase === false && buyerData?.optedOutAt) {
      return NextResponse.json({
        success: true,
        message: 'Your information is already marked as do not sell'
      });
    }

    // Update buyer profile to mark as unavailable
    await db.collection('buyerProfiles').doc(buyerDoc.id).update({
      isAvailableForPurchase: false,
      isActive: false,
      optedOutAt: new Date(),
      optOutReason: 'ccpa_do_not_sell',
      optOutSource: 'website_form',
      updatedAt: new Date(),
    });

    // Log the opt-out event
    await db.collection('buyerOptOutLogs').add({
      buyerId: buyerDoc.id,
      buyerPhone: buyerData?.phone || phone || null,
      buyerEmail: buyerData?.email || email || null,
      reason: 'ccpa_do_not_sell',
      source: 'website_form',
      lookupMethod,
      previousStatus: {
        isAvailableForPurchase: buyerData?.isAvailableForPurchase ?? null,
        isActive: buyerData?.isActive ?? null,
      },
      createdAt: new Date(),
    });

    console.log(`[Do Not Sell] Buyer ${buyerDoc.id} marked as unavailable via ${lookupMethod}`);

    return NextResponse.json({
      success: true,
      message: 'Your information has been marked as do not sell'
    });

  } catch (error) {
    console.error('[Do Not Sell] Error:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
