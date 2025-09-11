// Database cleanup and integrity utilities for OwnerFi
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { logInfo, logError } from './logger';

export interface CleanupResult {
  success: boolean;
  action: string;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsDeleted: number;
  errors: string[];
  details?: string[];
}

export class DatabaseCleanup {
  
  // Remove duplicate buyer profiles based on email
  static async removeDuplicateBuyers(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: false,
      action: 'remove_duplicate_buyers',
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      details: []
    };

    try {
      if (!db) {
        throw new Error('Firebase not initialized');
      }
      
      // Get all buyer profiles
      const buyersQuery = query(collection(db, 'buyerProfiles'));
      const buyerDocs = await getDocs(buyersQuery);
      
      result.recordsProcessed = buyerDocs.docs.length;
      
      // Group buyers by email
      const buyersByEmail: { [email: string]: Record<string, unknown>[] } = {};
      
      buyerDocs.docs.forEach(doc => {
        const data = doc.data();
        const email = data.email?.toLowerCase() || '';
        
        if (email) {
          if (!buyersByEmail[email]) {
            buyersByEmail[email] = [];
          }
          buyersByEmail[email].push({ id: doc.id, ...data });
        }
      });

      // Find and remove duplicates
      for (const [email, buyers] of Object.entries(buyersByEmail)) {
        if (buyers.length > 1) {
          // Sort by createdAt, keep the oldest (most complete profile)
          buyers.sort((a, b) => {
            const aDate = (a.createdAt as any)?.toDate?.() || new Date(0);
            const bDate = (b.createdAt as any)?.toDate?.() || new Date(0);
            return aDate.getTime() - bDate.getTime();
          });

          const keepBuyer = buyers[0];
          const duplicates = buyers.slice(1);

          result.details?.push(`Found ${buyers.length} duplicate profiles for ${email}, keeping ${keepBuyer.id}`);

          // Delete duplicate profiles
          for (const duplicate of duplicates) {
            if (!db) {
              throw new Error('Firebase not initialized');
            }
            await deleteDoc(doc(db, 'buyerProfiles', String(duplicate.id)));
            result.recordsDeleted++;
            result.details?.push(`Deleted duplicate buyer ${duplicate.id} (${duplicate.firstName} ${duplicate.lastName})`);
          }
        }
      }

      result.success = true;
      await logInfo('Database cleanup: duplicate buyers removed', {
        action: result.action,
        metadata: {
          recordsProcessed: result.recordsProcessed,
          recordsDeleted: result.recordsDeleted
        }
      });

    } catch (error) {
      result.errors.push(`Failed to remove duplicate buyers: ${(error as Error).message}`);
      await logError('Database cleanup failed', { action: result.action }, error);
    }

