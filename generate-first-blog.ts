#!/usr/bin/env tsx
/**
 * Generate First Blog Now (Manual Test)
 *
 * Bypasses queue and creates a blog immediately
 */

import { generateBlogContent } from './src/lib/blog-ai-generator';
import { generateSocialImagesFromBlog, generateOGImageUrl } from './src/lib/blog-og-generator';
import { BlogPost, generateSlug } from './src/lib/blog-models';
import { getAdminDb } from './src/lib/firebase-admin';

async function main() {
  console.log('🚀 Generating Your First Blog...\n');

  // Generate content
  const topic = "5 Common Mistakes First-Time Buyers Make With Owner Financing";
  console.log(`📝 Topic: ${topic}`);
  console.log('🤖 Calling OpenAI GPT-4o...\n');

  const generated = await generateBlogContent({
    brand: 'ownerfi',
    topic,
    pillar: 'owner-finance-101',
    targetLength: 'medium',
  });

  console.log(`✅ Blog generated!`);
  console.log(`   Title: ${generated.title}`);
  console.log(`   Words: ~${generated.estimatedReadTime * 250}`);
  console.log(`   Sections: ${generated.sections.length}`);
  console.log(`   Steps: ${generated.sections.find(s => s.type === 'steps')?.bullets?.length}\n`);

  // Generate social images
  const socialImages = generateSocialImagesFromBlog('ownerfi', generated.title, generated.sections);
  console.log(`📸 Generated ${socialImages.length} social images`);

  // Populate image URLs
  socialImages.forEach(img => {
    img.generatedUrl = generateOGImageUrl({
      width: img.type === 'carousel-slide' ? 1080 : 1080,
      height: img.type === 'carousel-slide' ? 1920 : 1080,
      brand: 'ownerfi',
      type: img.type,
      title: img.title,
      content: img.content,
      slideNumber: img.slideNumber,
      totalSlides: img.totalSlides,
    });
  });

  // Create blog post
  const now = new Date();
  const blogPost: Omit<BlogPost, 'id'> = {
    brand: 'ownerfi',
    slug: generateSlug(generated.title),
    title: generated.title,
    subtitle: generated.subtitle,
    author: generated.author,
    sections: generated.sections,
    socialImages,
    seo: {
      metaTitle: generated.title.substring(0, 60),
      metaDescription: generated.subtitle || '',
      focusKeyword: generated.focusKeyword,
      keywords: generated.tags,
      ogImage: generateOGImageUrl({
        width: 1200,
        height: 630,
        brand: 'ownerfi',
        type: 'blog-hero',
        title: generated.title,
        subtitle: generated.subtitle,
      }),
      schema: {
        article: true,
        faq: true,
        breadcrumb: true,
      },
    },
    pillar: generated.pillar,
    tags: generated.tags,
    status: 'published',
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    views: 0,
    shares: 0,
    aiGenerated: true,
  };

  // Save to Firestore
  console.log('\n💾 Saving to Firestore...');
  const db = await getAdminDb();

  if (!db) {
    console.log('\n⚠️  Firebase not initialized - skipping database save');
    console.log('📝 Blog content generated successfully but not saved');
    console.log('\n✅ To save to database:');
    console.log('   1. Make sure Firebase env vars are set in Vercel');
    console.log('   2. Deploy and use the API endpoint instead');
    return;
  }

  const docRef = await db.collection('ownerfi_blog_posts').add(blogPost);

  console.log(`✅ Blog saved to Firestore!`);
  console.log(`   ID: ${docRef.id}`);
  console.log(`   Slug: ${blogPost.slug}`);
  console.log(`\n🌐 View at: https://ownerfi.ai/blog/${blogPost.slug}?brand=ownerfi`);
  console.log(`\n📱 Social images generated:`);
  socialImages.forEach((img, i) => {
    console.log(`   ${i + 1}. ${img.type}: ${img.title.substring(0, 50)}...`);
  });
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
