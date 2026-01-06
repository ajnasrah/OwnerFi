// Unified Submagic API client for checking job status
import { fetchWithTimeout, TIMEOUTS } from './api-utils';

const SUBMAGIC_API_URL = 'https://api.submagic.co/api/v1';

export interface SubmagicJobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  error?: string;
  progress?: number;
  created_at?: string;
  completed_at?: string;
}

/**
 * Check Submagic job status
 */
export async function checkSubmagicStatus(jobId: string): Promise<SubmagicJobStatus> {
  const apiKey = process.env.SUBMAGIC_API_KEY;

  if (!apiKey) {
    throw new Error('SUBMAGIC_API_KEY not configured');
  }

  try {
    const response = await fetchWithTimeout(
      `${SUBMAGIC_API_URL}/captions/${jobId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
      TIMEOUTS.SUBMAGIC_API
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submagic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      job_id: jobId,
      status: data.status || 'pending',
      video_url: data.video_url,
      error: data.error,
      progress: data.progress,
      created_at: data.created_at,
      completed_at: data.completed_at,
    };
  } catch (error) {
    console.error(`Error checking Submagic status for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Check multiple Submagic jobs in parallel
 */
export async function checkMultipleSubmagicJobs(
  jobIds: string[]
): Promise<Record<string, SubmagicJobStatus>> {
  const results: Record<string, SubmagicJobStatus> = {};

  // Check all jobs in parallel
  const promises = jobIds.map(async (jobId) => {
    try {
      const status = await checkSubmagicStatus(jobId);
      results[jobId] = status;
    } catch (error) {
      results[jobId] = {
        job_id: jobId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  await Promise.all(promises);

  return results;
}

/**
 * Get stuck Submagic jobs from Firestore
 */
export async function getStuckSubmagicJobs(brands?: string[]): Promise<any[]> {
  const { getFirestore } = await import('firebase-admin/firestore');
  const { initializeApp, getApps, cert } = await import('firebase-admin/app');

  // Initialize Firebase Admin if not already initialized
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }

  const db = getFirestore();

  // Find workflows stuck in submagic_processing
  const query = db.collection('workflows')
    .where('currentStage', '==', 'submagic_processing')
    .orderBy('lastUpdated', 'desc')
    .limit(100);

  const snapshot = await query.get();

  const workflows = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data() as { brand?: string },
  }));

  // Filter by brands if specified
  if (brands && brands.length > 0) {
    return workflows.filter(w => w.brand && brands.includes(w.brand));
  }

  return workflows;
}
