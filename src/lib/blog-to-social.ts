/**
 * Blog to Social Media Automation
 *
 * Automatically converts blog posts into social media posts and schedules them
 * to ALL platforms (Instagram, TikTok, Facebook, LinkedIn, Twitter, Threads) at optimal times
 */

import { Brand } from '@/config/constants';
import { BlogPost, generateSocialCaption } from './blog-models';
import { generateOGImageUrl, downloadOGImage } from './blog-og-generator';
import { postToLate, LatePostRequest } from './late-api';
import { uploadVideoToR2 } from './video-storage';
import { PLATFORM_OPTIMAL_HOURS } from '@/config/platform-optimal-times';

/**
 * Platform optimal times (targeting 25-40 year old demographic)
 */
const OPTIMAL_POSTING_TIMES = {
  // All times in CST (primary audience timezone)
  instagram: [8, 12, 17, 19, 21], // 8 AM, 12 PM, 5 PM, 7 PM, 9 PM - peak engagement times
  facebook: [9, 12, 13, 15, 18], // 9 AM, 12 PM, 1 PM, 3 PM, 6 PM - lunch & after work
  linkedin: [7, 8, 12, 17, 18], // 7-8 AM commute, 12 PM lunch, 5-6 PM after work
  twitter: [8, 12, 15, 17, 19], // Throughout day, peaks at 8 AM, 12 PM, 5 PM, 7 PM
  threads: [8, 12, 17, 19, 21], // Same as Instagram (Meta owns both)
  tiktok: [7, 11, 19, 21, 22], // 7 AM commute, 11 AM break, 7-10 PM prime time
  youtube: [14, 18, 19, 20], // 2 PM, 6-8 PM prime viewing hours
};

/**
 * Get optimal posting time for platform on a specific day
 */
function getOptimalTimeForPlatform(platform: string, dayOffset: number = 0): Date {
  const times = OPTIMAL_POSTING_TIMES[platform.toLowerCase() as keyof typeof OPTIMAL_POSTING_TIMES] || [19];

  // Use the best time (last in array = prime time)
  const hour = times[times.length - 1];

  const now = new Date();
  const cstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));

  const scheduled = new Date(cstNow);
  scheduled.setDate(scheduled.getDate() + dayOffset);
  scheduled.setHours(hour, 0, 0, 0);

  // If time has passed today, move to tomorrow
  if (dayOffset === 0 && scheduled <= cstNow) {
    scheduled.setDate(scheduled.getDate() + 1);
  }

  return scheduled;
}

/**
 * Convert blog carousel images to video format for social posting
 * (Creates a simple slideshow video from the carousel images)
 */
async function generateCarouselVideo(
  brand: Brand,
  blogPost: BlogPost
): Promise<string> {
  // Find carousel images
  const carouselImages = blogPost.socialImages.filter(img => img.type === 'carousel-slide');

  if (carouselImages.length === 0) {
    throw new Error('No carousel images found in blog post');
  }

  // For now, use the first slide as a static image
  // TODO: Enhance this to create actual video slideshow using ffmpeg or similar
  const firstSlideUrl = carouselImages[0].generatedUrl;

  if (!firstSlideUrl) {
    throw new Error('Carousel slide URL not generated');
  }

  return firstSlideUrl;
}

/**
 * All platforms to post to (25-40 demographic targets)
 */
const ALL_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'twitter', 'threads'] as const;
type SocialPlatform = typeof ALL_PLATFORMS[number];

/**
 * Schedule blog post to all social media platforms at optimal times
 */
