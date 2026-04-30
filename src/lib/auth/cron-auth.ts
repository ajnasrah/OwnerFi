import { NextRequest } from 'next/server';

/**
 * Verify cron job authentication
 * 
 * Supports multiple authentication methods:
 * 1. Vercel Cron Secret (preferred)
 * 2. Custom Authorization header
 * 3. User-Agent verification (fallback)
 */

interface AuthResult {
  success: boolean;
  error?: string;
  method?: string;
}

export async function verifyCronSecret(req: NextRequest): Promise<AuthResult> {
  try {
    // Method 1: Vercel Cron Secret (automatically injected by Vercel)
    const cronSecret = req.headers.get('x-vercel-cron-signature') || 
                      req.headers.get('vercel-cron-signature');
    
    if (cronSecret && process.env.CRON_SECRET) {
      // Verify the signature matches expected secret
      if (cronSecret === process.env.CRON_SECRET) {
        return { success: true, method: 'vercel-cron-signature' };
      } else {
        return { success: false, error: 'Invalid cron signature' };
      }
    }

    // Method 2: Custom Authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token === process.env.CRON_SECRET || token === process.env.INTERNAL_API_KEY) {
        return { success: true, method: 'authorization-header' };
      } else {
        return { success: false, error: 'Invalid authorization token' };
      }
    }

    // Method 3: Internal service call verification
    const internalSecret = req.headers.get('x-internal-secret');
    if (internalSecret === process.env.INTERNAL_API_KEY) {
      return { success: true, method: 'internal-secret' };
    }

    // Method 4: User-Agent based (for Vercel cron jobs)
    const userAgent = req.headers.get('user-agent');
    if (userAgent?.includes('vercel-cron') || userAgent?.includes('Vercel')) {
      // Additional check: ensure it's from Vercel's IP ranges or localhost
      const forwarded = req.headers.get('x-forwarded-for');
      const realIP = req.headers.get('x-real-ip');
      const ip = forwarded?.split(',')[0] || realIP || 'unknown';
      
      // Allow localhost for development
      if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) {
        return { success: true, method: 'localhost' };
      }
      
      // Allow Vercel's infrastructure (simplified check)
      if (process.env.VERCEL === '1') {
        return { success: true, method: 'vercel-infrastructure' };
      }
    }

    // Method 5: Development mode bypass
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_BASE_URL?.includes('localhost')) {
      return { success: true, method: 'development-bypass' };
    }

    return { 
      success: false, 
      error: 'No valid authentication method found' 
    };

  } catch (error) {
    return { 
      success: false, 
      error: `Authentication verification failed: ${error}` 
    };
  }
}

/**
 * Simple cron secret verification for basic endpoints
 */
export function verifySimpleCronAuth(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret') || 
                 req.nextUrl.searchParams.get('secret');
  
  return secret === process.env.CRON_SECRET || 
         secret === process.env.INTERNAL_API_KEY ||
         (process.env.NODE_ENV === 'development' && secret === 'dev');
}