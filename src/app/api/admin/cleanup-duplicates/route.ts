import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { 
  collection, 
  query, 
  getDocs,
  doc,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
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
    const propertiesQuery = query(collection(db, 'properties'));
    const propertiesSnapshot = await getDocs(propertiesQuery);
    
    const allProperties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      docRef: doc.ref,
      ...doc.data()
    }));

    console.log(`Found ${allProperties.length} total properties`);

    // Group by address (normalize addresses for comparison)
    const addressGroups: Record<string, Array<typeof allProperties[0]>> = {};
    
    allProperties.forEach(property => {
      const normalizedAddress = property.address?.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,]/g, '')
        .trim() || 'unknown';
      
      if (!addressGroups[normalizedAddress]) {
        addressGroups[normalizedAddress] = [];
      }
      addressGroups[normalizedAddress].push(property);
    });

    // Find duplicates
    const duplicateGroups = Object.entries(addressGroups)
      .filter(([address, properties]) => properties.length > 1);

    console.log(`Found ${duplicateGroups.length} duplicate groups`);

    let deletedCount = 0;
    const batch = writeBatch(db);

    // For each duplicate group, keep the most recent one and delete others
    duplicateGroups.forEach(([_address, properties]) => {
      // Sort by creation date, keep the newest
      properties.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });

      // Delete all but the first (most recent)
      properties.slice(1).forEach(property => {
        batch.delete(property.docRef);
        deletedCount++;
      });
    });

    // Execute the batch delete
    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Deleted ${deletedCount} duplicate properties`);
    }

    const remainingCount = allProperties.length - deletedCount;

    return NextResponse.json({
      success: true,
      summary: {
        totalProperties: allProperties.length,
        duplicateGroups: duplicateGroups.length,
        deletedDuplicates: deletedCount,
        remainingProperties: remainingCount
      },
      duplicateGroups: duplicateGroups.map(([address, properties]) => ({
        address,
        count: properties.length,
        kept: properties[0]?.id,
        deleted: properties.slice(1).map(p => p.id)
      }))
    });

  } catch (error) {
    console.error('Cleanup failed:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup duplicates', details: (error as Error).message },
      { status: 500 }
    );
  }
}