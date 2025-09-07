import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  collection, 
  query, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    // Admin access control
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Get all properties
    const propertiesQuery = query(collection(db, 'properties'));
    const propertiesSnapshot = await getDocs(propertiesQuery);
    
    const allProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      docRef: doc.ref,
      ...doc.data()
    }));

    console.log(`Found ${allProperties.length} properties to delete`);

    // Delete ALL properties to start fresh
    const batch = writeBatch(db);
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