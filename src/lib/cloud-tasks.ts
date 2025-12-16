/**
 * Cloud Tasks Queue Manager
 *
 * Provides a reliable async job queue using Google Cloud Tasks.
 * Benefits:
 * - No timeout limits (tasks can run up to 30 minutes)
 * - Automatic retries with exponential backoff
 * - Built-in error handling and observability
 * - No additional infrastructure needed (uses existing GCP/Firebase)
 */

interface TaskPayload {
  brand: string;
  workflowId: string;
  videoUrl?: string;
  submagicProjectId?: string;
  [key: string]: any;
}

interface CreateTaskOptions {
  queueName?: string;
  delaySeconds?: number;
  maxRetries?: number;
  retryConfig?: {
    maxAttempts?: number;
    minBackoff?: string;
    maxBackoff?: string;
    maxDoublings?: number;
  };
}

/**
 * Create a Cloud Task to process a video workflow asynchronously
 * This replaces the synchronous fetch() call in webhooks
 */
export async function createVideoProcessingTask(
  payload: TaskPayload,
  options: CreateTaskOptions = {}
): Promise<{ taskName: string; scheduleTime: Date }> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
  const queueName = options.queueName || 'video-processing';

  if (!projectId) {
    console.warn('⚠️  Cloud Tasks not configured - falling back to direct fetch');
    return fallbackToDirectFetch(payload);
  }

  try {
    // Dynamic import to avoid build-time errors
    const { CloudTasksClient } = await import('@google-cloud/tasks');

    // Initialize client with service account credentials
    const client = new CloudTasksClient({
      projectId,
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    // Construct the fully qualified queue name
    const parent = client.queuePath(projectId, location, queueName);

    // Construct the task target URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const url = `${baseUrl}/api/workers/process-video`;

    // Calculate schedule time (optional delay)
    const scheduleTime = new Date();
    if (options.delaySeconds) {
      scheduleTime.setSeconds(scheduleTime.getSeconds() + options.delaySeconds);
    }

    // Create the task
    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url,
        headers: {
          'Content-Type': 'application/json',
          // Add authorization header for worker authentication
          'X-Cloud-Tasks-Worker': process.env.CLOUD_TASKS_SECRET || 'default-secret',
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
      scheduleTime: {
        seconds: Math.floor(scheduleTime.getTime() / 1000),
      },
    };

    // Create the task with retry config
    const request = {
      parent,
      task,
    };

    const [response] = await client.createTask(request);

    console.log(`✅ Cloud Task created: ${response.name}`);
    console.log(`   Scheduled for: ${scheduleTime.toISOString()}`);
    console.log(`   Workflow: ${payload.workflowId}`);
    console.log(`   Brand: ${payload.brand}`);

    return {
      taskName: response.name!,
      scheduleTime,
    };

  } catch (error) {
    console.error('❌ Failed to create Cloud Task:', error);
    console.warn('   Falling back to direct fetch...');

    // Fallback to direct fetch if Cloud Tasks unavailable
    return fallbackToDirectFetch(payload);
  }
}

/**
 * Fallback mechanism when Cloud Tasks is not available
 * Calls the worker API endpoint directly via fetch with retry logic
 */
async function fallbackToDirectFetch(payload: TaskPayload): Promise<{ taskName: string; scheduleTime: Date }> {
  console.log(`⚠️  Cloud Tasks unavailable - calling worker API for ${payload.brand}/${payload.workflowId}`);

  // Call the worker API endpoint directly
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const workerUrl = `${baseUrl}/api/workers/process-video`;
  const secret = process.env.CLOUD_TASKS_SECRET || process.env.CRON_SECRET;

  // Retry with exponential backoff (non-blocking but with error tracking)
  const maxRetries = 3;
  let lastError: Error | undefined;

  // Use setImmediate-style async to not block webhook response
  (async () => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cloud-Tasks-Worker': secret || '',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`✅ [FALLBACK] Worker API called successfully for ${payload.workflowId} (attempt ${attempt})`);
          return; // Success, exit retry loop
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        console.warn(`⚠️  [FALLBACK] Worker API returned ${response.status} for ${payload.workflowId} (attempt ${attempt})`);

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`❌ [FALLBACK] Worker API call failed for ${payload.workflowId} (attempt ${attempt}):`, lastError.message);
      }

      // Wait before retry with jitter (except on last attempt)
      if (attempt < maxRetries) {
        const baseDelay = Math.pow(2, attempt) * 1000; // 2s, 4s
        const jitter = Math.random() * 1000; // 0-1s jitter
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      }
    }

    // All retries failed - log critical error
    console.error(`🚨 [FALLBACK CRITICAL] All ${maxRetries} attempts failed for ${payload.workflowId}:`, lastError?.message);
    console.error(`   Workflow may be stuck - manual intervention required`);
  })();

  return {
    taskName: 'inline-processing-with-retry',
    scheduleTime: new Date(),
  };
}

/**
 * Get the status of a Cloud Task
 */
export async function getTaskStatus(taskName: string): Promise<any> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

  if (!projectId) {
    return { error: 'Cloud Tasks not configured' };
  }

  try {
    const { CloudTasksClient } = await import('@google-cloud/tasks');
    const client = new CloudTasksClient({
      projectId,
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    const [task] = await client.getTask({ name: taskName });
    return task;

  } catch (error) {
    console.error('Failed to get task status:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create or update a Cloud Tasks queue with proper retry configuration
 * Run this once to set up the queue
 */
export async function ensureQueueExists(
  queueName: string = 'video-processing'
): Promise<boolean> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';

  if (!projectId) {
    console.warn('Cloud Tasks not configured');
    return false;
  }

  try {
    const { CloudTasksClient } = await import('@google-cloud/tasks');
    const client = new CloudTasksClient({
      projectId,
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });

    const parent = `projects/${projectId}/locations/${location}`;
    const queuePath = client.queuePath(projectId, location, queueName);

    try {
      // Try to get existing queue
      await client.getQueue({ name: queuePath });
      console.log(`✅ Queue already exists: ${queueName}`);
      return true;

    } catch (error: any) {
      // Queue doesn't exist, create it
      if (error.code === 5) { // NOT_FOUND
        console.log(`Creating queue: ${queueName}...`);

        const queue = {
          name: queuePath,
          retryConfig: {
            maxAttempts: 5,
            minBackoff: { seconds: 10 },
            maxBackoff: { seconds: 300 }, // 5 minutes
            maxDoublings: 3,
          },
          rateLimits: {
            maxDispatchesPerSecond: 10,
            maxConcurrentDispatches: 5,
          },
        };

        await client.createQueue({
          parent,
          queue,
        });

        console.log(`✅ Queue created: ${queueName}`);
        return true;
      }

      throw error;
    }

  } catch (error) {
    console.error('Failed to ensure queue exists:', error);
    return false;
  }
}
