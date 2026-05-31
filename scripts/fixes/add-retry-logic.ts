// Retry logic wrapper for API calls

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    exponentialBackoff?: boolean;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    exponentialBackoff = true,
    onRetry
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === retries) {
        throw error;
      }

      if (onRetry) {
        onRetry(error, attempt);
      }

      const waitTime = exponentialBackoff 
        ? delay * Math.pow(2, attempt - 1)
        : delay;

      console.log(`Attempt ${attempt} failed, retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// Usage example for Creatify API:
export async function createVideoWithRetry(scenes: any[], apiHeaders: any) {
  return withRetry(
    async () => {
      const response = await fetch('https://api.creatify.ai/api/lipsyncs_v2/', {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ 
          video_inputs: scenes, 
          aspect_ratio: '9x16' 
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Creatify error: ${JSON.stringify(data)}`);
      }
      
      return data;
    },
    {
      retries: 3,
      delay: 2000,
      exponentialBackoff: true,
      onRetry: (error, attempt) => {
        console.log(`Video creation attempt ${attempt} failed:`, error.message);
      }
    }
  );
}

// Usage example for Zernio API:
export async function postToSocialWithRetry(payload: any, headers: any) {
  return withRetry(
    async () => {
      const response = await fetch('https://api.zernio.com/v1/posts', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      // Don't retry on 409 (duplicate content)
      if (response.status === 409) {
        console.log('Content appears to be duplicate, modifying...');
        // Modify payload to make it unique
        payload.name = `${payload.name} - ${Date.now()}`;
        payload.description = `${payload.description} #unique${Date.now()}`;
        throw new Error('DUPLICATE_CONTENT');
      }

      if (!response.ok) {
        throw new Error(`Zernio error: ${JSON.stringify(data)}`);
      }

      return data;
    },
    {
      retries: 3,
      delay: 1000,
      onRetry: (error, attempt) => {
        if (error.message === 'DUPLICATE_CONTENT' && attempt === 1) {
          // Only retry once for duplicates
          return;
        }
        console.log(`Social posting attempt ${attempt} failed:`, error.message);
      }
    }
  );
}