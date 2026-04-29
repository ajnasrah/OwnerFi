import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/auth-helpers';
import { createAgentRefreshRunner, CronBatchProcessor } from '@/lib/cron-reliability';
import { logger } from '@/lib/structured-logger';

/**
 * Background job to refresh agent data for popular cities
 * POST /api/cron/refresh-agents
 * 
 * Runs every few hours to keep data fresh without user triggering API costs
 * Focuses on most searched cities to maximize cache hit rates
 */

// Popular cities to keep fresh (expand based on usage analytics)
const POPULAR_CITIES = [
  { city: 'Memphis', state: 'TN' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Knoxville', state: 'TN' },
  { city: 'Chattanooga', state: 'TN' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Birmingham', state: 'AL' },
  { city: 'Little Rock', state: 'AR' },
  { city: 'Jackson', state: 'MS' }
];

export async function POST(request: NextRequest) {
  // Verify this is a legitimate cron job
  const authResult = requireCronAuth(request);
  if ('error' in authResult) {
    return authResult.error;
  }

  const cronRunner = createAgentRefreshRunner();
  
  const result = await cronRunner.execute(async () => {
    logger.cron('Starting background agent data refresh', {
      cities: POPULAR_CITIES.length
    });
    
    // Use batch processor for better reliability and progress tracking
    const batchProcessor = new CronBatchProcessor({
      name: 'agent-refresh-cities',
      batchSize: 3, // Process 3 cities at a time
      delayBetweenBatches: 2000 // 2 second delay between batches
    });

    interface CityRefreshResult {
      city: string;
      state: string;
      success: boolean;
      agentCount?: number;
      source?: string;
      error?: string;
    }

    const { results, errors } = await batchProcessor.process(
      POPULAR_CITIES,
      async (cityBatch) => {
        const batchResults: CityRefreshResult[] = [];
        
        for (const location of cityBatch) {
          try {
            logger.debug('Refreshing city agents', {
              city: location.city,
              state: location.state
            });
            
            // Call our own live search API to trigger refresh and caching
            const searchUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/agents/search-live`);
            searchUrl.searchParams.set('city', location.city);
            searchUrl.searchParams.set('state', location.state);
            searchUrl.searchParams.set('limit', '6');
            searchUrl.searchParams.set('offset', '0');
            
            // Use internal API call with admin headers
            const response = await fetch(searchUrl.toString(), {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ownerfi-cron/1.0',
                'Accept-Language': 'en-US',
                'Accept-Encoding': 'gzip',
                // This will bypass the auth check for cron jobs
                'X-Cron-Internal': 'true'
              },
              // Add timeout to prevent hanging
              signal: AbortSignal.timeout(30000) // 30 second timeout per city
            });
            
            if (response.ok) {
              const data = await response.json();
              batchResults.push({
                city: location.city,
                state: location.state,
                success: true,
                agentCount: data.count,
                source: data.source
              });
              
              logger.info('City agent refresh successful', {
                city: location.city,
                state: location.state,
                agentCount: data.count,
                source: data.source
              });
            } else {
              const errorData = await response.json().catch(() => ({}));
              batchResults.push({
                city: location.city,
                state: location.state,
                success: false,
                error: `HTTP ${response.status}: ${errorData.error || 'Unknown error'}`
              });
              
              logger.warn('City agent refresh failed', {
                city: location.city,
                state: location.state,
                status: response.status,
                error: errorData.error
              });
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            batchResults.push({
              city: location.city,
              state: location.state,
              success: false,
              error: errorMsg
            });
            
            logger.warn('City agent refresh exception', {
              city: location.city,
              state: location.state,
              error: errorMsg
            });
          }
        }
        
        return batchResults;
      }
    );

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    // Return summary data
    return {
      totalCities: POPULAR_CITIES.length,
      successful: successCount,
      failed: errorCount,
      batchErrors: errors.length,
      results: results,
      successRate: Math.round((successCount / POPULAR_CITIES.length) * 100)
    };
  });

  return cronRunner.createResponse(result);
}