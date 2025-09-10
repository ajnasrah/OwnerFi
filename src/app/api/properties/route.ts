import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { withErrorHandler, ensureDatabaseConnection, withDatabaseRetry } from '@/lib/api-error-handler';

const getPropertiesHandler = async (request: NextRequest): Promise<NextResponse> => {
  console.log('🔍 Properties API called');
  
  // Ensure database connection
  ensureDatabaseConnection();

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  console.log(`🔍 Fetching ${limit} properties from Firestore Admin`);
  
  // Fetch properties with automatic retry
  const properties = await withDatabaseRetry(async () => {
    const propertiesRef = adminDb.collection('properties');
    const propertiesQuery = propertiesRef
      .where('isActive', '==', true)
      .limit(limit);
    
    const propertiesSnapshot = await propertiesQuery.get();
    console.log(`📊 Found ${propertiesSnapshot.docs.length} properties in Firestore`);
    
    return propertiesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Admin timestamps to readable format
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
    }));
  });

  console.log(`✅ Successfully returning ${properties.length} properties`);
  return NextResponse.json({ 
    properties,
    count: properties.length 
  });
};

export const GET = withErrorHandler(getPropertiesHandler, 'Properties API');