import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

/**
 * POST /api/admin/properties/bulk-delete
 * Bulk delete properties from zillow_imports and properties collections
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No property IDs provided' },
        { status: 400 }
      );
    }

    const db = await getAdminDb();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    console.log(`[properties/bulk-delete] Deleting ${ids.length} properties...`);

    let deleted = 0;
    const batch = db.batch();

    for (const id of ids) {
      // Try to delete from both collections
      const zillowRef = db.collection('zillow_imports').doc(id);
      const propertiesRef = db.collection('properties').doc(id);

      // Check which collection has the doc
      const [zillowDoc, propertiesDoc] = await Promise.all([
        zillowRef.get(),
        propertiesRef.get()
      ]);

      if (zillowDoc.exists) {
        batch.delete(zillowRef);
        deleted++;
      }
      if (propertiesDoc.exists) {
        batch.delete(propertiesRef);
        // Only increment if not already counted from zillow_imports
        if (!zillowDoc.exists) {
          deleted++;
        }
      }
    }

    await batch.commit();

    await logInfo('Bulk deleted properties', {
      action: 'admin_properties_bulk_delete',
      metadata: { count: deleted, requestedIds: ids.length }
    });

    console.log(`[properties/bulk-delete] Deleted ${deleted} properties`);

    return NextResponse.json({
      success: true,
      deleted,
      requested: ids.length
    });
  } catch (error) {
    await logError('Failed to bulk delete properties', {
      action: 'admin_properties_bulk_delete_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to delete properties' },
      { status: 500 }
    );
  }
}
