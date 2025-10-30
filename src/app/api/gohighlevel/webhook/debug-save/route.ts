import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    let parsedBody;

    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = body;
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(request.headers.entries()),
      body: parsedBody,
      url: request.url,
      method: request.method,
    };

    console.log('=== GHL WEBHOOK DEBUG ===');
    console.log(JSON.stringify(debugInfo, null, 2));

    // Return success so GHL marks it as completed
    return NextResponse.json({
      success: true,
      debug: true,
      received: debugInfo
    });

  } catch (error) {
    console.error('Debug webhook error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
