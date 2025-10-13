// Test endpoint to verify Submagic API key is configured
import { NextResponse } from 'next/server';

export async function GET() {
  const SUBMAGIC_API_KEY = process.env.SUBMAGIC_API_KEY;
  const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

  return NextResponse.json({
    submagic_configured: !!SUBMAGIC_API_KEY,
    submagic_length: SUBMAGIC_API_KEY?.length || 0,
    heygen_configured: !!HEYGEN_API_KEY,
    heygen_length: HEYGEN_API_KEY?.length || 0,
    timestamp: new Date().toISOString()
  });
}
