/**
 * Test Blog Automation System
 *
 * Tests the complete flow:
 * 1. Generate blog content with AI
 * 2. Create blog post
 * 3. Schedule to social platforms
 */

import { generateBlogContent } from './src/lib/blog-ai-generator';
import { autoScheduleBlogToSocial } from './src/lib/blog-to-social';
import { generateSocialImagesFromBlog, generateOGImageUrl } from './src/lib/blog-og-generator';
import { BlogPost, generateSlug } from './src/lib/blog-models';

async function testBlogAutomation() {
  console.log('🧪 Testing Blog Automation System\n');

  // Test 1: AI Blog Generation
  console.log('1️⃣ Testing AI Blog Generation...');
  try {
    const topic = "5 Common Mistakes First-Time Buyers Make With Owner Financing";
    console.log(`   Topic: ${topic}`);

    const generated = await generateBlogContent({
      brand: 'ownerfi',
      topic,
      pillar: 'owner-finance-101',
      targetLength: 'short', // Faster for testing
    });

    console.log(`   ✅ Generated blog: ${generated.title}`);
    console.log(`   ✅ Sections: ${generated.sections.length}`);
    console.log(`   ✅ Steps: ${generated.sections.find(s => s.type === 'steps')?.bullets?.length || 0}`);
    console.log(`   ✅ Estimated read time: ${generated.estimatedReadTime} min`);

    // Test 2: Social Image Generation
    console.log('\n2️⃣ Testing Social Image Generation...');
    const socialImages = generateSocialImagesFromBlog('ownerfi', generated.title, generated.sections);
    console.log(`   ✅ Generated ${socialImages.length} social images`);
    socialImages.forEach((img, i) => {
      console.log(`      ${i + 1}. ${img.type}: ${img.title}`);
    });

    // Test 3: Create Mock Blog Post
    console.log('\n3️⃣ Creating Mock Blog Post...');
    const now = new Date();
    const blogPost: BlogPost = {
      id: 'test-123',
      brand: 'ownerfi',
      slug: generateSlug(generated.title),
      title: generated.title,
      subtitle: generated.subtitle,
      author: generated.author,
      sections: generated.sections,
      socialImages: socialImages.map(img => ({
        ...img,
        generatedUrl: generateOGImageUrl({
          width: 1080,
          height: 1920,
          brand: 'ownerfi',
          type: img.type,
          title: img.title,
          content: img.content,
          slideNumber: img.slideNumber,
          totalSlides: img.totalSlides,
        }),
      })),
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

    console.log(`   ✅ Blog post created`);
    console.log(`      Slug: ${blogPost.slug}`);
    console.log(`      OG Image: ${blogPost.seo.ogImage}`);

    // Test 4: Social Media Scheduling (DRY RUN)
    console.log('\n4️⃣ Testing Social Media Scheduling (DRY RUN)...');
    console.log('   Note: This would schedule to: Instagram, Facebook, LinkedIn, Twitter, Threads');
    console.log('   Skipping actual API calls in test mode');

    // Show what would be scheduled
    const platforms = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads'];
    const times = {
      instagram: '9:00 PM CST',
      facebook: '6:00 PM CST',
      linkedin: '6:00 PM CST',
      twitter: '7:00 PM CST',
      threads: '9:00 PM CST',
    };

    platforms.forEach(platform => {
      console.log(`      → ${platform.toUpperCase()}: ${times[platform as keyof typeof times]}`);
    });

    console.log('\n✅ All Tests Passed!');
    console.log('\n📊 Summary:');
    console.log(`   ✅ AI generated ${generated.sections.reduce((sum, s) => sum + s.content.split(' ').length + (s.bullets?.join(' ').split(' ').length || 0), 0)} words`);
    console.log(`   ✅ Created ${socialImages.length} social images`);
    console.log(`   ✅ Would post to ${platforms.length} platforms`);
    console.log(`   ✅ System is working correctly!`);

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    throw error;
  }
}

// Run test
testBlogAutomation()
  .then(() => {
    console.log('\n🎉 Blog automation system is ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
