import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Admin access control
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Get all properties
    const propertiesQuery = query(adminDb.collection('properties'));
    const propertiesSnapshot = await propertiesQuery.get();
    
    const allProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      docRef: doc.ref,
      ...doc.data()
    }));

    console.log(`Found ${allProperties.length} properties to delete`);

    // Delete ALL properties to start fresh
    const batch = writeBatch(adminDb);
    let deletedCount = 0;

    allProperties.forEach(property => {
      batch.delete(property.docRef);
      deletedCount++;
    });

    // Execute the batch delete
    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} properties`);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} properties. Database is now clean.`,
      deletedCount
    });

  } catch (error) {
    console.error('Database cleanup failed:', error);
    return NextResponse.json(
      { error: 'Failed to clean database', details: (error as Error).message },
      { status: 500 }
    );
  }
}