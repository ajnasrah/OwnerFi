/**
 * Blog OG Image Generator
 *
 * Generates Open Graph images and social media picture posts from blog content
 * Uses Vercel's OG Image generation (built into Next.js)
 */

import { Brand } from '@/config/constants';
import { SocialImage, BlogSection } from './blog-models';

/**
 * Brand color schemes for OG images
 */
export const BRAND_COLORS = {
  ownerfi: {
    primary: '#10b981', // emerald-500
    secondary: '#3b82f6', // blue-500
    background: '#0f172a', // slate-900
    text: '#ffffff',
    accent: '#34d399', // emerald-400
  },
  carz: {
    primary: '#ef4444', // red-500
    secondary: '#1f2937', // gray-800
    background: '#000000',
    text: '#ffffff',
    accent: '#f87171', // red-400
  },
  abdullah: {
    primary: '#6366f1', // indigo-500
    secondary: '#f59e0b', // amber-500
    background: '#1e293b', // slate-800
    text: '#ffffff',
    accent: '#818cf8', // indigo-400
  },
  vassdistro: {
    primary: '#8b5cf6', // violet-500
    secondary: '#ec4899', // pink-500
    background: '#18181b', // zinc-900
    text: '#ffffff',
    accent: '#a78bfa', // violet-400
  },
  // Default for other brands
  default: {
    primary: '#3b82f6', // blue-500
    secondary: '#10b981', // emerald-500
    background: '#0f172a', // slate-900
    text: '#ffffff',
    accent: '#60a5fa', // blue-400
  },
} as const;

/**
 * Get brand colors
 */
export function getBrandColors(brand: Brand) {
  return BRAND_COLORS[brand as keyof typeof BRAND_COLORS] || BRAND_COLORS.default;
}

/**
 * OG Image Configuration
 */
export interface OGImageConfig {
  width: number;
  height: number;
  brand: Brand;
  type: 'blog-hero' | 'carousel-slide' | 'quote-card' | 'faq-card' | 'story-card';
  title: string;
  subtitle?: string;
  content?: string;
  slideNumber?: number;
  totalSlides?: number;
  logoUrl?: string;
}

/**
 * Generate OG Image URL (for Vercel OG)
 */
export function generateOGImageUrl(config: OGImageConfig): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  const params = new URLSearchParams({
    type: config.type,
    brand: config.brand,
    title: config.title,
    ...(config.subtitle && { subtitle: config.subtitle }),
    ...(config.content && { content: config.content }),
    ...(config.slideNumber && { slide: config.slideNumber.toString() }),
    ...(config.totalSlides && { total: config.totalSlides.toString() }),
  });

  return `${baseUrl}/api/og?${params.toString()}`;
}

/**
 * Generate HTML/CSS for OG Image (for satori rendering)
 */
