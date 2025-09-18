import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  getDocs,
  where,
  orderBy,
  limit as firestoreLimit,
  DocumentData
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import crypto from 'crypto';

const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET || '';

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature || !GHL_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', GHL_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

interface GHLWebhookPayload {
  contactId?: string;
  locationId?: string;
  filters?: {
    city?: string;
    state?: string;
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    maxBeds?: number;
    minBaths?: number;
    maxBaths?: number;
    status?: string;
    limit?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('x-ghl-signature');

    if (!verifyWebhookSignature(body, signature)) {
      logError('Invalid GoHighLevel webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const payload: GHLWebhookPayload = JSON.parse(body);
    logInfo('GoHighLevel list properties webhook received', {
      action: 'webhook_received',
      metadata: {
        contactId: payload.contactId,
        locationId: payload.locationId,
        hasFilters: !!payload.filters,
        filterCount: payload.filters ? Object.keys(payload.filters).length : 0
      }
    });

    const filters = payload.filters || {};
    const limit = filters.limit || 100;

    let propertiesQuery = query(
      collection(db, 'properties'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limit)
    );

    const conditions = [];

    if (filters.city) {
      conditions.push(where('city', '==', filters.city));
    }

    if (filters.state) {
      conditions.push(where('state', '==', filters.state));
    }

    if (filters.status) {
      conditions.push(where('status', '==', filters.status));
    }

    if (filters.minPrice) {
      conditions.push(where('price', '>=', filters.minPrice));
    }

    if (filters.maxPrice) {
      conditions.push(where('price', '<=', filters.maxPrice));
    }

    if (filters.minBeds) {
      conditions.push(where('beds', '>=', filters.minBeds));
    }

    if (filters.maxBeds) {
      conditions.push(where('beds', '<=', filters.maxBeds));
    }

    if (filters.minBaths) {
      conditions.push(where('baths', '>=', filters.minBaths));
    }

    if (filters.maxBaths) {
      conditions.push(where('baths', '<=', filters.maxBaths));
    }

    if (conditions.length > 0) {
      propertiesQuery = query(
        collection(db, 'properties'),
        ...conditions,
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
    }

    const snapshot = await getDocs(propertiesQuery);
    const properties: Array<DocumentData & { id: string }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      properties.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      });
    });

    logInfo(`Retrieved ${properties.length} properties for GoHighLevel`);

    const response = {
      success: true,
      data: {
        properties,
        count: properties.length,
        filters: filters,
        contactId: payload.contactId,
        locationId: payload.locationId
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    logError('Error in GoHighLevel list properties webhook:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}