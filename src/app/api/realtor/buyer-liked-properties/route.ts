import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { FirebaseDB } from '@/lib/firebase-db';
import { ExtendedSession } from '@/types/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as any as ExtendedSession;
    
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

    const likedPropertyIds = (buyerProfile as any).likedProperties || [];
    
    if (likedPropertyIds.length === 0) {
      return NextResponse.json({ 
        buyer: {
          firstName: (buyerProfile as any).firstName,
          lastName: (buyerProfile as any).lastName
        },
        properties: [] 
      });
    }

    // Fetch property details directly from properties database
    const likedProperties = [];
    
    for (const propertyId of likedPropertyIds) {
      try {
        const property = await FirebaseDB.getDocument('properties', propertyId) as any;
        if (property) {
          // Format property data with all needed fields
          likedProperties.push({
            id: propertyId,
            address: property.address || '',
            city: property.city || '',
            state: property.state || '',
            bedrooms: property.bedrooms || 0,
            bathrooms: property.bathrooms || 0,
            squareFeet: property.squareFeet || 0,
            listPrice: property.listPrice || 0,
            monthlyPayment: property.monthlyPayment || 0,
            downPaymentAmount: property.downPaymentAmount || 0,
            imageUrl: property.imageUrl || property.zillowImageUrl,
            ...property
          });
        }
      } catch (err) {
        console.error(`Failed to load property ${propertyId}:`, err);
      }
    }

    return NextResponse.json({
      buyer: {
        firstName: (buyerProfile as any).firstName,
        lastName: (buyerProfile as any).lastName
      },
      properties: likedProperties
    });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}