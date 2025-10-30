/**
 * Abdullah Content System Test Endpoint
 *
 * Use this to manually test the Abdullah personal brand content generation
 * without waiting for the cron job.
 *
 * GET /api/test/abdullah - Generate 5 daily videos immediately
 * GET /api/test/abdullah?count=1 - Generate only 1 video for testing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateAbdullahDailyContent, validateAbdullahScript } from '@/lib/abdullah-content-generator';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.is_admin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }
    console.log('\n' + '='.repeat(60));
    console.log('🧪 ABDULLAH CONTENT TEST');
    console.log('='.repeat(60) + '\n');

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '5', 10);
    const date = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();

    console.log(`📋 Test Configuration:`);
    console.log(`   Date: ${date.toLocaleDateString()}`);
    console.log(`   Videos to generate: ${count}`);
    console.log();

    // Generate scripts
    console.log('🤖 Generating scripts with OpenAI...');
    const dailyContent = await generateAbdullahDailyContent(OPENAI_API_KEY, date);

    // Limit to requested count
    const videos = dailyContent.videos.slice(0, count);

    console.log(`✅ Generated ${videos.length} scripts:\n`);

    // Validate and display each script
    const results = videos.map((video, i) => {
      const validation = validateAbdullahScript(video);

      console.log(`${i + 1}. ${video.theme}`);
      console.log(`   Title: ${video.title}`);
      console.log(`   Script Length: ${video.script.split(' ').length} words`);
      console.log(`   Validation: ${validation.valid ? '✅ PASS' : '❌ FAIL'}`);

      if (!validation.valid) {
        console.log(`   Errors:`, validation.errors);
      }

      console.log(`   Script Preview:`);
      console.log(`   "${video.script.substring(0, 100)}..."`);
      console.log();

      return {
        theme: video.theme,
        title: video.title,
        script: video.script,
        caption: video.caption,
        hashtags: video.hashtags,
        wordCount: video.script.split(' ').length,
        validation: {
          valid: validation.valid,
          errors: validation.errors
        }
      };
    });

    console.log('='.repeat(60));
    console.log('✅ TEST COMPLETED');
    console.log('='.repeat(60) + '\n');

    return NextResponse.json({
      success: true,
      message: `Generated ${videos.length} test scripts`,
      date: dailyContent.date,
      count: videos.length,
      scripts: results,
      next_steps: [
        'Scripts look good? Call POST /api/workflow/complete-abdullah to generate videos',
        'Or wait for daily cron at 6 AM CST: /api/cron/generate-abdullah-daily'
      ]
    });

  } catch (error) {
    console.error('❌ Test error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Support POST as well
export async function POST(request: NextRequest) {
  return GET(request);
}
