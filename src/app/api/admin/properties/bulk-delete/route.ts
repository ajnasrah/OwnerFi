import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

/**
 * POST /api/admin/properties/bulk-delete
 * Bulk delete (mark as inactive) properties from unified properties collection
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

    console.log(`[properties/bulk-delete] Marking ${ids.length} properties as inactive...`);

    let deleted = 0;
    const batch = db.batch();

    for (const id of ids) {
      const propertiesRef = db.collection('properties').doc(id);
      const doc = await propertiesRef.get();

      if (doc.exists) {
        // Mark as inactive instead of hard delete to preserve history
        batch.update(propertiesRef, {
          isActive: false,
          deletedAt: new Date(),
          deletedBy: 'admin_bulk_delete',
        });
        deleted++;
      }
    }

    await batch.commit();

    await logInfo('Bulk deleted properties', {
      action: 'admin_properties_bulk_delete',
      metadata: { count: deleted, requestedIds: ids.length }
    });

    console.log(`[properties/bulk-delete] Marked ${deleted} properties as inactive`);

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
