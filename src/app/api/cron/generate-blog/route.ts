/**
 * Automated Blog Generation Cron
 *
 * Runs daily to:
 * 1. Check blog queue for pending topics
 * 2. Generate blog content with AI
 * 3. Create blog post in Firestore
 * 4. Schedule to all social platforms at optimal times
 *
 * Schedule: Daily at 6 AM CST
 * Vercel Cron: 0 11 * * * (6 AM CST = 11 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Brand } from '@/config/constants';
import { getFirestore } from '@/lib/firebase-admin';
import { getNextBlogFromQueue, updateBlogQueueStatus, getBlogQueueStats } from '@/lib/blog-queue';
import { generateBlogContent } from '@/lib/blog-ai-generator';
import { getBlogCollection, BlogPost, generateSlug } from '@/lib/blog-models';
import { generateSocialImagesFromBlog, generateOGImageUrl } from '@/lib/blog-og-generator';
import { autoScheduleBlogToSocial } from '@/lib/blog-to-social';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Process blog generation for a single brand
 */
async function processBrandBlog(brand: Brand): Promise<{
  success: boolean;
  blogId?: string;
  topic?: string;
  scheduledPlatforms?: number;
  error?: string;
}> {
  console.log(`\n🎯 Processing blog for ${brand}...`);

  try {
    // Get next pending topic from queue
    const queueItem = await getNextBlogFromQueue(brand);

    if (!queueItem) {
      console.log(`   No pending topics in queue for ${brand}`);
      return { success: false, error: 'No pending topics' };
    }

    console.log(`   Topic: ${queueItem.topic}`);
    console.log(`   Pillar: ${queueItem.pillar}`);

    // Check if scheduled for today
    if (queueItem.scheduledFor) {
      const now = new Date();
      const scheduled = new Date(queueItem.scheduledFor);

      if (scheduled > now) {
        console.log(`   Not scheduled yet (${scheduled.toLocaleDateString()})`);
        return { success: false, error: 'Not scheduled yet' };
      }
    }

    // Mark as generating
    await updateBlogQueueStatus(brand, queueItem.id, 'generating');

    // Generate blog content with AI
    console.log(`   🤖 Generating content with AI...`);
    const generated = await generateBlogContent({
      brand,
      topic: queueItem.topic,
      pillar: queueItem.pillar,
      targetLength: 'medium', // 1200-1500 words
    });

    console.log(`   ✅ Content generated`);
    console.log(`      Title: ${generated.title}`);
    console.log(`      Words: ~${generated.estimatedReadTime * 250}`);
    console.log(`      Steps: ${generated.sections.find(s => s.type === 'steps')?.bullets?.length || 0}`);

    // Generate social images
    const socialImages = generateSocialImagesFromBlog(brand, generated.title, generated.sections);

    // Populate image URLs
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

    // Generate OG image for blog
    const ogImageUrl = generateOGImageUrl({
      width: 1200,
      height: 630,
      brand,
      type: 'blog-hero',
      title: generated.title,
      subtitle: generated.subtitle,
    });

    // Create blog post in Firestore
    const db = await getFirestore();
    if (!db) {
      throw new Error('Database not initialized');
    }
    const collection = getBlogCollection(brand);
    const slug = generateSlug(generated.title);

    // Check if slug exists
    const existing = await db.collection(collection).where('slug', '==', slug).limit(1).get();
    if (!existing.empty) {
      throw new Error(`Blog with slug "${slug}" already exists`);
    }

    const now = new Date();
    const blogPost: Omit<BlogPost, 'id'> = {
      brand,
      slug,
      title: generated.title,
      subtitle: generated.subtitle,
      author: generated.author,
      sections: generated.sections,
      socialImages,
      seo: {
        metaTitle: generated.title.substring(0, 60),
        metaDescription: generated.subtitle || generated.sections[0]?.content.substring(0, 160),
        focusKeyword: generated.focusKeyword,
        keywords: generated.tags,
        ogImage: ogImageUrl,
        schema: {
          article: true,
          faq: generated.sections.some(s => s.type === 'faq'),
          breadcrumb: true,
        },
      },
      pillar: generated.pillar,
      tags: generated.tags,
      status: 'published', // Auto-publish
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      views: 0,
      shares: 0,
      aiGenerated: true,
    };

    const docRef = await db.collection(collection).add(blogPost);
    const createdBlog: BlogPost = {
      id: docRef.id,
      ...blogPost,
    };

    console.log(`   ✅ Blog created: ${docRef.id}`);

    // Update queue item
    await updateBlogQueueStatus(brand, queueItem.id, 'generated', {
      generatedBlogId: docRef.id,
    });

    // Schedule to all social media platforms
    console.log(`   📱 Scheduling to social media...`);
    const socialResult = await autoScheduleBlogToSocial(createdBlog, 0); // Post today

    if (socialResult.success) {
      console.log(`   ✅ Scheduled to ${socialResult.scheduledPosts.length} platforms`);
      socialResult.scheduledPosts.forEach(post => {
        console.log(`      - ${post.platform}: ${post.scheduledFor.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })} CST`);
      });

      // Mark as scheduled
      await updateBlogQueueStatus(brand, queueItem.id, 'scheduled');
    } else {
      console.log(`   ⚠️  Social scheduling had errors:`);
      socialResult.errors.forEach(err => console.log(`      - ${err}`));
    }

    return {
      success: true,
      blogId: docRef.id,
      topic: queueItem.topic,
      scheduledPlatforms: socialResult.scheduledPosts.length,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   ❌ Error processing ${brand} blog:`, errorMsg);

    // Try to mark queue item as failed
    try {
      const queueItem = await getNextBlogFromQueue(brand);
      if (queueItem) {
        await updateBlogQueueStatus(brand, queueItem.id, 'failed', {
          error: errorMsg,
        });
      }
    } catch (updateError) {
      console.error('Failed to update queue item:', updateError);
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Main cron handler
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🕐 Blog Generation Cron Started');
  console.log(`   Time: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST`);

  const brands: Brand[] = ['ownerfi', 'carz', 'abdullah', 'vassdistro'];
  const results: Record<string, any> = {};

  // Process each brand sequentially
  for (const brand of brands) {
    // Get queue stats first
    const stats = await getBlogQueueStats(brand);
    console.log(`\n📊 ${brand.toUpperCase()} Queue Stats:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Posted: ${stats.posted}`);
    console.log(`   Failed: ${stats.failed}`);

    if (stats.pending === 0) {
      console.log(`   ⚠️  No pending topics - skipping`);
      results[brand] = { skipped: true, reason: 'No pending topics' };
      continue;
    }

    const result = await processBrandBlog(brand);
    results[brand] = result;

    // Small delay between brands
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  const successful = Object.values(results).filter((r: any) => r.success).length;
  const failed = Object.values(results).filter((r: any) => !r.success && !r.skipped).length;
  const skipped = Object.values(results).filter((r: any) => r.skipped).length;

  console.log(`\n✅ Cron Complete`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      successful,
      failed,
      skipped,
      total: brands.length,
    },
  });
}