export async function scheduleBlogToSocial(
  blogPost: BlogPost,
  options: {
    platforms?: SocialPlatform[];
    startDayOffset?: number; // Start posting N days from now (default: 0 = today)
    staggerHours?: boolean; // Stagger posts across different hours (default: true)
  } = {}
): Promise<{
  success: boolean;
  scheduledPosts: Array<{
    platform: string;
    scheduledFor: Date;
    postId?: string;
  }>;
  errors: string[];
}> {
  const {
    platforms = ALL_PLATFORMS as any,
    startDayOffset = 0,
    staggerHours = true,
  } = options;

  const scheduledPosts: Array<{
    platform: string;
    scheduledFor: Date;
    postId?: string;
  }> = [];
  const errors: string[] = [];

  console.log('📱 Scheduling blog to social media...');
  console.log(`   Blog: ${blogPost.title}`);
  console.log(`   Brand: ${blogPost.brand}`);
  console.log(`   Platforms: ${platforms.join(', ')}`);

  try {
    // Generate caption from blog
    const caption = generateSocialCaption(
      blogPost.brand,
      blogPost.title,
      blogPost.slug,
      blogPost.sections
    );

    // Get carousel video URL (using first slide for now)
    const videoUrl = await generateCarouselVideo(blogPost.brand, blogPost);

    // Schedule to each platform at optimal time
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];

      // Stagger across different days if needed
      const dayOffset = staggerHours ? startDayOffset + Math.floor(i / 3) : startDayOffset;
      const scheduledTime = getOptimalTimeForPlatform(platform, dayOffset);

      try {
        console.log(`   → ${platform.toUpperCase()}: ${scheduledTime.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short'
        })}`);

        const postRequest: LatePostRequest = {
          videoUrl,
          caption,
          title: blogPost.title,
          platforms: [platform] as any,
          scheduleTime: scheduledTime.toISOString(),
          brand: blogPost.brand as any,
          timezone: 'America/Chicago',
        };

        const result = await postToLate(postRequest);

        if (result.success) {
          scheduledPosts.push({
            platform,
            scheduledFor: scheduledTime,
            postId: result.postId,
          });
          console.log(`   ✅ Scheduled to ${platform}`);
        } else {
          errors.push(`${platform}: ${result.error || 'Unknown error'}`);
          console.log(`   ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${platform}: ${errorMsg}`);
        console.log(`   ❌ Error: ${errorMsg}`);
      }

      // Small delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const success = scheduledPosts.length > 0;

    console.log(`\n📊 Results:`);
    console.log(`   ✅ Scheduled: ${scheduledPosts.length}/${platforms.length} platforms`);
    if (errors.length > 0) {
      console.log(`   ❌ Errors: ${errors.length}`);
    }

    return {
      success,
      scheduledPosts,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to schedule blog to social:', errorMsg);
    return {
      success: false,
      scheduledPosts,
      errors: [errorMsg, ...errors],
    };
  }
}

/**
 * Get brand-specific platform preferences (targeting 25-40 demo)
 */
function getBrandPlatformPriority(brand: Brand): SocialPlatform[] {
  switch (brand) {
    case 'ownerfi':
      // Real estate: Instagram (visual), Facebook (older demo), LinkedIn (professional)
      return ['instagram', 'facebook', 'linkedin', 'threads', 'twitter'];

    case 'carz':
      // Cars: Instagram (visual), Facebook (marketplace), Twitter (quick updates)
      return ['instagram', 'facebook', 'twitter', 'threads', 'linkedin'];

    case 'abdullah':
      // Personal brand: Instagram (lifestyle), LinkedIn (professional), Twitter (thoughts)
      return ['instagram', 'linkedin', 'twitter', 'threads', 'facebook'];

    case 'vassdistro':
      // B2B vape: LinkedIn (B2B), Instagram (visual products), Facebook (groups)
      return ['linkedin', 'instagram', 'facebook', 'twitter', 'threads'];

    default:
      return ['instagram', 'facebook', 'linkedin', 'twitter', 'threads'];
  }
}

/**
 * Auto-schedule blog with brand-specific platform strategy
 */
export async function autoScheduleBlogToSocial(
  blogPost: BlogPost,
  startInDays: number = 0
): Promise<{
  success: boolean;
  scheduledPosts: Array<{
    platform: string;
    scheduledFor: Date;
    postId?: string;
  }>;
  errors: string[];
}> {
  // Get platform priority for this brand
  const platforms = getBrandPlatformPriority(blogPost.brand);

  console.log(`🎯 Auto-scheduling for ${blogPost.brand} (25-40 demo)`);
  console.log(`   Platform strategy: ${platforms.join(' → ')}`);

  return scheduleBlogToSocial(blogPost, {
    platforms,
    startDayOffset: startInDays,
    staggerHours: true, // Spread across optimal times
  });
}

/**
 * Schedule blog post immediately to all platforms
 */
export async function postBlogToSocialNow(
  blogPost: BlogPost
): Promise<{
  success: boolean;
  scheduledPosts: Array<{
    platform: string;
    scheduledFor: Date;
    postId?: string;
  }>;
  errors: string[];
}> {
  return scheduleBlogToSocial(blogPost, {
    platforms: getBrandPlatformPriority(blogPost.brand),
    startDayOffset: 0,
    staggerHours: false, // Post all at next available optimal time
  });
}
