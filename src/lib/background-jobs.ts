// Background job system for async property processing
import { collection, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { getNearbyCitiesDirect } from './cities-service';

interface BackgroundJob {
  id: string;
  type: 'populate_nearby_cities';
  propertyId: string;
  city: string;
  state: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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
export function queueNearbyCitiesJob(propertyId: string, city: string, state: string): void {
  const job: BackgroundJob = {
    id: `${propertyId}_${Date.now()}`,
    type: 'populate_nearby_cities',
    propertyId,
    city,
    state,
    status: 'pending',
    createdAt: new Date()
  };
  
  jobQueue.push(job);
  console.log(`📋 Queued nearby cities job for ${city}, ${state} (Property: ${propertyId})`);
  
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
  
  console.log(`⚡ Starting job processor, ${jobQueue.length} jobs in queue`);
  
  while (jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    
    try {
      job.status = 'processing';
      console.log(`🔄 Processing job ${job.id} for ${job.city}, ${job.state}`);
      
      // Get nearby cities
      const nearbyCities = await getNearbyCitiesDirect(job.city, job.state, 30);
      
      // Update property with nearby cities
      await updateDoc(doc(db, 'properties', job.propertyId), {
        nearbyCities: nearbyCities,
        nearbyCitiesUpdatedAt: serverTimestamp()
      });
      
      job.status = 'completed';
      job.completedAt = new Date();
      console.log(`✅ Completed job ${job.id}, added ${nearbyCities.length} cities`);
      
    } catch (error) {
      job.status = 'failed';
      job.error = (error as Error).message;
      job.completedAt = new Date();
      console.error(`❌ Job ${job.id} failed:`, error);
    }
  }
  
  isProcessing = false;
  console.log(`🏁 Job processor finished`);
}

/**
 * Batch process multiple properties with rate limiting
 */
export async function batchProcessNearbyCities(properties: Array<{id: string, city: string, state: string}>): Promise<void> {
  const batchSize = 10;
  const batches = [];
  
  // Split into batches
  for (let i = 0; i < properties.length; i += batchSize) {
    batches.push(properties.slice(i, i + batchSize));
  }
  
  console.log(`🔢 Processing ${properties.length} properties in ${batches.length} batches`);
  
  for (const [batchIndex, batch] of batches.entries()) {
    console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length}`);
    
    // Process batch in parallel
    const promises = batch.map(async property => {
      try {
        const nearbyCities = await getNearbyCitiesDirect(property.city, property.state, 30);
        return { propertyId: property.id, nearbyCities, success: true };
      } catch (error) {
        console.error(`Error processing ${property.city}, ${property.state}:`, error);
        return { propertyId: property.id, nearbyCities: [], success: false };
      }
    });
    
    const results = await Promise.all(promises);
    
    // Batch write to Firestore (up to 500 operations)
    const batch = writeBatch(db);
    let operations = 0;
    
    for (const result of results) {
      if (result.success) {
        const propertyRef = doc(db, 'properties', result.propertyId);
        batch.update(propertyRef, {
          nearbyCities: result.nearbyCities,
          nearbyCitiesUpdatedAt: serverTimestamp()
        });
        operations++;
      }
    }
    
    if (operations > 0) {
      await batch.commit();
      console.log(`✅ Batch ${batchIndex + 1}: Updated ${operations} properties`);
    }
    
    // Rate limiting between batches
    if (batchIndex < batches.length - 1) {
      console.log('⏳ Waiting 2s between batches...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('🎉 Batch processing completed!');
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