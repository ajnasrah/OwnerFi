import { NextRequest, NextResponse } from 'next/server';
import { getTypesenseSearchClient, TYPESENSE_COLLECTIONS } from '@/lib/typesense/client';
import {
  collection,
  query,
  where,
  getDocs,
  limit as firestoreLimit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { rateLimit } from '@/lib/rate-limiter';

/**
 * /api/properties - Get owner finance properties
 *
 * Uses Typesense for fast search with Firestore fallback.
 * This endpoint returns owner_finance properties only (for backward compatibility).
 *
 * For full search with filters, use /api/search/properties instead.
 */
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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Try Typesense first for speed
    const typesenseClient = getTypesenseSearchClient();

    if (typesenseClient) {
      try {
        const result = await typesenseClient.collections(TYPESENSE_COLLECTIONS.PROPERTIES)
          .documents()
          .search({
            q: '*',
            query_by: 'address,city',
            filter_by: 'isActive:=true && dealType:=[owner_finance, both]',
            sort_by: 'createdAt:desc',
            per_page: limit
          });

        const properties = result.hits?.map(hit => {
          const doc = hit.document as Record<string, unknown>;
          return {
            id: doc.id,
            ...doc,
            imageUrl: doc.primaryImage || '',
            imageUrls: [],
            address: doc.address,
            squareFeet: doc.squareFeet,
            listPrice: doc.listPrice,
          };
        }) || [];

        return NextResponse.json({
          properties,
          count: properties.length,
          engine: 'typesense'
        });
      } catch (typesenseError) {
        console.warn('[/api/properties] Typesense error, falling back to Firestore:', typesenseError);
      }
    }

    // Fallback to Firestore - use unified properties collection
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('isOwnerFinance', '==', true),
      firestoreLimit(limit)
    );

    const propertiesSnapshot = await getDocs(propertiesQuery);
    const properties = propertiesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        foundAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        imageUrl: data.firstPropertyImage || data.imageUrl,
        imageUrls: data.imageUrls || [],
        address: data.address || data.streetAddress || data.fullAddress,
        squareFeet: data.squareFeet || data.squareFoot,
        listPrice: data.listPrice || data.price,
      };
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      properties,
      count: properties.length,
      engine: 'firestore'
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