import { NextRequest, NextResponse } from 'next/server';
import {
  collection,
  query,
  where,
  getDocs,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { rateLimit } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 100 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitKey = `properties:${ip}`;
    const rateLimitResult = await rateLimit(rateLimitKey, 100, 60);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          }
        }
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Cap at 100 for performance

    // Fetch properties from zillow_imports collection (where all owner finance properties are stored)
    // Note: Removed orderBy to avoid requiring composite index
    // Properties will be sorted client-side if needed
    const propertiesQuery = query(
      collection(db, 'zillow_imports'),
      where('ownerFinanceVerified', '==', true),
      firestoreLimit(limit)
    );

    const propertiesSnapshot = await getDocs(propertiesQuery);
    const properties = propertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to readable format
        foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
        createdAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
        updatedAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
        // Ensure image fields are mapped correctly for PropertyCard
        imageUrl: data.firstPropertyImage || data.imageUrl,
        imageUrls: data.propertyImages || data.imageUrls || [],
        // Map field names for compatibility
        address: data.streetAddress || data.fullAddress,
        squareFeet: data.squareFoot || data.squareFeet,
        listPrice: data.price || data.listPrice,
      };
    })
    // Sort by foundAt client-side (newest first)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.foundAt || 0).getTime();
      const dateB = new Date(b.foundAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ 
      properties,
      count: properties.length 
    });

  } catch (error) {
    console.error('Error fetching properties:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}