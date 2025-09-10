import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Properties API called');
    
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      console.error('❌ Firebase Admin database not initialized');
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    console.log(`🔍 Fetching ${limit} properties from Firestore Admin`);
    
    // Fetch properties from Firebase Admin
    const propertiesRef = adminDb.collection('properties');
    const propertiesQuery = propertiesRef
      .where('isActive', '==', true)
      .limit(limit);
    
    const propertiesSnapshot = await propertiesQuery.get();
    console.log(`📊 Found ${propertiesSnapshot.docs.length} properties in Firestore`);
    
    const properties = propertiesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Firestore Admin timestamps to readable format
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
    }));

    console.log(`✅ Successfully returning ${properties.length} properties`);
    return NextResponse.json({ 
      properties,
      count: properties.length 
    });

  } catch (error) {
    console.error('❌ Properties API error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });

    return NextResponse.json(
      { error: 'Failed to fetch properties', details: error.message },
      { status: 500 }
    );
  }
}