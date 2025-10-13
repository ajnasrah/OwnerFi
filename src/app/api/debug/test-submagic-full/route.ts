// Full test of Submagic API integration
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Read at runtime
    const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;

    console.log('SUBMAGIC_API_KEY exists:', !!SUBMAGIC_API_KEY);
    console.log('SUBMAGIC_API_KEY length:', SUBMAGIC_API_KEY?.length || 0);

    if (!SUBMAGIC_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Submagic API key not configured'
      }, { status: 500 });
    }

    console.log('🧪 Testing Submagic API integration...');
    console.log('   API Key length:', SUBMAGIC_API_KEY.length);

    // Use a sample video URL for testing
    const testVideoUrl = 'https://pub-2476f0809ce64c369348d90eb220788e.r2.dev/test-video.mp4';

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
                    'https://ownerfi.ai';

    const webhookUrl = `${baseUrl}/api/webhooks/submagic`;

    console.log('   Sending request to Submagic API...');
    console.log('   Webhook URL:', webhookUrl);

    const response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'TEST - API Integration Test',
        language: 'en',
        videoUrl: testVideoUrl,
        templateName: 'Hormozi 2',
        magicBrolls: true,
        magicBrollsPercentage: 50,
        magicZooms: true
        // Note: callbackUrl is not supported
      })
    });

    console.log('   Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('   Submagic API error:', errorText);
      return NextResponse.json({
        success: false,
        error: `Submagic API returned ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('   ✅ Submagic project created:', data);

    return NextResponse.json({
      success: true,
      message: 'Submagic API is working!',
      projectId: data.id || data.project_id || data.projectId,
      data: data
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
