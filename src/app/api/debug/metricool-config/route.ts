import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    METRICOOL_API_KEY: process.env.METRICOOL_API_KEY ? '✅ Set' : '❌ Missing',
    METRICOOL_USER_ID: process.env.METRICOOL_USER_ID || '❌ Missing',
    METRICOOL_OWNERFI_BRAND_ID: process.env.METRICOOL_OWNERFI_BRAND_ID || '❌ Missing',
    METRICOOL_CARZ_BRAND_ID: process.env.METRICOOL_CARZ_BRAND_ID || '❌ Missing',
    expectedValues: {
      METRICOOL_USER_ID: '2946453',
      METRICOOL_OWNERFI_BRAND_ID: '4562987'
    }
  });
}
