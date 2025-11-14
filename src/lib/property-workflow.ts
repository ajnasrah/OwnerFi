/**
 * Property Video Workflow Management
 *
 * Simplified single-collection system for property showcase videos.
 * Replaces the broken 3-collection system (property_rotation_queue, property_videos, propertyShowcaseWorkflows).
 *
 * Collection: propertyShowcaseWorkflows
 * Handles: Queue management + Workflow tracking + Rotation logic
 */

import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit as firestoreLimit, runTransaction } from 'firebase/firestore';

export interface PropertyShowcaseWorkflow {
  // Identity
  id: string;
  propertyId: string;

  // Queue Management
  queueStatus: 'queued' | 'processing' | 'completed_cycle';
  queuePosition: number;
  queueAddedAt: number;

  // Rotation Tracking
  totalVideosGenerated: number;
  currentCycleCount: number;
  lastVideoGeneratedAt?: number;

  // Workflow Status
  status: 'pending' | 'heygen_processing' | 'submagic_processing' | 'posting' | 'completed' | 'failed';

  // Property Data (cached for display)
  address: string;
  city: string;
  state: string;
  downPayment: number;
  monthlyPayment: number;

  // Video Details
  variant: '15sec' | '30sec';
  language: 'en' | 'es';
  script?: string;
  caption?: string;
  title?: string;

  // HeyGen
  heygenVideoId?: string;
  heygenVideoUrl?: string;
  heygenCompletedAt?: number;

  // Submagic
  submagicVideoId?: string;
  submagicDownloadUrl?: string;
  submagicCompletedAt?: number;

  // Final Video
  finalVideoUrl?: string;

  // Posting
  latePostId?: string;
  platforms?: string[];
  scheduledFor?: number;
  postedAt?: number;

