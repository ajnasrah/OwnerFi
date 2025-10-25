// Background job system for async property processing
import { doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { getNearbyCitiesUpdate } from './property-nearby-cities';

type JobType = 'populate_nearby_cities';
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface BackgroundJob {
  id: string;
  type: JobType;
  propertyId: string;
  propertyData: {
    address: string;
    city: string;
    state: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  };
  status: JobStatus;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// Job queue (in production, use Redis or Cloud Tasks)
const jobQueue: BackgroundJob[] = [];
let isProcessing = false;

/**
 * Add job to queue for nearby cities population
 */
export function queueNearbyCitiesJob(
  propertyId: string,
  propertyData: {
    address: string;
    city: string;
    state: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  }
): void {
  const job: BackgroundJob = {
    id: `${propertyId}_${Date.now()}`,
    type: 'populate_nearby_cities',
    propertyId,
    propertyData,
    status: 'pending',
    createdAt: new Date()
  };

  jobQueue.push(job);

  // Start processing if not already running
  if (!isProcessing) {
    processJobQueue();
  }
}

/**
 * Process jobs in the background
 */
async function processJobQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (jobQueue.length > 0) {
    const job = jobQueue.shift()!;

    try {
      job.status = 'processing';

      // Get nearby cities update using comprehensive approach
      const updateData = await getNearbyCitiesUpdate(job.propertyData, 30);

      // Update property with nearby cities
      if (!db) {
        throw new Error('Firebase not initialized');
      }

      await updateDoc(doc(db, 'properties', job.propertyId), updateData);

      job.status = 'completed';
      job.completedAt = new Date();

    } catch (error) {
      job.status = 'failed';
      job.error = (error as Error).message;
      job.completedAt = new Date();
      console.error(`[background-jobs] Failed to process job ${job.id}:`, error);
    }
  }

  isProcessing = false;
}

/**
 * Batch process multiple properties with rate limiting
 */
export async function batchProcessNearbyCities(
  properties: Array<{
    id: string;
    address: string;
    city: string;
    state: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  }>
): Promise<void> {
  const batchSize = 10;
  const batches = [];

  // Split into batches
  for (let i = 0; i < properties.length; i += batchSize) {
    batches.push(properties.slice(i, i + batchSize));
  }

  for (const [batchIndex, propertyBatch] of batches.entries()) {
    // Process batch in parallel
    const promises = propertyBatch.map(async property => {
      try {
        const updateData = await getNearbyCitiesUpdate(property, 30);
        return { propertyId: property.id, updateData, success: true };
      } catch (error) {
        console.error(`[batch-process] Failed for property ${property.id}:`, error);
        return { propertyId: property.id, updateData: {}, success: false };
      }
    });

    const results = await Promise.all(promises);

    // Batch write to Firestore (up to 500 operations)
    if (!db) {
      throw new Error('Firebase not initialized');
    }
    const batch = writeBatch(db);
    let operations = 0;

    for (const result of results) {
      if (result.success) {
        const propertyRef = doc(db!, 'properties', result.propertyId);
        batch.update(propertyRef, result.updateData);
        operations++;
      }
    }

    if (operations > 0) {
      await batch.commit();
    }

    // Rate limiting between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Get job queue status
 */
export function getJobQueueStatus(): { queueLength: number; isProcessing: boolean } {
  return {
    queueLength: jobQueue.length,
    isProcessing
  };
}