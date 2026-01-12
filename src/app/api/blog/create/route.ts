/**
 * Blog Create API
 *
 * Creates a new blog post with auto-generated SEO and social images
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ExtendedSession } from '@/types/session';
import { getFirestore } from '@/lib/firebase-admin';
import { BlogPost, getBlogCollection, generateSlug, generateMetaDescription, extractKeywords, BlogSection } from '@/lib/blog-models';
import { generateSocialImagesFromBlog, generateOGImageUrl } from '@/lib/blog-og-generator';
import { Brand } from '@/config/constants';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Verify admin authentication
    const session = await getServerSession(authOptions as unknown as Parameters<typeof getServerSession>[0]) as ExtendedSession;
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      brand,
      title,
      subtitle,
      author,
      sections,
      pillar,
      tags = [],
      status = 'draft',
      focusKeyword,
    } = body as {
      brand: Brand;
      title: string;
      subtitle?: string;
      author: string;
      sections: BlogSection[];
      pillar: string;
      tags?: string[];
      status?: 'draft' | 'published';
      focusKeyword?: string;
    };

    // Validation
    if (!brand || !title || !sections || sections.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: brand, title, sections' },
        { status: 400 }
      );
    }

    // Generate slug
    const slug = generateSlug(title);

    // Check if slug already exists
    const db = await getFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }
    const collection = getBlogCollection(brand);
    const existingDocs = await db.collection(collection).where('slug', '==', slug).limit(1).get();

    if (!existingDocs.empty) {
      return NextResponse.json(
        { error: `A blog post with slug "${slug}" already exists for ${brand}` },
        { status: 409 }
      );
    }

    // Generate social images
    const socialImages = generateSocialImagesFromBlog(brand, title, sections);

    // Generate OG image URLs
    const ogImageUrl = generateOGImageUrl({
      width: 1200,
      height: 630,
      brand,
      type: 'blog-hero',
      title,
      subtitle,
    });

    // Populate social image URLs
    socialImages.forEach(image => {
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

    // Generate SEO metadata
    const metaDescription = generateMetaDescription(sections);
    const keywords = extractKeywords(title, sections);

    const seo = {
      metaTitle: title.substring(0, 60),
      metaDescription,
      focusKeyword: focusKeyword || keywords[0] || title.split(' ')[0].toLowerCase(),
      keywords,
      ogImage: ogImageUrl,
      schema: {
        article: true,
        faq: sections.some(s => s.type === 'faq'),
        breadcrumb: true,
      },
    };

    // Create blog post
    const now = new Date();
    const blogPost: Omit<BlogPost, 'id'> = {
      brand,
      slug,
      title,
      subtitle,
      author,
      sections,
      socialImages,
      seo,
      pillar,
      tags,
      status,
      createdAt: now,
      updatedAt: now,
      ...(status === 'published' && { publishedAt: now }),
      views: 0,
      shares: 0,
    };

    // Save to Firestore
    const docRef = await db.collection(collection).add(blogPost);

    const createdPost: BlogPost = {
      id: docRef.id,
      ...blogPost,
    };

    return NextResponse.json({
      success: true,
      post: createdPost,
      message: `Blog post created successfully for ${brand}`,
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    return NextResponse.json(
      { error: 'Failed to create blog post', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
