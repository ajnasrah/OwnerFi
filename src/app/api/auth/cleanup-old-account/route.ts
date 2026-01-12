import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo, logError } from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Deletes an old email/password account after user creates new phone-only account
 * This cleans up:
 * - User document
 * - BuyerProfile (if exists)
 * - RealtorData (nested in user doc, so auto-deleted)
 * - Any other user-linked data
 *
 * SECURITY: Requires authenticated session and ownership verification
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in' },
        { status: 401 }
      );
    }

    const { oldAccountId, newAccountId } = await request.json();

    if (!oldAccountId || !newAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // SECURITY: Verify the newAccountId matches the logged-in user
    if (session.user.id !== newAccountId) {
      await logError('Unauthorized cleanup attempt - user ID mismatch', {
        action: 'cleanup_old_account_unauthorized',
        userId: session.user.id,
        metadata: { attemptedNewAccountId: newAccountId, oldAccountId }
      });
      return NextResponse.json(
        { error: 'Unauthorized - can only cleanup your own accounts' },
        { status: 403 }
      );
    }

    // SECURITY: Verify the old account shares the same email or phone as the new account
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    const oldAccountDoc = await getDoc(doc(db, 'users', oldAccountId));
    const newAccountDoc = await getDoc(doc(db, 'users', newAccountId));

    if (!oldAccountDoc.exists() || !newAccountDoc.exists()) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const oldData = oldAccountDoc.data();
    const newData = newAccountDoc.data();

    // Verify accounts are linked by email or phone
    const emailMatch = oldData.email && newData.email &&
      oldData.email.toLowerCase() === newData.email.toLowerCase();
    const phoneMatch = oldData.phone && newData.phone &&
      oldData.phone === newData.phone;

    if (!emailMatch && !phoneMatch) {
      await logError('Unauthorized cleanup attempt - accounts not linked', {
        action: 'cleanup_old_account_not_linked',
        userId: session.user.id,
        metadata: { oldAccountId, newAccountId }
      });
      return NextResponse.json(
        { error: 'Unauthorized - accounts must share email or phone' },
        { status: 403 }
      );
    }

    console.log('🗑️ [CLEANUP-OLD-ACCOUNT] Starting cleanup:', {
      oldAccountId,
      newAccountId,
      requestedBy: session.user.id
    });

    // 1. Find and delete old buyer profile (if exists)
    try {
      const buyerProfilesQuery = query(
        collection(db, 'buyerProfiles'),
        where('userId', '==', oldAccountId)
      );
      const buyerProfileDocs = await getDocs(buyerProfilesQuery);

      if (!buyerProfileDocs.empty) {
        for (const buyerDoc of buyerProfileDocs.docs) {
          await deleteDoc(doc(db, 'buyerProfiles', buyerDoc.id));
          console.log('✅ [CLEANUP-OLD-ACCOUNT] Deleted buyer profile:', buyerDoc.id);
        }
      } else {
        console.log('ℹ️ [CLEANUP-OLD-ACCOUNT] No buyer profile found for old account');
      }
    } catch (error) {
      console.error('⚠️ [CLEANUP-OLD-ACCOUNT] Error deleting buyer profile:', error);
      // Continue with cleanup even if this fails
    }

    // 2. Find and delete old realtor profile (if exists)
    // Note: realtorData is stored IN the user document, so it will be auto-deleted
    // But check if there's a separate realtors collection entry
    try {
      const realtorsQuery = query(
        collection(db, 'realtors'),
        where('userId', '==', oldAccountId)
      );
      const realtorDocs = await getDocs(realtorsQuery);

      if (!realtorDocs.empty) {
        for (const realtorDoc of realtorDocs.docs) {
          await deleteDoc(doc(db, 'realtors', realtorDoc.id));
          console.log('✅ [CLEANUP-OLD-ACCOUNT] Deleted realtor profile:', realtorDoc.id);
        }
      } else {
        console.log('ℹ️ [CLEANUP-OLD-ACCOUNT] No realtor profile found for old account');
      }
    } catch (error) {
      console.error('⚠️ [CLEANUP-OLD-ACCOUNT] Error deleting realtor profile:', error);
      // Continue with cleanup even if this fails
    }

    // 3. Delete the old user document (this also deletes nested realtorData)
    try {
      await deleteDoc(doc(db, 'users', oldAccountId));
      console.log('✅ [CLEANUP-OLD-ACCOUNT] Deleted old user document:', oldAccountId);
    } catch (error) {
      console.error('❌ [CLEANUP-OLD-ACCOUNT] Error deleting user document:', error);
      await logError('Failed to delete old user document during cleanup', {
        action: 'cleanup_old_account_user_delete_failed',
        metadata: { oldAccountId, newAccountId }
      }, error as Error);

      return NextResponse.json(
        { error: 'Failed to delete old account' },
        { status: 500 }
      );
    }

    await logInfo('Successfully cleaned up old email/password account', {
      action: 'cleanup_old_account_success',
      metadata: {
        oldAccountId,
        newAccountId,
        reason: 'User migrated to phone auth'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Old account cleaned up successfully'
    });

  } catch (error) {
    await logError('Failed to cleanup old account', {
      action: 'cleanup_old_account_error'
    }, error as Error);

    console.error('❌ [CLEANUP-OLD-ACCOUNT] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup old account' },
      { status: 500 }
    );
  }
}
