/**
 * Admin API for Viral Hooks Management
 *
 * GET - List hooks (with filters)
 * POST - Add manual hook
 * PATCH - Review/approve/reject hooks
 * DELETE - Remove hook
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  addHook,
  getHooksForReview,
  reviewHook,
  getHookStats,
  ViralHook,
  HookCategory,
  HookStyle,
} from '@/lib/viral-hooks';

/**
 * GET /api/admin/hooks
 * List hooks with optional filters
 *
 * Query params:
 * - status: 'pending' | 'active' | 'all'
 * - brand: brand filter
 * - category: category filter
 * - limit: max results (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const brand = searchParams.get('brand');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');

    const adminDb = await getAdminDb();

    // Build query
    let query = adminDb.collection('viral_hooks').limit(limit);

    if (status === 'pending') {
      query = query.where('needsReview', '==', true);
    } else if (status === 'active') {
      query = query.where('isActive', '==', true).where('needsReview', '==', false);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    let hooks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ViralHook[];

    // Apply additional filters in memory
    if (brand) {
      hooks = hooks.filter(h => h.brands.includes(brand as any));
    }
    if (category) {
      hooks = hooks.filter(h => h.category === category);
    }

    // Get stats
    const stats = await getHookStats();

    return NextResponse.json({
      success: true,
      hooks,
      total: hooks.length,
      stats
    });

  } catch (error) {
    console.error('Error listing hooks:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/hooks
 * Add a manual hook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.videoUrl) {
      return NextResponse.json({
        success: false,
        error: 'videoUrl is required'
      }, { status: 400 });
    }

    const hookId = await addHook({
      videoUrl: body.videoUrl,
      thumbnailUrl: body.thumbnailUrl,
      duration: body.duration || 3,
      transcript: body.transcript,

      category: body.category || 'attention',
      style: body.style || 'mixed',
      emotion: body.emotion || 'neutral',

      brands: body.brands || ['gaza', 'ownerfi', 'carz', 'vassdistro'],
      topics: body.topics || [],

      source: 'manual',
      sourceUrl: body.sourceUrl,

      isActive: true,  // Manual uploads are immediately active
      needsReview: false,
    });

    return NextResponse.json({
      success: true,
      hookId,
      message: 'Hook added successfully'
    });

  } catch (error) {
    console.error('Error adding hook:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/hooks
 * Review/update hooks
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, hookId, hookIds, updates } = body;

    const adminDb = await getAdminDb();

    if (action === 'approve') {
      // Approve single or multiple hooks
      const ids = hookIds || [hookId];
      for (const id of ids) {
        await reviewHook(id, true);
      }
      return NextResponse.json({
        success: true,
        approved: ids.length,
        message: `Approved ${ids.length} hook(s)`
      });
    }

    if (action === 'reject') {
      // Reject (delete) single or multiple hooks
      const ids = hookIds || [hookId];
      for (const id of ids) {
        await reviewHook(id, false);
      }
      return NextResponse.json({
        success: true,
        rejected: ids.length,
        message: `Rejected ${ids.length} hook(s)`
      });
    }

    if (action === 'update' && hookId && updates) {
      // Update hook fields
      await adminDb.collection('viral_hooks').doc(hookId).update({
        ...updates,
        updatedAt: Date.now()
      });
      return NextResponse.json({
        success: true,
        message: 'Hook updated'
      });
    }

    if (action === 'toggle' && hookId) {
      // Toggle active status
      const doc = await adminDb.collection('viral_hooks').doc(hookId).get();
      const current = doc.data() as ViralHook;
      await adminDb.collection('viral_hooks').doc(hookId).update({
        isActive: !current.isActive,
        updatedAt: Date.now()
      });
      return NextResponse.json({
        success: true,
        isActive: !current.isActive,
        message: `Hook ${!current.isActive ? 'activated' : 'deactivated'}`
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use: approve, reject, update, toggle'
    }, { status: 400 });

  } catch (error) {
    console.error('Error updating hooks:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/hooks
 * Delete hook(s)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hookId = searchParams.get('id');
    const hookIds = searchParams.get('ids')?.split(',');

    const adminDb = await getAdminDb();
    const ids = hookIds || (hookId ? [hookId] : []);

    if (ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hook ID(s) provided'
      }, { status: 400 });
    }

    for (const id of ids) {
      await adminDb.collection('viral_hooks').doc(id).delete();
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      message: `Deleted ${ids.length} hook(s)`
    });

  } catch (error) {
    console.error('Error deleting hooks:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
