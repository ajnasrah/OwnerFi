import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  source?: string;
  createdAt?: any;
  opportunityId?: string;
  [key: string]: any;
}

interface DuplicateGroup {
  key: string; // "address|city|state"
  properties: Property[];
  keepId: string;
  deleteIds: string[];
}

/**
 * Find and optionally remove duplicate properties
 * Duplicates are identified by matching: address + city + state
 * Priority for keeping: GHL opportunityId > manual > import
 */
export async function POST(request: NextRequest) {
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

    const { mode } = await request.json(); // mode: 'detect' or 'remove'

    // Fetch all properties
    const propertiesQuery = query(collection(db, 'properties'));
    const propertiesSnapshot = await getDocs(propertiesQuery);

    const properties: Property[] = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Property));

    // Helper function to extract street number and street name only
    const extractStreetKey = (address: string): string => {
      if (!address) return '';

      // Remove common unit/apartment indicators and everything after
      let cleaned = address.toLowerCase().trim();

      // Remove unit/apt/suite etc and everything after
      cleaned = cleaned.replace(/\s+(unit|apt|ste|suite|#|lot)\s+.*$/i, '');
      cleaned = cleaned.replace(/,.*$/, ''); // Remove anything after comma

      // Extract just street number + street name (remove directionals at end, suffixes)
      // Example: "7348 N 38th Ave" -> "7348 n 38th ave"
      // Example: "5284 flowering peach dr" -> "5284 flowering peach"

      return cleaned.trim();
    };

    // Group properties by street number + street name ONLY
    const groupMap = new Map<string, Property[]>();

    for (const property of properties) {
      const streetKey = extractStreetKey(property.address || '');

      if (!streetKey) {
        continue; // Skip properties with missing address
      }

      // Use ONLY street number + street name as the key (no city/state)
      const key = streetKey;

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(property);
    }

    // Find duplicates (groups with more than 1 property)
    const duplicateGroups: DuplicateGroup[] = [];

    for (const [key, props] of groupMap.entries()) {
      if (props.length > 1) {
        // Sort by priority:
        // 1. Properties with GHL opportunityId (source: 'gohighlevel' or has opportunityId field)
        // 2. Properties from manual entry
        // 3. Properties from import
        // 4. Older properties (by createdAt)
        const sorted = props.sort((a, b) => {
          // Priority 1: Has opportunityId that matches the property ID (from GHL webhook)
          const aIsGHL = a.source === 'gohighlevel' || (a.opportunityId && a.id === a.opportunityId);
          const bIsGHL = b.source === 'gohighlevel' || (b.opportunityId && b.id === b.opportunityId);

          if (aIsGHL && !bIsGHL) return -1;
          if (!aIsGHL && bIsGHL) return 1;

          // Priority 2: Manual entries over imports
          if (a.source === 'manual' && b.source !== 'manual') return -1;
          if (a.source !== 'manual' && b.source === 'manual') return 1;

          // Priority 3: Older properties
          const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return aTime - bTime;
        });

        const keepProperty = sorted[0];
        const deleteProperties = sorted.slice(1);

        duplicateGroups.push({
          key,
          properties: props,
          keepId: keepProperty.id,
          deleteIds: deleteProperties.map(p => p.id)
        });
      }
    }

    // If mode is 'detect', just return the duplicates
    if (mode === 'detect') {
      const summary = duplicateGroups.map(group => ({
        address: group.properties[0].address,
        city: group.properties[0].city,
        state: group.properties[0].state,
        duplicateCount: group.properties.length,
        keepId: group.keepId,
        keepSource: group.properties.find(p => p.id === group.keepId)?.source,
        deleteIds: group.deleteIds,
        deleteSources: group.deleteIds.map(id =>
          group.properties.find(p => p.id === id)?.source
        )
      }));

      await logInfo('Duplicate detection completed', {
        action: 'detect_duplicates',
        metadata: {
          totalProperties: properties.length,
          duplicateGroups: duplicateGroups.length,
          totalDuplicates: duplicateGroups.reduce((sum, g) => sum + g.deleteIds.length, 0)
        }
      });

      return NextResponse.json({
        success: true,
        mode: 'detect',
        summary: {
          totalProperties: properties.length,
          duplicateGroups: duplicateGroups.length,
          duplicatesToRemove: duplicateGroups.reduce((sum, g) => sum + g.deleteIds.length, 0),
          propertiesAfterCleanup: properties.length - duplicateGroups.reduce((sum, g) => sum + g.deleteIds.length, 0)
        },
        duplicates: summary
      });
    }

    // If mode is 'remove', delete the duplicates
    if (mode === 'remove') {
      let deletedCount = 0;
      const deletedIds: string[] = [];

      for (const group of duplicateGroups) {
        for (const deleteId of group.deleteIds) {
          try {
            await deleteDoc(doc(db, 'properties', deleteId));
            deletedIds.push(deleteId);
            deletedCount++;
          } catch (error) {
            await logError('Failed to delete duplicate property', {
              action: 'delete_duplicate_error',
              metadata: { propertyId: deleteId }
            }, error as Error);
          }
        }
      }

      await logInfo('Duplicate removal completed', {
        action: 'remove_duplicates',
        metadata: {
          totalDeleted: deletedCount,
          duplicateGroupsProcessed: duplicateGroups.length,
          deletedIds
        }
      });

      return NextResponse.json({
        success: true,
        mode: 'remove',
        summary: {
          duplicateGroupsFound: duplicateGroups.length,
          propertiesDeleted: deletedCount,
          remainingProperties: properties.length - deletedCount
        },
        deletedIds
      });
    }

    return NextResponse.json(
      { error: 'Invalid mode. Use "detect" or "remove"' },
      { status: 400 }
    );

  } catch (error) {
    await logError('Failed to process duplicates', {
      action: 'deduplicate_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to process duplicates' },
      { status: 500 }
    );
  }
}
