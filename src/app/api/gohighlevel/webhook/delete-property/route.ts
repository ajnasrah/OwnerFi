import { NextRequest, NextResponse } from 'next/server';
import { logWarn } from '@/lib/logger';

/**
 * DELETE PROPERTY WEBHOOK - PERMANENTLY DISABLED
 *
 * This endpoint has been permanently disabled for security reasons.
 * Property deletions should be performed through the admin panel only.
 *
 * Date Disabled: November 15, 2025
 * Reason: Security - prevents unauthorized mass deletions
 */

export async function POST(request: NextRequest) {
  // Log the blocked attempt
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  await logWarn('Blocked access attempt to disabled delete-property webhook', {
    action: 'webhook_blocked',
    metadata: {
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
      reason: 'Endpoint permanently disabled for security'
    }
  });

  return NextResponse.json(
    {
      error: 'This endpoint has been permanently disabled',
      message: 'Property deletions must be performed through the admin panel',
      status: 'disabled',
      disabled_date: '2025-11-15',
      contact: 'Please contact system administrator if you need to delete properties'
    },
    {
      status: 410, // 410 Gone - Resource permanently removed
      headers: {
        'X-Endpoint-Status': 'Permanently Disabled',
        'X-Disabled-Date': '2025-11-15'
      }
    }
  );
}

// Block all other HTTP methods
export async function GET(request: NextRequest) {
  return POST(request);
}

export async function PUT(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  return POST(request);
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
