// Test endpoint: Upload a video from Submagic download URL to Firebase Storage

import { NextRequest, NextResponse } from 'next/server';
import { uploadSubmagicVideo } from '@/lib/video-storage';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { submagicUrl } = await request.json();

    if (!submagicUrl) {
      return NextResponse.json(
        { success: false, error: 'submagicUrl is required' },
        { status: 400 }
      );
    }

    console.log('🧪 Testing video upload from Submagic...');
    console.log(`   URL: ${submagicUrl.substring(0, 80)}...`);

    const publicUrl = await uploadSubmagicVideo(submagicUrl);

    return NextResponse.json({
      success: true,
      message: 'Video uploaded successfully',
      submagic_url: submagicUrl,
      public_url: publicUrl
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
