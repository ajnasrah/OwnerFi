import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit as firestoreLimit,
  orderBy 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // Cap at 100 for performance
    
    // Fetch properties from Firebase with proper indexing
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'), // Add ordering for consistent pagination
      firestoreLimit(limit)
    );
    
    const propertiesSnapshot = await getDocs(propertiesQuery);
    const properties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore timestamps to readable format
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
    }));

    return NextResponse.json({ 
      properties,
      count: properties.length 
    });

  } catch (error) {

    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    );
  }
}