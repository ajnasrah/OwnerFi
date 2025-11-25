/**
 * Blog List API
 *
 * Lists blog posts for a specific brand with filtering and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { BlogPost, getBlogCollection } from '@/lib/blog-models';
import { Brand } from '@/config/constants';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') as Brand;
    const status = searchParams.get('status') as 'draft' | 'published' | 'archived' | null;
    const pillar = searchParams.get('pillar');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!brand) {
      return NextResponse.json(
        { error: 'Missing required parameter: brand' },
        { status: 400 }
      );
    }

    const db = await getFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }
    const collection = getBlogCollection(brand);

    // Build query
    let query = db.collection(collection).orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    if (pillar) {
      query = query.where('pillar', '==', pillar) as any;
    }

    // Get total count (for pagination)
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    // Get paginated results
    const snapshot = await query.limit(limit).offset(offset).get();

    const posts: BlogPost[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      publishedAt: doc.data().publishedAt?.toDate(),
    })) as BlogPost[];

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + posts.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing blog posts:', error);
    return NextResponse.json(
      { error: 'Failed to list blog posts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
