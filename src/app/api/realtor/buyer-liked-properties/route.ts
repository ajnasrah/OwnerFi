import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { FirebaseDB } from '@/lib/firebase-db';
import { ExtendedSession } from '@/types/session';
import { BuyerProfile } from '@/lib/firebase-models';
import { PropertyListing } from '@/lib/property-schema';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession;
    
    if (!session?.user || session.user.role !== 'realtor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const buyerId = searchParams.get('buyerId');

    if (!buyerId) {
      return NextResponse.json({ error: 'Buyer ID required' }, { status: 400 });
    }

    // Get buyer's profile to access their liked properties
    const buyerProfile = await FirebaseDB.getDocument('buyerProfiles', buyerId);
    
    if (!buyerProfile) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });
    }

    const likedPropertyIds = (buyerProfile as BuyerProfile).likedPropertyIds || [];
    
    if (likedPropertyIds.length === 0) {
      return NextResponse.json({ 
        buyer: {
          firstName: (buyerProfile as BuyerProfile).firstName,
          lastName: (buyerProfile as BuyerProfile).lastName
        },
        properties: [] 
      });
    }

    // PERFORMANCE FIX: Batch fetch properties instead of N+1 queries
    // Firestore 'in' operator supports max 10 values, so we batch
    const likedProperties = [];

    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    for (let i = 0; i < likedPropertyIds.length; i += 10) {
      const batchIds = likedPropertyIds.slice(i, i + 10);

      try {
        const batchQuery = query(
          collection(db, 'properties'),
          where(documentId(), 'in', batchIds)
        );
        const batchSnapshot = await getDocs(batchQuery);

        batchSnapshot.docs.forEach(doc => {
          const property = doc.data() as PropertyListing;
          // Format property data with all needed fields
          likedProperties.push({
            ...property,
            address: property.address || '',
            city: property.city || '',
            state: property.state || '',
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0,
            squareFeet: property.squareFeet || 0,
            listPrice: property.listPrice || 0,
            monthlyPayment: property.monthlyPayment || 0,
            downPaymentAmount: property.downPaymentAmount || 0,
            imageUrl: property.imageUrl || property.zillowImageUrl
          });
        });
      } catch (err) {
        console.error('Failed to load property batch:', err);
      }
    }

    return NextResponse.json({
      buyer: {
        firstName: (buyerProfile as BuyerProfile).firstName,
        lastName: (buyerProfile as BuyerProfile).lastName
      },
      properties: likedProperties
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}