/**
 * Blog Single Post API
 *
 * Get, update, or delete a single blog post
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from '@/lib/firebase-admin';
import { BlogPost, getBlogCollection, generateSlug, generateMetaDescription, extractKeywords } from '@/lib/blog-models';
import { generateSocialImagesFromBlog, generateOGImageUrl } from '@/lib/blog-og-generator';

// GET single blog post
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const { id } = params;

    if (!brand || !id) {
      return NextResponse.json(
        { error: 'Missing required parameters: brand, id' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const collection = getBlogCollection(brand as any);
    const doc = await db.collection(collection).doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const post: BlogPost = {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data()?.createdAt?.toDate(),
      updatedAt: doc.data()?.updatedAt?.toDate(),
      publishedAt: doc.data()?.publishedAt?.toDate(),
    } as BlogPost;

    // Increment view count
    await db.collection(collection).doc(id).update({
      views: (post.views || 0) + 1,
    });

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('Error getting blog post:', error);
    return NextResponse.json(
      { error: 'Failed to get blog post', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT update blog post
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { brand, title, subtitle, sections, pillar, tags, status } = body;

    if (!brand || !id) {
      return NextResponse.json(
        { error: 'Missing required parameters: brand, id' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const collection = getBlogCollection(brand);

    // Get existing post
    const doc = await db.collection(collection).doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Blog post not found' },
        { status: 404 }
      );
    }

    const existingPost = doc.data() as BlogPost;

    // Build update object
    const updates: any = {
      updatedAt: new Date(),
    };

    if (title) {
      updates.title = title;
      updates.slug = generateSlug(title);
    }

    if (subtitle !== undefined) updates.subtitle = subtitle;
    if (sections) {
      updates.sections = sections;
      // Regenerate social images
      updates.socialImages = generateSocialImagesFromBlog(brand, title || existingPost.title, sections);
      updates.socialImages.forEach((image: any) => {
        image.generatedUrl = generateOGImageUrl({
          width: image.type === 'carousel-slide' ? 1080 : 1080,
          height: image.type === 'carousel-slide' ? 1920 : 1080,
          brand,
          type: image.type,
          title: image.title,
          content: image.content,
          slideNumber: image.slideNumber,
          totalSlides: image.totalSlides,
        });
      });

      // Update SEO
      const metaDescription = generateMetaDescription(sections);
      const keywords = extractKeywords(title || existingPost.title, sections);
      updates.seo = {
        ...existingPost.seo,
        metaDescription,
        keywords,
      };
    }

    if (pillar) updates.pillar = pillar;
    if (tags) updates.tags = tags;

    if (status) {
      updates.status = status;
      if (status === 'published' && !existingPost.publishedAt) {
        updates.publishedAt = new Date();
      }
    }

    // Update in Firestore
    await db.collection(collection).doc(id).update(updates);

    // Get updated post
    const updatedDoc = await db.collection(collection).doc(id).get();
    const updatedPost: BlogPost = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data()?.createdAt?.toDate(),
      updatedAt: updatedDoc.data()?.updatedAt?.toDate(),
      publishedAt: updatedDoc.data()?.publishedAt?.toDate(),
    } as BlogPost;

    return NextResponse.json({
      success: true,
      post: updatedPost,
      message: 'Blog post updated successfully',
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    return NextResponse.json(
      { error: 'Failed to update blog post', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE blog post
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand');
    const { id } = params;

    if (!brand || !id) {
      return NextResponse.json(
        { error: 'Missing required parameters: brand, id' },
        { status: 400 }
      );
    }

    const db = getFirestore();
    const collection = getBlogCollection(brand as any);

    await db.collection(collection).doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Blog post deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return NextResponse.json(
      { error: 'Failed to delete blog post', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
