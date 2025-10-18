import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';

/**
 * Simplified remove-duplicates endpoint
 * This is an alias that calls the deduplicate endpoint with mode='remove'
 */
export async function POST(request: NextRequest) {
  try {
    // Admin access control
    const session = await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getServerSession(authOptions as any) as ExtendedSession | null;

    if (!session?.user || (session as ExtendedSession).user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Access denied. Admin access required.' },
        { status: 403 }
      );
    }

    // Call the deduplicate endpoint with mode='remove'
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const deduplicateUrl = `${baseUrl}/api/admin/properties/deduplicate`;

    const response = await fetch(deduplicateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({ mode: 'remove' })
    });

    const data = await response.json();

    // Reformat response to match expected format
    if (data.success && data.mode === 'remove') {
      return NextResponse.json({
        success: true,
        summary: {
          deleted: data.summary.propertiesDeleted,
          remaining: data.summary.remainingProperties
        },
        deletedIds: data.deletedIds
      });
    }

    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove duplicates' },
      { status: 500 }
    );
  }
}
