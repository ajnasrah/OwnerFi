import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logInfo, logError } from '@/lib/logger';

/**
 * Deletes an old email/password account after user creates new phone-only account
 * This cleans up:
 * - User document
 * - BuyerProfile (if exists)
 * - RealtorData (nested in user doc, so auto-deleted)
 * - Any other user-linked data
 */
export async function POST(request: NextRequest) {
  try {
    const { oldAccountId, newAccountId } = await request.json();

    if (!oldAccountId || !newAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    console.log('🗑️ [CLEANUP-OLD-ACCOUNT] Starting cleanup:', {
      oldAccountId,
      newAccountId
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