export function generateOGImageHTML(config: OGImageConfig): string {
  const colors = getBrandColors(config.brand);

  if (config.type === 'blog-hero') {
    return `
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background: linear-gradient(135deg, ${colors.background} 0%, ${colors.primary} 100%); padding: 60px; color: ${colors.text}; font-family: Inter, sans-serif;">
        <div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
          <h1 style="font-size: 72px; font-weight: bold; margin: 0 0 24px 0; line-height: 1.1;">${config.title}</h1>
          ${config.subtitle ? `<p style="font-size: 36px; opacity: 0.9; margin: 0;">${config.subtitle}</p>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 16px; margin-top: auto;">
          <div style="width: 48px; height: 48px; background: ${colors.accent}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">${config.brand[0].toUpperCase()}</div>
          <span style="font-size: 32px; font-weight: 600;">${config.brand === 'ownerfi' ? 'OwnerFi' : config.brand === 'carz' ? 'Carz Inc' : config.brand === 'abdullah' ? 'Abdullah' : config.brand.charAt(0).toUpperCase() + config.brand.slice(1)}</span>
        </div>
      </div>
    `;
  }

  if (config.type === 'carousel-slide') {
    const isFirstSlide = config.slideNumber === 1;
    const isLastSlide = config.slideNumber === config.totalSlides;

    return `
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background: ${colors.background}; padding: 60px; color: ${colors.text}; font-family: Inter, sans-serif; position: relative;">
        ${!isFirstSlide ? `<div style="position: absolute; top: 40px; right: 60px; background: ${colors.primary}; color: white; padding: 12px 24px; border-radius: 999px; font-size: 24px; font-weight: bold;">${config.slideNumber} / ${config.totalSlides}</div>` : ''}

        <div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
          ${isFirstSlide ? `
            <h1 style="font-size: 64px; font-weight: bold; margin: 0 0 24px 0; line-height: 1.1; color: ${colors.accent};">${config.title}</h1>
          ` : `
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
              <div style="width: 64px; height: 64px; background: ${colors.primary}; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 36px;">${config.slideNumber! - 1}</div>
              <h2 style="font-size: 48px; font-weight: bold; margin: 0;">${config.title}</h2>
            </div>
          `}

          <p style="font-size: ${isFirstSlide ? '42px' : '36px'}; line-height: 1.5; margin: 0; ${isFirstSlide ? `opacity: 0.9;` : ''}">${config.content}</p>
        </div>

        <div style="display: flex; align-items: center; gap: 16px; margin-top: auto;">
          <div style="width: 40px; height: 40px; background: ${colors.accent}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">${config.brand[0].toUpperCase()}</div>
          <span style="font-size: 28px; font-weight: 600;">${config.brand === 'ownerfi' ? 'OwnerFi' : config.brand === 'carz' ? 'Carz Inc' : config.brand === 'abdullah' ? 'Abdullah' : config.brand.charAt(0).toUpperCase() + config.brand.slice(1)}</span>
        </div>
      </div>
    `;
  }

  if (config.type === 'quote-card') {
    return `
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%); padding: 60px; color: ${colors.text}; font-family: Inter, sans-serif; justify-content: center; align-items: center; text-align: center;">
        <div style="font-size: 120px; opacity: 0.3; margin-bottom: -40px;">"</div>
        <p style="font-size: 48px; line-height: 1.4; margin: 0 0 40px 0; max-width: 900px; font-weight: 500;">${config.content}</p>
        <div style="width: 100px; height: 4px; background: ${colors.accent}; border-radius: 2px; margin-bottom: 32px;"></div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: ${colors.accent}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">${config.brand[0].toUpperCase()}</div>
          <span style="font-size: 32px; font-weight: 600;">${config.brand === 'ownerfi' ? 'OwnerFi' : config.brand === 'carz' ? 'Carz Inc' : config.brand === 'abdullah' ? 'Abdullah' : config.brand.charAt(0).toUpperCase() + config.brand.slice(1)}</span>
        </div>
      </div>
    `;
  }

  if (config.type === 'faq-card') {
    return `
      <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background: ${colors.background}; padding: 60px; color: ${colors.text}; font-family: Inter, sans-serif;">
        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 48px;">
          <div style="width: 56px; height: 56px; background: ${colors.primary}; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 32px;">?</div>
          <h2 style="font-size: 52px; font-weight: bold; margin: 0; color: ${colors.accent};">${config.title}</h2>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
          <p style="font-size: 38px; line-height: 1.6; margin: 0;">${config.content}</p>
        </div>

        <div style="display: flex; align-items: center; gap: 16px; margin-top: auto;">
          <div style="width: 40px; height: 40px; background: ${colors.accent}; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px;">${config.brand[0].toUpperCase()}</div>
          <span style="font-size: 28px; font-weight: 600;">${config.brand === 'ownerfi' ? 'OwnerFi' : config.brand === 'carz' ? 'Carz Inc' : config.brand === 'abdullah' ? 'Abdullah' : config.brand.charAt(0).toUpperCase() + config.brand.slice(1)}</span>
        </div>
      </div>
    `;
  }

  // Default fallback
  return `
    <div style="display: flex; width: 100%; height: 100%; background: ${colors.background}; padding: 60px; color: ${colors.text}; font-family: Inter, sans-serif; align-items: center; justify-content: center;">
      <h1 style="font-size: 72px; font-weight: bold;">${config.title}</h1>
    </div>
  `;
}

/**
 * Generate social images from blog sections
 */
export function generateSocialImagesFromBlog(
  brand: Brand,
  title: string,
  sections: BlogSection[]
): SocialImage[] {
  const images: SocialImage[] = [];

  // Find steps section for carousel
  const stepsSection = sections.find(s => s.type === 'steps' && s.bullets && s.bullets.length > 0);
  if (stepsSection && stepsSection.bullets) {
    // First slide: Hook
    images.push({
      id: 'slide-1',
      type: 'carousel-slide',
      title: title,
      content: stepsSection.heading,
      slideNumber: 1,
      totalSlides: stepsSection.bullets.length + 2, // +1 for hook, +1 for CTA
    });

    // Middle slides: Steps
    stepsSection.bullets.forEach((bullet, index) => {
      images.push({
        id: `slide-${index + 2}`,
        type: 'carousel-slide',
        title: `Step ${index + 1}`,
        content: bullet,
        slideNumber: index + 2,
        totalSlides: stepsSection.bullets!.length + 2,
      });
    });

    // Last slide: CTA
    const ctaSection = sections.find(s => s.type === 'cta');
    images.push({
      id: `slide-${stepsSection.bullets.length + 2}`,
      type: 'carousel-slide',
      title: 'Next Step',
      content: ctaSection?.content || `Visit ${brand === 'ownerfi' ? 'OwnerFi.ai' : brand === 'carz' ? 'CarzInc.com' : 'the link in bio'} to learn more`,
      slideNumber: stepsSection.bullets.length + 2,
      totalSlides: stepsSection.bullets.length + 2,
    });
  }

  // Quote card from hook
  const hookSection = sections.find(s => s.type === 'hook');
  if (hookSection) {
    images.push({
      id: 'quote-hook',
      type: 'quote-card',
      title: 'Did You Know?',
      content: hookSection.content.substring(0, 200), // Limit for readability
    });
  }

  // FAQ card
  const faqSection = sections.find(s => s.type === 'faq');
  if (faqSection) {
    images.push({
      id: 'faq-card',
      type: 'faq-card',
      title: 'Common Questions',
      content: faqSection.content.substring(0, 300),
    });
  }

  return images;
}

/**
 * Caption generator for social media posts
 */
export function generateSocialCaption(
  brand: Brand,
  title: string,
  blogSlug: string,
  sections: BlogSection[]
): string {
  const hookSection = sections.find(s => s.type === 'hook');
  const hook = hookSection?.content.substring(0, 150) || title;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ownerfi.ai';
  const blogUrl = `${baseUrl}/${brand}/blog/${blogSlug}`;

  // Brand-specific hashtags
  const hashtags = {
    ownerfi: '#OwnerFinancing #RealEstate #Homeownership #OwnerFi #AlternativeFinancing',
    carz: '#Cars #Automotive #CarBuying #CarzInc #UsedCars',
    abdullah: '#Entrepreneurship #RealEstate #Business #PersonalGrowth #Abdullah',
    vassdistro: '#Vape #Wholesale #VapeBusiness #VassDistro #B2B',
  };

  const brandHashtags = hashtags[brand as keyof typeof hashtags] || '#Business';

  return `${hook}

Swipe through to learn more ➡️

Full article (link in bio):
${blogUrl}

${brandHashtags}`;
}

/**
 * Download image from URL (for storage)
 */
export async function downloadOGImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
