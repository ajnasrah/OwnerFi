// Background job system for async property processing
// Note: nearby cities processing is currently disabled (property-nearby-cities removed)

/**
 * Add job to queue for nearby cities population
 * Note: nearby cities processing is currently disabled (property-nearby-cities removed)
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
  console.warn(`[background-jobs] queueNearbyCitiesJob is a no-op: nearby cities module was removed`);
}

/**
 * Batch process multiple properties with rate limiting
 * Note: nearby cities processing is currently disabled (property-nearby-cities removed)
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
  console.warn(`[background-jobs] batchProcessNearbyCities is a no-op: nearby cities module was removed`);
}

/**
 * Get job queue status
 */
export function getJobQueueStatus(): { queueLength: number; isProcessing: boolean } {
  return {
    queueLength: 0,
    isProcessing: false
  };
}