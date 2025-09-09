import { NextRequest, NextResponse } from 'next/server';
import { 
  collection, 
  getDocs, 
  deleteDoc,
  doc,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Delete the mock Dallas properties I created for testing
 */
export async function DELETE() {
  try {
    // Get all properties that start with "dallas-test-"
    const snapshot = await getDocs(collection(db, 'properties'));
    
    const mockProperties = [];
    const deletePromises = [];
    
    for (const propertyDoc of snapshot.docs) {
      const propertyId = propertyDoc.id;
      if (propertyId.startsWith('dallas-test-')) {
        mockProperties.push({
          id: propertyId,
          address: propertyDoc.data().address,
          city: propertyDoc.data().city
        });
        deletePromises.push(deleteDoc(doc(db, 'properties', propertyId)));
      }
    }
    
    // Delete all mock properties
    await Promise.all(deletePromises);
    
    return NextResponse.json({
      success: true,
      message: `Deleted ${mockProperties.length} mock Dallas properties`,
      deletedProperties: mockProperties
    });
    
  } catch (error) {
    console.error('Failed to delete mock properties:', error);
    return NextResponse.json(
      { error: 'Failed to delete mock properties', details: (error as Error).message },
      { status: 500 }
    );
  }
}