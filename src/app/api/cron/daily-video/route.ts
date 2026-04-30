import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { verifyCronSecret } from '@/lib/auth/cron-auth';

/**
 * Daily Video Generation Cron
 * 
 * Runs the daily property video pipeline for both EN and ES
 * Replaces GitHub Actions for more reliable execution
 */

export async function POST(req: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authResult = await verifyCronSecret(req);
    if (!authResult.success) {
      console.error('[Daily Video Cron] Auth failed:', authResult.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Daily Video Cron] Starting daily video generation');
    const startTime = Date.now();

    // Get schedule parameters
    const searchParams = req.nextUrl.searchParams;
    const lang = searchParams.get('lang') || 'both'; // en, es, or both
    const dryRun = searchParams.get('dry_run') === 'true';

    console.log(`[Daily Video Cron] Language: ${lang}, Dry run: ${dryRun}`);

    try {
      // Execute the script with proper environment
      const command = `cd ${process.cwd()} && npx tsx scripts/ownerfi-daily-video.ts --lang ${lang}${dryRun ? ' --dry-run' : ''}`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 20 * 60 * 1000, // 20 minute timeout
        env: {
          ...process.env,
          NODE_ENV: 'production'
        }
      });

      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.log('[Daily Video Cron] Script completed successfully');
      console.log(`[Daily Video Cron] Output:`, output.slice(-500)); // Last 500 chars
      
      return NextResponse.json({
        success: true,
        message: 'Daily video pipeline completed successfully',
        duration,
        lang,
        dryRun,
        timestamp: new Date().toISOString()
      });

    } catch (execError: any) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      console.error('[Daily Video Cron] Script execution failed:', execError.message);
      console.error('[Daily Video Cron] Exit code:', execError.status);
      console.error('[Daily Video Cron] Output:', execError.stdout);
      console.error('[Daily Video Cron] Error output:', execError.stderr);

      // Send error notification
      if (process.env.SLACK_WEBHOOK_URL) {
        try {
          await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 Daily Video Cron Failed\nLanguage: ${lang}\nDuration: ${duration}s\nError: ${execError.message}\nExit Code: ${execError.status}`
            })
          });
        } catch (notifyError) {
          console.error('[Daily Video Cron] Failed to send error notification:', notifyError);
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
    console.error('[Daily Video Cron] Unexpected error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Optional: Health check endpoint
export async function GET(req: NextRequest) {
  const authResult = await verifyCronSecret(req);
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'healthy',
    endpoint: 'daily-video',
    timestamp: new Date().toISOString(),
    env: {
      hasCreatifyKey: !!process.env.CREATIFY_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasLateKey: !!process.env.LATE_API_KEY,
      hasR2Keys: !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)
    }
  });
}