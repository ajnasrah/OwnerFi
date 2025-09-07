import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/auth-utils';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithRole('buyer');
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get buyer profile
    const buyersQuery = query(
      collection(db, 'buyerProfiles'),
      where('userId', '==', session.user.id)
    );
    const buyerDocs = await getDocs(buyersQuery);

    if (buyerDocs.empty) {
      return NextResponse.json(
        { error: 'Buyer profile not found' },
        { status: 404 }
      );
    }

    const buyerDoc = buyerDocs.docs[0];
    const buyerData = buyerDoc.data();
    
    // Calculate property matches for this buyer
    console.log(`🔄 Migrating ${buyerData.preferredCity} buyer to new propertyMatches system`);
    
    // Get all properties in buyer's state
    const propertiesQuery = query(
      collection(db, 'properties'),
      where('isActive', '==', true),
      where('state', '==', buyerData.preferredState),
      firestoreLimit(200)
    );
    
    const snapshot = await getDocs(propertiesQuery);
    const allProperties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter properties that match buyer's criteria
    const userCities = buyerData.cities || buyerData.searchAreaCities || [buyerData.preferredCity];
    const matchingProperties = allProperties.filter((property: any) => {
      const cityMatch = userCities.some(cityName => 
        property.city.toLowerCase() === cityName.toLowerCase()
      );
      const budgetMatch = 
        property.monthlyPayment <= (buyerData.maxMonthlyPayment || 0) &&
        property.downPaymentAmount <= (buyerData.maxDownPayment || 0);
      const requirementsMatch = 
        (!buyerData.minBedrooms || property.bedrooms >= buyerData.minBedrooms) &&
        (!buyerData.minBathrooms || property.bathrooms >= buyerData.minBathrooms);
      
      return cityMatch && budgetMatch && requirementsMatch;
    });

    // Create propertyMatches with existing like/pass status
    const likedIds = buyerData.likedPropertyIds || [];
    const passedIds = buyerData.passedPropertyIds || [];
    
    const propertyMatches = matchingProperties.map((property: any) => {
      let status = 'pending';
      if (likedIds.includes(property.id)) {
        status = 'liked';
      } else if (passedIds.includes(property.id)) {
        status = 'disliked';
      }
      
      return {
        propertyId: property.id,
        status: status,
        addedAt: new Date().toISOString()
      };
    });

    // Update buyer profile with new propertyMatches system
    await updateDoc(doc(db, 'buyerProfiles', buyerDoc.id), {
      propertyMatches: propertyMatches,
      lastMatchUpdate: serverTimestamp(),
      // Keep old fields for now during migration
      likedPropertyIds: likedIds,
      passedPropertyIds: passedIds,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ Migrated buyer to new system: ${propertyMatches.length} total matches`);
    console.log(`📊 Status breakdown:`, {
      pending: propertyMatches.filter(m => m.status === 'pending').length,
      liked: propertyMatches.filter(m => m.status === 'liked').length,
      disliked: propertyMatches.filter(m => m.status === 'disliked').length
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully migrated to new property matching system',
      totalMatches: propertyMatches.length,
      pending: propertyMatches.filter(m => m.status === 'pending').length,
      liked: propertyMatches.filter(m => m.status === 'liked').length,
      disliked: propertyMatches.filter(m => m.status === 'disliked').length
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate to new system' },
      { status: 500 }
    );
  }
}