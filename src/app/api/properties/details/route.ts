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
      
      // Query from zillow_imports collection (where all owner finance properties are stored)
      const batchQuery = query(
        collection(db, 'zillow_imports'),
        where(documentId(), 'in', batch)
      );

      const snapshot = await getDocs(batchQuery);
      const batchProperties = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert timestamps and map fields for compatibility
          foundAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
          createdAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
          updatedAt: data.foundAt?.toDate?.()?.toISOString() || data.foundAt,
          // Map field names for compatibility
          imageUrl: data.firstPropertyImage || data.imageUrl,
          imageUrls: data.propertyImages || data.imageUrls || [],
          address: data.streetAddress || data.fullAddress || data.address,
          squareFeet: data.squareFoot || data.squareFeet,
          listPrice: data.price || data.listPrice,
        };
      });
      
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

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch property details' },
      { status: 500 }
    );
  }
}