  // Error Tracking
  error?: string;
  retryCount?: number;
  lastRetryAt?: number;
  failedAt?: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

const COLLECTION = 'propertyShowcaseWorkflows';

/**
 * Add property to showcase queue
 */
export async function addPropertyToShowcaseQueue(
  propertyId: string,
  propertyData: {
    address: string;
    city: string;
    state: string;
    downPayment: number;
    monthlyPayment: number;
  },
  variant: '15sec' | '30sec' = '15sec',
  language: 'en' | 'es' = 'en'
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  // Check if property already in queue (any queueStatus)
  const existingQuery = query(
    collection(db, COLLECTION),
    where('propertyId', '==', propertyId),
    where('queueStatus', 'in', ['queued', 'processing'])
  );
  const existing = await getDocs(existingQuery);

  if (!existing.empty) {
    throw new Error(`Property ${propertyId} already in queue`);
  }

  // Get current max position
  const maxPosQuery = query(
    collection(db, COLLECTION),
    where('queueStatus', '==', 'queued'),
    orderBy('queuePosition', 'desc'),
    firestoreLimit(1)
  );
  const maxPosSnapshot = await getDocs(maxPosQuery);
  const maxPosition = maxPosSnapshot.empty ? 0 : maxPosSnapshot.docs[0].data().queuePosition;

  const workflowId = `property_${variant}_${language}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  const workflow: PropertyShowcaseWorkflow = {
    id: workflowId,
    propertyId,
    queueStatus: 'queued',
    queuePosition: maxPosition + 1,
    queueAddedAt: Date.now(),
    totalVideosGenerated: 0,
    currentCycleCount: 0,
    status: 'pending',
    address: propertyData.address,
    city: propertyData.city,
    state: propertyData.state,
    downPayment: propertyData.downPayment,
    monthlyPayment: propertyData.monthlyPayment,
    variant,
    language,
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(doc(db, COLLECTION, workflowId), workflow);
  console.log(`✅ Added property ${propertyId} to showcase queue at position ${workflow.queuePosition}`);

  return workflowId;
}

/**
 * Get next property from queue
 */
export async function getNextPropertyFromQueue(): Promise<PropertyShowcaseWorkflow | null> {
  if (!db) return null;

  const q = query(
    collection(db, COLLECTION),
    where('queueStatus', '==', 'queued'),
    orderBy('queuePosition', 'asc'),
    firestoreLimit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const workflow = { ...snapshot.docs[0].data() } as PropertyShowcaseWorkflow;

  // Mark as processing
  await updateDoc(doc(db, COLLECTION, workflow.id), {
    queueStatus: 'processing',
    updatedAt: Date.now()
  });

  return workflow;
}

/**
 * Update workflow status
 */
export async function updatePropertyWorkflow(
  workflowId: string,
  updates: Partial<PropertyShowcaseWorkflow>
): Promise<void> {
  if (!db) return;

  await updateDoc(doc(db, COLLECTION, workflowId), {
    ...updates,
    updatedAt: Date.now()
  });
}

/**
 * Mark workflow as completed for this cycle
 */
export async function completePropertyWorkflow(workflowId: string): Promise<void> {
  if (!db) return;

  const workflowDoc = await getDoc(doc(db, COLLECTION, workflowId));
  if (!workflowDoc.exists()) return;

  const workflow = workflowDoc.data() as PropertyShowcaseWorkflow;

  await updateDoc(doc(db, COLLECTION, workflowId), {
    queueStatus: 'completed_cycle',
    status: 'completed',
    totalVideosGenerated: (workflow.totalVideosGenerated || 0) + 1,
    currentCycleCount: (workflow.currentCycleCount || 0) + 1,
    lastVideoGeneratedAt: Date.now(),
    completedAt: Date.now(),
    updatedAt: Date.now()
  });

  console.log(`✅ Property workflow ${workflowId} completed (total videos: ${workflow.totalVideosGenerated + 1})`);
}

/**
 * Mark workflow as failed and reset to queued (for validation errors)
 */
export async function failAndRequeuePropertyWorkflow(workflowId: string, error: string): Promise<void> {
  if (!db) return;

  const workflowDoc = await getDoc(doc(db, COLLECTION, workflowId));
  if (!workflowDoc.exists()) return;

  const workflow = workflowDoc.data() as PropertyShowcaseWorkflow;

  await updateDoc(doc(db, COLLECTION, workflowId), {
    queueStatus: 'queued',
    status: 'failed',
    error,
    retryCount: (workflow.retryCount || 0) + 1,
    lastRetryAt: Date.now(),
    failedAt: Date.now(),
    updatedAt: Date.now()
  });

  console.log(`⚠️  Property workflow ${workflowId} failed and requeued: ${error}`);
}

/**
 * Mark workflow as permanently failed (for system errors)
 */
export async function failPropertyWorkflow(workflowId: string, error: string): Promise<void> {
  if (!db) return;

  const workflowDoc = await getDoc(doc(db, COLLECTION, workflowId));
  if (!workflowDoc.exists()) return;

  const workflow = workflowDoc.data() as PropertyShowcaseWorkflow;

  await updateDoc(doc(db, COLLECTION, workflowId), {
    queueStatus: 'completed_cycle', // Remove from queue
    status: 'failed',
    error,
    retryCount: (workflow.retryCount || 0) + 1,
    failedAt: Date.now(),
    updatedAt: Date.now()
  });

  console.log(`❌ Property workflow ${workflowId} permanently failed: ${error}`);
}

/**
 * Reset queue cycle (move all completed_cycle back to queued)
 */
export async function resetPropertyQueueCycle(): Promise<number> {
  if (!db) return 0;

  const completedQuery = query(
    collection(db, COLLECTION),
    where('queueStatus', '==', 'completed_cycle')
  );

  const snapshot = await getDocs(completedQuery);
  if (snapshot.empty) return 0;

  console.log(`🔄 Resetting ${snapshot.size} properties for new cycle...`);

  // Reset all to queued with fresh positions
  let position = 1;
  for (const docSnap of snapshot.docs) {
    await updateDoc(doc(db, COLLECTION, docSnap.id), {
      queueStatus: 'queued',
      queuePosition: position++,
      currentCycleCount: 0,
      status: 'pending',
      error: undefined,
      updatedAt: Date.now()
    });
  }

  console.log(`✅ Queue cycle reset - ${snapshot.size} properties ready`);
  return snapshot.size;
}

/**
 * Get queue statistics
 */
export async function getPropertyQueueStats(): Promise<{
  total: number;
  queued: number;
  processing: number;
  completed: number;
  nextProperty?: PropertyShowcaseWorkflow;
}> {
  if (!db) return { total: 0, queued: 0, processing: 0, completed: 0 };

  const allSnapshot = await getDocs(collection(db, COLLECTION));
  const queuedSnapshot = await getDocs(query(
    collection(db, COLLECTION),
    where('queueStatus', '==', 'queued')
  ));
  const processingSnapshot = await getDocs(query(
    collection(db, COLLECTION),
    where('queueStatus', '==', 'processing')
  ));
  const completedSnapshot = await getDocs(query(
    collection(db, COLLECTION),
    where('queueStatus', '==', 'completed_cycle')
  ));

  // Get next property
  const nextQuery = query(
    collection(db, COLLECTION),
    where('queueStatus', '==', 'queued'),
    orderBy('queuePosition', 'asc'),
    firestoreLimit(1)
  );
  const nextSnapshot = await getDocs(nextQuery);
  const nextProperty = nextSnapshot.empty ? undefined : nextSnapshot.docs[0].data() as PropertyShowcaseWorkflow;

  return {
    total: allSnapshot.size,
    queued: queuedSnapshot.size,
    processing: processingSnapshot.size,
    completed: completedSnapshot.size,
    nextProperty
  };
}

/**
 * Get workflow by ID
 */
export async function getPropertyWorkflow(workflowId: string): Promise<PropertyShowcaseWorkflow | null> {
  if (!db) return null;

  const docSnap = await getDoc(doc(db, COLLECTION, workflowId));
  return docSnap.exists() ? docSnap.data() as PropertyShowcaseWorkflow : null;
}

/**
 * Sync queue with properties database
 * Adds new active properties, removes deleted/inactive ones
 */
export async function syncPropertyQueue(): Promise<{ added: number; removed: number }> {
  if (!db) return { added: 0, removed: 0 };

  console.log('🔄 Syncing property queue...');

  // Get all workflow property IDs currently in queue
  const workflowsSnapshot = await getDocs(collection(db, COLLECTION));
  const workflowPropertyIds = new Set(
    workflowsSnapshot.docs.map(doc => doc.data().propertyId)
  );

  // Get all active properties from properties collection
  const { collection: firestoreCollection, query: firestoreQuery, where: firestoreWhere, getDocs: firestoreGetDocs } = await import('firebase/firestore');
  const propertiesQuery = firestoreQuery(
    firestoreCollection(db, 'properties'),
    firestoreWhere('isActive', '==', true),
    firestoreWhere('status', '==', 'active')
  );

  const propertiesSnapshot = await firestoreGetDocs(propertiesQuery);

  const activePropertyIds = new Set<string>();
  const newProperties: Array<{ id: string; data: any }> = [];

  propertiesSnapshot.docs.forEach(doc => {
    const data = doc.data();
    // Only include properties with images
    if (data.imageUrls && data.imageUrls.length > 0) {
      activePropertyIds.add(doc.id);

      if (!workflowPropertyIds.has(doc.id)) {
        newProperties.push({ id: doc.id, data });
      }
    }
  });

  // Add new properties
  let added = 0;
  for (const prop of newProperties) {
    try {
      await addPropertyToShowcaseQueue(prop.id, {
        address: prop.data.address,
        city: prop.data.city,
        state: prop.data.state,
        downPayment: prop.data.downPaymentAmount,
        monthlyPayment: prop.data.monthlyPayment
      });
      added++;
    } catch (err) {
      console.warn(`⚠️  Could not add property ${prop.id}:`, err);
    }
  }

  // Remove deleted/inactive properties (only if in queued or completed_cycle status)
  let removed = 0;
  for (const workflowDoc of workflowsSnapshot.docs) {
    const workflow = workflowDoc.data() as PropertyShowcaseWorkflow;

    // Only remove if not currently processing
    if (workflow.queueStatus !== 'processing' && !activePropertyIds.has(workflow.propertyId)) {
      await workflowDoc.ref.delete();
      removed++;
    }
  }

  if (added > 0 || removed > 0) {
    console.log(`   ✅ Sync complete: +${added} new, -${removed} deleted`);
  } else {
    console.log(`   ✅ Queue already in sync`);
  }

  return { added, removed };
}
