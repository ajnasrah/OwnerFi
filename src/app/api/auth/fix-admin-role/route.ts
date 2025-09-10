import { NextRequest, NextResponse } from 'next/server';
import { logInfo, logError } from '@/lib/logger';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    // Check if Firebase Admin is initialized
    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 503 });
    }

  try {
    // Find admin user by email
    const userDocs = await adminDb.collection('users').where('email', '==', 'admin@prosway.com').get();

    if (userDocs.empty) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 }
      );
    }

    const userDoc = userDocs.docs[0];
    const userData = userDoc.data();
    
    // Update user role to admin
    await updateDoc(userDoc.ref, {
      role: 'admin',
      updatedAt: new Date()
    });

    await logInfo('Admin role updated', {
      action: 'admin_role_fix',
      userId: userDoc.id,
      metadata: {
        email: 'admin@prosway.com',
        oldRole: userData.role,
        newRole: 'admin'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Admin role updated successfully',
      userId: userDoc.id,
      oldRole: userData.role,
      newRole: 'admin'
    });

  } catch (error) {
    await logError('Failed to fix admin role', {
      action: 'admin_role_fix_error'
    }, error as Error);

    return NextResponse.json(
      { error: 'Failed to update admin role' },
      { status: 500 }
    );
  }
}