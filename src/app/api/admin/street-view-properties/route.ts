import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ExtendedSession } from '@/types/session';

/**
 * Get all properties using Google Street View images
 */
export async function GET(_request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Admin access control
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Get all properties
    const propertiesQuery = query(collection(db, 'properties'));
    const snapshot = await getDocs(propertiesQuery);

    // Filter for Street View images
    const streetViewProperties = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(property => {
        // Check if imageQuality field indicates Street View
        if ((property as any).imageQuality?.isStreetView) {
          return true;
        }

        // Also check image URLs directly for Street View patterns
        const imageUrl = (property as any).imageUrl || ((property as any).imageUrls?.[0]);
        if (imageUrl && (
          imageUrl.includes('maps.googleapis.com/maps/api/streetview') ||
          imageUrl.includes('maps.google.com') ||
          imageUrl.includes('streetview')
        )) {
          return true;
        }

        return false;
      });

    return NextResponse.json({
      properties: streetViewProperties,
      count: streetViewProperties.length
    });

  } catch (error) {
    console.error('Failed to fetch Street View properties:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Street View properties' },
      { status: 500 }
    );
  }
}