    return result;
  }

  // Clean up orphaned lead purchases (purchases without valid buyer/realtor)
  static async cleanupOrphanedLeadPurchases(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: false,
      action: 'cleanup_orphaned_lead_purchases',
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      details: []
    };

    try {
      if (!db) {
        throw new Error('Firebase not initialized');
      }
      
      // Get all lead purchases
      const purchasesQuery = query(collection(db, 'buyerLeadPurchases'));
      const purchaseDocs = await getDocs(purchasesQuery);
      
      result.recordsProcessed = purchaseDocs.docs.length;

      // Get valid buyer and realtor IDs
      const buyersQuery = query(collection(db, 'buyerProfiles'));
      const buyerDocs = await getDocs(buyersQuery);
      const validBuyerIds = new Set(buyerDocs.docs.map(doc => doc.id));

      const realtorsQuery = query(collection(db, 'realtors'));
      const realtorDocs = await getDocs(realtorsQuery);
      const validRealtorIds = new Set(realtorDocs.docs.map(doc => doc.id));

      // Check each purchase for valid references
      for (const purchaseDoc of purchaseDocs.docs) {
        const purchase = purchaseDoc.data();
        const buyerId = purchase.buyerId;
        const realtorId = purchase.realtorId;

        let shouldDelete = false;
        const reasons = [];

        if (!validBuyerIds.has(buyerId)) {
          reasons.push(`invalid buyer ID: ${buyerId}`);
          shouldDelete = true;
        }

        if (!validRealtorIds.has(realtorId)) {
          reasons.push(`invalid realtor ID: ${realtorId}`);
          shouldDelete = true;
        }

        if (shouldDelete) {
          if (!db) {
            throw new Error('Firebase not initialized');
          }
          await deleteDoc(doc(db, 'buyerLeadPurchases', purchaseDoc.id));
          result.recordsDeleted++;
          result.details?.push(`Deleted orphaned purchase ${purchaseDoc.id}: ${reasons.join(', ')}`);
        }
      }

      result.success = true;
      await logInfo('Database cleanup: orphaned lead purchases removed', {
        action: result.action,
        metadata: {
          recordsProcessed: result.recordsProcessed,
          recordsDeleted: result.recordsDeleted
        }
      });

    } catch (error) {
      result.errors.push(`Failed to cleanup orphaned purchases: ${(error as Error).message}`);
      await logError('Database cleanup failed', { action: result.action }, error);
    }

    return result;
  }

  // Fix incomplete profiles (add missing required fields with defaults)
  static async fixIncompleteProfiles(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: false,
      action: 'fix_incomplete_profiles',
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      details: []
    };

    try {
      if (!db) {
        throw new Error('Firebase not initialized');
      }
      
      const batch = writeBatch(db);
      let batchCount = 0;

      // Fix buyer profiles
      const buyersQuery = query(collection(db, 'buyerProfiles'));
      const buyerDocs = await getDocs(buyersQuery);

      for (const buyerDoc of buyerDocs.docs) {
        const buyer = buyerDoc.data();
        const updates: Record<string, unknown> = {};
        
        // Add default values for missing fields
        if (!buyer.languages || !Array.isArray(buyer.languages)) {
          updates.languages = ['English'];
        }
        
        if (typeof buyer.emailNotifications !== 'boolean') {
          updates.emailNotifications = true;
        }
        
        if (typeof buyer.smsNotifications !== 'boolean') {
          updates.smsNotifications = false;
        }
        
        if (!buyer.searchRadius) {
          updates.searchRadius = 25;
        }

        if (!buyer.minBedrooms) {
          updates.minBedrooms = 2;
        }

        if (!buyer.minBathrooms) {
          updates.minBathrooms = 1;
        }

        if (typeof buyer.profileComplete !== 'boolean') {
          // Determine if profile is complete based on essential fields
          updates.profileComplete = !!(
            buyer.maxMonthlyPayment && 
            buyer.maxDownPayment && 
            buyer.preferredCity && 
            buyer.preferredState
          );
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = serverTimestamp();
          if (!db) {
            throw new Error('Firebase not initialized');
          }
          batch.update(doc(db, 'buyerProfiles', buyerDoc.id), updates);
          batchCount++;
          result.recordsUpdated++;
          result.details?.push(`Updated buyer ${buyerDoc.id} with defaults: ${Object.keys(updates).join(', ')}`);

          // Commit batch every 500 operations
          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      // Fix realtor profiles
      const realtorsQuery = query(collection(db, 'realtors'));
      const realtorDocs = await getDocs(realtorsQuery);

      for (const realtorDoc of realtorDocs.docs) {
        const realtor = realtorDoc.data();
        const updates: Record<string, unknown> = {};
        
        if (!realtor.languages || !Array.isArray(realtor.languages)) {
          updates.languages = ['English'];
        }

        if (!realtor.serviceRadius) {
          updates.serviceRadius = 50;
        }

        if (!realtor.serviceStates || !Array.isArray(realtor.serviceStates)) {
          updates.serviceStates = realtor.primaryState ? [realtor.primaryState] : [];
        }

        if (!realtor.serviceCities || !Array.isArray(realtor.serviceCities)) {
          updates.serviceCities = realtor.primaryCity && realtor.primaryState ? 
            [`${realtor.primaryCity}, ${realtor.primaryState}`] : [];
        }

        if (typeof realtor.credits !== 'number') {
          updates.credits = 0;
        }

        if (typeof realtor.isOnTrial !== 'boolean') {
          updates.isOnTrial = true;
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = serverTimestamp();
          if (!db) {
            throw new Error('Firebase not initialized');
          }
          batch.update(doc(db, 'realtors', realtorDoc.id), updates);
          batchCount++;
          result.recordsUpdated++;
          result.details?.push(`Updated realtor ${realtorDoc.id} with defaults: ${Object.keys(updates).join(', ')}`);

          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }
        }
      }

      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
      }

      result.recordsProcessed = buyerDocs.docs.length + realtorDocs.docs.length;
      result.success = true;

      await logInfo('Database cleanup: incomplete profiles fixed', {
        action: result.action,
        metadata: {
          recordsProcessed: result.recordsProcessed,
          recordsUpdated: result.recordsUpdated
        }
      });

    } catch (error) {
      result.errors.push(`Failed to fix incomplete profiles: ${(error as Error).message}`);
      await logError('Database cleanup failed', { action: result.action }, error);
    }

    return result;
  }

  // Remove test data (emails ending with specific patterns)
  static async removeTestData(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: false,
      action: 'remove_test_data',
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      errors: [],
      details: []
    };

    const testPatterns = [
      'test.com',
      'example.com',
      'ownerfi-test.com',
      '@aol.com', // Often test emails
      'test@',
      'demo@'
    ];

    try {
      if (!db) {
        throw new Error('Firebase not initialized');
      }
      
      // Remove test buyers
      const buyersQuery = query(collection(db, 'buyerProfiles'));
      const buyerDocs = await getDocs(buyersQuery);

      for (const buyerDoc of buyerDocs.docs) {
        const buyer = buyerDoc.data();
        const email = buyer.email?.toLowerCase() || '';
        
        const isTestData = testPatterns.some(pattern => email.includes(pattern.toLowerCase()));
        
        if (isTestData) {
          if (!db) {
            throw new Error('Firebase not initialized');
          }
          await deleteDoc(doc(db, 'buyerProfiles', buyerDoc.id));
          result.recordsDeleted++;
          result.details?.push(`Deleted test buyer: ${buyer.firstName} ${buyer.lastName} (${email})`);
        }
      }

      // Remove test realtors
      const realtorsQuery = query(collection(db, 'realtors'));
      const realtorDocs = await getDocs(realtorsQuery);

      for (const realtorDoc of realtorDocs.docs) {
        const realtor = realtorDoc.data();
        const email = realtor.email?.toLowerCase() || '';
        
        const isTestData = testPatterns.some(pattern => email.includes(pattern.toLowerCase()));
        
        if (isTestData) {
          if (!db) {
            throw new Error('Firebase not initialized');
          }
          await deleteDoc(doc(db, 'realtors', realtorDoc.id));
          result.recordsDeleted++;
          result.details?.push(`Deleted test realtor: ${realtor.firstName} ${realtor.lastName} (${email})`);
        }
      }

      result.recordsProcessed = buyerDocs.docs.length + realtorDocs.docs.length;
      result.success = true;

      await logInfo('Database cleanup: test data removed', {
        action: result.action,
        metadata: {
          recordsProcessed: result.recordsProcessed,
          recordsDeleted: result.recordsDeleted
        }
      });

    } catch (error) {
      result.errors.push(`Failed to remove test data: ${(error as Error).message}`);
      await logError('Database cleanup failed', { action: result.action }, error);
    }

    return result;
  }

  // Run comprehensive cleanup
  static async runComprehensiveCleanup(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];
    
    
    // Run all cleanup operations
    results.push(await this.fixIncompleteProfiles());
    results.push(await this.removeDuplicateBuyers());
    results.push(await this.cleanupOrphanedLeadPurchases());
    
    
    return results;
  }
}