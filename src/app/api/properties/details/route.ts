import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  documentId 
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
    const idsParam = searchParams.get('ids');
    
    if (!idsParam) {
      return NextResponse.json({ properties: [] });
    }

    const propertyIds = JSON.parse(idsParam);
    
    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return NextResponse.json({ properties: [] });
    }


    // Firestore 'in' query has a limit of 10, so batch if needed
    const properties = [];
    
    for (let i = 0; i < propertyIds.length; i += 10) {
      const batch = propertyIds.slice(i, i + 10);
      
      const batchQuery = query(
        collection(db, 'properties'),
        where(documentId(), 'in', batch)
      );
      
      const snapshot = await getDocs(batchQuery);
      const batchProperties = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      }));
      
      properties.push(...batchProperties);
    }

    // Sort properties in the same order as requested IDs
    const sortedProperties = properties.sort((a, b) => {
      const aIndex = propertyIds.indexOf(a.id);
      const bIndex = propertyIds.indexOf(b.id);
      return aIndex - bIndex;
    });


    return NextResponse.json({
      properties: sortedProperties,
      count: sortedProperties.length
    });

  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch property details' },
      { status: 500 }
    );
  }
}