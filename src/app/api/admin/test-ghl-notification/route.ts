/**
 * Admin API - Test GoHighLevel Notification
 *
 * Manually trigger a test SMS notification to verify GoHighLevel integration is working.
 *
 * Route: POST /api/admin/test-ghl-notification
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getSafeDb } from '@/lib/firebase-safe';
import { sendPropertyMatchNotification } from '@/lib/gohighlevel-notifications';
import { BuyerProfile } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const db = getSafeDb();
    const { buyerId, propertyId } = await request.json();

    if (!buyerId || !propertyId) {
      return NextResponse.json(
        { error: 'Missing required fields: buyerId, propertyId' },
        { status: 400 }
      );
    }

    // Fetch buyer profile
    const buyerDoc = await getDoc(doc(db, 'buyerProfiles', buyerId));
    if (!buyerDoc.exists()) {
      return NextResponse.json(
        { error: 'Buyer not found' },
        { status: 404 }
      );
    }

    const buyer = { id: buyerDoc.id, ...buyerDoc.data() } as BuyerProfile;

    // Fetch property
    const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
    if (!propertyDoc.exists()) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    const property = { id: propertyDoc.id, ...propertyDoc.data() } as PropertyListing;

    // Send notification
    console.log(`[Admin] Testing GoHighLevel notification for buyer ${buyerId}, property ${propertyId}`);

    const result = await sendPropertyMatchNotification({
      buyer,
      property,
      trigger: 'manual_trigger',
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        buyer: {
          id: buyer.id,
          name: `${buyer.firstName} ${buyer.lastName}`,
          phone: buyer.phone,
          smsEnabled: buyer.smsNotifications,
        },
        property: {
          id: property.id,
          address: property.address,
          city: property.city,
        },
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully',
      logId: result.logId,
      buyer: {
        id: buyer.id,
        name: `${buyer.firstName} ${buyer.lastName}`,
        phone: buyer.phone,
      },
      property: {
        id: property.id,
        address: property.address,
        city: property.city,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Admin] Test notification failed:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

// GET endpoint to list buyers and properties for testing
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const db = getSafeDb();

    // Get a few active buyers
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('isActive', '==', true)
    );
    const buyersSnapshot = await getDocs(buyersQuery);
    const buyers = buyersSnapshot.docs.slice(0, 10).map(doc => ({
      id: doc.id,
      name: `${doc.data().firstName} ${doc.data().lastName}`,
      phone: doc.data().phone,
      city: doc.data().preferredCity || doc.data().city,
      state: doc.data().preferredState || doc.data().state,
      smsEnabled: doc.data().smsNotifications !== false,
    }));

    // Get a few active properties
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true)
    );
    const propertiesSnapshot = await getDocs(propertiesQuery);
    const properties = propertiesSnapshot.docs.slice(0, 10).map(doc => ({
      id: doc.id,
      address: doc.data().address,
      city: doc.data().city,
      state: doc.data().state,
      monthlyPayment: doc.data().monthlyPayment,
      downPaymentAmount: doc.data().downPaymentAmount,
    }));

    return NextResponse.json({
      success: true,
      buyers,
      properties,
      note: 'Use POST /api/admin/test-ghl-notification with buyerId and propertyId to send a test notification',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
