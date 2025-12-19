import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError, logInfo } from '@/lib/logger';
import { ExtendedSession } from '@/types/session';

export async function POST(_request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Strict admin access control
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    await logInfo('Starting database cleanup - deleting all properties', {
      action: 'admin_clean_database',
      metadata: { adminUser: session.user.email }
    });

    // Get all properties
    const propertiesSnapshot = await getDocs(collection(db, 'properties'));
    const totalProperties = propertiesSnapshot.size;

    let deletedCount = 0;
    let failedCount = 0;
    const failures: string[] = [];

    // Delete all properties
    for (const propertyDoc of propertiesSnapshot.docs) {
      try {
        await deleteDoc(doc(db, 'properties', propertyDoc.id));
        deletedCount++;
      } catch (error) {
        failedCount++;
        failures.push(`${propertyDoc.id}: ${(error as Error).message}`);
        await logError('Failed to delete property during cleanup', {
          action: 'admin_clean_database_error',
          metadata: { propertyId: propertyDoc.id }
        }, error as Error);
      }
    }

    const message = `Database cleaned: ${deletedCount} properties deleted${failedCount > 0 ? `, ${failedCount} failed` : ''}`;

    await logInfo('Database cleanup completed', {
      action: 'admin_clean_database',
      metadata: {
        totalProperties,
        deletedCount,
        failedCount,
        adminUser: session.user.email
      }
    });

    return NextResponse.json({
      success: true,
      message,
      totalProperties,
      deletedCount,
      failedCount,
      failures: failures.slice(0, 10) // Limit failures shown
    });

  } catch (error) {
    await logError('Database cleanup failed', {
      action: 'admin_clean_database_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to clean database' },
      { status: 500 }
    );
  }
}