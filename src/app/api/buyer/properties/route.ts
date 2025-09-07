import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  documentId
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getSessionWithRole } from '@/lib/auth-utils';

/**
 * UNIFIED PROPERTY DISPLAY API
 * 
 * Used by both:
 * - Buyer dashboard (to show their properties) 
 * - Realtor buyer-properties page (to show buyer's properties)
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buyerId = searchParams.get('buyerId');
    const status = searchParams.get('status') || 'pending'; // 'pending', 'liked', 'disliked', 'all'
    
    if (!buyerId) {
      return NextResponse.json({ error: 'Missing buyerId' }, { status: 400 });
    }

    // Get property matches for this buyer
    let matchesQuery;
    if (status === 'all') {
      matchesQuery = query(
        collection(db, 'propertyMatches'),
        where('buyerId', '==', buyerId)
      );
    } else {
      matchesQuery = query(
        collection(db, 'propertyMatches'),
        where('buyerId', '==', buyerId),
        where('status', '==', status)
      );
    }
    
    const matchesSnapshot = await getDocs(matchesQuery);
    const propertyMatches = matchesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (propertyMatches.length === 0) {
      return NextResponse.json({
        properties: [],
        totalMatches: 0,
        status: status
      });
    }

    console.log(`📋 Found ${propertyMatches.length} ${status} property matches for buyer`);

    // Get property details for the matched property IDs
    const propertyIds = propertyMatches.map(match => match.propertyId);
    
    // Batch fetch property details (handle Firestore 'in' limit of 10)
    const allProperties = [];
    
    for (let i = 0; i < propertyIds.length; i += 10) {
      const batch = propertyIds.slice(i, i + 10);
      
      const batchQuery = query(
        collection(db, 'properties'),
        where(documentId(), 'in', batch)
      );
      
      const batchSnapshot = await getDocs(batchQuery);
      const batchProperties = batchSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      allProperties.push(...batchProperties);
    }

    // Combine property data with match data
    const propertiesWithMatchData = allProperties.map(property => {
      const match = propertyMatches.find(m => m.propertyId === property.id);
      return {
        ...property,
        matchScore: match?.matchScore || 0,
        matchReasons: match?.matchReasons || [],
        buyerStatus: match?.status || 'pending',
        matchedAt: match?.matchedAt
      };
    });

    // Sort by match score (best matches first)
    propertiesWithMatchData.sort((a, b) => b.matchScore - a.matchScore);

    console.log(`✅ Returning ${propertiesWithMatchData.length} properties with match data`);

    return NextResponse.json({
      properties: propertiesWithMatchData,
      totalMatches: propertiesWithMatchData.length,
      status: status,
      averageMatchScore: propertiesWithMatchData.reduce((sum, p) => sum + p.matchScore, 0) / propertiesWithMatchData.length
    });

  } catch (error) {
    console.error('Property display error:', error);
    return NextResponse.json({ error: 'Failed to load properties' }, { status: 500 });
  }
}