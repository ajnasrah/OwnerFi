/**
 * Admin API: Webhook Dead Letter Queue Management
 *
 * GET /api/admin/webhook-dlq - List DLQ entries with filters
 * POST /api/admin/webhook-dlq/resolve - Mark entries as resolved
 * DELETE /api/admin/webhook-dlq - Delete DLQ entries
 *
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDLQEntries,
  getDLQEntry,
  getDLQStats,
  getRecentDLQFailures,
  markDLQResolved,
  batchResolveDLQEntries,
  deleteDLQEntry,
  cleanupOldDLQEntries,
} from '@/lib/webhook-dlq';
import { validateBrand } from '@/lib/brand-utils';

/**
 * GET - List DLQ entries
 *
 * Query params:
 * - brand: Filter by brand (carz, ownerfi, podcast)
 * - service: Filter by service (heygen, submagic, etc.)
 * - resolved: Filter by resolved status (true/false)
 * - limit: Limit number of results
 * - stats: Return stats instead of entries (true/false)
 * - recent: Get recent failures only (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get filters from query params
    const brand = searchParams.get('brand');
    const service = searchParams.get('service');
    const resolvedParam = searchParams.get('resolved');
    const limitParam = searchParams.get('limit');
    const statsParam = searchParams.get('stats');
    const recentParam = searchParams.get('recent');

    // Validate brand if provided
    if (brand && !['carz', 'ownerfi', 'podcast'].includes(brand)) {
      return NextResponse.json(
        { success: false, error: 'Invalid brand' },
        { status: 400 }
      );
    }

    // Return stats if requested
    if (statsParam === 'true') {
      const stats = await getDLQStats(brand || undefined);
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Return recent failures if requested
    if (recentParam === 'true') {
      const failures = await getRecentDLQFailures(brand || undefined);
      return NextResponse.json({
        success: true,
        count: failures.length,
        entries: failures,
      });
    }

    // Build filters
    const filters: any = {};

    if (brand) filters.brand = brand;
    if (service) filters.service = service;
    if (resolvedParam) filters.resolved = resolvedParam === 'true';
    if (limitParam) filters.limit = parseInt(limitParam, 10);

    const entries = await getDLQEntries(filters);

    return NextResponse.json({
      success: true,
      count: entries.length,
      filters,
      entries,
    });
  } catch (error) {
    console.error('Error fetching DLQ entries:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Resolve DLQ entries
 *
 * Body:
 * - entryId: Single entry ID to resolve
 * - entryIds: Array of entry IDs to resolve
 * - notes: Optional notes about resolution
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId, entryIds, notes } = body;

    if (!entryId && !entryIds) {
      return NextResponse.json(
        { success: false, error: 'entryId or entryIds required' },
        { status: 400 }
      );
    }

    // Single entry
    if (entryId) {
      const success = await markDLQResolved(entryId, notes);
      return NextResponse.json({
        success,
        message: success ? 'Entry marked as resolved' : 'Failed to mark entry as resolved',
      });
    }

    // Multiple entries
    if (entryIds && Array.isArray(entryIds)) {
      const count = await batchResolveDLQEntries(entryIds, notes);
      return NextResponse.json({
        success: true,
        resolved: count,
        message: `Marked ${count} entries as resolved`,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error resolving DLQ entries:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete DLQ entries
 *
 * Query params:
 * - entryId: Delete specific entry
 * - cleanup: Clean up old entries (true)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entryId = searchParams.get('entryId');
    const cleanup = searchParams.get('cleanup');

    if (cleanup === 'true') {
      const count = await cleanupOldDLQEntries();
      return NextResponse.json({
        success: true,
        deleted: count,
        message: `Cleaned up ${count} old entries`,
      });
    }

    if (entryId) {
      const success = await deleteDLQEntry(entryId);
      return NextResponse.json({
        success,
        message: success ? 'Entry deleted' : 'Failed to delete entry',
      });
    }

    return NextResponse.json(
      { success: false, error: 'entryId or cleanup=true required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting DLQ entries:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
