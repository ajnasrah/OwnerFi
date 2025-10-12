import { NextRequest, NextResponse } from 'next/server';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_API_URL = 'https://api.heygen.com/v2/video/generate';

export async function POST(request: NextRequest) {
  try {
    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.talking_photo_id || !body.input_text || !body.voice_id) {
      return NextResponse.json(
        { error: 'Missing required fields: talking_photo_id, input_text, voice_id' },
        { status: 400 }
      );
    }

    // Default values
    const scale = body.scale || 1.4; // Default zoom level
    const width = body.width || 720;
    const height = body.height || 1280;
    const speed = body.speed || 1.1;
    const caption = body.caption !== undefined ? body.caption : false;
    const title = body.title || 'Generated Video';
    const test = body.test !== undefined ? body.test : false;

    // Build the HeyGen API request
    const heygenRequest = {
      video_inputs: [
        {
          character: {
            type: 'talking_photo',
            talking_photo_id: body.talking_photo_id,
            scale: scale,
            talking_photo_style: body.talking_photo_style || 'square',
            talking_style: body.talking_style || 'expressive',
            ...(body.super_resolution && { super_resolution: true }),
            ...(body.offset && { offset: body.offset })
          },
          voice: {
            type: 'text',
            input_text: body.input_text,
            voice_id: body.voice_id,
            speed: speed
          }
        }
      ],
      caption: caption,
      dimension: {
        width: width,
        height: height
      },
      title: title,
      test: test,
      ...(body.callback_id && { callback_id: body.callback_id })
    };

    console.log('Generating HeyGen video:', {
      talking_photo_id: body.talking_photo_id,
      scale: scale,
      dimensions: `${width}x${height}`,
      text_length: body.input_text.length
    });

    const response = await fetch(HEYGEN_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'x-api-key': HEYGEN_API_KEY,
      },
      body: JSON.stringify(heygenRequest)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('HeyGen API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate video', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      video_id: data.data?.video_id || data.video_id,
      data: data
    });

  } catch (error) {
    console.error('Error generating HeyGen video:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check video status
export async function GET(request: NextRequest) {
  try {
    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: 'HeyGen API key not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('video_id');

    if (!videoId) {
      return NextResponse.json(
        { error: 'video_id parameter is required' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': HEYGEN_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Failed to fetch video status', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      status: data.data?.status,
      video_url: data.data?.video_url,
      data: data
    });

  } catch (error) {
    console.error('Error fetching video status:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
