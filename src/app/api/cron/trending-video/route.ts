import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { verifyCronSecret } from '@/lib/auth/cron-auth';

/**
 * Trending Video Generation Cron
 * 
 * Runs the trending article video pipeline
 * Replaces GitHub Actions for more reliable execution
 */

export async function POST(req: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authResult = await verifyCronSecret(req);
    if (!authResult.success) {
      console.error('[Trending Video Cron] Auth failed:', authResult.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Trending Video Cron] Starting trending video generation');
    const startTime = Date.now();

    // Get schedule parameters
    const searchParams = req.nextUrl.searchParams;
    const lang = searchParams.get('lang') || 'en'; // en or es
    const dryRun = searchParams.get('dry_run') === 'true';

    console.log(`[Trending Video Cron] Language: ${lang}, Dry run: ${dryRun}`);

    try {
      // Execute the script
      const command = `cd ${process.cwd()} && npx tsx scripts/trending-article-video.ts --lang ${lang}${dryRun ? ' --dry-run' : ''}`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 4 * 60 * 1000, // 4 minute timeout (under Vercel 5min limit)
        env: {
          ...process.env,
          NODE_ENV: 'production'
        }
      });

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('[Trending Video Cron] Script completed successfully');
      console.log(`[Trending Video Cron] Output:`, output.slice(-500)); // Last 500 chars
      
      return NextResponse.json({
        success: true,
        message: 'Trending video pipeline completed successfully',
        duration,
        lang,
        dryRun,
        timestamp: new Date().toISOString()
      });

    } catch (execError: any) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.error('[Trending Video Cron] Script execution failed:', execError.message);
      console.error('[Trending Video Cron] Exit code:', execError.status);
      console.error('[Trending Video Cron] Output:', execError.stdout);
      console.error('[Trending Video Cron] Error output:', execError.stderr);

      // Send error notification
      if (process.env.SLACK_WEBHOOK_URL) {
        try {
          await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 Trending Video Cron Failed\nLanguage: ${lang}\nDuration: ${duration}s\nError: ${execError.message}\nExit Code: ${execError.status}`
            })
          });
        } catch (notifyError) {
          console.error('[Trending Video Cron] Failed to send error notification:', notifyError);
        }
      }

      return NextResponse.json({
        success: false,
        error: execError.message,
        exitCode: execError.status,
        duration,
        lang,
        dryRun,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Trending Video Cron] Unexpected error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authResult = await verifyCronSecret(req);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'healthy',
    endpoint: 'trending-video',
    timestamp: new Date().toISOString()
  });
}